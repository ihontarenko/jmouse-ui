import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { Icon } from "../icons/Icon"
import { highlightSource, splitSourceLines, type SourceMatch, type SyntaxLanguage, type SyntaxSegment } from "../lib/syntax"

/** What version control knows about the lines of a file; `added: "all"` is a file that is new as a whole. */
export interface LineChanges {
  added?: number[] | "all"
  modified?: number[]
  deleted?: number[]
}

export type ProblemSeverity = "danger" | "warn" | "weak"

export interface CodeProblem {
  severity: ProblemSeverity
  line: number
  message: string
}

export interface CaretPosition {
  line: number
  column: number
}

export interface CodeViewProperties {
  source: string
  language: SyntaxLanguage
  /** The region's name — the file's name and how many lines it has. */
  label: string
  changes?: LineChanges
  breakpoints?: number[]
  onBreakpointToggle?(line: number): void
  /** Ranges that can be folded: [first line, last line], 1-based. */
  folds?: Array<[number, number]>
  /** Code vision: a quiet line of words above a declaration — its usages, its author. */
  vision?: Record<number, string>
  onVisionActivate?(line: number): void
  /** Drives the inspection widget in the corner and the warning marks on the error stripe. */
  problems?: CodeProblem[]
  onInspectionActivate?(): void
  caret: CaretPosition
  onCaretChange(caret: CaretPosition): void
  /** Changes whenever the caret must be brought to the middle of the view — a jump, not a step. */
  revealSerial?: number
  /** The find bar's occurrences and which of them is current. */
  matches?: SourceMatch[]
  currentMatch?: number
  /** A popup under the caret line — completion. */
  popup?: ReactNode
  /** Indent guides and the right margin at 120 columns. */
  guides?: boolean
  labels?: Partial<Record<"fold" | "unfold" | "noProblems" | "problems", string>>
}

function changeOf(changes: LineChanges | undefined, line: number): "added" | "modified" | "deleted" | undefined {
  if (!changes) {
    return undefined
  }
  if (changes.added === "all") {
    return "added"
  }
  if (changes.added?.includes(line)) {
    return "added"
  }
  if (changes.modified?.includes(line)) {
    return "modified"
  }
  if (changes.deleted?.includes(line)) {
    return "deleted"
  }
  return undefined
}

/** The caret's column inside a line's text: the characters before the selection point, inlay hints left out. */
function columnInside(text: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !text.contains(selection.anchorNode)) {
    return 1
  }
  const range = document.createRange()
  range.setStart(text, 0)
  range.setEnd(selection.anchorNode, selection.anchorOffset)
  const contents = range.cloneContents()
  contents.querySelectorAll(".kit-code-inlay").forEach((inlay) => inlay.remove())
  return (contents.textContent ?? "").length + 1
}

const roleClass = (role: string | undefined) => (role ? `kit-syntax-${role}` : undefined)

/**
 * Draws one line's segments, cutting the find bar's occurrences out of them. Offsets are counted in the line's plain
 * text, so an inlay hint or the caret marker never moves a match.
 */
function renderSegments(segments: SyntaxSegment[], ranges: Array<SourceMatch & { current: boolean }>): ReactNode[] {
  const nodes: ReactNode[] = []
  let offset = 0
  segments.forEach((segment, segmentIndex) => {
    if (segment.kind === "inlay") {
      nodes.push(<span key={segmentIndex} className="kit-code-inlay">{segment.text}</span>)
      return
    }
    if (segment.kind === "caret") {
      nodes.push(<span key={segmentIndex} className="kit-code-caret" aria-hidden="true" />)
      return
    }
    const start = offset
    const end = offset + segment.text.length
    offset = end
    const pieces: ReactNode[] = []
    let cursor = start
    for (const range of ranges) {
      if (range.end <= cursor || range.start >= end) {
        continue
      }
      const from = Math.max(range.start, cursor)
      const to = Math.min(range.end, end)
      if (from > cursor) {
        pieces.push(segment.text.slice(cursor - start, from - start))
      }
      pieces.push(<span key={`${segmentIndex}-${from}`} className="kit-code-match" data-current={range.current ? "" : undefined}>{segment.text.slice(from - start, to - start)}</span>)
      cursor = to
    }
    if (cursor < end) {
      pieces.push(segment.text.slice(cursor - start))
    }
    if (segment.kind === "warning") {
      nodes.push(<span key={segmentIndex} className="kit-code-warning">{pieces}</span>)
    } else {
      nodes.push(<span key={segmentIndex} className={roleClass(segment.role)}>{pieces}</span>)
    }
  })
  return nodes
}

/**
 * Code on the kit's canvas, drawn as Burin draws it: a gutter that sticks to the left edge (a breakpoint slot, the line
 * number, the version-control mark, the fold toggle), code-vision lines above declarations, inlay hints, the caret line,
 * folding, the find bar's occurrences, the inspection widget in the corner and the error stripe along the scrollbar.
 * Up and Down move the caret over the visible lines; Ctrl+F8 toggles a breakpoint on it.
 */
export function CodeView({ source, language, label, changes, breakpoints = [], onBreakpointToggle, folds = [], vision = {}, onVisionActivate, problems, onInspectionActivate, caret, onCaretChange, revealSerial, matches = [], currentMatch = -1, popup, guides = true, labels = {} }: CodeViewProperties) {
  const text = { fold: "Fold lines", unfold: "Unfold lines", noProblems: "No problems in this file", problems: "open the Problems tool window", ...labels }
  const scrollerReference = useRef<HTMLDivElement>(null)
  const hostReference = useRef<HTMLDivElement>(null)
  const sourceLines = useMemo(() => splitSourceLines(source), [source])
  const highlighted = useMemo(() => highlightSource(source, language), [source, language])
  const [folded, setFolded] = useState<Set<number>>(() => new Set())
  const [popupPosition, setPopupPosition] = useState<CSSProperties>({})
  const foldEnds = useMemo(() => new Map(folds.map(([start, end]) => [start, end])), [folds])
  const breakpointSet = useMemo(() => new Set(breakpoints), [breakpoints])

  useEffect(() => {
    setFolded(new Set())
  }, [source])

  const hiddenLines = useMemo(() => {
    const hidden = new Set<number>()
    for (const start of folded) {
      const end = foldEnds.get(start) ?? start
      for (let line = start + 1; line <= end; line++) {
        hidden.add(line)
      }
    }
    return hidden
  }, [folded, foldEnds])

  const lineElement = (line: number) => hostReference.current?.querySelector<HTMLElement>(`[data-line="${line}"]`)

  useEffect(() => {
    if (revealSerial === undefined) {
      return
    }
    lineElement(caret.line)?.scrollIntoView({ block: "center" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealSerial])

  useEffect(() => {
    if (currentMatch < 0 || !matches[currentMatch]) {
      return
    }
    hostReference.current?.querySelector(".kit-code-match[data-current]")?.scrollIntoView({ block: "center", inline: "nearest" })
  }, [currentMatch, matches])

  useLayoutEffect(() => {
    if (!popup) {
      return
    }
    const line = lineElement(caret.line)
    const frame = scrollerReference.current?.parentElement
    if (!line || !frame) {
      return
    }
    const bounds = line.getBoundingClientRect()
    const host = frame.getBoundingClientRect()
    const textStart = line.querySelector(".kit-code-text")?.getBoundingClientRect().left ?? bounds.left
    /* fixed to the viewport, so a tool window under the editor never clips it */
    setPopupPosition({ top: bounds.bottom + 2, left: Math.max(host.left + 8, Math.min(textStart + 120, host.right - 540)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, caret.line])

  function toggleFold(start: number) {
    setFolded((current) => {
      const next = new Set(current)
      if (next.has(start)) {
        next.delete(start)
      } else {
        next.add(start)
      }
      return next
    })
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const lineNode = target.closest<HTMLElement>("[data-line]")
    if (!lineNode) {
      return
    }
    const line = Number(lineNode.dataset.line)
    if (target.closest(".kit-code-fold")) {
      toggleFold(line)
      return
    }
    if (target.closest(".kit-code-breakpoint-slot, .kit-code-number")) {
      onBreakpointToggle?.(line)
      return
    }
    onCaretChange({ line, column: columnInside(lineNode.querySelector<HTMLElement>(".kit-code-text")!) })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      let next = caret.line + step
      while (next >= 1 && next <= sourceLines.length && hiddenLines.has(next)) {
        next += step
      }
      if (next >= 1 && next <= sourceLines.length) {
        onCaretChange({ line: next, column: caret.column })
        requestAnimationFrame(() => lineElement(next)?.scrollIntoView({ block: "nearest" }))
      }
    }
    if (event.ctrlKey && event.key === "F8") {
      event.preventDefault()
      onBreakpointToggle?.(caret.line)
    }
  }

  const stripeMarks: Array<{ line: number; kind: string }> = []
  if (Array.isArray(changes?.modified)) {
    changes.modified.forEach((line) => stripeMarks.push({ line, kind: "modified" }))
  }
  if (Array.isArray(changes?.added)) {
    changes.added.forEach((line) => stripeMarks.push({ line, kind: "added" }))
  }
  problems?.forEach((problem) => stripeMarks.push({ line: problem.line, kind: "warn" }))
  matches.forEach((match) => stripeMarks.push({ line: match.line, kind: "match" }))

  const count = (severity: ProblemSeverity) => problems?.filter((problem) => problem.severity === severity).length ?? 0
  const errors = count("danger")
  const warnings = count("warn")
  const weak = count("weak")

  return (
    <div className="kit-code-view">
      <div ref={scrollerReference} className="kit-code-scroll" tabIndex={0} role="region" aria-label={label} onKeyDown={onKeyDown}>
        <div ref={hostReference} className="kit-code" role="document" data-guides={guides ? "" : undefined} onClick={onClick}>
          {highlighted.map((segments, index) => {
            const line = index + 1
            if (hiddenLines.has(line)) {
              return null
            }
            const indent = (sourceLines[index].match(/^ */)?.[0].length ?? 0)
            const change = changeOf(changes, line)
            const foldEnd = foldEnds.get(line)
            const isFolded = folded.has(line)
            const ranges = matches.map((match, matchIndex) => ({ ...match, current: matchIndex === currentMatch })).filter((match) => match.line === line)
            return (
              <Fragment key={line}>
                {vision[line] && (
                  <div className="kit-code-line" data-vision="" aria-hidden="true">
                    <span className="kit-code-gutter" />
                    <span className="kit-code-text">
                      <span className="kit-code-vision">
                        {sourceLines[index].match(/^\s*/)?.[0]}
                        <a href="#" onClick={(event) => {
                          event.preventDefault()
                          onVisionActivate?.(line)
                        }}>{vision[line]}</a>
                      </span>
                    </span>
                  </div>
                )}
                <div
                  className="kit-code-line"
                  data-line={line}
                  data-change={change}
                  data-current={caret.line === line ? "" : undefined}
                  data-breakpoint={breakpointSet.has(line) ? "" : undefined}
                  data-folded={isFolded ? "" : undefined}
                  style={{ ["--kit-code-indent" as string]: Math.floor(indent / 4) * 4 }}
                >
                  <span className="kit-code-gutter">
                    <span className="kit-code-breakpoint-slot" aria-hidden="true" />
                    <span className="kit-code-number">{line}</span>
                    <span className="kit-code-change" aria-hidden="true" />
                    {foldEnd !== undefined ? (
                      <span className="kit-code-fold" role="button" aria-label={`${isFolded ? text.unfold : text.fold} ${line}–${foldEnd}`}>
                        <Icon name="chevron-down" />
                      </span>
                    ) : (
                      <span />
                    )}
                  </span>
                  <span className="kit-code-text">
                    {segments.length ? renderSegments(segments, ranges) : " "}
                    {isFolded && <span className="kit-code-fold-placeholder">…</span>}
                  </span>
                </div>
              </Fragment>
            )
          })}
        </div>
      </div>
      {problems && (
        <button type="button" className="kit-inspection-widget" onClick={onInspectionActivate}>
          {problems.length === 0 ? (
            <>
              <Icon name="check" className="kit-inspection-good" />
              <span className="kit-visually-hidden">{text.noProblems}</span>
            </>
          ) : (
            <>
              {errors > 0 && <span data-severity="danger"><Icon name="error" />{errors}</span>}
              {warnings > 0 && <span data-severity="warn"><Icon name="warning" />{warnings}</span>}
              {weak > 0 && <span data-severity="weak"><Icon name="information" />{weak}</span>}
              <span className="kit-visually-hidden">{`${errors} errors, ${warnings} warnings, ${weak} weak warnings; ${text.problems}`}</span>
            </>
          )}
        </button>
      )}
      <div className="kit-error-stripe" aria-hidden="true">
        {stripeMarks.map((mark, index) => (
          <i key={index} data-kind={mark.kind} style={{ top: `${((mark.line - 1) / sourceLines.length) * 100}%` }} />
        ))}
      </div>
      {popup && <div className="kit-code-popup" style={popupPosition}>{popup}</div>}
    </div>
  )
}

/* ===================== completion ===================== */

export interface CompletionItem {
  id: string
  /** A file-type glyph — a method's "m", a field's "f". */
  glyph?: ReactNode
  name: string
  /** How many leading characters the typed prefix matched — drawn in the accent. */
  matchedLength?: number
  signature?: string
  returns?: string
}

export interface CompletionListProperties {
  label: string
  items: CompletionItem[]
  activeIndex: number
  onPick(item: CompletionItem): void
  /** The keys and the owner of the active item, under the list. */
  footer?: ReactNode
  idPrefix?: string
}

/** The completion popup's list: a listbox the editor drives with the arrow keys while focus stays in the code. */
export function CompletionList({ label, items, activeIndex, onPick, footer, idPrefix = "kit-completion" }: CompletionListProperties) {
  const listReference = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listReference.current?.querySelector(`[aria-selected="true"]`)?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])
  return (
    <div className="kit-completion" onClick={(event) => event.stopPropagation()}>
      <div ref={listReference} role="listbox" aria-label={label}>
        {items.map((item, index) => {
          const matched = item.matchedLength ?? 0
          return (
            <div key={item.id} id={`${idPrefix}-${index}`} role="option" aria-selected={index === activeIndex} onClick={() => onPick(item)}>
              {item.glyph ?? <span />}
              <span>
                <span className="kit-completion-matched">{item.name.slice(0, matched)}</span>
                {item.name.slice(matched)}
                {item.signature && <span className="kit-completion-signature">{item.signature}</span>}
              </span>
              <span className="kit-completion-returns">{item.returns}</span>
            </div>
          )
        })}
      </div>
      {footer && <div className="kit-completion-foot">{footer}</div>}
    </div>
  )
}

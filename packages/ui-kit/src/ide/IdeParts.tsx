import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react"
import { Icon, type IconSource } from "../icons/Icon"
import type { Tone } from "../controls/Button"
import { joinClassNames } from "../lib/classNames"

/* ===================== glyphs and badges ===================== */

export interface FileTypeGlyphProperties {
  /** One letter: C for a class, I for an interface, m for a method. */
  letter: string
  color: string
  /** A member — a method, a field — is a circle rather than a square. */
  round?: boolean
}

/** A file's or a member's kind as a letter in a tinted square, never a brand logo. */
export function FileTypeGlyph({ letter, color, round }: FileTypeGlyphProperties) {
  return (
    <span className="kit-file-type" data-shape={round ? "round" : undefined} style={{ ["--kit-file-type-color" as string]: color }} aria-hidden="true">
      {letter}
    </span>
  )
}

/** A project's letters in an accent square — in the title bar's widget and in the list of recent projects. */
export function ProjectBadge({ letters, tone }: { letters: string; tone?: Tone }) {
  return <span className="kit-widget-badge" data-tone={tone} aria-hidden="true">{letters}</span>
}

/* ===================== the title bar's own parts ===================== */

export interface TitleBarBrandProperties {
  /** The product's mark, drawn by the product. */
  mark?: ReactNode
  /** The word beside it; its last letter takes the accent. */
  name: string
  href?: string
  label?: string
  /** Hides the word on a phone, keeping the mark. */
  compact?: boolean
}

/** The product's mark and wordmark at the start of the title bar, leading back to its start screen. */
export function TitleBarBrand({ mark, name, href = "#", label, compact }: TitleBarBrandProperties) {
  return (
    <a className="kit-title-bar-brand" href={href} aria-label={label ?? name}>
      {mark && <span className="kit-title-bar-mark" aria-hidden="true">{mark}</span>}
      <span className="kit-wordmark" data-compact={compact ? "" : undefined}>
        {name.slice(0, -1)}
        <span className="kit-wordmark-last">{name.slice(-1)}</span>
      </span>
    </a>
  )
}

/** A run of title-bar controls that belong together — build, run, stop, debug. */
export function TitleBarGroup({ label, children }: { label?: string; children: ReactNode }) {
  return <div className="kit-title-bar-group" role={label ? "group" : undefined} aria-label={label}>{children}</div>
}

/* ===================== tool-window content ===================== */

export interface ToolTabItem {
  id: string
  label: ReactNode
  icon?: IconSource
  count?: number
  /** Goes elsewhere instead of switching — Git's "Changes" opens the commit screen. */
  href?: string
}

export interface ToolTabsProperties {
  label: string
  items: ToolTabItem[]
  selectedId: string
  /** Given, the tabs switch; left out, they only name what the window shows. */
  onSelect?(id: string): void
}

/** Content tabs in a tool window's head: Run · Debug, Local · docker, Log · Changes. */
export function ToolTabs({ label, items, selectedId, onSelect }: ToolTabsProperties) {
  return (
    <div className="kit-tool-tabs" role={onSelect ? "tablist" : "presentation"} aria-label={onSelect ? label : undefined}>
      {items.map((item) => {
        const content = (
          <>
            {item.icon && <Icon name={item.icon} />}
            {item.label}
            {item.count !== undefined && <span className="kit-tool-tab-count">{item.count}</span>}
          </>
        )
        if (item.href) {
          return <a key={item.id} className="kit-tool-tab" href={item.href}>{content}</a>
        }
        if (!onSelect) {
          return <span key={item.id} className="kit-tool-tab" aria-selected={item.id === selectedId}>{content}</span>
        }
        return (
          <button key={item.id} type="button" role="tab" className="kit-tool-tab" aria-selected={item.id === selectedId} onClick={() => onSelect(item.id)}>
            {content}
          </button>
        )
      })}
    </div>
  )
}

/** A quiet paragraph at a tool window's foot — how to add another bookmark. */
export function ToolNote({ children }: { children: ReactNode }) {
  return <p className="kit-tool-note">{children}</p>
}

export type ConsoleTone = "prompt" | "path" | "branch" | "information" | "level-info" | "level-warn" | "level-error" | "level-debug" | "exit"

export interface ConsoleProperties extends HTMLAttributes<HTMLPreElement> {
  /** Keeps the newest line in view while output streams in — the scroller is the console's parent. */
  follow?: boolean
  children: ReactNode
}

/** A process's output or a shell, in the code face; it wraps rather than scrolls sideways. */
export function Console({ follow, className, children, ...rest }: ConsoleProperties) {
  const reference = useRef<HTMLPreElement>(null)
  useLayoutEffect(() => {
    const scroller = reference.current?.parentElement
    if (follow && scroller) {
      scroller.scrollTop = scroller.scrollHeight
    }
  })
  return <pre ref={reference} className={joinClassNames("kit-console", className)} {...rest}>{children}</pre>
}

/** A run of console text in one of its voices: the prompt, a path, a log level. */
export function ConsoleText({ tone, children }: { tone: ConsoleTone; children: ReactNode }) {
  return <span data-tone={tone}>{children}</span>
}

/** The shell's waiting block cursor. */
export function ConsoleCursor() {
  return <span className="kit-console-cursor" aria-hidden="true" />
}

export interface ToolNotificationProperties {
  icon?: IconSource
  tone?: Tone
  title: ReactNode
  /** When it happened — a `<time>`'s machine value and the words shown. */
  time?: { value: string; label: string }
  /** Already seen: drawn quieter. */
  read?: boolean
  actions?: ReactNode
  children?: ReactNode
}

/** One notification in the Notifications tool window: what happened, when, and what can be done about it. */
export function ToolNotification({ icon = "information", tone, title, time, read, actions, children }: ToolNotificationProperties) {
  return (
    <article className="kit-tool-notification" data-read={read ? "" : undefined}>
      <header>
        <Icon name={icon} className="kit-tool-notification-icon" data-tone={tone} />
        <strong>{title}</strong>
        {time && <time dateTime={time.value}>{time.label}</time>}
      </header>
      {children && <p>{children}</p>}
      {actions && <div className="kit-tool-notification-actions">{actions}</div>}
    </article>
  )
}

/* ===================== commit log ===================== */

export interface CommitReference {
  kind: "head" | "remote" | "tag"
  name: string
}

export interface CommitRow {
  hash: string
  subject: string
  author: string
  date: string
  /** The column the commit sits in. */
  lane: number
  /** What it draws below itself: [from lane, to lane]. */
  edges: Array<[number, number]>
  references?: CommitReference[]
}

export interface CommitLogProperties {
  label: string
  commits: CommitRow[]
  selectedHash?: string
  onSelect?(hash: string): void
  /** One colour per lane; a lane past the end takes the last. */
  laneColors?: string[]
  headings?: Partial<Record<"graph" | "subject" | "author" | "date" | "hash", string>>
}

function laneX(lane: number) {
  return 8 + lane * 14
}

function CommitGraph({ commit, isLast, laneColors }: { commit: CommitRow; isLast: boolean; laneColors: string[] }) {
  const colorOf = (lane: number) => laneColors[Math.min(lane, laneColors.length - 1)]
  return (
    <svg viewBox="0 0 56 24" aria-hidden="true">
      {commit.edges.map(([from, to], index) => (!isLast || from !== to) ? (
        <path key={`edge-${index}`} d={`M${laneX(from)} 12 C ${laneX(from)} 20, ${laneX(to)} 18, ${laneX(to)} 28`} stroke={colorOf(Math.max(from, to))} strokeWidth="2" fill="none" />
      ) : null)}
      {commit.edges.filter(([from]) => from !== commit.lane).map(([from], index) => (
        <path key={`pass-${index}`} d={`M${laneX(from)} -4 L${laneX(from)} 12`} stroke={colorOf(from)} strokeWidth="2" />
      ))}
      <path d={`M${laneX(commit.lane)} -4 L${laneX(commit.lane)} 12`} stroke={colorOf(commit.lane)} strokeWidth="2" />
      <circle cx={laneX(commit.lane)} cy="12" r="4" fill="var(--kit-surface)" stroke={colorOf(commit.lane)} strokeWidth="2" />
    </svg>
  )
}

/**
 * The history of a branch: a graph of lanes, each commit's references, subject, author, date and hash. One row is
 * selected; Up and Down move it.
 */
export function CommitLog({ label, commits, selectedHash, onSelect, laneColors = ["var(--kit-accent)", "var(--kit-change-added)", "var(--kit-syntax-annotation)"], headings = {} }: CommitLogProperties) {
  const text = { graph: "Graph", subject: "Subject", author: "Author", date: "Date", hash: "Hash", ...headings }
  return (
    <table className="kit-commit-log" aria-label={label}>
      <thead>
        <tr>
          <th scope="col"><span className="kit-visually-hidden">{text.graph}</span></th>
          <th scope="col">{text.subject}</th>
          <th scope="col">{text.author}</th>
          <th scope="col">{text.date}</th>
          <th scope="col">{text.hash}</th>
        </tr>
      </thead>
      <tbody
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
            return
          }
          const index = commits.findIndex((commit) => commit.hash === selectedHash)
          const next = commits[index + (event.key === "ArrowDown" ? 1 : -1)]
          if (next) {
            event.preventDefault()
            onSelect?.(next.hash)
            const row = event.currentTarget.querySelector<HTMLElement>(`[data-hash="${next.hash}"]`)
            row?.focus()
          }
        }}
      >
        {commits.map((commit, index) => (
          <tr key={commit.hash} data-hash={commit.hash} tabIndex={0} aria-selected={commit.hash === selectedHash} onClick={() => onSelect?.(commit.hash)}>
            <td className="kit-commit-graph"><CommitGraph commit={commit} isLast={index === commits.length - 1} laneColors={laneColors} /></td>
            <td className="kit-commit-subject">
              {commit.references?.map((reference) => <span key={reference.name} className="kit-commit-reference" data-kind={reference.kind}>{reference.name}</span>)}
              {commit.subject}
            </td>
            <td className="kit-commit-author">{commit.author}</td>
            <td className="kit-commit-date">{commit.date}</td>
            <td className="kit-commit-date">{commit.hash}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ===================== breadcrumbs and the status bar ===================== */

export interface CodeCrumb {
  id: string
  label: string
  /** A file-type glyph, an icon, or nothing. */
  leading?: ReactNode
  onSelect?(): void
}

/**
 * A path of places — the members around the caret at the editor's foot (`placement="editor"`, on the canvas), or the
 * project, module and file at the status bar's start (`placement="status"`).
 */
export function CodeBreadcrumbs({ label, crumbs, placement = "editor" }: { label: string; crumbs: CodeCrumb[]; placement?: "editor" | "status" }) {
  return (
    <nav className="kit-code-breadcrumbs" data-placement={placement} aria-label={label}>
      {crumbs.map((crumb, index) => (
        <span key={crumb.id} className="kit-code-breadcrumb">
          {index > 0 && <Icon name="chevron-right" className="kit-code-breadcrumb-separator" />}
          <button type="button" onClick={crumb.onSelect}>
            {crumb.leading}
            {crumb.label}
          </button>
        </span>
      ))}
    </nav>
  )
}

/** A status-bar item that fills with how much of something is used — the heap of a running IDE. */
export function StatusMeter({ used, maximum, label, children }: { used: number; maximum: number; label: string; children: ReactNode }) {
  return (
    <span className="kit-status-item kit-status-meter" title={label} style={{ ["--kit-status-used" as string]: `${Math.round((used / maximum) * 100)}%` }}>
      <span>{children}</span>
    </span>
  )
}

/* ===================== the editor with nothing open ===================== */

export interface EditorEmptyProperties {
  title: string
  /** Where to go from here, each with the keys that get there: "Search everywhere" — "Shift Shift". */
  shortcuts?: Array<{ label: string; keys: string }>
}

/** What the editor shows when every file is closed: the ways back in. */
export function EditorEmpty({ title, shortcuts = [] }: EditorEmptyProperties) {
  return (
    <div className="kit-editor-empty">
      <p>{title}</p>
      {shortcuts.length > 0 && (
        <dl>
          {shortcuts.map((shortcut) => (
            <div key={shortcut.label} className="kit-editor-empty-row">
              <dt>{shortcut.label}</dt>
              <dd>{shortcut.keys.split(" ").map((key, index) => <kbd key={`${key}-${index}`}>{key}</kbd>)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

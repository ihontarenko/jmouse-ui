import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react"
import { Button, IconButton } from "../controls/Button"
import { Split } from "../containers/Split"
import { Icon } from "../icons/Icon"
import type { IconSource } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"

/* ===================== title bar ===================== */

export function TitleBar({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <header className="kit-title-bar">
      {start}
      {end && <div className="kit-title-bar-end">{end}</div>}
    </header>
  )
}

export function TitleBarSeparator() {
  return <span className="kit-title-bar-separator" role="separator" aria-orientation="vertical" />
}

export interface WidgetProperties extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** A letter in an accent square — the project's badge. */
  badge?: string
  icon?: IconSource
  /** Muted words after the label — the branch's remote, a configuration's kind. */
  quiet?: ReactNode
  /** Shows the chevron of a widget that drops a menu. */
  menu?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** A title-bar widget: a quiet button that names what is open — the project, the branch, the run configuration. */
export function Widget({ badge, icon, quiet, menu, className, children, type = "button", ...rest }: WidgetProperties) {
  return (
    <button type={type} className={joinClassNames("kit-widget", className)} {...rest}>
      {badge && <span className="kit-widget-badge" aria-hidden="true">{badge}</span>}
      {icon && <Icon name={icon} />}
      <span>{children}</span>
      {quiet && <span className="kit-widget-quiet">{quiet}</span>}
      {menu && <Icon name="chevron-down" size="small" />}
    </button>
  )
}

/* ===================== stripes and tool windows ===================== */

export interface ToolWindowEntry {
  id: string
  label: string
  icon: IconSource
  /** A count on the stripe button — problems, notifications. */
  count?: number
  /** Where the window opens; a stripe shows its side's top and bottom groups. */
  placement: "start" | "end" | "bottom"
  /** The shortcut that toggles it, for the button's title. */
  shortcut?: string
}

export interface ToolStripeProperties {
  side: "start" | "end"
  entries: ToolWindowEntry[]
  /** The open window of each placement. */
  open: Partial<Record<"start" | "end" | "bottom", string>>
  onToggle(entry: ToolWindowEntry): void
  label?: string
}

/**
 * A column of tool-window buttons. The start stripe carries the start and bottom windows, the end stripe the end ones;
 * a pressed button is the window that is open, and pressing it again closes it.
 */
export function ToolStripe({ side, entries, open, onToggle, label = side === "start" ? "Tool windows" : "More tool windows" }: ToolStripeProperties) {
  const top = entries.filter((entry) => entry.placement === side)
  const bottom = side === "start" ? entries.filter((entry) => entry.placement === "bottom") : []
  const renderButton = (entry: ToolWindowEntry) => (
    <button
      key={entry.id}
      type="button"
      className="kit-stripe-button"
      aria-pressed={open[entry.placement] === entry.id}
      aria-label={entry.count ? `${entry.label}, ${entry.count}` : entry.label}
      title={entry.shortcut ? `${entry.label} (${entry.shortcut})` : entry.label}
      onClick={() => onToggle(entry)}
    >
      <Icon name={entry.icon} />
      {entry.count ? <span className="kit-stripe-count" aria-hidden="true">{entry.count > 99 ? "99+" : entry.count}</span> : null}
    </button>
  )
  return (
    <nav className="kit-stripe" data-side={side} aria-label={label}>
      {top.map(renderButton)}
      <span className="kit-stripe-gap" />
      {bottom.map(renderButton)}
    </nav>
  )
}

export interface ToolWindowProperties {
  title: ReactNode
  /** Tabs in the head (Run · Debug) — a strip `Tabs`. */
  tabs?: ReactNode
  /** What the window's process is doing, after the tabs — a state badge, a progress bar. */
  status?: ReactNode
  actions?: ReactNode
  /** A row under the head: a filter, view toggles. */
  toolbar?: ReactNode
  padded?: boolean
  /** Shows a hide button that calls this. */
  onHide?(): void
  hideLabel?: string
  children: ReactNode
}

/** One tool window: its head with tabs and actions, an optional toolbar, and a body that scrolls on its own. */
export function ToolWindow({ title, tabs, status, actions, toolbar, padded, onHide, hideLabel = "Hide", children }: ToolWindowProperties) {
  return (
    <section className="kit-tool-window" aria-label={typeof title === "string" ? title : undefined}>
      <header className="kit-tool-head">
        <h2>{title}</h2>
        {tabs}
        {status && <span className="kit-tool-status">{status}</span>}
        <div className="kit-panel-actions">
          {actions}
          {onHide && <IconButton icon="minus" label={hideLabel} size="small" onClick={onHide} />}
        </div>
      </header>
      {toolbar && <div className="kit-tool-toolbar">{toolbar}</div>}
      <div className="kit-tool-body" data-padded={padded ? "" : undefined}>{children}</div>
    </section>
  )
}

/* ===================== the frame ===================== */

export interface IdeFrameProperties {
  titleBar?: ReactNode
  entries: ToolWindowEntry[]
  open: Partial<Record<"start" | "end" | "bottom", string>>
  onToggle(entry: ToolWindowEntry): void
  /** Draws the open tool window of an entry. */
  renderToolWindow(entry: ToolWindowEntry): ReactNode
  statusBar?: ReactNode
  /** Sizes are kept per frame under `<storagePrefix>.<placement>`. */
  storagePrefix?: string
  /** The frame is the whole page: it takes the viewport's height instead of its parent's. */
  viewport?: boolean
  /** The first size of each placement, in px, before the reader drags it. */
  defaultSizes?: Partial<Record<"start" | "end" | "bottom", number>>
  /** The editor: tabs, find bar, canvas. */
  children: ReactNode
}

/**
 * Burin's frame: stripes on both sides, a tool window per side and one at the bottom, each resizable with a focusable
 * handle, the editor in the middle. Which window is open is the caller's state — the frame only lays it out.
 */
export function IdeFrame({ titleBar, entries, open, onToggle, renderToolWindow, statusBar, storagePrefix, viewport, defaultSizes = {}, children }: IdeFrameProperties) {
  const windowOf = (placement: "start" | "end" | "bottom") => entries.find((entry) => entry.id === open[placement])
  const start = windowOf("start")
  const end = windowOf("end")
  const bottom = windowOf("bottom")
  const key = (placement: string) => (storagePrefix ? `${storagePrefix}.${placement}` : undefined)

  /*
   * The three splits are always there and only collapse, so opening a tool window never remounts the editor — its
   * scroll, its folds and its caret survive.
   */
  const middle = (
    <Split orientation="vertical" sizedPane="end" collapsed={!bottom} defaultSize={defaultSizes.bottom ?? 240} minimum={120} maximum={720} storageKey={key("bottom")} label={`${bottom?.label ?? "Bottom tool window"} height`}>
      <Split collapsed={!start} defaultSize={defaultSizes.start ?? 288} minimum={180} maximum={640} storageKey={key("start")} label={`${start?.label ?? "Start tool window"} width`}>
        <div className="kit-ide-window" data-placement="start">{start && renderToolWindow(start)}</div>
        <Split sizedPane="end" collapsed={!end} defaultSize={defaultSizes.end ?? 288} minimum={200} maximum={640} storageKey={key("end")} label={`${end?.label ?? "End tool window"} width`}>
          {children}
          <div className="kit-ide-window" data-placement="end">{end && renderToolWindow(end)}</div>
        </Split>
      </Split>
      <div className="kit-ide-window" data-placement="bottom">{bottom && renderToolWindow(bottom)}</div>
    </Split>
  )

  return (
    <div className="kit-ide" data-viewport={viewport ? "" : undefined}>
      {titleBar ?? <span />}
      <div className="kit-ide-body">
        <ToolStripe side="start" entries={entries} open={open} onToggle={onToggle} />
        <div className="kit-ide-area">{middle}</div>
        <ToolStripe side="end" entries={entries} open={open} onToggle={onToggle} />
      </div>
      {statusBar ?? <span />}
    </div>
  )
}

/** The editor column: the open-file strip, an optional find bar, the canvas that scrolls, and a foot — code breadcrumbs. */
export function Editor({ tabs, findBar, footer, children }: { tabs?: ReactNode; findBar?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="kit-editor">
      {tabs}
      {findBar}
      <div className="kit-editor-body">{children}</div>
      {footer}
    </div>
  )
}

/* ===================== find bar ===================== */

export interface FindOptions {
  matchCase: boolean
  wholeWord: boolean
  regularExpression: boolean
}

export interface FindBarProperties {
  query: string
  onQueryChange(query: string): void
  options: FindOptions
  onOptionsChange(options: FindOptions): void
  /** One-based position of the current match, and how many there are. */
  current: number
  total: number
  onNext(): void
  onPrevious(): void
  onClose(): void
  /** Given, a second row replaces. */
  replacement?: string
  onReplacementChange?(replacement: string): void
  onReplace?(): void
  onReplaceAll?(): void
  /** The query is not a valid expression — said in the field, never only by colour. */
  invalid?: boolean
  labels?: Partial<Record<"find" | "replace" | "next" | "previous" | "close" | "matchCase" | "wholeWord" | "regularExpression" | "replaceOne" | "replaceAll" | "noMatches", string>>
}

/**
 * Find (and replace) inside the open file: Enter for the next match, Shift+Enter for the previous, Escape closes. The
 * count says where the reader is — "3 of 12" — and "No matches" in words when there are none.
 */
export function FindBar({ query, onQueryChange, options, onOptionsChange, current, total, onNext, onPrevious, onClose, replacement, onReplacementChange, onReplace, onReplaceAll, invalid, labels = {} }: FindBarProperties) {
  const inputReference = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputReference.current?.focus()
    inputReference.current?.select()
  }, [])
  const text = { find: "Find", replace: "Replace", next: "Next match", previous: "Previous match", close: "Close", matchCase: "Match case", wholeWord: "Whole words", regularExpression: "Regular expression", replaceOne: "Replace", replaceAll: "Replace all", noMatches: "No matches", ...labels }
  const toggle = (option: keyof FindOptions) => onOptionsChange({ ...options, [option]: !options[option] })
  return (
    <div className="kit-find-bar" role="search" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }}>
      <div className="kit-find-row">
        <input
          ref={inputReference}
          className="kit-input"
          aria-label={text.find}
          aria-invalid={invalid || undefined}
          placeholder={text.find}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              if (event.shiftKey) {
                onPrevious()
              } else {
                onNext()
              }
            }
          }}
        />
        <Button variant="quiet" size="small" aria-label={text.matchCase} pressed={options.matchCase} onClick={() => toggle("matchCase")}>Aa</Button>
        <Button variant="quiet" size="small" aria-label={text.wholeWord} pressed={options.wholeWord} onClick={() => toggle("wholeWord")}>W</Button>
        <Button variant="quiet" size="small" aria-label={text.regularExpression} pressed={options.regularExpression} onClick={() => toggle("regularExpression")}>.*</Button>
      </div>
      <div className="kit-find-row">
        <span className="kit-find-count" aria-live="polite">{query ? (total === 0 ? text.noMatches : `${current} of ${total}`) : ""}</span>
        <IconButton icon="chevron-up" label={text.previous} size="small" disabled={total === 0} onClick={onPrevious} />
        <IconButton icon="chevron-down" label={text.next} size="small" disabled={total === 0} onClick={onNext} />
        <IconButton icon="close" label={text.close} size="small" onClick={onClose} />
      </div>
      {onReplacementChange && (
        <>
          <div className="kit-find-row">
            <input className="kit-input" aria-label={text.replace} placeholder={text.replace} value={replacement ?? ""} onChange={(event) => onReplacementChange(event.target.value)} />
          </div>
          <div className="kit-find-row">
            <Button variant="quiet" size="small" disabled={total === 0} onClick={onReplace}>{text.replaceOne}</Button>
            <Button variant="quiet" size="small" disabled={total === 0} onClick={onReplaceAll}>{text.replaceAll}</Button>
          </div>
        </>
      )}
    </div>
  )
}

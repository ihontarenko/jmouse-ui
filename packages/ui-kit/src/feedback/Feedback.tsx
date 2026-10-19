import { cloneElement, createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactElement, type ReactNode } from "react"
import type { Tone } from "../controls/Button"
import { IconButton } from "../controls/Button"
import { Icon } from "../icons/Icon"
import type { IconName } from "../icons/iconPaths"
import type { IconSource } from "../icons/Icon"
import { placeUnderAnchor } from "../lib/anchoredPopover"
import { joinClassNames } from "../lib/classNames"

const toneIcons: Record<Tone, IconName> = {
  accent: "information",
  good: "success",
  warn: "warning",
  danger: "danger",
}

export interface NoticeProperties extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: Tone
  title?: ReactNode
  actions?: ReactNode
  icon?: IconSource
}

/**
 * Something the reader should know about this place — information, a caution, a failure. The band, the icon and the
 * words all say the tone, so it never rests on colour. A danger notice is announced as an alert.
 */
export function Notice({ tone = "accent", title, actions, icon, className, children, ...rest }: NoticeProperties) {
  return (
    <div className={joinClassNames("kit-notice", className)} data-tone={tone === "accent" ? undefined : tone} role={tone === "danger" ? "alert" : "status"} {...rest}>
      <Icon name={icon ?? toneIcons[tone]} />
      <div className="kit-notice-text">
        {title && <strong>{title}</strong>}
        {children && (typeof children === "string" ? <p>{children}</p> : children)}
      </div>
      {actions && <div className="kit-panel-actions">{actions}</div>}
    </div>
  )
}

export interface EmptyStateProperties {
  title: ReactNode
  description?: ReactNode
  /** Innoventa's name for `description`. */
  text?: string
  icon?: IconSource
  /** What to do about it — the action that fills the place. */
  actions?: ReactNode
  /** No frame: the state fills a panel or a table that already has one. Whether there is a frame at all otherwise is
      the theme's (`--kit-empty-frame`): Parallax draws a dashed one, Innoventa none. */
  flush?: boolean
  /** "danger": the place is empty because something failed — prefer {@link ProblemState}, which also says how. */
  tone?: "neutral" | "danger"
  className?: string
}

/** A place with nothing in it yet: say why, and what fills it. */
export function EmptyState({ title, description, text, icon = "inbox", actions, flush, tone = "neutral", className }: EmptyStateProperties) {
  description = description ?? text
  return (
    <div className={joinClassNames("kit-empty", className)} data-flush={flush ? "" : undefined} data-tone={tone === "danger" ? "danger" : undefined}>
      <Icon name={icon} />
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actions && <div className="kit-panel-actions">{actions}</div>}
    </div>
  )
}

export interface ProblemStateProperties extends Omit<EmptyStateProperties, "icon"> {
  /** The technical detail — a status code, a message — set apart in the data face. */
  detail?: ReactNode
}

/** Something that should be here could not be loaded. Never dress a failure as an empty list. */
export function ProblemState({ title, description, detail, actions, flush }: ProblemStateProperties) {
  return (
    <div className="kit-empty" data-tone="danger" data-flush={flush ? "" : undefined} role="alert">
      <Icon name="danger" />
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {detail && <code className="kit-empty-detail">{detail}</code>}
      {actions && <div className="kit-panel-actions">{actions}</div>}
    </div>
  )
}

export function Skeleton({ width, height, className }: { width?: CSSProperties["width"]; height?: CSSProperties["height"]; className?: string }) {
  return <span className={joinClassNames("kit-skeleton", className)} style={{ width, height }} aria-hidden="true" />
}

export function Spinner({ size = "regular", label }: { size?: "regular" | "large"; label?: string }) {
  return <span className="kit-spinner" data-size={size === "regular" ? undefined : size} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
}

export interface WaitingProperties {
  /** The words, inline beside the spinner. */
  children?: ReactNode
  /** Innoventa's shape: the words as a label, drawn as a centred block — a wait with no shape to promise. */
  label?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

/**
 * Work in progress, said in words. Inline with `children`; a centred block with `label` (Innoventa). ⚠️ Not a list's
 * loading state — that is {@link TableSkeleton}, which keeps the list's shape.
 */
export function Waiting({ children, label, size = "md", className }: WaitingProperties) {
  if (label !== undefined) {
    return (
      <div className={joinClassNames("kit-waiting-block", className)} role="status" data-size={size}>
        <Spinner size={size === "sm" ? "regular" : "large"} />
        <span>{label}</span>
      </div>
    )
  }
  return (
    <span className={joinClassNames("kit-waiting", className)} role="status">
      <Spinner />
      {children}
    </span>
  )
}

/** A whole page waiting: the block, centred in the viewport. */
export function PageWaiting({ label }: { label: string }) {
  return <Waiting label={label} size="lg" className="kit-page-waiting" />
}

/** A list's loading state: rows of uneven bars where the rows will be, so nothing jumps when they arrive. */
export function TableSkeleton({ rows = 8, label = "Loading" }: { rows?: number; label?: string }) {
  const widths = [92, 71, 84, 63, 88, 58, 77, 69]
  return (
    <div className="kit-table-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_unused, index) => (
        <Skeleton key={index} width={`${widths[index % widths.length]}%`} height={16} />
      ))}
    </div>
  )
}

/* ===================== toasts ===================== */

export interface ToastOptions {
  title: ReactNode
  description?: ReactNode
  tone?: Tone
  /** One action — "Undo", "Open". The toast closes after it runs. */
  action?: { label: string; run(): void }
  /** Milliseconds; 0 keeps it until dismissed. A danger toast stays by default. */
  duration?: number
}

interface ToastEntry extends ToastOptions {
  id: number
}

interface ToastContextValue {
  show(options: ToastOptions): number
  dismiss(id: number): void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Holds the toasts and draws them in the corner. One per application, near the root. */
export function ToastProvider({ children, dismissLabel = "Dismiss" }: { children: ReactNode; dismissLabel?: string }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const sequence = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (options: ToastOptions) => {
      sequence.current += 1
      const id = sequence.current
      setToasts((current) => [...current.slice(-3), { ...options, id }])
      const duration = options.duration ?? (options.tone === "danger" ? 0 : 5000)
      if (duration > 0) {
        timers.current.set(id, window.setTimeout(() => dismiss(id), duration))
      }
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ol className="kit-toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => {
          const tone = toast.tone ?? "accent"
          return (
            <li key={toast.id} className="kit-toast" data-tone={tone === "accent" ? undefined : tone} role={tone === "danger" ? "alert" : undefined}>
              <Icon name={toneIcons[tone]} />
              <div className="kit-toast-text">
                <strong>{toast.title}</strong>
                {toast.description && <p>{toast.description}</p>}
              </div>
              <div className="kit-toast-actions">
                {toast.action && (
                  <button
                    type="button"
                    className="kit-button"
                    data-variant="quiet"
                    data-size="small"
                    onClick={() => {
                      toast.action?.run()
                      dismiss(toast.id)
                    }}
                  >
                    {toast.action.label}
                  </button>
                )}
                <IconButton icon="close" size="small" label={dismissLabel} onClick={() => dismiss(toast.id)} />
              </div>
            </li>
          )
        })}
      </ol>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast() needs a <ToastProvider> above it.")
  }
  return context
}

/* ===================== tooltip ===================== */

export interface TooltipProperties {
  /** What the control does, in a few words. Never the only place a fact lives — a tooltip cannot be touched. */
  content: ReactNode
  shortcut?: string
  /** One element that can take focus; it gains aria-describedby. */
  children: ReactElement<{ "aria-describedby"?: string; onPointerEnter?(): void; onPointerLeave?(): void; onFocus?(): void; onBlur?(): void; ref?: unknown }>
}

/** A short description shown on hover and on keyboard focus, after a beat; Escape or moving away hides it. */
export function Tooltip({ content, shortcut, children }: TooltipProperties) {
  const id = useId()
  const tooltipReference = useRef<HTMLDivElement>(null)
  const anchorReference = useRef<HTMLElement | null>(null)
  const timer = useRef<number | undefined>(undefined)

  function show() {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const tooltip = tooltipReference.current
      const anchor = anchorReference.current
      if (tooltip && anchor && anchor.isConnected) {
        tooltip.showPopover()
        placeUnderAnchor(anchor, tooltip, "start", 6)
      }
    }, 450)
  }

  function hide() {
    window.clearTimeout(timer.current)
    tooltipReference.current?.hidePopover()
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        hide()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      window.clearTimeout(timer.current)
    }
  }, [])

  return (
    <>
      {cloneElement(children, {
        "aria-describedby": id,
        ref: (element: HTMLElement | null) => {
          anchorReference.current = element
        },
        // The child's own handlers still run: the tooltip adds to them, it never takes them over.
        onPointerEnter: () => {
          children.props.onPointerEnter?.()
          show()
        },
        onPointerLeave: () => {
          children.props.onPointerLeave?.()
          hide()
        },
        onFocus: () => {
          children.props.onFocus?.()
          show()
        },
        onBlur: () => {
          children.props.onBlur?.()
          hide()
        },
      })}
      <div ref={tooltipReference} id={id} role="tooltip" popover="manual" className="kit-tooltip">
        {content}
        {shortcut && <kbd>{shortcut}</kbd>}
      </div>
    </>
  )
}

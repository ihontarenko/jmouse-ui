import { useEffect, useState, type ReactNode } from "react"
import { IconButton } from "../controls/Button"
import { Icon } from "../icons/Icon"
import type { IconName } from "../icons/iconPaths"

/*
 * Toasts called from anywhere — `toast.success("Saved")` — the shape Innoventa calls through sonner, without sonner.
 * Mount <Toaster /> once near the root; `toast` works from event handlers, queries and plain functions alike. A tree
 * that prefers a hook uses the kit's `ToastProvider` / `useToast`; both draw the same toast.
 */

type ToastKind = "default" | "success" | "info" | "warning" | "error"

export interface ToastCallOptions {
  description?: ReactNode
  /** One action — "Undo", "Open". The toast closes after it runs. */
  action?: { label: string; onClick(): void }
  /** Milliseconds; Infinity keeps it until dismissed. An error stays by default. */
  duration?: number
  id?: string | number
}

interface QueuedToast extends ToastCallOptions {
  id: string | number
  kind: ToastKind
  title: ReactNode
}

let sequence = 0
let queue: QueuedToast[] = []
const listeners = new Set<(toasts: QueuedToast[]) => void>()

function publish(next: QueuedToast[]) {
  queue = next
  listeners.forEach((listener) => listener(queue))
}

function dismiss(id?: string | number) {
  publish(id === undefined ? [] : queue.filter((entry) => entry.id !== id))
}

function add(kind: ToastKind, title: ReactNode, options: ToastCallOptions = {}): string | number {
  sequence += 1
  const id = options.id ?? sequence
  publish([...queue.filter((entry) => entry.id !== id).slice(-3), { ...options, id, kind, title }])
  const duration = options.duration ?? (kind === "error" ? Infinity : 5000)
  if (Number.isFinite(duration)) {
    window.setTimeout(() => dismiss(id), duration)
  }
  return id
}

/** Shows a toast. `toast(title)` is neutral; the members say how it went. */
export const toast = Object.assign((title: ReactNode, options?: ToastCallOptions) => add("default", title, options), {
  success: (title: ReactNode, options?: ToastCallOptions) => add("success", title, options),
  info: (title: ReactNode, options?: ToastCallOptions) => add("info", title, options),
  warning: (title: ReactNode, options?: ToastCallOptions) => add("warning", title, options),
  error: (title: ReactNode, options?: ToastCallOptions) => add("error", title, options),
  dismiss,
})

const kinds: Record<ToastKind, { icon: IconName; tone?: string }> = {
  default: { icon: "information" },
  info: { icon: "information" },
  success: { icon: "success", tone: "good" },
  warning: { icon: "warning", tone: "warn" },
  error: { icon: "danger", tone: "danger" },
}

/** Draws the toasts `toast()` raises, in the corner. One per application. */
export function Toaster({ dismissLabel = "Dismiss" }: { dismissLabel?: string }) {
  const [toasts, setToasts] = useState<QueuedToast[]>(queue)
  useEffect(() => {
    listeners.add(setToasts)
    return () => {
      listeners.delete(setToasts)
    }
  }, [])
  return (
    <ol className="kit-toasts" aria-live="polite" aria-relevant="additions">
      {toasts.map((entry) => (
        <li key={entry.id} className="kit-toast" data-tone={kinds[entry.kind].tone} role={entry.kind === "error" ? "alert" : undefined}>
          <Icon name={kinds[entry.kind].icon} />
          <div className="kit-toast-text">
            <strong>{entry.title}</strong>
            {entry.description && <p>{entry.description}</p>}
          </div>
          <div className="kit-toast-actions">
            {entry.action && (
              <button type="button" className="kit-button" data-variant="quiet" data-size="small" onClick={() => { entry.action?.onClick(); dismiss(entry.id) }}>
                {entry.action.label}
              </button>
            )}
            <IconButton icon="close" size="small" label={dismissLabel} onClick={() => dismiss(entry.id)} />
          </div>
        </li>
      ))}
    </ol>
  )
}

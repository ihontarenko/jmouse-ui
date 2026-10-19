import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import { joinClassNames } from "../lib/classNames"

export interface SplitProperties {
  /** horizontal: panes side by side, the handle drags left and right · vertical: stacked. */
  orientation?: "horizontal" | "vertical"
  /** Which pane has the size; the other takes what is left. */
  sizedPane?: "start" | "end"
  defaultSize: number
  minimum?: number
  maximum?: number
  /** Kept across visits under this key; without it the size lives as long as the page. */
  storageKey?: string
  /** What the handle resizes — "Project tool window width". */
  label: string
  /** Hides the sized pane and the handle, keeping the other pane mounted — a tool window that is closed. */
  collapsed?: boolean
  className?: string
  children: [ReactNode, ReactNode]
}

function readStoredSize(storageKey: string | undefined, fallback: number): number {
  if (!storageKey) {
    return fallback
  }
  try {
    const stored = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(stored) && stored > 0 ? stored : fallback
  } catch {
    return fallback
  }
}

/**
 * Two panes and the handle between them — a workbench's columns, a tool window and its editor. The handle is a
 * focusable separator: the arrow keys move it by 16px (Shift: 64px), Home and End take it to its limits.
 */
export function Split({ orientation = "horizontal", sizedPane = "start", defaultSize, minimum = 160, maximum = 720, storageKey, label, collapsed, className, children }: SplitProperties) {
  const [size, setSize] = useState(() => readStoredSize(storageKey, defaultSize))
  const [dragging, setDragging] = useState(false)
  const origin = useRef<{ pointer: number; size: number } | null>(null)
  const horizontal = orientation === "horizontal"

  useEffect(() => {
    if (!storageKey) {
      return
    }
    try {
      window.localStorage.setItem(storageKey, String(Math.round(size)))
    } catch {
      // Storage refused: the size still holds for this page.
    }
  }, [size, storageKey])

  function clamp(value: number) {
    return Math.max(minimum, Math.min(maximum, value))
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    origin.current = { pointer: horizontal ? event.clientX : event.clientY, size }
    setDragging(true)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!origin.current) {
      return
    }
    const travelled = (horizontal ? event.clientX : event.clientY) - origin.current.pointer
    setSize(clamp(origin.current.size + (sizedPane === "start" ? travelled : -travelled)))
  }

  function onPointerUp() {
    origin.current = null
    setDragging(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 64 : 16
    const growKey = horizontal ? (sizedPane === "start" ? "ArrowRight" : "ArrowLeft") : (sizedPane === "start" ? "ArrowDown" : "ArrowUp")
    const shrinkKey = horizontal ? (sizedPane === "start" ? "ArrowLeft" : "ArrowRight") : (sizedPane === "start" ? "ArrowUp" : "ArrowDown")
    if (event.key === growKey) {
      setSize((current) => clamp(current + step))
    } else if (event.key === shrinkKey) {
      setSize((current) => clamp(current - step))
    } else if (event.key === "Home") {
      setSize(minimum)
    } else if (event.key === "End") {
      setSize(maximum)
    } else {
      return
    }
    event.preventDefault()
  }

  const sizedStyle = horizontal ? { width: size, flex: "none" } : { height: size, flex: "none" }
  const [start, end] = children
  return (
    <div className={joinClassNames("kit-split", className)} data-orientation={orientation}>
      <div className="kit-split-pane" style={sizedPane === "start" ? sizedStyle : undefined} data-fill={sizedPane === "end" ? "" : undefined} hidden={collapsed && sizedPane === "start"}>{start}</div>
      <div
        className="kit-split-handle"
        hidden={collapsed}
        role="separator"
        tabIndex={0}
        aria-label={label}
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(size)}
        aria-valuemin={minimum}
        aria-valuemax={maximum}
        data-dragging={dragging ? "" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setSize(clamp(defaultSize))}
      />
      <div className="kit-split-pane" style={sizedPane === "end" ? sizedStyle : undefined} data-fill={sizedPane === "start" ? "" : undefined} hidden={collapsed && sizedPane === "end"}>{end}</div>
    </div>
  )
}

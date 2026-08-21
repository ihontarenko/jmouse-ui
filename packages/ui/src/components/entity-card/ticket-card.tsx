import type { DragEvent, ReactNode } from "react"
import { entityCardSurface } from "./surface"

/**
 * A card that stands in a column and gets dragged to the next one — the board shape.
 *
 * ⚠️ **The whole card is the target, so it is a `button`.** A card whose title alone is clickable is a
 * card people miss on a board, where the gesture is "grab that one" rather than "read this and then
 * decide". Everything inside it is therefore markup, never a control.
 *
 * ⚠️ **The accent edge is the caller's colour and its meaning is the caller's too** — an issue type, a
 * severity, a queue. `pl-2` against `p-2.5` keeps the text where it was: the edge grows from 1px to 4px,
 * so the padding gives the 3px back rather than letting every card shift on its own.
 *
 * ⚠️ **`leading` and `trailing` are two ends of one line, not a slot for anything.** What identifies the
 * card goes left — its icon, its key, whatever marks it as blocked; what qualifies it goes right — a
 * priority, whoever holds it. A board is read down those two columns.
 */
export function TicketCard({
  title,
  isMuted = false,
  identifier,
  leading,
  trailing,
  accentClassName,
  draggable = false,
  onOpen,
  onDragStart,
  onDragOver,
  className,
}: {
  title: ReactNode
  /** Struck through and quietened — the card is closed, done, cancelled. */
  isMuted?: boolean
  /** The key somebody quotes, drawn monospaced: `TES-42`. */
  identifier?: string
  leading?: ReactNode
  trailing?: ReactNode
  /** A Tailwind border-left class the product owns — `border-l-emerald-500`. */
  accentClassName?: string
  draggable?: boolean
  onOpen?: () => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void
  className?: string
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onClick={onOpen}
      className={entityCardSurface({
        hasAccent: true,
        className: [
          "flex w-full flex-col gap-2 p-2.5 pl-2 text-left shadow-sm",
          draggable && "cursor-grab active:cursor-grabbing",
          accentClassName ?? "border-l-transparent",
          className,
        ]
          .filter(Boolean)
          .join(" "),
      })}
    >
      <span className={isMuted ? "text-sm text-muted-foreground line-through" : "text-sm"}>{title}</span>

      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {leading}
          {identifier && <span className="font-mono text-xs text-muted-foreground">{identifier}</span>}
        </span>
        {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
      </div>
    </button>
  )
}

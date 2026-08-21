import { useState } from "react"
import { Trash2 } from "lucide-react"
import { cn } from "../../lib/helpers"
import { Button } from "../button"

/**
 * Removing the thing the card is about — two presses, and the second one names it.
 *
 * ⚠️ **Quiet, and only under the pointer.** A delete sitting beside "Open" at equal weight is a delete
 * somebody reaches for by accident; it appears on hover and on keyboard focus, so it is reachable
 * without a mouse and invisible while nobody is asking for it.
 *
 * ⚠️ **The confirmation is the control itself, not a dialog.** A modal over a grid of twenty cards
 * loses the one thing that made the press safe — which card it was about.
 */
export function EntityCardRemoveControl({
  onRemove,
  confirmLabel,
  density = "comfortable",
}: {
  onRemove: () => void
  /** What the second press says. Name the record in it — "Really delete 'Relay'". */
  confirmLabel?: string
  density?: "comfortable" | "compact"
}) {
  const [isConfirming, setConfirming] = useState(false)

  if (isConfirming) {
    return (
      // ⚠️ The compact confirmation is SHORT and carries the record’s name as a title. A row and a
      // card corner are both a few characters wide, and “Really delete ‘Relay’” rendered there pushes the
      // name it names off its own line.
      <Button
        variant="destructive"
        size="sm"
        title={confirmLabel}
        onClick={() => {
          onRemove()
          setConfirming(false)
        }}
      >
        {density === "compact" ? "Really?" : (confirmLabel ?? "Really delete")}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={confirmLabel ?? "Delete"}
      className={cn(
        "text-destructive opacity-0 transition-opacity group-hover/entity-card:opacity-100 group-focus-within/entity-card:opacity-100 hover:bg-destructive/10",
        density === "compact" && "size-7 p-0",
      )}
      onClick={() => setConfirming(true)}
    >
      {density === "compact" ? <Trash2 className="size-3.5" /> : "Delete"}
    </Button>
  )
}

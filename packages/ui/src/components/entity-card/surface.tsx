import { cn } from "../../lib/helpers"

/** How much room a card is allowed to take for the same facts. */
export type EntityCardDensity = "comfortable" | "compact"

/**
 * The border, the background and the hover every card in this family draws — the one place they are
 * decided, so a comfortable card and a compact one are visibly the same object at two sizes.
 *
 * ⚠️ **With an accent edge the hover recolours three sides, not four.** A plain
 * `hover:border-primary/40` repaints the left edge too and wipes the accent out exactly when somebody
 * is pointing at the card — which is the moment it was least worth losing.
 *
 * ⚠️ **A draft is marked on the card itself, not only in a badge.** Somebody scanning twenty cards for
 * the unpublished one should not have to read twenty badges.
 */
export function entityCardSurface({
  isDraft = false,
  hasAccent = false,
  className,
}: {
  isDraft?: boolean
  hasAccent?: boolean
  className?: string
}): string {
  return cn(
    "group/entity-card min-w-0 rounded-md border bg-card text-card-foreground transition-colors",
    hasAccent ? "border-l-4 hover:border-y-primary/40 hover:border-r-primary/40" : "hover:border-primary/40",
    isDraft && "border-dashed",
    className,
  )
}

/**
 * The card's title: a way in when there is somewhere to go, and plain text when there is not.
 *
 * ⚠️ **Truncated, never wrapped.** A grid whose rows are as tall as its longest name is a grid that
 * jumps every time somebody renames something.
 *
 * ⚠️ **`min-w-0` is what makes that truncation happen at all.** A flex item's minimum width is its
 * content, so without it the name refuses to shrink and the row squeezes whatever sits beside it
 * instead — on the compact card that was the name pushing itself off its own row and rendering as
 * nothing.
 */
export function EntityCardName({
  name,
  onOpen,
  className,
}: {
  name: string
  onOpen?: () => void
  /** ⚠️ Type only — the row sets its own size and weight. Never a colour: a draft is already recolouring. */
  className?: string
}) {
  if (onOpen) {
    return (
      <button
        type="button"
        title={name}
        onClick={onOpen}
        className={cn("min-w-0 truncate text-sm font-medium hover:underline", className)}
      >
        {name}
      </button>
    )
  }

  // ⚠️ `title` because a truncated name is a name nobody can read. The compact row is packed by
  // design, so this is the only place the whole of it still exists on screen.
  return (
    <span title={name} className={cn("min-w-0 truncate text-sm font-medium", className)}>
      {name}
    </span>
  )
}

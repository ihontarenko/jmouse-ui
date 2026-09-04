import { cn } from "@jmouse/ui"
import type { ReactNode } from "react"

/**
 * The mark that names a control or a column. 🏷️
 *
 * ## ⚠️ It is a real `<label for>` when it has something to point at
 *
 * Small is not the same as absent. Ten-pixel uppercase is what `rules/design.md` reserves for metadata
 * marks and this is exactly that — but a screen reader has to receive the same word a sighted reader
 * does, so the caption is bound to its control by id rather than merely painted beside it.
 *
 * ## ⚠️ What used to live here, and why it is gone
 *
 * This file also held `CELL` — a borderless filled box every control in the package wore, invented when
 * the rules tab drew a hundred inputs at once and forty rows of outlines would have been unreadable.
 * The inputs now live in a dialog, one statement at a time, so the reason is gone and what remained was
 * a control that looked like nothing else in the product. `Input` and `NativeSelect` carry the toolkit's
 * own `size="sm"`, which exists precisely so a dense row does not have to invent its own height.
 */
export function Caption({
  htmlFor,
  className,
  children,
}: {
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  const classes = cn(
    "text-muted-foreground shrink-0 text-[10px] font-medium tracking-[0.08em] uppercase",
    className,
  )

  return htmlFor === undefined ? (
    <span className={classes}>{children}</span>
  ) : (
    <label htmlFor={htmlFor} className={classes}>
      {children}
    </label>
  )
}

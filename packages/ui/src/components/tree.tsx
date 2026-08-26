import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "../lib/helpers"

/**
 * One row of a hierarchy, and the arithmetic that indents it.
 *
 * <h2>⚠️ The row, never the tree</h2>
 *
 * <p>Two products draw a tree in an aside — the file manager's directories and a knowledge base's
 * sections — and everything <em>above</em> the row differs between them: one walks a flat list carrying
 * `depth`, the other recurses through `children`; one has a single kind of row, the other has two and an
 * inert third for a branch nobody was granted; one drags files onto folders, the other runs a search
 * across what is filed. Extracting all of that would produce a component with a union type per consumer.
 * What genuinely coincides is this: the indent, the twisty, the label line, the actions that appear on
 * hover, and what "selected" looks like. So that is what lives here.</p>
 *
 * <h2>⚠️ The label element belongs to the caller</h2>
 *
 * <p>It is a link on one screen, a button on another, and a `span` with a `title` on the third — a
 * section somebody may see the name of and not open. A package that picked one of those would be wrong
 * on two screens out of three, so the row takes the finished element as its children and offers
 * {@link treeLabelClassName} for the class it needs to sit correctly in the line.</p>
 *
 * <h2>⚠️ Exactly one thing in the line may shrink, and it is the name</h2>
 *
 * <p>`min-w-0` on the label and `shrink-0` on the twisty is what lets `truncate` work at all. Without
 * it a long name pushes the row out past the aside's border instead of ending in an ellipsis.</p>
 *
 * <h2>⚠️ The actions FLOAT over the row rather than sitting in it</h2>
 *
 * <p>Laid out in the flex line they are permanently reserved, so three icon buttons take ~80px off every
 * name for the whole time the pointer is elsewhere — `Datasheets 2026` truncated to `Datashee…` beside
 * eighty pixels of nothing. Absolutely positioned, the name truncates at the aside's real edge and the
 * buttons appear on top of its tail only while the row is hovered. Hidden by opacity rather than
 * removed, so nothing reflows under the pointer, and given a backdrop of its own so the name underneath
 * stays legible.</p>
 *
 * <h2>⚠️ Every indent is PADDING, never a margin</h2>
 *
 * <p>A margin does not come off an element's width, so an indented full-width row keeps its full width
 * and simply starts further in — sliding out past the aside's border by exactly the depth it was
 * indented by. This has been learned twice; it is padding here and it is padding in anything a caller
 * indents to match.</p>
 */

/**
 * How far in a row at this level sits, in pixels — the root at level `0`.
 *
 * ⚠️ **10px a level, capped at six.** A deep branch otherwise spends the whole aside on indentation and
 * leaves nothing for the names it is indenting; past the sixth level the shape is carried by the twisty
 * column rather than by more whitespace.
 */
export function treeIndent(level: number): number {
  return 4 + Math.min(Math.max(level, 0), 6) * 10
}

/**
 * The class the caller's own label element wears — a link, a button, or an inert span.
 *
 * ⚠️ `outline-hidden` because the row draws the focus ring, not the thing inside it: a browser's own
 * outline over a selected row's fill reads as a broken control rather than as a selection, and it only
 * ever appears after a click, which is how it survives review.
 */
export const treeLabelClassName =
  "flex min-w-0 flex-1 items-center gap-1.5 text-left outline-hidden"

/**
 * How a selected row is painted.
 *
 * - `accent` — the quiet fill the file manager uses, where the tree is one panel of a busy screen.
 * - `primary` — the inverted active state Innoventa's sidebar established and every navigation list in
 *   this family repeats, for a tree that *is* the screen's navigation.
 */
export type TreeRowTone = "accent" | "primary"

/**
 * ⚠️ `inverted-surface` on the `primary` row, and it is not decoration — see the class in `styles.css`.
 * The label and the twisty are `currentColor` and follow `text-primary-foreground` by themselves; a
 * drawn glyph in the same line paints its own colour and would keep its dark value on top of the fill.
 * The class is what tells one what the other already knows: here, the accent is the foreground.
 */
const SELECTED_TONE: Record<TreeRowTone, string> = {
  accent: "bg-accent font-medium",
  primary: "inverted-surface bg-primary font-medium text-primary-foreground",
}

/**
 * ⚠️ On a selected `primary` row the accent IS the background, so a `bg-background` panel floated over
 * it is a hole punched in the highlight. It tints with the row's own colour instead.
 */
const ACTIONS_TONE: Record<TreeRowTone, string> = {
  accent: "bg-accent",
  primary: "bg-primary/90 text-primary-foreground",
}

export function TreeRow({
  indent,
  branch = false,
  open = false,
  onToggle,
  name,
  actions,
  selected = false,
  tone = "accent",
  dropTarget = false,
  children,
  className,
  style,
  ...rest
}: {
  /** Pixels of padding on the left — {@link treeIndent} of the row's level. */
  indent: number
  /** Whether there is anything underneath. A leaf keeps the twisty's width as a spacer. */
  branch?: boolean
  open?: boolean
  onToggle?: () => void
  /** The row's name, used only to say what the twisty does — screen readers get "Collapse Datasheets". */
  name?: string
  /** Offered on hover, floated over the end of the row. */
  actions?: React.ReactNode
  selected?: boolean
  tone?: TreeRowTone
  /** Something is being dragged over this row and would land in it. */
  dropTarget?: boolean
} & Omit<React.ComponentProps<"div">, "onToggle">) {
  const action = open ? "Collapse" : "Expand"

  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "group relative flex h-7 min-w-0 items-center gap-1 rounded-md pr-1 text-[13px] transition-colors",
        // ⚠️ Taller wherever the pointer is a finger. 28px is a mouse rhythm — deliberately dense,
        // because a tree is read by scanning it — and it is well under every platform's minimum touch
        // target, on the control the whole of a wiki's navigation hangs off. The variant asks the
        // DEVICE rather than the width: a tablet at 1200px is still operated by a thumb, and a narrow
        // desktop window is not.
        "pointer-coarse:h-9 pointer-coarse:text-sm",
        // ⚠️ Our own ring rather than the browser's — see {@link treeLabelClassName}.
        "outline-hidden focus-within:ring-2 focus-within:ring-ring",
        selected ? SELECTED_TONE[tone] : "hover:bg-accent/50",
        dropTarget && "ring-2 ring-primary",
        className,
      )}
      style={{ paddingLeft: `${indent}px`, ...style }}
      {...rest}
    >
      {/* ⚠️ The twisty is its OWN button, never the row — opening a branch and going into it are two
          different intentions, and a tree where looking inside also navigates cannot be read without
          being walked. A leaf keeps the same 16px as a spacer, or every name at a depth would start at a
          different place depending on whether it happened to have children. */}
      {branch ? (
        <button
          type="button"
          // ⚠️ 16px for a mouse, 24px for a thumb — and the LEAF SPACER below grows by exactly the same
          // amount. They are one column: growing only the button would leave every branch's name eight
          // pixels to the right of every leaf's at the same depth, which reads as a broken tree rather
          // than as a bigger control.
          className="flex size-4 shrink-0 items-center justify-center rounded text-current opacity-60 transition-opacity hover:opacity-100 pointer-coarse:size-6 pointer-coarse:opacity-80"
          title={action}
          aria-label={name ? `${action} ${name}` : action}
          aria-expanded={open}
          onClick={onToggle}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        </button>
      ) : (
        <span aria-hidden="true" className="size-4 shrink-0 pointer-coarse:size-6" />
      )}

      {children}

      {actions && (
        <div
          className={cn(
            "absolute top-1/2 right-1 flex -translate-y-1/2 items-center rounded-md opacity-0 shadow-sm backdrop-blur-sm transition-opacity",
            "focus-within:opacity-100 group-hover:opacity-100 [&:has([data-state=open])]:opacity-100",
            // ⚠️ **Always visible where there is no hover, or this control does not exist.** Revealing
            // a row's actions on hover is right for a mouse and total on a touch screen: a finger
            // never produces a hover, so on a phone every per-row menu in every tree in this family —
            // rename, move, delete, new page — was invisible and unreachable, with nothing on screen
            // to suggest a control was there at all. This is not a touch-target size problem; the
            // button was not rendered to be aimed at.
            "pointer-coarse:opacity-100",
            selected ? ACTIONS_TONE[tone] : "bg-background/85",
          )}
        >
          {actions}
        </div>
      )}
    </div>
  )
}

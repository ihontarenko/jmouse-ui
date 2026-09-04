import type { CSSProperties } from "react"
import { cn } from "../../lib/helpers"
import { EntityCardName } from "./surface"
import { EntityCardRemoveControl } from "./remove-control"
import type { EntityCardProperties } from "./properties"

/**
 * One row of a list, not a small card.
 *
 * ⚠️ **The chrome belongs to the LIST, and this is what makes it read as one.** As a card per row —
 * its own rounded border, its own background, a gap under it — a stack of them is a stack of pills that
 * happen to be the same width. A hairline between rows, one border around the whole run and a hover
 * that lights the row is what a list of linked issues looks like, and it is the shape being copied.
 *
 * ⚠️ **One column template for every row.** Alignment is the whole difference between a list and a
 * column of flex rows: names start in the same place, descriptions start in the same place, and the eye
 * reads down one of them instead of tracking a ragged edge.
 *
 * ⚠️ **The left edge is the group's colour**, and it is the caller's to supply — as a value where the
 * product computes one, as a class where it keeps a fixed map. Absent, the edge is transparent until
 * the pointer arrives and then it is the accent: no colour is an answer, grey reads as a group whose
 * colour happens to be grey, and a row that lights an edge under the pointer says "this whole line is
 * one thing" better than a background wash does.
 *
 * ⚠️ **The glyph is a tile, not a loose emoji** (Ivan, 2026-08-21). Bare, it floats at whatever size and
 * baseline the font hands back — an emoji, a letter and a symbol on three consecutive rows sit at three
 * different heights. A 24px tile gives every row the same first column whatever is dropped into it.
 */
const ROW_COLUMNS = "1.5rem minmax(6rem,14rem) minmax(0,1fr) auto"

export function CompactEntityCard({
  glyph,
  measure,
  name,
  isDraft,
  badge,
  description,
  actions,
  footer,
  accentClassName,
  accentColour,
  onOpen,
  onRemove,
  confirmLabel,
  navigation,
}: EntityCardProperties) {
  return (
    <li
      {...navigation}
      className={cn(
        "group/entity-card grid min-h-9 items-center gap-2.5 border-t border-l-[3px] border-l-transparent px-3 py-1.5",
        "transition-colors first:border-t-0 hover:bg-accent/50",
        // ⚠️ A ring, not a fill — the left edge already carries the accent and a draft already recedes,
        // so the active row needs a channel neither of them is using.
        "focus-visible:outline-none data-[active]:ring-2 data-[active]:ring-ring data-[active]:ring-inset",
        // The accent edge is a colour the caller owns; where there is none, the hover supplies one.
        !accentColour && !accentClassName && "hover:border-l-primary",
        // ⚠️ A draft recedes rather than growing a dashed border: the left edge is spoken for, and two
        // things saying "unfinished" in the same 2px is one of them saying nothing.
        isDraft && "text-muted-foreground",
        accentClassName,
      )}
      style={
        {
          gridTemplateColumns: ROW_COLUMNS,
          ...(accentColour ? { borderLeftColor: accentColour } : {}),
        } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className="grid size-6 place-items-center rounded-md bg-muted text-[13px] leading-none"
      >
        {glyph}
      </span>

      <span className="flex min-w-0 items-center gap-2">
        <EntityCardName name={name} onOpen={onOpen} className="font-display text-[13px] font-bold tracking-[-0.01em]" />
        {badge}
      </span>

      {description ? (
        <span title={description} className="min-w-0 truncate text-xs text-muted-foreground">
          {description}
        </span>
      ) : (
        <span />
      )}

      {/* ⚠️ Everything that can be done sits at the right end, in the order the roomy card has it: what
          the thing measures, what can be done to it, the way out, and only then the delete — and no rule
          between the verbs and the door. That hairline was there while the door was bare text and needed
          holding off a ghost button; both are buttons now, and a rule between two bordered controls is a
          third edge inside the same two millimetres. */}
      <span className="flex items-center justify-end gap-1.5">
        {measure && <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">{measure}</span>}
        {actions}
        {footer}
        {onRemove && <EntityCardRemoveControl onRemove={onRemove} confirmLabel={confirmLabel} density="compact" />}
      </span>
    </li>
  )
}

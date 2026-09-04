import type { CSSProperties } from "react"
import { entityCardSurface, EntityCardName } from "./surface"
import { EntityCardRemoveControl } from "./remove-control"
import type { EntityCardProperties } from "./properties"

/**
 * The roomy card: glyph, name, description, chips, and a footer band carrying the way out and the
 * card's own verbs.
 *
 * ⚠️ **The glyph is a tile, not a column.** The shape this replaced gave the glyph an 80px panel of
 * its own down the left-hand side — the place the eye lands first, holding one emoji and a count — and
 * that panel is most of why a card stood 215px tall for 90px of content.
 *
 * ⚠️ **The delete sits in the corner, not in the action row, and the reason is alignment rather than
 * taste.** Hidden until hover it still reserves its width, so an action row containing it pushed every
 * button a Delete's width left of the card's edge — "Add one" floating two thirds of the way across,
 * lined up with nothing. In the corner it costs the name a few pixels it was truncating anyway.
 *
 * ⚠️ **One band at the bottom holds the door AND the actions** (Ivan, 2026-08-21). They used to be two
 * bands — a half-empty action row inside the text column, then a rule, then the door — which cost a card
 * two lines of height to carry two controls, and left the actions floating against nothing while the
 * door below them was edge to edge. Together they are one row the width of the card: the way out on the
 * left, the verbs on the right, aligned with each other across every card in the grid.
 *
 * ⚠️ **The measure rides with the name, not on a row of its own.** "14 fields" is a fact about the
 * thing, not something to do with it, and a whole line spent on one mono number is a line the grid pays
 * for in every card.
 */
export function ComfortableEntityCard({
  glyph,
  measure,
  name,
  isDraft,
  badge,
  description,
  chips,
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
    <article
      {...navigation}
      className={entityCardSurface({
        isDraft,
        hasAccent: !!(accentClassName || accentColour),
        className: [
          "flex flex-col",
          // ⚠️ A ring rather than a fill, so an accented or draft card keeps saying what it is while
          // it is also the active row. Two facts, two channels.
          "focus-visible:outline-none data-[active]:ring-2 data-[active]:ring-ring data-[active]:ring-inset",
          accentClassName,
        ]
          .filter(Boolean)
          .join(" "),
      })}
      style={accentColour ? ({ borderLeftColor: accentColour } as CSSProperties) : undefined}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 p-2.5">
        <div
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/60 font-display text-base"
        >
          {glyph}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <EntityCardName name={name} onOpen={onOpen} />
            {badge}
            {measure && (
              <span className="shrink-0 font-mono text-[11px] whitespace-nowrap text-muted-foreground">{measure}</span>
            )}
            {onRemove && (
              <div className="-my-1 ml-auto shrink-0">
                <EntityCardRemoveControl onRemove={onRemove} confirmLabel={confirmLabel} density="compact" />
              </div>
            )}
          </div>

          {description && <p className="line-clamp-1 text-xs text-muted-foreground">{description}</p>}

          {chips && <div className="mt-1 flex flex-wrap gap-1">{chips}</div>}
        </div>
      </div>

      {/* ⚠️ Below everything and edge to edge, because both halves of it leave the card's text column:
          the door goes to another level of the same thing, the actions act on the whole of it. */}
      {(footer || actions) && (
        <div className="mt-auto flex min-h-9 flex-wrap items-center gap-2 border-t px-2.5 py-1.5">
          {footer}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-1">{actions}</div>}
        </div>
      )}
    </article>
  )
}

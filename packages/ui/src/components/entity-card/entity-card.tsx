import { ComfortableEntityCard } from "./comfortable-card"
import { CompactEntityCard } from "./compact-card"
import type { EntityCardOwnProperties } from "./properties"

/**
 * One thing in a grid of things, at whichever density the screen is showing.
 *
 * ⚠️ **A card here rather than a table row, and the difference is what the eye is doing.** A row is
 * scanned down a column for one name; a card is *browsed* — the glyph, the count, the description and
 * two or three chips are looked at together. Where a list is long or a row carries one control, it
 * wanted a table.
 *
 * ⚠️ **A dispatcher and nothing else.** The two densities are two files, because they are two layouts
 * and a single component holding both grows a conditional in every line of its markup. What they share
 * — the surface, the name, the delete — is in `surface.tsx` and `remove-control.tsx`, so the two never
 * drift into being different objects.
 */
export function EntityCard({ density = "comfortable", ...card }: EntityCardOwnProperties) {
  return density === "compact" ? <CompactEntityCard {...card} /> : <ComfortableEntityCard {...card} />
}

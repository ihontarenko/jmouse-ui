import type { ReactNode } from "react"
import type { EntityCardDensity } from "./surface"

/**
 * What one thing in a grid of things is drawn from — a component type, a form, a project, a tool.
 *
 * ⚠️ **Both densities take the same properties, and that is the whole point.** A screen decides how
 * much room to give a card; it never decides which facts a card carries. What `compact` does with them
 * is documented on each field below, and dropping a field there is a rendering decision, never a
 * different call site.
 *
 * ⚠️ **Nothing here carries a colour VALUE.** `accentClassName` takes a class the product owns, so the
 * hue of a category or an issue type stays with whoever knows what those mean.
 */
export interface EntityCardProperties {
  /** One letter or one emoji. Fall back to the name's initial at the call site, never to a placeholder. */
  glyph: ReactNode
  /**
   * The second thing worth knowing — "14 fields", "3 entries". Shown in both densities: it is usually
   * the number somebody is actually scanning for.
   *
   * ⚠️ **Omit it where it is not.** A measure nobody scans for costs the card the width beside its
   * name and reads as clutter — the roomy card carries it on the title line rather than on a row of its
   * own, so it is cheap, not free.
   */
  measure?: string
  name: string
  /** Draws the card's border dashed, so an unfinished thing is legible without reading its badge. */
  isDraft?: boolean
  badge?: ReactNode
  /** Kept in both: `compact` is a full-width list, so a one-line description fits beside the name. */
  description?: string | null
  /** ⚠️ Dropped in `compact` — a row of four badges is what turns a line back into a paragraph. */
  chips?: ReactNode
  actions?: ReactNode
  /**
   * A way out of the level this screen is on, rather than one of its own verbs.
   *
   * ⚠️ **It shares the bottom band with {@link actions}**: the door on the left, the verbs on the
   * right. Two bands were two lines of height for two controls, and left the verbs aligned with
   * nothing. In `compact` the same pair sits at the right end of the single row.
   */
  footer?: ReactNode
  /**
   * A Tailwind border-left class the product owns — `border-l-emerald-500`. Turns on the accent edge.
   *
   * ⚠️ Give this OR {@link accentColour}, never both. Two forms because products arrive with two
   * different things: a fixed map of classes per issue type, or a hue computed per group at render
   * time. Neither can be expressed as the other, and neither belongs in this package.
   */
  accentClassName?: string
  /** A CSS colour the product computed — `hsl(212 62% 52%)`. The value form of {@link accentClassName}. */
  accentColour?: string
  /** Makes the name the way in. Every action below stays its own target. */
  onOpen?: () => void
  onRemove?: () => void
  /** What the delete's second press says. Name the record in it. */
  confirmLabel?: string
}

export interface EntityCardOwnProperties extends EntityCardProperties {
  density?: EntityCardDensity
}

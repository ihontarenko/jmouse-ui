/**
 * The card family: one thing in a grid of things, and one thing in a column of things.
 *
 * ⚠️ **Two shapes, deliberately not one component with three variants.** `EntityCard` is browsed — a
 * glyph, a count and a description read together — and `TicketCard` is grabbed and dragged. They share
 * the surface and nothing else, and a single component covering both would be a conditional in every
 * line of its markup.
 */
export { EntityCard } from "./entity-card"
export { EntityCardGrid } from "./entity-card-grid"
export { EntityCardDensityToggle } from "./density-toggle"
export { TicketCard } from "./ticket-card"
export { entityCardSurface, type EntityCardDensity } from "./surface"
export type { EntityCardProperties, EntityCardOwnProperties } from "./properties"

import type { StationDefinition } from "./station.js"

/**
 * The two colours a station's mark is drawn from.
 *
 * ⚠️ **Structurally the same as `@jmouse/ui`'s `MarkColours`, and deliberately not imported from it.**
 * This module is read by the Vite plugin, which runs in Node; a type import would erase, but the
 * coupling would invite somebody to reach for a value next, and the render layer has no business in a
 * build configuration. The two shapes agreeing is what lets a product pass its favicon painter here
 * unchanged.
 */
export interface IconColours {
  readonly plate: string
  readonly ink: string
}

/** A product's own mark, given the colours to draw it in — the same callback `themedFaviconPainter` takes. */
export type StationGlyph = (station: StationDefinition, colours: IconColours) => string

/**
 * How much of a maskable icon a launcher is guaranteed not to crop.
 *
 * ⚠️ **Android crops to whatever shape the launcher uses** — a circle, a squircle, a rounded square —
 * and the specification only promises the middle 80%. A glyph drawn to the edges comes back clipped on
 * exactly the devices nobody has to hand for testing.
 */
export const MASKABLE_SAFE_FRACTION = 0.8

const CANVAS = 512

/**
 * The station's mark as its own document — what goes in the manifest as `purpose: "any"`.
 *
 * Left exactly as the product drew it: at this purpose the browser draws the icon inside its own
 * container, so a mark that already knows what it looks like should not be second-guessed.
 */
export function buildStationIconSvg(
  station: StationDefinition,
  colours: IconColours,
  draw: StationGlyph,
): string {
  return draw(station, colours)
}

/**
 * The same mark, inset into the safe circle on a plate that bleeds to the edges — `purpose: "maskable"`.
 *
 * ⚠️ **The plate is drawn here rather than left to the product's own mark.** A maskable icon is
 * cropped, so whatever reaches the edge has to be the background: a mark with transparent corners
 * comes out as a glyph floating on the launcher's default grey, which is the failure this purpose
 * exists to avoid.
 *
 * The product's document is nested rather than rewritten — an inner `<svg>` with `x`/`y`/`width`/
 * `height` scales its own `viewBox` to fit, so the glyph keeps its proportions without anybody parsing
 * the markup.
 */
export function buildMaskableIconSvg(
  station: StationDefinition,
  colours: IconColours,
  draw: StationGlyph,
): string {
  // Rounded because this lands in a generated file a person reads: `51.19999999999999` is arithmetically
  // fine and looks like a defect, which costs somebody an afternoon eventually.
  const round = (value: number) => Number(value.toFixed(3))
  const inset = round((CANVAS * (1 - MASKABLE_SAFE_FRACTION)) / 2)
  const inner = round(CANVAS * MASKABLE_SAFE_FRACTION)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}">`,
    `<rect width="${CANVAS}" height="${CANVAS}" fill="${colours.plate}"/>`,
    `<svg x="${inset}" y="${inset}" width="${inner}" height="${inner}" overflow="visible">`,
    draw(station, colours),
    "</svg>",
    "</svg>",
  ].join("")
}

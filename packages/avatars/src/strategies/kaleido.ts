/**
 * `kaleido` — a mandala, built by rotating one element around a centre.
 *
 * Rings of a single shape, each ring a little further out, a little larger, a little further along the
 * hue. Radial symmetry does the rest: the same handful of numbers reads as an ornament rather than as
 * scattered marks, and no seed can produce something ugly because nothing is placed off-axis.
 */

import { hslColor } from "../colors"
import { roundToTenth } from "../random"
import { flagOf, numberOf, optionOf } from "./read"
import type { Strategy, StrategyContext, StrategyDrawing } from "./types"

const ELEMENTS = ["circle", "square", "triangle", "petal"] as const

const FULL_TURN = 360

/** Where the innermost ring starts, and how much further the outermost reaches. */
const INNER_RADIUS = 12
const RADIAL_REACH = 36

/** Each ring is rotated a few degrees past the last, so the arms spiral instead of lining up. */
const RING_TWIST = 6

function draw({ random, parameters }: StrategyContext): StrategyDrawing {
  const segments = numberOf(parameters, "segments", 8)
  const rings = numberOf(parameters, "rings", 4)
  const hue = numberOf(parameters, "hue", 190)
  const spread = numberOf(parameters, "spread", 90)
  const element = optionOf(parameters, "shape", ELEMENTS, "petal")
  const outlined = flagOf(parameters, "stroke", false)

  let body = ""

  for (let ring = 0; ring < rings; ring += 1) {
    const radius = INNER_RADIUS + (ring * RADIAL_REACH) / rings + random() * 4
    const size = 3 + random() * 7
    const color = hslColor(hue + (ring * spread) / rings, 74, 40 + ring * 6)
    const stroke = outlined ? ` stroke="${hslColor(hue + 180, 60, 88)}" stroke-width="0.8"` : ""

    // Every element is drawn at the top of the circle and rotated into place, so one shape serves
    // every arm of every ring.
    const y = 50 - radius
    const shape = elementMarkup(element, y, size, color, stroke)

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (FULL_TURN / segments) * segment + ring * RING_TWIST

      body += `<g transform="rotate(${roundToTenth(angle)} 50 50)">${shape}</g>`
    }
  }

  if (flagOf(parameters, "core", true)) {
    body += `<circle cx="50" cy="50" r="7" fill="${hslColor(hue + spread, 80, 62)}"/>`
  }

  return { viewBox: 100, background: hslColor(hue, 30, 10), body, crisp: false }
}

function elementMarkup(element: string, y: number, size: number, color: string, stroke: string): string {
  if (element === "circle") {
    return `<circle cx="50" cy="${roundToTenth(y)}" r="${roundToTenth(size)}" fill="${color}"${stroke}/>`
  }

  if (element === "square") {
    return (
      `<rect x="${roundToTenth(50 - size)}" y="${roundToTenth(y - size)}" ` +
      `width="${roundToTenth(size * 2)}" height="${roundToTenth(size * 2)}" fill="${color}"${stroke}/>`
    )
  }

  if (element === "triangle") {
    return (
      `<polygon points="50,${roundToTenth(y - size)} ${roundToTenth(50 + size)},${roundToTenth(y + size)} ` +
      `${roundToTenth(50 - size)},${roundToTenth(y + size)}" fill="${color}"${stroke}/>`
    )
  }

  return (
    `<path d="M 50 ${roundToTenth(y - size)} q ${roundToTenth(size)} ${roundToTenth(size)} 0 ${roundToTenth(size * 2)} ` +
    `q ${roundToTenth(-size)} ${roundToTenth(-size)} 0 ${roundToTenth(-size * 2)}" fill="${color}"${stroke}/>`
  )
}

export const kaleidoStrategy: Strategy = {
  id: "kaleido",
  name: "Kaleidoscope",
  tag: "vector · radial symmetry",
  controls: [
    { kind: "range", key: "segments", label: "Segments", minimum: 3, maximum: 14, step: 1, fallback: 8 },
    { kind: "range", key: "rings", label: "Rings", minimum: 2, maximum: 7, step: 1, fallback: 4 },
    { kind: "select", key: "shape", label: "Element", options: ELEMENTS, fallback: "petal" },
    { kind: "range", key: "hue", label: "Hue", minimum: 0, maximum: 359, step: 1, fallback: 190 },
    { kind: "range", key: "spread", label: "Hue spread", minimum: 0, maximum: 180, step: 1, fallback: 90 },
    { kind: "toggle", key: "stroke", label: "Outline", fallback: false },
    { kind: "toggle", key: "core", label: "Core", fallback: true },
  ],
  draw,
}

/**
 * `initials` — one or two letters on a gradient tile.
 *
 * The strategy that reads its seed as *text* rather than as randomness: everything about the tile comes
 * from the controls, and only the letters come from the string. It is the closest thing here to the
 * state every product starts people in, and the reason somebody who wants their initials does not have
 * to leave this picker to keep them.
 */

import { hslColor } from "../colors"
import { escapeMarkup } from "../svg"
import { flagOf, numberOf, optionOf, textOf } from "./read"
import type { Strategy, StrategyContext, StrategyDrawing } from "./types"

const SHAPES = ["square", "rounded", "circle"] as const
const WEIGHTS = ["400", "700", "900"] as const
const PATTERNS = ["none", "dots", "stripes", "grid"] as const

/** What a seed with no letters in it at all draws. */
const NOTHING_LEGIBLE = "?"

const MONOSPACED_STACK = "ui-monospace, SFMono-Regular, Menlo, monospace"
const TEXT_STACK = "Inter, Helvetica, Arial, sans-serif"

/**
 * Up to two initials from a seed.
 *
 * Splits on the separators a username or an address actually uses, so `ivan.hontarenko`, `ivan_h` and
 * `ivan@innoventa.net` all give the same two letters as `Ivan Hontarenko`.
 */
function initialsOf(source: string): string {
  const letters = source
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()

  return letters || NOTHING_LEGIBLE
}

function draw({ parameters, uniqueId, seed }: StrategyContext): StrategyDrawing {
  const gradientId = `initialsGradient${uniqueId}`
  const patternId = `initialsPattern${uniqueId}`

  const requested = textOf(parameters, "text", "").trim()
  const letters = initialsOf(requested || seed)

  const hue = numberOf(parameters, "hue", 215)
  const angle = numberOf(parameters, "angle", 45)
  const shape = optionOf(parameters, "shape", SHAPES, "rounded")
  const weight = optionOf(parameters, "weight", WEIGHTS, "700")
  const pattern = optionOf(parameters, "pattern", PATTERNS, "none")

  let definitions =
    `<linearGradient id="${gradientId}" gradientTransform="rotate(${angle} 0.5 0.5)">` +
    `<stop offset="0" stop-color="${hslColor(hue, 72, 58)}"/>` +
    `<stop offset="1" stop-color="${hslColor(hue + 55, 68, 34)}"/></linearGradient>`

  if (pattern === "dots") {
    definitions += `<pattern id="${patternId}" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="#fff" opacity="0.18"/></pattern>`
  } else if (pattern === "stripes") {
    definitions += `<pattern id="${patternId}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="12" fill="#fff" opacity="0.12"/></pattern>`
  } else if (pattern === "grid") {
    definitions += `<pattern id="${patternId}" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0 H0 V12" stroke="#fff" stroke-width="1" opacity="0.15" fill="none"/></pattern>`
  }

  const tile = (fillId: string) => {
    if (shape === "circle") {
      return `<circle cx="50" cy="50" r="50" fill="url(#${fillId})"/>`
    }

    if (shape === "rounded") {
      return `<rect width="100" height="100" rx="22" fill="url(#${fillId})"/>`
    }

    return `<rect width="100" height="100" fill="url(#${fillId})"/>`
  }

  let body = tile(gradientId)

  // The pattern is the same tile again, laid over the gradient — which is what keeps it inside a
  // circle's edge rather than squaring it off.
  if (pattern !== "none") {
    body += tile(patternId)
  }

  const fontFamily = flagOf(parameters, "monospaced", false) ? MONOSPACED_STACK : TEXT_STACK

  body +=
    `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" fill="#fff" ` +
    `font-family="${fontFamily}" font-size="${letters.length > 1 ? 38 : 50}" ` +
    `font-weight="${weight}" letter-spacing="1">${escapeMarkup(letters)}</text>`

  return { viewBox: 100, background: null, body, definitions, crisp: false }
}

export const initialsStrategy: Strategy = {
  id: "initials",
  name: "Initials",
  tag: "vector · gradient tile",
  controls: [
    { kind: "text", key: "text", label: "Text (empty = from the seed)", fallback: "" },
    { kind: "select", key: "shape", label: "Shape", options: SHAPES, fallback: "rounded" },
    { kind: "range", key: "hue", label: "Hue", minimum: 0, maximum: 359, step: 1, fallback: 215 },
    { kind: "range", key: "angle", label: "Gradient angle", minimum: 0, maximum: 360, step: 5, fallback: 45 },
    { kind: "select", key: "weight", label: "Font weight", options: WEIGHTS, fallback: "700" },
    { kind: "select", key: "pattern", label: "Pattern", options: PATTERNS, fallback: "none" },
    { kind: "toggle", key: "monospaced", label: "Monospaced", fallback: false },
  ],
  draw,
}

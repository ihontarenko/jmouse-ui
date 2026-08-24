/**
 * `meme-face` — a doodle, drawn with a wobbling line.
 *
 * The only strategy with no grid and no symmetry helper. A head is a smoothed ring whose radius jitters
 * per seed, and each expression is a hand-placed set of strokes on top — which is why they read as
 * drawn rather than generated.
 */

import { ringPoints, smoothPath } from "../svg"
import { AUTOMATIC, chosenOf, flagOf, numberOf } from "./read"
import type { Strategy, StrategyContext, StrategyDrawing } from "./types"

const EXPRESSIONS = ["shock", "smug", "cry", "deadpan", "derp", "angry", "bliss"] as const
const HEAD_SHAPES = ["round", "potato", "long", "wide"] as const
const FILL_NAMES = ["white", "cream", "sky", "pink", "none"] as const

const FILLS: Record<string, string> = {
  white: "#ffffff",
  cream: "#ffe9c7",
  sky: "#d7f0ff",
  pink: "#ffd9e8",
  none: "none",
}

const INK = "#1b1b22"
const TEAR = "#7ec8f2"
const TONGUE = "#f2748f"
const BLUSH = "#ff8fa3"

/** Where the eyes go, in the 100-unit viewBox every vector strategy shares. */
const LEFT_EYE_X = 38
const RIGHT_EYE_X = 62
const EYE_Y = 44

/** Ring nodes in a head. Enough to wobble, few enough to stay a head. */
const HEAD_NODES = 13

/** The wobble control is a 0–12 dial; the ring wants a fraction of the radius. */
const WOBBLE_SCALE = 40

function draw({ random, parameters }: StrategyContext): StrategyDrawing {
  const expression = chosenOf(random, parameters, "expression", EXPRESSIONS)
  const headShape = chosenOf(random, parameters, "headShape", HEAD_SHAPES)
  // ⚠️ "none" is a real choice but never an automatic one — an unfilled doodle on a dark board is a
  // handful of disconnected strokes.
  const fill = chosenOf(random, parameters, "fill", FILL_NAMES, FILL_NAMES.slice(0, -1))

  const paper = FILLS[fill]
  const lineWidth = numberOf(parameters, "lineWidth", 4)
  const wobble = numberOf(parameters, "wobble", 5)

  const radiusX = headShape === "long" ? 29 : headShape === "wide" ? 40 : 34
  const radiusY = headShape === "long" ? 42 : headShape === "wide" ? 31 : headShape === "potato" ? 37 : 34

  const head = smoothPath(ringPoints(random, HEAD_NODES, radiusX, radiusY, wobble / WOBBLE_SCALE, 50, 50))
  const stroke = `stroke="${INK}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"`

  let body = `<path d="${head}" fill="${paper}" stroke="${INK}" stroke-width="${lineWidth}" stroke-linejoin="round"/>`

  const arcUp = (x: number, y: number) => `<path d="M ${x - 8} ${y + 3} Q ${x} ${y - 6} ${x + 8} ${y + 3}" ${stroke}/>`
  const arcDown = (x: number, y: number) => `<path d="M ${x - 8} ${y - 3} Q ${x} ${y + 6} ${x + 8} ${y - 3}" ${stroke}/>`

  const eyeball = (x: number, y: number, radius: number, pupil: number, offsetX = 0, offsetY = 0) =>
    `<circle cx="${x}" cy="${y}" r="${radius}" fill="#fff" stroke="${INK}" stroke-width="${lineWidth}"/>` +
    `<circle cx="${x + offsetX}" cy="${y + offsetY}" r="${pupil}" fill="${INK}"/>`

  if (expression === "shock") {
    body += eyeball(LEFT_EYE_X, EYE_Y, 10, 3.5, 0, -1) + eyeball(RIGHT_EYE_X, EYE_Y, 10, 3.5, 0, -1)
    body += `<path d="M 30 28 Q 38 22 46 27" ${stroke}/><path d="M 54 27 Q 62 22 70 28" ${stroke}/>`
    body += `<ellipse cx="50" cy="69" rx="8" ry="11" fill="${INK}"/>`
  } else if (expression === "smug") {
    body += arcDown(LEFT_EYE_X, EYE_Y) + arcDown(RIGHT_EYE_X, EYE_Y)
    body += `<circle cx="${LEFT_EYE_X + 3}" cy="${EYE_Y + 1}" r="2" fill="${INK}"/>`
    body += `<circle cx="${RIGHT_EYE_X - 3}" cy="${EYE_Y + 1}" r="2" fill="${INK}"/>`
    body += `<path d="M 30 33 L 45 36" ${stroke}/><path d="M 70 33 L 55 36" ${stroke}/>`
    body += `<path d="M 34 64 Q 48 60 66 70" ${stroke}/>`
  } else if (expression === "cry") {
    body += arcUp(LEFT_EYE_X, EYE_Y) + arcUp(RIGHT_EYE_X, EYE_Y)
    body += tear(LEFT_EYE_X, EYE_Y + 6, lineWidth)
    body += tear(RIGHT_EYE_X, EYE_Y + 6, lineWidth)
    body += `<path d="M 36 66 Q 50 88 64 66 Q 50 74 36 66 Z" fill="${INK}"/>`
  } else if (expression === "deadpan") {
    body += `<circle cx="${LEFT_EYE_X}" cy="${EYE_Y}" r="3" fill="${INK}"/>`
    body += `<circle cx="${RIGHT_EYE_X}" cy="${EYE_Y}" r="3" fill="${INK}"/>`
    body += `<path d="M 30 34 L 46 34" ${stroke}/><path d="M 54 34 L 70 34" ${stroke}/>`
    body += `<path d="M 38 68 L 62 68" ${stroke}/>`
  } else if (expression === "derp") {
    body += eyeball(LEFT_EYE_X - 2, EYE_Y - 2, 11, 4, -3, 3) + eyeball(RIGHT_EYE_X + 1, EYE_Y + 2, 6, 2.5, 2, -2)
    body += `<path d="M 34 66 q 6 9 12 0 q 6 -9 12 0" ${stroke}/>`
    body += `<path d="M 46 70 q 5 10 9 0 z" fill="${TONGUE}" stroke="${INK}" stroke-width="${lineWidth * 0.8}"/>`
  } else if (expression === "angry") {
    body += `<circle cx="${LEFT_EYE_X}" cy="${EYE_Y}" r="4" fill="${INK}"/>`
    body += `<circle cx="${RIGHT_EYE_X}" cy="${EYE_Y}" r="4" fill="${INK}"/>`
    body += `<path d="M 29 31 L 45 39" ${stroke}/><path d="M 71 31 L 55 39" ${stroke}/>`
    body += `<path d="M 33 70 l 6 -7 l 6 7 l 6 -7 l 6 7" ${stroke}/>`
  } else {
    body += arcUp(LEFT_EYE_X, EYE_Y) + arcUp(RIGHT_EYE_X, EYE_Y)
    body += `<path d="M 33 60 Q 50 78 67 60" ${stroke}/>`
  }

  if (flagOf(parameters, "blush", false) || expression === "bliss") {
    body += `<ellipse cx="26" cy="57" rx="7" ry="4" fill="${BLUSH}" opacity="0.55"/>`
    body += `<ellipse cx="74" cy="57" rx="7" ry="4" fill="${BLUSH}" opacity="0.55"/>`
  }

  if (flagOf(parameters, "sweat", false)) {
    body += `<path d="M 76 20 q 6 9 0 13 q -6 -4 0 -13" fill="${TEAR}" stroke="${INK}" stroke-width="${lineWidth * 0.7}"/>`
  }

  // ⚠️ No background: a doodle wants the surface it is placed on, and a filled square would put a white
  // card behind every avatar in a dark theme.
  return { viewBox: 100, background: null, body, crisp: false }
}

function tear(x: number, y: number, lineWidth: number): string {
  return `<path d="M ${x} ${y} q 4 8 0 11 q -4 -3 0 -11" fill="${TEAR}" stroke="${INK}" stroke-width="${lineWidth * 0.7}"/>`
}

export const memeFaceStrategy: Strategy = {
  id: "meme-face",
  name: "Meme face",
  tag: "vector · doodle line",
  controls: [
    { kind: "select", key: "expression", label: "Expression", options: [AUTOMATIC, ...EXPRESSIONS], fallback: AUTOMATIC },
    { kind: "select", key: "headShape", label: "Head shape", options: [AUTOMATIC, ...HEAD_SHAPES], fallback: AUTOMATIC },
    { kind: "range", key: "lineWidth", label: "Line width", minimum: 2, maximum: 8, step: 0.5, fallback: 4 },
    { kind: "range", key: "wobble", label: "Hand wobble", minimum: 0, maximum: 12, step: 1, fallback: 5 },
    { kind: "select", key: "fill", label: "Fill", options: [AUTOMATIC, ...FILL_NAMES], fallback: AUTOMATIC },
    { kind: "toggle", key: "sweat", label: "Sweat drop", fallback: false },
    { kind: "toggle", key: "blush", label: "Blush", fallback: false },
  ],
  draw,
}

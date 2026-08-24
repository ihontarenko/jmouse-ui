/**
 * `blob-buddy` — a jelly creature with a gradient and however many eyes.
 *
 * A smoothed ring for a body, a two-stop gradient chosen by hue, and eyes spaced evenly across it. The
 * one strategy where the pupils drift a little off centre per seed, which is most of why two blobs with
 * the same settings still read as two different creatures.
 */

import { hslColor } from "../colors"
import { roundToTenth } from "../random"
import { ringPoints, smoothPath } from "../svg"
import { AUTOMATIC, chosenOf, flagOf, numberOf } from "./read"
import type { Strategy, StrategyContext, StrategyDrawing } from "./types"

const MOUTHS = ["smile", "o", "wave", "fangs", "none"] as const

const INK = "#1a1526"

/** Where the eyes may sit, and how wide that band is. */
const EYE_BAND_START = 22
const EYE_BAND_WIDTH = 56
const EYE_Y = 46

const AS_PERCENTAGE = 100

function draw({ random, parameters, uniqueId }: StrategyContext): StrategyDrawing {
  const hue = numberOf(parameters, "hue", 265)
  const spread = numberOf(parameters, "spread", 60)
  const points = numberOf(parameters, "points", 8)
  const wobble = numberOf(parameters, "wobble", 24)
  const eyeCount = numberOf(parameters, "eyes", 2)

  // ⚠️ The gradient id carries the descriptor's unique id. Two blobs on one page whose gradients share
  // a name are one blob drawn twice, and only when they happen to appear together.
  const gradientId = `blobGradient${uniqueId}`

  const outline = smoothPath(ringPoints(random, points, 38, 36, wobble / AS_PERCENTAGE, 50, 52))

  const definitions =
    `<linearGradient id="${gradientId}" x1="0" y1="0" x2="0.6" y2="1">` +
    `<stop offset="0" stop-color="${hslColor(hue, 85, 68)}"/>` +
    `<stop offset="1" stop-color="${hslColor(hue + spread, 80, 45)}"/></linearGradient>`

  let body = `<path d="${outline}" fill="url(#${gradientId})"/>`

  if (flagOf(parameters, "gloss", true)) {
    body += `<ellipse cx="36" cy="30" rx="12" ry="7" fill="#fff" opacity="0.35" transform="rotate(-25 36 30)"/>`
  }

  if (flagOf(parameters, "antenna", false)) {
    body += `<path d="M 50 18 q 3 -12 10 -14" stroke="${hslColor(hue + spread, 70, 40)}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    body += `<circle cx="61" cy="4" r="5" fill="${hslColor(hue + 180, 90, 62)}"/>`
  }

  const step = EYE_BAND_WIDTH / (eyeCount + 1)

  for (let index = 1; index <= eyeCount; index += 1) {
    const x = EYE_BAND_START + step * index
    // Four eyes at nine units across would overlap, so a crowd gets smaller eyes.
    const radius = eyeCount > 2 ? 6 : 9

    body += `<circle cx="${roundToTenth(x)}" cy="${EYE_Y}" r="${radius}" fill="#fff"/>`
    body +=
      `<circle cx="${roundToTenth(x + (random() - 0.5) * 4)}" cy="${roundToTenth(EYE_Y + (random() - 0.5) * 4)}" ` +
      `r="${radius * 0.42}" fill="${INK}"/>`
  }

  const mouth = chosenOf(random, parameters, "mouth", MOUTHS, MOUTHS.slice(0, -1))
  const stroke = `stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"`

  if (mouth === "smile") {
    body += `<path d="M 40 64 Q 50 74 60 64" ${stroke}/>`
  } else if (mouth === "o") {
    body += `<ellipse cx="50" cy="67" rx="6" ry="8" fill="${INK}"/>`
  } else if (mouth === "wave") {
    body += `<path d="M 38 66 q 6 6 12 0 q 6 -6 12 0" ${stroke}/>`
  } else if (mouth === "fangs") {
    body += `<path d="M 38 62 h 24 l -4 8 l -4 -6 l -4 6 l -4 -6 l -4 6 z" fill="${INK}"/>`
  }

  return { viewBox: 100, background: null, body, definitions, crisp: false }
}

export const blobBuddyStrategy: Strategy = {
  id: "blob-buddy",
  name: "Jelly blob",
  tag: "vector · gradient",
  controls: [
    { kind: "range", key: "points", label: "Outline nodes", minimum: 5, maximum: 12, step: 1, fallback: 8 },
    { kind: "range", key: "wobble", label: "Irregularity, %", minimum: 0, maximum: 55, step: 1, fallback: 24 },
    { kind: "range", key: "hue", label: "Hue", minimum: 0, maximum: 359, step: 1, fallback: 265 },
    { kind: "range", key: "spread", label: "Gradient spread", minimum: 0, maximum: 180, step: 1, fallback: 60 },
    { kind: "range", key: "eyes", label: "Eyes", minimum: 1, maximum: 4, step: 1, fallback: 2 },
    { kind: "select", key: "mouth", label: "Mouth", options: [AUTOMATIC, ...MOUTHS], fallback: AUTOMATIC },
    { kind: "toggle", key: "gloss", label: "Gloss", fallback: true },
    { kind: "toggle", key: "antenna", label: "Antenna", fallback: false },
  ],
  draw,
}

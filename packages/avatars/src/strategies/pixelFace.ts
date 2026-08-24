/**
 * `pixel-face` — a 16x16 face assembled from features.
 *
 * Unlike the cellular automaton next door, nothing here is discovered: a skull, a hairstyle, a pair of
 * eyes and a mouth are each placed at coordinates somebody chose. Noise-generated faces look like
 * noise; a face reads as a face because the eyes are where eyes go.
 */

import {
  HAIRS,
  HAIR_NAMES,
  INK,
  LIGHT,
  PALETTES,
  PALETTE_NAMES,
  SKINS,
  SKIN_NAMES,
  shiftColor,
} from "../colors"
import { pick } from "../random"
import { gridToSvg, makeGrid, setMirroredPixel, setMirroredRow } from "../svg"
import { AUTOMATIC, chosenOf, flagOf } from "./read"
import type { Strategy, StrategyContext, StrategyDrawing } from "./types"

const HAIR_STYLES = ["short", "long", "spiky", "cap", "mohawk", "bald"] as const
const EYE_STYLES = ["dots", "big", "sleepy", "visor"] as const
const MOUTH_STYLES = ["smile", "grin", "open", "flat"] as const

/** How often a face gets eyebrows and a nose. Both read better as sometimes than as always. */
const BROW_CHANCE = 0.55
const NOSE_CHANCE = 0.6

const TONGUE = "#c2415a"
const BLUSH = "#e8737e"

function draw({ random, parameters }: StrategyContext): StrategyDrawing {
  const palette = PALETTES[chosenOf(random, parameters, "palette", PALETTE_NAMES)]
  const skin = SKINS[chosenOf(random, parameters, "skin", SKIN_NAMES)]
  const hair = HAIRS[chosenOf(random, parameters, "hairColor", HAIR_NAMES)]

  const accent = pick(random, palette.colors)
  const clothing = pick(random, palette.colors)
  const grid = makeGrid(16)

  // Shoulders, then neck, then the head over both.
  setMirroredRow(grid, 15, 2, 7, clothing)
  setMirroredRow(grid, 14, 4, 7, clothing)
  setMirroredRow(grid, 14, 6, 7, skin.shade)
  setMirroredRow(grid, 13, 6, 7, skin.base)

  for (let y = 3; y <= 12; y += 1) {
    setMirroredRow(grid, y, 3, 7, skin.base)
  }

  // The corners come back off, which is what rounds the skull.
  setMirroredPixel(grid, 3, 3, null)
  setMirroredPixel(grid, 3, 12, null)
  setMirroredPixel(grid, 2, 8, skin.base)
  setMirroredPixel(grid, 2, 9, skin.shade)

  const hairStyle = chosenOf(random, parameters, "hairStyle", HAIR_STYLES)

  if (hairStyle === "short" || hairStyle === "long") {
    setMirroredRow(grid, 2, 4, 7, hair)
    setMirroredRow(grid, 3, 3, 7, hair)

    if (hairStyle === "long") {
      for (let y = 4; y <= 11; y += 1) {
        setMirroredPixel(grid, 3, y, hair)
      }
    }
  } else if (hairStyle === "spiky") {
    setMirroredRow(grid, 3, 3, 7, hair)
    setMirroredPixel(grid, 4, 2, hair)
    setMirroredPixel(grid, 6, 2, hair)
    setMirroredPixel(grid, 5, 1, hair)
  } else if (hairStyle === "cap") {
    setMirroredRow(grid, 2, 4, 7, hair)
    setMirroredRow(grid, 3, 3, 7, hair)
    setMirroredRow(grid, 4, 2, 7, accent)
  } else if (hairStyle === "mohawk") {
    setMirroredPixel(grid, 7, 1, hair)
    setMirroredPixel(grid, 7, 2, hair)
    setMirroredRow(grid, 3, 5, 7, hair)
  }

  if (random() < BROW_CHANCE) {
    setMirroredPixel(grid, 5, 6, shiftColor(hair, -20))
    setMirroredPixel(grid, 6, 6, shiftColor(hair, -20))
  }

  const eyes = chosenOf(random, parameters, "eyes", EYE_STYLES)

  if (eyes === "dots") {
    setMirroredPixel(grid, 5, 8, INK)
  } else if (eyes === "big") {
    for (let x = 5; x <= 6; x += 1) {
      setMirroredPixel(grid, x, 7, LIGHT)
      setMirroredPixel(grid, x, 8, LIGHT)
    }

    setMirroredPixel(grid, 6, 8, INK)
  } else if (eyes === "sleepy") {
    setMirroredPixel(grid, 5, 8, INK)
    setMirroredPixel(grid, 6, 8, INK)
  } else {
    setMirroredRow(grid, 8, 4, 7, accent)
    setMirroredPixel(grid, 5, 8, INK)
    setMirroredPixel(grid, 6, 8, INK)
  }

  if (random() < NOSE_CHANCE) {
    setMirroredPixel(grid, 7, 10, skin.shade)
  }

  const mouth = chosenOf(random, parameters, "mouth", MOUTH_STYLES)

  if (mouth === "smile") {
    setMirroredPixel(grid, 6, 11, INK)
    setMirroredPixel(grid, 7, 11, INK)
  } else if (mouth === "grin") {
    setMirroredRow(grid, 11, 5, 7, INK)
    setMirroredPixel(grid, 6, 11, LIGHT)
  } else if (mouth === "open") {
    setMirroredPixel(grid, 6, 11, INK)
    setMirroredPixel(grid, 7, 11, INK)
    setMirroredPixel(grid, 6, 12, TONGUE)
    setMirroredPixel(grid, 7, 12, TONGUE)
  } else {
    setMirroredPixel(grid, 7, 11, INK)
  }

  if (flagOf(parameters, "blush", false)) {
    setMirroredPixel(grid, 4, 10, BLUSH)
  }

  if (flagOf(parameters, "beard", false)) {
    setMirroredRow(grid, 12, 4, 7, hair)
    setMirroredPixel(grid, 3, 11, hair)
  }

  return {
    viewBox: 16,
    background: flagOf(parameters, "transparent", false) ? null : palette.background,
    body: gridToSvg(grid),
    crisp: true,
  }
}

export const pixelFaceStrategy: Strategy = {
  id: "pixel-face",
  name: "Pixel face",
  tag: "16×16 · assembled features",
  controls: [
    { kind: "select", key: "palette", label: "Palette", options: [AUTOMATIC, ...PALETTE_NAMES], fallback: AUTOMATIC },
    { kind: "select", key: "skin", label: "Skin tone", options: [AUTOMATIC, ...SKIN_NAMES], fallback: AUTOMATIC },
    { kind: "select", key: "hairStyle", label: "Hair", options: [AUTOMATIC, ...HAIR_STYLES], fallback: AUTOMATIC },
    { kind: "select", key: "hairColor", label: "Hair colour", options: [AUTOMATIC, ...HAIR_NAMES], fallback: AUTOMATIC },
    { kind: "select", key: "eyes", label: "Eyes", options: [AUTOMATIC, ...EYE_STYLES], fallback: AUTOMATIC },
    { kind: "select", key: "mouth", label: "Mouth", options: [AUTOMATIC, ...MOUTH_STYLES], fallback: AUTOMATIC },
    { kind: "toggle", key: "beard", label: "Beard", fallback: false },
    { kind: "toggle", key: "blush", label: "Blush", fallback: false },
    { kind: "toggle", key: "transparent", label: "Transparent background", fallback: false },
  ],
  draw,
}

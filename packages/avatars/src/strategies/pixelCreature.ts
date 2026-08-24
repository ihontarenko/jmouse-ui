/**
 * `pixel-creature` — a cellular automaton that grows something with eyes.
 *
 * The opposite approach to `pixel-face`: nothing is placed, everything is discovered. Random cells,
 * mirrored down the middle, then smoothed by a majority rule until the noise collapses into a
 * silhouette. The eyes go on last, into the first pair of adjacent cells found near the top — which is
 * what turns a shape into a creature.
 */

import { INK, LIGHT, PALETTES, PALETTE_NAMES, shiftColor } from "../colors"
import { pick } from "../random"
import { gridToSvg, makeGrid, setMirroredPixel, setPixel } from "../svg"
import { AUTOMATIC, chosenOf, flagOf, numberOf } from "./read"
import type { Strategy, StrategyContext, StrategyDrawing } from "./types"

/** How much likelier the spine column is to be solid. Without it a creature grows in two halves. */
const SPINE_BIAS = 0.25

const AS_PERCENTAGE = 100

function draw({ random, parameters }: StrategyContext): StrategyDrawing {
  const palette = PALETTES[chosenOf(random, parameters, "palette", PALETTE_NAMES)]

  const requestedSize = numberOf(parameters, "gridSize", 12)
  const size = requestedSize % 2 ? requestedSize + 1 : requestedSize
  const half = size / 2

  const density = numberOf(parameters, "density", 48)
  const smoothingPasses = numberOf(parameters, "smooth", 2)
  const speckle = numberOf(parameters, "speckle", 18)

  const body = pick(random, palette.colors)
  const speckleColor = shiftColor(body, 40)
  const outlineColor = shiftColor(palette.background, -6)

  const grid = makeGrid(size)
  const solid = new Array<boolean>(size * size).fill(false)

  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < half; x += 1) {
      const filled = random() < density / AS_PERCENTAGE + (x === half - 1 ? SPINE_BIAS : 0)

      solid[y * size + x] = filled
      solid[y * size + (size - 1 - x)] = filled
    }
  }

  for (let pass = 0; pass < smoothingPasses; pass += 1) {
    const next = solid.slice()

    for (let y = 1; y < size - 1; y += 1) {
      for (let x = 1; x < half; x += 1) {
        let neighbours = 0

        for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
          for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
            if (!deltaX && !deltaY) {
              continue
            }

            if (solid[(y + deltaY) * size + (x + deltaX)]) {
              neighbours += 1
            }
          }
        }

        // Crowded cells fill in, lonely ones die, and the rest are left alone — the rule that turns
        // static into a silhouette in two passes.
        const filled = neighbours >= 5 ? true : neighbours <= 2 ? false : solid[y * size + x]

        next[y * size + x] = filled
        next[y * size + (size - 1 - x)] = filled
      }
    }

    for (let index = 0; index < solid.length; index += 1) {
      solid[index] = next[index]
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (solid[y * size + x]) {
        setPixel(grid, x, y, random() < speckle / AS_PERCENTAGE ? speckleColor : body)
      }
    }
  }

  if (flagOf(parameters, "outline", true)) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (solid[y * size + x]) {
          continue
        }

        const touchesBody =
          (x > 0 && solid[y * size + x - 1]) ||
          (x < size - 1 && solid[y * size + x + 1]) ||
          (y > 0 && solid[(y - 1) * size + x]) ||
          (y < size - 1 && solid[(y + 1) * size + x])

        if (touchesBody) {
          setPixel(grid, x, y, outlineColor)
        }
      }
    }
  }

  if (flagOf(parameters, "eyes", true)) {
    placeEyes(grid, solid, size, half)
  }

  return { viewBox: size, background: palette.background, body: gridToSvg(grid), crisp: true }
}

/**
 * Two eyes into the topmost row that has room for them.
 *
 * ⚠️ The search runs over the left half and mirrors, so the pair always straddles the axis. Placing
 * each eye independently is how a creature ends up cross-eyed on half its seeds.
 */
function placeEyes(
  grid: ReturnType<typeof makeGrid>,
  solid: boolean[],
  size: number,
  half: number,
): void {
  for (let y = 2; y < Math.floor(size / 2); y += 1) {
    for (let x = 2; x < half - 1; x += 1) {
      if (solid[y * size + x] && solid[y * size + x + 1]) {
        setMirroredPixel(grid, x, y, LIGHT)
        setPixel(grid, x + 1, y, INK)
        setPixel(grid, size - 2 - x, y, INK)
        return
      }
    }
  }
}

export const pixelCreatureStrategy: Strategy = {
  id: "pixel-creature",
  name: "Pixel creature",
  tag: "cellular automaton",
  controls: [
    { kind: "range", key: "gridSize", label: "Grid", minimum: 8, maximum: 18, step: 2, fallback: 12 },
    { kind: "range", key: "density", label: "Density, %", minimum: 25, maximum: 75, step: 1, fallback: 48 },
    { kind: "range", key: "smooth", label: "Smoothing passes", minimum: 0, maximum: 4, step: 1, fallback: 2 },
    { kind: "range", key: "speckle", label: "Speckle, %", minimum: 0, maximum: 45, step: 1, fallback: 18 },
    { kind: "toggle", key: "outline", label: "Outline", fallback: true },
    { kind: "toggle", key: "eyes", label: "Eyes", fallback: true },
    { kind: "select", key: "palette", label: "Palette", options: [AUTOMATIC, ...PALETTE_NAMES], fallback: AUTOMATIC },
  ],
  draw,
}

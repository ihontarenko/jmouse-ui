/**
 * `identicon` — the classic mirrored hash grid.
 *
 * No face, no creature: just a pattern that is unmistakably *this* string and unmistakably not that
 * one. The one strategy nobody has to like the look of, because its job is telling two rows apart at
 * sixteen pixels.
 */

import { PALETTES, PALETTE_NAMES } from "../colors"
import { pick } from "../random"
import { AUTOMATIC, chosenOf, flagOf, numberOf, optionOf } from "./read"
import type { Strategy, StrategyContext, StrategyDrawing } from "./types"

const CELL_SHAPES = ["square", "circle", "diamond"] as const

const AS_PERCENTAGE = 100

function draw({ random, parameters }: StrategyContext): StrategyDrawing {
  const palette = PALETTES[chosenOf(random, parameters, "palette", PALETTE_NAMES)]

  const cells = numberOf(parameters, "cells", 6)
  const density = numberOf(parameters, "density", 52)
  const colorCount = numberOf(parameters, "colorCount", 2)
  const cellShape = optionOf(parameters, "cellShape", CELL_SHAPES, "square")
  const padding = flagOf(parameters, "padding", true) ? 1 : 0

  const viewBox = cells + padding * 2
  const colors = [...palette.colors].sort(() => random() - 0.5).slice(0, colorCount)
  const half = Math.ceil(cells / 2)

  let body = ""

  const emit = (cellX: number, cellY: number, color: string) => {
    const x = padding + cellX
    const y = padding + cellY

    if (cellShape === "circle") {
      body += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.5" fill="${color}"/>`
    } else if (cellShape === "diamond") {
      body += `<polygon points="${x + 0.5},${y} ${x + 1},${y + 0.5} ${x + 0.5},${y + 1} ${x},${y + 0.5}" fill="${color}"/>`
    } else {
      body += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`
    }
  }

  for (let cellY = 0; cellY < cells; cellY += 1) {
    for (let cellX = 0; cellX < half; cellX += 1) {
      if (random() > density / AS_PERCENTAGE) {
        continue
      }

      const color = pick(random, colors)

      emit(cellX, cellY, color)

      // An odd cell count has a middle column, and mirroring it onto itself doubles the markup.
      if (cellX !== cells - 1 - cellX) {
        emit(cells - 1 - cellX, cellY, color)
      }
    }
  }

  return { viewBox, background: palette.background, body, crisp: cellShape === "square" }
}

export const identiconStrategy: Strategy = {
  id: "identicon",
  name: "Hash grid",
  tag: "mirrored identicon",
  controls: [
    { kind: "range", key: "cells", label: "Cells per row", minimum: 4, maximum: 9, step: 1, fallback: 6 },
    { kind: "range", key: "density", label: "Fill, %", minimum: 20, maximum: 85, step: 1, fallback: 52 },
    { kind: "range", key: "colorCount", label: "Colours", minimum: 1, maximum: 4, step: 1, fallback: 2 },
    { kind: "select", key: "cellShape", label: "Cell shape", options: CELL_SHAPES, fallback: "square" },
    { kind: "toggle", key: "padding", label: "Padding", fallback: true },
    { kind: "select", key: "palette", label: "Palette", options: [AUTOMATIC, ...PALETTE_NAMES], fallback: AUTOMATIC },
  ],
  draw,
}

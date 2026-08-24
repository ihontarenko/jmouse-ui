/**
 * `pixel-classic` — the pre-package generator, wearing the strategy interface.
 *
 * A thin adapter and nothing else: `faces.ts` is untouched and stays untouched, and this file only
 * turns its runs into the same `<rect>` markup every other pixel strategy emits.
 *
 * ⚠️ **It has no controls, and that is correct rather than unfinished.** The old generator took a seed
 * and nothing else, so every control offered here would be a control that does nothing to a stored
 * value. Somebody who wants dials has seven other strategies.
 */

import type { Strategy, StrategyContext, StrategyDrawing } from "../types"
import { pixelFace } from "./faces"

export { PRESET_SEEDS, rollSeed } from "./faces"

function draw({ seed }: StrategyContext): StrategyDrawing {
  const face = pixelFace(seed)

  const body = face.runs
    .map((run) => `<rect x="${run.x}" y="${run.y}" width="${run.width}" height="1" fill="${run.fill}"/>`)
    .join("")

  return { viewBox: face.size, background: face.background, body, crisp: true }
}

export const pixelClassicStrategy: Strategy = {
  id: "pixel-classic",
  name: "Classic face",
  tag: "12×12 · drawn parts",
  controls: [],
  draw,
}

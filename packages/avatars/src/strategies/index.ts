/**
 * The registry — the one place that knows how many strategies there are.
 *
 * ⚠️ **Order is what the picker shows, so it is a design decision rather than an accident.** The two
 * that draw a person come first, then the two that draw a creature, then the abstract ones; the legacy
 * generator sits last because nobody picking a new avatar is looking for it.
 */

import { blobBuddyStrategy } from "./blobBuddy"
import { identiconStrategy } from "./identicon"
import { initialsStrategy } from "./initials"
import { kaleidoStrategy } from "./kaleido"
import { memeFaceStrategy } from "./memeFace"
import { pixelClassicStrategy } from "./pixelClassic"
import { pixelCreatureStrategy } from "./pixelCreature"
import { pixelFaceStrategy } from "./pixelFace"
import type { AvatarParameters, Strategy } from "./types"

export const STRATEGIES: readonly Strategy[] = [
  pixelFaceStrategy,
  memeFaceStrategy,
  pixelCreatureStrategy,
  blobBuddyStrategy,
  initialsStrategy,
  identiconStrategy,
  kaleidoStrategy,
  pixelClassicStrategy,
]

const BY_ID = new Map(STRATEGIES.map((strategy) => [strategy.id, strategy]))

/** The strategy an id names, or `undefined` — callers decide what an unknown id should do. */
export function findStrategy(id: string): Strategy | undefined {
  return BY_ID.get(id)
}

/**
 * A strategy's controls at their defaults.
 *
 * What a freshly picked strategy starts at, and the base every stored parameter set is layered onto —
 * which is what lets a strategy grow a ninth control without invalidating anybody's existing token.
 */
export function defaultParametersOf(strategy: Strategy): AvatarParameters {
  const parameters: AvatarParameters = {}

  for (const control of strategy.controls) {
    parameters[control.key] = control.fallback
  }

  return parameters
}

/**
 * How many seeds the grid shows, and how many a roll adds.
 *
 * ⚠️ **The seed vocabulary itself is not here.** `PRESET_SEEDS` and `rollSeed` live with the classic
 * strategy, which is where they have always lived, and are re-exported from the package root. Writing a
 * second word list beside them is precisely the duplication this package exists to end — the two would
 * be identical today and different in a month, with nothing anywhere saying so.
 */

import { rollSeed } from "../strategies/pixelClassic"

/** How many faces the grid starts with. Enough to find one you like, few enough to scan. */
export const OPENING_SEED_COUNT = 32

/** How many a roll adds. Enough to change the grid, few enough to still recognise it. */
export const ROLL_SIZE = 8

/** `count` fresh seeds. */
export function rollSeeds(count: number = ROLL_SIZE): string[] {
  return Array.from({ length: count }, rollSeed)
}

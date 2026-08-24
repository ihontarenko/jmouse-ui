/**
 * Determinism, in three functions.
 *
 * An avatar is a pure function of its descriptor: the same seed draws the same face on every screen,
 * forever, with nothing stored but a short string. That only holds if the randomness is ours, so
 * `Math.random` appears nowhere below and the constants are written down rather than imported — a
 * dependency that retunes its generator would silently redraw everybody's face.
 */

/**
 * A 32-bit hash of a string (FNV-1a).
 *
 * Not a cryptographic choice and does not need to be. What matters is the avalanche: visually similar
 * seeds ("owl-1", "owl-2") must land far apart, or every member of a team drawn from their username
 * ends up wearing the same head.
 */
export function hashString(value: string): number {
  let hash = 2166136261 >>> 0

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

/** Draws a number in [0, 1). Successive calls are independent. */
export type RandomSource = () => number

/**
 * Mulberry32 — small, fast, and with a period long past anything a face needs.
 *
 * The point is that six successive calls give six unrelated numbers, so a seed whose hash happens to
 * be even does not end up with a correlated head and mouth.
 */
export function randomSourceFrom(seedNumber: number): RandomSource {
  let state = seedNumber

  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0

    let drawn = Math.imul(state ^ (state >>> 15), 1 | state)
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn

    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296
  }
}

/** One of `items`, drawn from `random`. */
export function pick<Item>(random: RandomSource, items: readonly Item[]): Item {
  return items[Math.floor(random() * items.length) % items.length]
}

/** An integer in [lowest, highest], both ends included. */
export function randomInteger(random: RandomSource, lowest: number, highest: number): number {
  return lowest + Math.floor(random() * (highest - lowest + 1))
}

/**
 * One decimal place.
 *
 * ⚠️ Every coordinate written into a path goes through this. Unrounded floats turn a 40-node blob into
 * a kilobyte of `50.000000000000014`, and the token that produced it is a hundred bytes.
 */
export function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10
}

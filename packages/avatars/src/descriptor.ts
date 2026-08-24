/**
 * What an avatar *is*, as a value: a strategy, a seed, and whatever its controls were set to.
 *
 * This is the half that gets stored, so it is the half that cannot be changed later. Everything else in
 * the package is drawing, and drawing can be improved; a token that has been written into three
 * databases cannot.
 */

import { decodeBase64, encodeBase64 } from "./base64"
import type { AvatarParameters } from "./strategies/types"

/** The engine's version, and the second segment of every token. */
export const ENGINE_VERSION = 1

/** How many dot-separated pieces a token has. */
const SEGMENT_COUNT = 5

/** The first segment of every token. ⚠️ A full word, never an abbreviation. */
const TOKEN_PREFIX = "avatar"

/**
 * The strategy a legacy value is drawn with.
 *
 * ⚠️ Before this package there was one generator, and what was stored was a bare seed. Those values are
 * live, in three products' databases, and a person who chose a face is entitled to keep it — so the old
 * generator ships here as a strategy of its own and a bare value decodes into it.
 */
export const LEGACY_STRATEGY_ID = "pixel-classic"

export interface AvatarDescriptor {
  strategy: string
  seed: string
  parameters: AvatarParameters
}

/**
 * `avatar.1.<strategy>.<url-encoded seed>.<base64 parameters>`
 *
 * ⚠️ **The dot is escaped by hand, because `encodeURIComponent` leaves it alone.** It is an unreserved
 * character in a URI and therefore survives encoding untouched — while here it is the separator. A seed
 * is an arbitrary string and the `initials` strategy is documented to take a username or an address, so
 * `ivan.hontarenko` is the ordinary case: unescaped it splits the token into six pieces and the
 * parameters segment decodes to noise. Nothing else `encodeURIComponent` leaves alone collides.
 */
export function encodeToken(descriptor: AvatarDescriptor): string {
  return [
    TOKEN_PREFIX,
    String(ENGINE_VERSION),
    descriptor.strategy,
    encodeSeed(descriptor.seed),
    encodeBase64(JSON.stringify(descriptor.parameters ?? {})),
  ].join(".")
}

/** The seed as one token segment: url-encoded, and with the separator escaped on top of that. */
function encodeSeed(seed: string): string {
  return encodeURIComponent(seed).split(".").join("%2E")
}

/**
 * A token, or a bare legacy seed, as a descriptor.
 *
 * ⚠️ **A value with no dots is a legacy seed and must stay valid forever.** That is not a transitional
 * kindness: it is why nobody's face changes when a product adopts this package. A value that looks like
 * a token but is malformed is a different matter and throws, because silently drawing the wrong face is
 * worse than refusing.
 */
export function decodeToken(token: string): AvatarDescriptor {
  const segments = token.split(".")

  if (segments.length === 1) {
    return { strategy: LEGACY_STRATEGY_ID, seed: token, parameters: {} }
  }

  // ⚠️ Checked rather than destructured blindly. A token with the wrong number of pieces used to take
  // the segment that happened to be fourth as the seed and base64-decode the fifth to noise — which is
  // a wrong face drawn in silence, the one failure mode this format may not have.
  if (segments.length !== SEGMENT_COUNT) {
    throw new Error(
      `An avatar token has ${SEGMENT_COUNT} parts, this one has ${segments.length}: ${token}`,
    )
  }

  const [prefix, version, strategy, seed, parameters] = segments

  if (prefix !== TOKEN_PREFIX) {
    throw new Error(`Not an avatar token: ${token}`)
  }

  if (Number(version) !== ENGINE_VERSION) {
    throw new Error(`Unsupported avatar token version: ${version}`)
  }

  return {
    strategy,
    seed: decodeURIComponent(seed),
    parameters: JSON.parse(decodeBase64(parameters)) as AvatarParameters,
  }
}

/** Whether a stored value is one this engine can draw, without throwing to find out. */
export function isReadableToken(token: string): boolean {
  try {
    decodeToken(token)
    return true
  } catch {
    return false
  }
}

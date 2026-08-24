/**
 * Reading parameters back out.
 *
 * Parameters arrive from a token, which means they arrive from a database, which means they may be
 * anything at all. Every read below therefore falls back rather than throwing: a face drawn with one
 * defaulted control is a face, and a strategy that refuses to draw is a hole in a member list.
 */

import { pick, type RandomSource } from "../random"
import type { AvatarParameters } from "./types"

/** The value every "let it choose" option is spelled with. */
export const AUTOMATIC = "auto"

export function textOf(parameters: AvatarParameters, key: string, fallback: string): string {
  const value = parameters[key]

  return typeof value === "string" ? value : fallback
}

export function numberOf(parameters: AvatarParameters, key: string, fallback: number): number {
  const value = parameters[key]

  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export function flagOf(parameters: AvatarParameters, key: string, fallback: boolean): boolean {
  const value = parameters[key]

  return typeof value === "boolean" ? value : fallback
}

/**
 * A chosen option, or one drawn at random when the choice was left automatic.
 *
 * ⚠️ A stored value naming an option that no longer exists also lands in the random branch rather than
 * being refused — options are curation, not a catalogue, and trimming one must not invalidate anybody's
 * face.
 *
 * `automaticOptions` is what "auto" may land on, and it is narrower than `options` wherever a choice is
 * offerable but never a good surprise — an unfilled doodle, say. Omit it and the two are the same list.
 */
export function chosenOf(
  random: RandomSource,
  parameters: AvatarParameters,
  key: string,
  options: readonly string[],
  automaticOptions: readonly string[] = options,
): string {
  const value = textOf(parameters, key, AUTOMATIC)

  if (value !== AUTOMATIC && options.includes(value)) {
    return value
  }

  return pick(random, automaticOptions)
}

/**
 * A chosen option, or the control's own default.
 *
 * The counterpart to `chosenOf`, for a control that offers no "auto": the shape of an identicon cell
 * has a sensible default and no reason to surprise anybody. Never draws randomness — a control whose
 * default is concrete must render the same face whether it was set explicitly or left alone.
 */
export function optionOf(
  parameters: AvatarParameters,
  key: string,
  options: readonly string[],
  fallback: string,
): string {
  const value = textOf(parameters, key, fallback)

  return options.includes(value) ? value : fallback
}

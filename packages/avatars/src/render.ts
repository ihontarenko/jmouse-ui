/**
 * Turning a descriptor into something a browser can show.
 *
 * Three shapes, and the difference between them is who is going to hold the result: `buildSVG` for
 * markup that goes straight into the page, `buildPNG` for a file somebody downloads or uploads, and
 * `buildPayload` for a message crossing a wire.
 */

import { decodeToken, encodeToken, LEGACY_STRATEGY_ID, ENGINE_VERSION, type AvatarDescriptor } from "./descriptor"
import { hashString, randomSourceFrom } from "./random"
import { defaultParametersOf, findStrategy, STRATEGIES } from "./strategies"
import type { AvatarParameters } from "./strategies/types"

/** The size every caller gets when it does not say. Big enough to upload, small enough to inline. */
const DEFAULT_SIZE = 256

/** How long a browser is given to rasterise one SVG before the caller is handed the SVG instead. */
const RASTERISATION_TIMEOUT = 2500

/** A descriptor, or the token that encodes one. */
export type AvatarSource = AvatarDescriptor | string

export function asDescriptor(source: AvatarSource): AvatarDescriptor {
  return typeof source === "string" ? decodeToken(source) : source
}

/**
 * The SVG source for one avatar.
 *
 * ⚠️ **The random source is seeded from the strategy id as well as the seed.** Without it a person
 * switching strategies keeps the same sequence of draws, and their creature comes out wearing the
 * arrangement of their face.
 */
export function buildSVG(source: AvatarSource, size: number | null = DEFAULT_SIZE): string {
  const descriptor = asDescriptor(source)
  const strategy = findStrategy(descriptor.strategy)

  if (!strategy) {
    throw new Error(`Unknown avatar strategy: ${descriptor.strategy}`)
  }

  const signature = `${descriptor.strategy}|${descriptor.seed}`
  const parameters: AvatarParameters = { ...defaultParametersOf(strategy), ...(descriptor.parameters ?? {}) }

  const drawing = strategy.draw({
    random: randomSourceFrom(hashString(signature)),
    parameters,
    uniqueId: hashString(signature).toString(36),
    seed: descriptor.seed,
  })

  const background = drawing.background
    ? `<rect width="${drawing.viewBox}" height="${drawing.viewBox}" fill="${drawing.background}"/>`
    : ""
  const definitions = drawing.definitions ? `<defs>${drawing.definitions}</defs>` : ""
  const crisp = drawing.crisp ? ` shape-rendering="crispEdges"` : ""

  // ⚠️ `size: null` omits width and height so that CSS governs the box. A component that has to fill
  // its container cannot do it against attributes, and stripping them afterwards with a regular
  // expression is how a renderer starts corrupting its own output.
  const box = size === null ? "" : ` width="${size}" height="${size}"`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${drawing.viewBox} ${drawing.viewBox}"` +
    `${box}${crisp}>${definitions}${background}${drawing.body}</svg>`
  )
}

/**
 * The same avatar as a PNG data URI.
 *
 * ⚠️ **Needs a DOM, and is the only thing here that does.** It rasterises through an `<img>` and a
 * canvas, so it belongs to a click — never to a render, and never to a server.
 */
export function buildPNG(source: AvatarSource, size: number = DEFAULT_SIZE): Promise<string> {
  const svg = buildSVG(source, size)

  return new Promise((resolve, reject) => {
    const image = new Image()
    const timer = setTimeout(() => reject(new Error("PNG rasterisation timed out")), RASTERISATION_TIMEOUT)

    const settle = <Value,>(settler: (value: Value) => void) => (value: Value) => {
      clearTimeout(timer)
      settler(value)
    }

    const succeed = settle(resolve)
    const fail = settle(reject)

    image.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size

      const context = canvas.getContext("2d")

      if (!context) {
        fail(new Error("PNG rasterisation has no 2d context"))
        return
      }

      // ⚠️ Off, or a 16-unit grid scaled to 256 pixels comes out as a smudge — the same reason the
      // markup carries `shape-rendering="crispEdges"`.
      context.imageSmoothingEnabled = false
      context.drawImage(image, 0, 0, size, size)

      try {
        succeed(canvas.toDataURL("image/png"))
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)))
      }
    }

    image.onerror = () => fail(new Error("SVG rasterisation failed"))
    // A UTF-8 data URI rather than base64: one of these strategies draws free text, and a name in
    // Cyrillic is the ordinary case rather than the exotic one.
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
  })
}

/** Everything a caller needs to store or send one avatar. */
export interface AvatarPayload {
  version: number
  strategy: string
  seed: string
  parameters: AvatarParameters
  token: string
  size: number
  format: "png" | "svg"
  contentType: string
  data: string
  /** Set only when the requested format could not be produced and something else was returned. */
  note?: string
}

/**
 * A descriptor packaged for a wire.
 *
 * ⚠️ **A failed rasterisation degrades to SVG rather than throwing.** The caller asked for an avatar,
 * not for a format, and an avatar that arrives as vector is an avatar; `note` says what happened for
 * anybody who cares.
 */
export async function buildPayload(
  source: AvatarSource,
  options: { size?: number; image?: "png" | "svg" } = {},
): Promise<AvatarPayload> {
  const { size = DEFAULT_SIZE, image = "png" } = options
  const descriptor = asDescriptor(source)

  const payload: AvatarPayload = {
    version: ENGINE_VERSION,
    strategy: descriptor.strategy,
    seed: descriptor.seed,
    parameters: descriptor.parameters,
    token: encodeToken(descriptor),
    size,
    format: image,
    contentType: image === "svg" ? "image/svg+xml" : "image/png",
    data: "",
  }

  if (image === "svg") {
    payload.data = buildSVG(descriptor, size)
    return payload
  }

  try {
    payload.data = await buildPNG(descriptor, size)
  } catch {
    payload.format = "svg"
    payload.contentType = "image/svg+xml"
    payload.data = buildSVG(descriptor, size)
    payload.note = "PNG rasterisation is unavailable here; SVG returned instead"
  }

  return payload
}

/** A descriptor for a seed, on whichever strategy — the shortest path from a username to a face. */
export function describe(
  seed: string,
  strategyId: string = LEGACY_STRATEGY_ID,
  parameters: AvatarParameters = {},
): AvatarDescriptor {
  const strategy = findStrategy(strategyId) ?? STRATEGIES[0]

  return { strategy: strategy.id, seed, parameters }
}

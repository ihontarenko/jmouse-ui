/**
 * `@jmouse/avatars` — generated avatars, as a value and as SVG.
 *
 * ⚠️ **Nothing in this entry point imports React**, and that is the whole reason the package exists
 * separately from `@jmouse/ui`. The engine is arithmetic and string building: it runs in a browser, in
 * a test, and anywhere else a face has to be drawn. The picker is `@jmouse/avatars/picker`, and only it
 * pays for the render layer.
 *
 * The shortest useful path:
 *
 * ```ts
 * import { buildSVG, decodeToken } from "@jmouse/avatars"
 *
 * const markup = buildSVG(storedToken, 64)
 * ```
 *
 * ⚠️ **A bare seed with no dots is a valid input everywhere a token is**, because three products stored
 * bare seeds before this package existed and none of those faces may change. See `descriptor.ts`.
 */

export {
  ENGINE_VERSION,
  LEGACY_STRATEGY_ID,
  decodeToken,
  encodeToken,
  isReadableToken,
  type AvatarDescriptor,
} from "./descriptor"

export {
  asDescriptor,
  buildPNG,
  buildPayload,
  buildSVG,
  describe,
  type AvatarPayload,
  type AvatarSource,
} from "./render"

export { STRATEGIES, defaultParametersOf, findStrategy } from "./strategies"

export type {
  AvatarParameters,
  Control,
  ControlKind,
  RangeControl,
  SelectControl,
  Strategy,
  StrategyContext,
  StrategyDrawing,
  TextControl,
  ToggleControl,
} from "./strategies/types"

export { PRESET_SEEDS, rollSeed } from "./strategies/pixelClassic"

export { PALETTES, PALETTE_NAMES, SKINS, SKIN_NAMES, HAIRS, HAIR_NAMES } from "./colors"

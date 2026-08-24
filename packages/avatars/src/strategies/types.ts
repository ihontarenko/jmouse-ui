/**
 * What a strategy is, and what it declares about itself.
 *
 * ⚠️ **A strategy declares its controls; the picker reads that declaration.** Nothing in the React
 * layer knows what a hairstyle is or that a kaleidoscope has rings — it walks `controls` and renders
 * four widget shapes. That is what makes a ninth strategy one file rather than three, and it is the
 * single design decision in this package worth protecting.
 */

import type { RandomSource } from "../random"

/** The four widget shapes a control may ask for. Adding a fifth is a picker change, not a data change. */
export type ControlKind = "select" | "range" | "toggle" | "text"

interface ControlBase {
  /** The key this control writes into the descriptor's parameters. */
  key: string
  /** What the person choosing sees. */
  label: string
}

export interface SelectControl extends ControlBase {
  kind: "select"
  options: readonly string[]
  fallback: string
}

export interface RangeControl extends ControlBase {
  kind: "range"
  minimum: number
  maximum: number
  step: number
  fallback: number
}

export interface ToggleControl extends ControlBase {
  kind: "toggle"
  fallback: boolean
}

export interface TextControl extends ControlBase {
  kind: "text"
  fallback: string
}

export type Control = SelectControl | RangeControl | ToggleControl | TextControl

/** Whatever a strategy's controls have been set to. Values are of the control's own shape. */
export type AvatarParameters = Record<string, string | number | boolean>

/**
 * What a strategy hands back: the marks, and how to frame them.
 *
 * It is deliberately not a finished `<svg>`. The wrapper carries the requested pixel size and the
 * `shape-rendering` hint, and only the caller knows those — a thumbnail and a profile header ask the
 * same strategy for the same face at different sizes.
 */
export interface StrategyDrawing {
  /** The square viewBox the marks are drawn in — 16 for a pixel grid, 100 for a vector. */
  viewBox: number
  /** A colour to fill the whole viewBox with first, or `null` for a transparent avatar. */
  background: string | null
  /** The marks themselves, as SVG source. */
  body: string
  /** Anything that has to live in `<defs>` — gradients, patterns. */
  definitions?: string
  /** ⚠️ Load-bearing on a pixel grid: without it the browser antialiases the art into a smudge. */
  crisp: boolean
}

/** Everything a strategy is handed when it draws. */
export interface StrategyContext {
  random: RandomSource
  parameters: AvatarParameters
  /**
   * A short string unique to this descriptor.
   *
   * ⚠️ Every `<defs>` id must carry it. Two avatars on one page whose gradients are both called
   * `gradient` are one avatar drawn twice — the second `<defs>` wins for both, silently, and only when
   * they happen to share a screen.
   */
  uniqueId: string
  /** The seed itself, for the one strategy that reads it as text rather than as randomness. */
  seed: string
}

export interface Strategy {
  /** The stable identifier written into the token. ⚠️ Never renamed: it is stored data. */
  id: string
  /** What the picker shows on the strategy chip. */
  name: string
  /** One line under the name, saying how the face is made. */
  tag: string
  controls: readonly Control[]
  draw: (context: StrategyContext) => StrategyDrawing
}

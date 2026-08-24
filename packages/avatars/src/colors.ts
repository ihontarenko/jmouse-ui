/**
 * Every colour an avatar may wear.
 *
 * ⚠️ **The palettes are fixed, and deliberately not the theme's.** An avatar is somebody's identity, so
 * it has to look the same to everybody looking at it. Drawing it from theme tokens would mean your face
 * renders in my colours on my board, which is the one thing an identity mark may not do — and it is why
 * this package carries colour values at all, when `@jmouse/ui` carries none.
 */

/** A background and the inks that sit on it. */
export interface Palette {
  background: string
  colors: readonly string[]
}

export const PALETTES: Record<string, Palette> = {
  nebula: { background: "#141024", colors: ["#7c5cff", "#c05cff", "#ff5c9d", "#4be3d9", "#f3ecff"] },
  terminal: { background: "#08150e", colors: ["#22c55e", "#0ea5a0", "#a3e635", "#0d7a4a", "#e2fbe8"] },
  amber: { background: "#171006", colors: ["#f0b429", "#ef6c1a", "#fbbf24", "#8a3d12", "#fff3d6"] },
  ice: { background: "#09141f", colors: ["#38bdf8", "#818cf8", "#22d3ee", "#2a4a9e", "#eaf6ff"] },
  rust: { background: "#190e0e", colors: ["#e2725b", "#b45309", "#d97706", "#8f2222", "#ffe6d5"] },
  moss: { background: "#0e150f", colors: ["#84cc16", "#4d7c0f", "#ca8a04", "#1d7a45", "#f0fbe0"] },
  candy: { background: "#1c101a", colors: ["#f472b6", "#fb7185", "#c084fc", "#f9a8d4", "#fff0f7"] },
  paper: { background: "#efe9df", colors: ["#2f3542", "#e2725b", "#3d7ea6", "#c9a227", "#ffffff"] },
}

export const PALETTE_NAMES = Object.keys(PALETTES)

/** A skin tone and the shade it takes where a face turns away from the light. */
export interface SkinTone {
  base: string
  shade: string
}

export const SKINS: Record<string, SkinTone> = {
  porcelain: { base: "#ffd9ae", shade: "#e0ab77" },
  sand: { base: "#f2c49b", shade: "#cf9264" },
  honey: { base: "#d79a63", shade: "#a86c38" },
  bronze: { base: "#a9683a", shade: "#7d4823" },
  cocoa: { base: "#7a4423", shade: "#552c13" },
  espresso: { base: "#4e2d18", shade: "#33190a" },
  mint: { base: "#9ad6c0", shade: "#63ad95" },
  violet: { base: "#bfb4ff", shade: "#8f81d8" },
}

export const SKIN_NAMES = Object.keys(SKINS)

export const HAIRS: Record<string, string> = {
  raven: "#241f2b",
  chestnut: "#4a2c15",
  copper: "#b03a2e",
  gold: "#d9a441",
  silver: "#ececf2",
  orchid: "#f472b6",
  toxic: "#3fbf6f",
}

export const HAIR_NAMES = Object.keys(HAIRS)

/**
 * The dark value the pixel strategies draw with.
 *
 * ⚠️ Not universal, and the comment used to claim it was. `meme-face` and `blob-buddy` each carry their
 * own ink, deliberately: a doodle line and a jelly outline are read against different backgrounds and a
 * single value flattens both. Reach for this one when adding a PIXEL strategy; a vector one chooses.
 */
export const INK = "#191420"

/** The one light value — eye whites, teeth, highlights. */
export const LIGHT = "#f7f5ff"

/** Moves `#rrggbb` towards white (positive) or black (negative), channel by channel. */
export function shiftColor(hex: string, amount: number): string {
  const packed = parseInt(hex.slice(1), 16)
  const clamp = (channel: number) => Math.max(0, Math.min(255, channel))

  const red = clamp(((packed >> 16) & 255) + amount)
  const green = clamp(((packed >> 8) & 255) + amount)
  const blue = clamp((packed & 255) + amount)

  return "#" + ((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)
}

/** An `hsl()` colour, with the hue wrapped into [0, 360). */
export function hslColor(hue: number, saturation: number, lightness: number): string {
  return `hsl(${((hue % 360) + 360) % 360} ${saturation}% ${lightness}%)`
}

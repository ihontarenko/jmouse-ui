/**
 * The theme CONTRACT — types and the mechanism's own constants.
 *
 * ⚠️ No colour values live here. A palette is a product's identity, so the catalogue of themes is
 * passed into {@link ThemeProvider} by the product; `@jmouse/ui/presets` ships the shared 29-theme
 * catalogue for the products that want it, and a product is free to hand over its own list instead.
 */

export type ThemeCategory = "existing" | "palette" | "seasonal"

export type SeasonalEffect = "snow" | "hearts" | "clovers" | "skulls"

export interface ThemeDefinition {
  /** The class applied to `<html>`, and the value persisted in web storage. */
  name: string
  /** What a theme switcher shows a reader. */
  label: string
  /** The accent this theme is recognised by — a switcher's swatch dot. */
  swatchColor: string
  category: ThemeCategory
  dark: boolean
  effect?: SeasonalEffect
}

export type ThemeMode = "light" | "dark" | "system"

export type FontScale = "small" | "medium" | "large" | "xlarge"

export const FONT_SCALE_VALUES: Record<FontScale, number> = {
  small: 1,
  medium: 1.125,
  large: 1.25,
  xlarge: 1.375,
}

export type ContrastMode = "normal" | "medium" | "high"

/** The light half of a catalogue, seasonal themes included — the switcher's "light" column. */
export function lightThemesOf(themes: ThemeDefinition[]): ThemeDefinition[] {
  return themes.filter((theme) => !theme.dark)
}

/** The dark half of a catalogue, seasonal themes included. */
export function darkThemesOf(themes: ThemeDefinition[]): ThemeDefinition[] {
  return themes.filter((theme) => theme.dark)
}

export function findTheme(themes: ThemeDefinition[], name: string): ThemeDefinition | undefined {
  return themes.find((theme) => theme.name === name)
}

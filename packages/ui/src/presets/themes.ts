import type { ThemeDefinition } from "../theme/theming"

/**
 * The shared 29-theme catalogue — Innoventa's original 27 plus the `atlas` / `atlas-night` pair added
 * by Tessera. Same ids, same labels, same accent used for the swatch dot as every product already
 * shows.
 *
 * ⚠️ This is a PRESET, never the mechanism. `ThemeProvider` takes the catalogue as a prop precisely so
 * a product can hand it something else; importing this file is how a product says "the shared palettes
 * are mine too". The palette VALUES live in `@jmouse/ui/presets/themes.css`, and a product may import
 * this list while defining its own colours, or the other way round.
 */
export const lightThemes: ThemeDefinition[] = [
  { name: "cream", label: "Cream", swatchColor: "#1E78A4", category: "existing", dark: false },
  { name: "sage", label: "Sage", swatchColor: "#2E7D52", category: "existing", dark: false },
  { name: "slate", label: "Slate", swatchColor: "#1565C0", category: "existing", dark: false },
  { name: "sand", label: "Sand", swatchColor: "#C05020", category: "existing", dark: false },
  { name: "rose", label: "Rose", swatchColor: "#C62060", category: "existing", dark: false },
  { name: "lavender", label: "Lavender", swatchColor: "#6B3FCC", category: "existing", dark: false },
  { name: "terracotta", label: "Terracotta", swatchColor: "#C2410C", category: "palette", dark: false },
  { name: "periwinkle", label: "Periwinkle", swatchColor: "#4F46E5", category: "palette", dark: false },
  { name: "nordic-ice", label: "Nordic Ice", swatchColor: "#2563EB", category: "palette", dark: false },
  { name: "monochrome", label: "Monochrome", swatchColor: "#111827", category: "palette", dark: false },
  { name: "atlas", label: "Atlas", swatchColor: "#0052CD", category: "palette", dark: false },
]

export const darkThemes: ThemeDefinition[] = [
  { name: "steel", label: "Steel", swatchColor: "#F0A030", category: "existing", dark: true },
  { name: "indigo", label: "Indigo", swatchColor: "#FF6B2B", category: "existing", dark: true },
  { name: "midnight", label: "Midnight", swatchColor: "#40D080", category: "existing", dark: true },
  { name: "obsidian", label: "Obsidian", swatchColor: "#E0A020", category: "existing", dark: true },
  { name: "navy", label: "Navy", swatchColor: "#FF6B4A", category: "existing", dark: true },
  { name: "crimson", label: "Crimson", swatchColor: "#E02020", category: "existing", dark: true },
  { name: "neon-ink", label: "Neon Ink", swatchColor: "#F97316", category: "palette", dark: true },
  { name: "midnight-ocean", label: "Midnight Ocean", swatchColor: "#38BDF8", category: "palette", dark: true },
  { name: "dracula", label: "Dracula", swatchColor: "#BD93F9", category: "palette", dark: true },
  { name: "nord", label: "Nord", swatchColor: "#81A1C1", category: "palette", dark: true },
  { name: "monokai", label: "Monokai", swatchColor: "#A6E22E", category: "palette", dark: true },
  { name: "one-dark", label: "One Dark", swatchColor: "#61AFEF", category: "palette", dark: true },
  { name: "catppuccin-mocha", label: "Catppuccin Mocha", swatchColor: "#CBA6F7", category: "palette", dark: true },
  { name: "atlas-night", label: "Atlas Night", swatchColor: "#579DFE", category: "palette", dark: true },
]

export const seasonalThemes: ThemeDefinition[] = [
  { name: "christmas", label: "Christmas Days", swatchColor: "#C8900C", category: "seasonal", dark: true, effect: "snow" },
  { name: "st-patricks", label: "St. Patrick's", swatchColor: "#1A8A2A", category: "seasonal", dark: false, effect: "clovers" },
  { name: "halloween", label: "Halloween", swatchColor: "#E05800", category: "seasonal", dark: true, effect: "skulls" },
  { name: "valentines", label: "Valentine's", swatchColor: "#D01840", category: "seasonal", dark: false, effect: "hearts" },
]

/** The whole catalogue, in the order a switcher lists it. This is what `ThemeProvider` wants. */
export const allThemes: ThemeDefinition[] = [...lightThemes, ...darkThemes, ...seasonalThemes]

/**
 * The light and dark halves, seasonal themes folded into whichever half they belong to — a seasonal
 * theme is an ordinary pick, so a switcher's two columns have to include them alongside the rest.
 * Derived here rather than hand-listed, so adding a seasonal theme lands in the right column for free.
 */
export const allLightThemes: ThemeDefinition[] = allThemes.filter((theme) => !theme.dark)
export const allDarkThemes: ThemeDefinition[] = allThemes.filter((theme) => theme.dark)

export function findPresetTheme(name: string): ThemeDefinition | undefined {
  return allThemes.find((theme) => theme.name === name)
}

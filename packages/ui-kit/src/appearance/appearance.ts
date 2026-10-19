/**
 * The appearance contract: what a reader may choose, how a choice is stored, and how it reaches the page. A choice is
 * never a colour or a size — those are a theme file's (`../themes/*.css`) — only the names written onto <html> as
 * data-* attributes, which the stylesheets read.
 *
 * A THEME is a product's whole look (geometry, type, colours) and has two MODES, light and dark; the mode is chosen on
 * its own, so every theme is seen both ways.
 */

/** One theme a product offers: a CSS file with `[data-theme="<name>"]` and `[data-theme="<name>"][data-mode="dark"]`. */
export interface ThemeDefinition {
  name: string
  label: string
  /** One line on what the theme is for — a switcher's description. */
  description?: string
  /**
   * The palettes this theme offers, when it has its own (Raccoon's Graphite, Forest, Terminal…). Their colours are in
   * the theme's file, as `[data-theme="<name>"][data-palette="<palette>"]` blocks; without this list the kit's shared
   * palettes are offered. "theme" is always the theme's own accent.
   */
  palettes?: PaletteDefinition[]
}

/** The themes the kit ships, named after the products whose look they are. A product extends or replaces this list. */
export const standardThemes: ThemeDefinition[] = [
  { name: "parallax", label: "Parallax", description: "Porcelain neutrals, one quiet accent, soft radii." },
  {
    name: "raccoon",
    label: "Raccoon",
    description: "Cold surfaces, graphite type, ink-filled actions, a steel accent.",
    palettes: [
      { name: "theme", label: "Graphite", swatch: "#1d6c97" },
      { name: "forest", label: "Forest", swatch: "#4b7a17" },
      { name: "terminal", label: "Terminal", swatch: "#0b8670" },
      { name: "amber", label: "Amber", swatch: "#b06405" },
      { name: "kurenai", label: "Kurenai", swatch: "#983339" },
      { name: "sakura", label: "Sakura", swatch: "#a82e5c" },
      { name: "fuji", label: "Fuji", swatch: "#6534d3" },
      { name: "mizu", label: "Mizu", swatch: "#1a6066" },
      { name: "matcha", label: "Matcha", swatch: "#2e6847" },
      { name: "wakaba", label: "Wakaba", swatch: "#5b7322" },
    ],
  },
  {
    name: "innoventa",
    label: "Innoventa",
    description: "Square, hairlined, Onest and mono, an orange accent on a dark chassis.",
    palettes: [
      { name: "theme", label: "Ember", swatch: "#e8590c" },
      { name: "teal", label: "Teal", swatch: "#009797" },
      { name: "cobalt", label: "Cobalt", swatch: "#1f86f8" },
      { name: "violet", label: "Violet", swatch: "#a16cef" },
    ],
  },
  {
    name: "kitsu",
    label: "Kitsu",
    description: "Warm stone, the ember accent, rounder by role.",
    palettes: [
      { name: "theme", label: "Ember", swatch: "#ff641b" },
      { name: "kurenai", label: "Kurenai", swatch: "#d92b36" },
      { name: "sakura", label: "Sakura", swatch: "#e62d72" },
      { name: "fuji", label: "Fuji", swatch: "#8b5cf6" },
      { name: "ao", label: "Ao", swatch: "#2f7bf5" },
      { name: "mizu", label: "Mizu", swatch: "#0e8b96" },
      { name: "matcha", label: "Matcha", swatch: "#2d9459" },
      { name: "wakaba", label: "Wakaba", swatch: "#7da818" },
      { name: "sumi", label: "Sumi", swatch: "#7d746f" },
    ],
  },
  { name: "burin", label: "Burin", description: "Parallax tightened for an IDE, code on dark glass." },
  { name: "paper", label: "Paper", description: "Warm paper and ink, a vermilion accent." },
]

export interface PaletteDefinition {
  name: string
  label: string
  /** The swatch a switcher paints: the palette as it reads on a light ground. */
  swatch: string
}

/** "theme" is not a palette: it keeps the theme's own accent. */
export const palettes: PaletteDefinition[] = [
  { name: "theme", label: "Theme", swatch: "var(--kit-accent-base)" },
  { name: "iris", label: "Iris", swatch: "#5358c5" },
  { name: "mint", label: "Mint", swatch: "#137c78" },
  { name: "amber", label: "Amber", swatch: "#aa6427" },
  { name: "glacier", label: "Glacier", swatch: "#235b93" },
  { name: "coral", label: "Coral", swatch: "#a3466b" },
  { name: "slate", label: "Slate", swatch: "#3d5a80" },
  { name: "moss", label: "Moss", swatch: "#4a6f2c" },
  { name: "plum", label: "Plum", swatch: "#6f3e8a" },
  { name: "rust", label: "Rust", swatch: "#9a4a2a" },
  { name: "sand", label: "Sand", swatch: "#7a6433" },
]

export type Mode = "light" | "dark"

/** Every axis but the theme and the mode defaults to "theme": as the theme says. */
export interface AppearanceChoice {
  theme: string
  mode: Mode | "system"
  palette: string
  intensity: "theme" | "calm" | "bright"
  contrast: "regular" | "high"
  scale: "0.9" | "1" | "1.15" | "1.3"
  density: "compact" | "regular" | "airy"
  font: "theme" | "inter" | "onest" | "code" | "hybrid" | "plex" | "plex-mono" | "fira" | "manrope"
  weight: "theme" | "normal" | "strong"
  shape: "theme" | "flat" | "soft" | "round"
  depth: "ruled" | "elevated"
  canvas: "theme" | "glass" | "paper"
  /** Which colours a chart's series are drawn in. */
  chart: "quiet" | "vivid" | "cool" | "warm"
  motion: "on" | "off"
  /** A code view's line height. */
  leading: "tight" | "regular" | "loose"
  /** Contextual alternates and ligatures in a code view. */
  ligatures: "on" | "off"
  /** Indent guides and the right margin in a code view. */
  guides: "on" | "off"
}

export type AppearanceAxis = keyof AppearanceChoice

export const defaultAppearance: AppearanceChoice = {
  theme: "parallax",
  mode: "system",
  palette: "theme",
  intensity: "theme",
  contrast: "regular",
  scale: "1",
  density: "regular",
  font: "theme",
  weight: "theme",
  shape: "theme",
  depth: "ruled",
  canvas: "theme",
  chart: "quiet",
  motion: "on",
  leading: "regular",
  ligatures: "on",
  guides: "on",
}

export interface AxisOption {
  value: string
  label: string
  swatch?: string
}

export interface AxisDefinition {
  axis: AppearanceAxis
  legend: string
  options: AxisOption[]
  /** Spans both columns of the settings — the axes with many options. */
  wide?: boolean
}

const asTheme: AxisOption = { value: "theme", label: "Theme" }

/** Every axis except the theme, the mode and the palette, whose options come from the product's catalogues. */
export const standardAxes: AxisDefinition[] = [
  { axis: "intensity", legend: "Colour intensity", options: [asTheme, { value: "calm", label: "Calm" }, { value: "bright", label: "Bright" }] },
  { axis: "contrast", legend: "Contrast", options: [{ value: "regular", label: "Regular" }, { value: "high", label: "High" }] },
  { axis: "scale", legend: "Interface size", options: [{ value: "0.9", label: "90%" }, { value: "1", label: "100%" }, { value: "1.15", label: "115%" }, { value: "1.3", label: "130%" }] },
  { axis: "density", legend: "Density", options: [{ value: "compact", label: "Compact" }, { value: "regular", label: "Theme" }, { value: "airy", label: "Airy" }] },
  {
    axis: "font",
    legend: "Typeface",
    wide: true,
    options: [
      asTheme,
      { value: "inter", label: "Inter" },
      { value: "onest", label: "Onest" },
      { value: "manrope", label: "Manrope" },
      { value: "plex", label: "IBM Plex" },
      { value: "hybrid", label: "Onest + Mono" },
      { value: "fira", label: "Inter + Fira" },
      { value: "code", label: "JetBrains Mono" },
      { value: "plex-mono", label: "Plex Mono" },
    ],
  },
  { axis: "weight", legend: "Weight", options: [asTheme, { value: "normal", label: "Normal" }, { value: "strong", label: "Strong" }] },
  { axis: "shape", legend: "Shape", options: [asTheme, { value: "flat", label: "Flat" }, { value: "soft", label: "Soft" }, { value: "round", label: "Round" }] },
  { axis: "depth", legend: "Surfaces", options: [{ value: "ruled", label: "Ruled" }, { value: "elevated", label: "Elevated" }] },
  { axis: "canvas", legend: "Code and instruments", options: [asTheme, { value: "glass", label: "Dark glass" }, { value: "paper", label: "Follow the mode" }] },
  { axis: "chart", legend: "Chart colours", options: [{ value: "quiet", label: "Quiet" }, { value: "vivid", label: "Vivid" }, { value: "cool", label: "Cool" }, { value: "warm", label: "Warm" }] },
  { axis: "motion", legend: "Motion", options: [{ value: "on", label: "On" }, { value: "off", label: "Off" }] },
  { axis: "leading", legend: "Code line height", options: [{ value: "tight", label: "Tight" }, { value: "regular", label: "Regular" }, { value: "loose", label: "Loose" }] },
  { axis: "ligatures", legend: "Code ligatures", options: [{ value: "on", label: "On" }, { value: "off", label: "Off" }] },
  { axis: "guides", legend: "Indent guides", options: [{ value: "on", label: "Shown" }, { value: "off", label: "Hidden" }] },
]

export function storageKeyOf(storagePrefix: string): string {
  return `${storagePrefix}.appearance`
}

/** The stored choice over the defaults; anything unreadable falls back rather than failing the first paint. */
export function readStoredAppearance(storagePrefix: string, defaults: AppearanceChoice): AppearanceChoice {
  try {
    const stored = window.localStorage.getItem(storageKeyOf(storagePrefix))
    if (!stored) {
      return defaults
    }
    return { ...defaults, ...(JSON.parse(stored) as Partial<AppearanceChoice>) }
  } catch {
    return defaults
  }
}

export function storeAppearance(storagePrefix: string, choice: AppearanceChoice): void {
  try {
    window.localStorage.setItem(storageKeyOf(storagePrefix), JSON.stringify(choice))
  } catch {
    // Storage refused (private window, blocked site data): the choice still applies for this page's life.
  }
}

/** The theme actually painted: the chosen one when the catalogue has it, the catalogue's first otherwise. */
export function resolveTheme(choice: AppearanceChoice, themes: ThemeDefinition[]): ThemeDefinition {
  return themes.find((theme) => theme.name === choice.theme) ?? themes[0]
}

/** The mode actually painted: "system" follows the operating system. */
export function resolveMode(choice: AppearanceChoice, prefersDark: boolean): Mode {
  if (choice.mode === "system") {
    return prefersDark ? "dark" : "light"
  }
  return choice.mode
}

/** Writes a choice onto the root element as data-* attributes — the only way a choice reaches the stylesheets. */
export function applyAppearance(root: HTMLElement, choice: AppearanceChoice, theme: ThemeDefinition, mode: Mode): void {
  for (const axis of Object.keys(choice) as AppearanceAxis[]) {
    if (axis !== "theme" && axis !== "mode") {
      root.dataset[axis] = choice[axis]
    }
  }
  root.dataset.theme = theme.name
  root.dataset.mode = mode
  root.style.colorScheme = mode
}

/**
 * Reads the stored choice and writes it onto <html> at once — call it at the top of the entry module, before React
 * renders, when the page has no inline {@link appearanceBootScript}. The boot script is still better: a module runs
 * after the first paint may already have happened.
 */
export function applyStoredAppearance(storagePrefix: string, themes: ThemeDefinition[] = standardThemes, defaults: AppearanceChoice = defaultAppearance): void {
  const choice = readStoredAppearance(storagePrefix, defaults)
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  applyAppearance(document.documentElement, choice, resolveTheme(choice, themes), resolveMode(choice, prefersDark))
}

/**
 * The same work as {@link applyStoredAppearance}, as a string for an inline `<script>` in the page's `<head>`, so the
 * stored choice is on <html> before the first paint instead of flashing the default theme while React boots.
 */
export function appearanceBootScript(storagePrefix: string, themes: ThemeDefinition[] = standardThemes, defaults: AppearanceChoice = defaultAppearance): string {
  const names = JSON.stringify(themes.map((theme) => theme.name))
  return `(function(){try{var d=${JSON.stringify(defaults)},c=d;try{var s=localStorage.getItem(${JSON.stringify(storageKeyOf(storagePrefix))});if(s){c=Object.assign({},d,JSON.parse(s))}}catch(e){}var t=${names},r=document.documentElement,k;for(k in c){if(k!=="theme"&&k!=="mode"){r.dataset[k]=c[k]}}var n=t.indexOf(c.theme)<0?t[0]:c.theme,m=c.mode==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c.mode;r.dataset.theme=n;r.dataset.mode=m;r.style.colorScheme=m}catch(e){}})();`
}

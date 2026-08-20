import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  FONT_SCALE_VALUES,
  darkThemesOf,
  findTheme,
  lightThemesOf,
  type ContrastMode,
  type FontScale,
  type SeasonalEffect,
  type ThemeDefinition,
  type ThemeMode,
} from "./theming"

/**
 * The text-color tiers every theme defines, in the ink/ink-2/ink-3/ink-4 order — several shadcn slots
 * share the same starting value per theme (foreground/card-foreground/popover-foreground/
 * sidebar-foreground all equal "ink"), so all of them shift together under contrast mode rather than
 * just --foreground drifting out of sync with card/popover text.
 */
const CONTRAST_TIERS: [cssVariables: string[], factorIndex: number][] = [
  [["--foreground", "--card-foreground", "--popover-foreground", "--sidebar-foreground"], 0],
  [["--secondary-foreground"], 1],
  [["--muted-foreground"], 2],
  [["--ink-4"], 3],
]

interface ThemeContextValue {
  mode: ThemeMode
  lightTheme: string
  darkTheme: string
  resolvedTheme: string
  activeEffect: SeasonalEffect | undefined
  fontScale: FontScale
  contrastMode: ContrastMode
  seasonalEffectEnabled: boolean
  themes: ThemeDefinition[]
  setMode: (mode: ThemeMode) => void
  setLightTheme: (themeName: string) => void
  setDarkTheme: (themeName: string) => void
  setFontScale: (scale: FontScale) => void
  setContrastMode: (mode: ContrastMode) => void
  setSeasonalEffectEnabled: (enabled: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function prefersDarkColorScheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function blendHex(hex: string, target: number, factor: number): string {
  const cleaned = hex.replace("#", "").padEnd(6, "0")
  const value = Number.parseInt(cleaned, 16)
  const red = Math.round(((value >> 16) & 0xff) * (1 - factor) + target * factor)
  const green = Math.round(((value >> 8) & 0xff) * (1 - factor) + target * factor)
  const blue = Math.round((value & 0xff) * (1 - factor) + target * factor)
  return "#" + [red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")
}

function applyContrastMode(mode: ContrastMode, isDarkTheme: boolean) {
  const root = document.documentElement
  // Clear any previous override first so switching back to "normal" (or to a different theme)
  // doesn't leave a stale blended color behind.
  for (const [cssVariables] of CONTRAST_TIERS) {
    for (const cssVariable of cssVariables) {
      root.style.removeProperty(cssVariable)
    }
  }

  if (mode === "normal") {
    return
  }

  const factors = mode === "medium" ? [0.05, 0.15, 0.28, 0.42] : [0.1, 0.25, 0.45, 0.6]
  const target = isDarkTheme ? 255 : 0
  const computed = getComputedStyle(root)

  for (const [cssVariables, factorIndex] of CONTRAST_TIERS) {
    const factor = factors[factorIndex]
    for (const cssVariable of cssVariables) {
      const currentValue = computed.getPropertyValue(cssVariable).trim()
      if (currentValue.startsWith("#")) {
        root.style.setProperty(cssVariable, blendHex(currentValue, target, factor))
      }
    }
  }
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ("ontouchstart" in window && window.innerWidth < 1024)
}

/**
 * Text size, applied as a zoom on the body.
 *
 * Scaling the root font size instead was tried and reverted: rem-based lengths grow while the viewport
 * does not, so at Extra large the layout stopped reflowing and simply overflowed sideways. `zoom`
 * enlarges the CSS pixel itself, which shrinks the viewport in CSS pixels and lets every layout reflow
 * as though it were on a smaller screen — that reflow is the whole reason this mechanism was chosen.
 *
 * ⚠️ <strong>Its cost was every dropdown in the application, and that cost is paid once, here.</strong>
 * A JavaScript positioner cannot survive this: floating-ui divides a trigger's measured rect by the
 * scale it detects — which for a zoomed element is the zoom — and then cannot reconcile a
 * `position: fixed` containing block. Measured at 1.5 times, a trigger at y=18 opened its panel at
 * y=654; moving this zoom onto the application root instead moved it to y=436. Wrong either way.
 *
 * So no overlay in this package is positioned by JavaScript. `components/anchored.tsx` hands the job to
 * the browser's own anchor positioning, which resolves during normal layout where every length already
 * agrees. This zoom is free to keep buying the reflow it was chosen for.
 */
function applyFontScale(scale: FontScale) {
  const value = FONT_SCALE_VALUES[scale]
  document.documentElement.style.setProperty("--font-scale", String(value))

  if (isMobileDevice()) {
    // --body-zoom stays "1" here since body.style.zoom is never actually applied on mobile — any CSS
    // that counter-scales against it (see components/dropdown-menu.tsx) must know the real applied
    // multiplier, not just the user's chosen scale, or it would shrink content that was never zoomed.
    document.documentElement.style.setProperty("--body-zoom", "1")
    return
  }

  ;(document.body.style as CSSStyleDeclaration & { zoom: string }).zoom = String(value)
  document.documentElement.style.setProperty("--body-zoom", String(value))
}

export interface ThemeProviderProperties {
  children: ReactNode
  /**
   * The catalogue this product offers. ⚠️ Required on purpose: the mechanism is shared, the palettes
   * are the product's identity. `@jmouse/ui/presets` exports the shared catalogue for the products
   * that want it.
   */
  themes: ThemeDefinition[]
  /**
   * Namespace for the persisted preferences — `"tessera"` writes `tessera.theme-mode` and friends.
   * ⚠️ Changing it for an existing product forgets everybody's theme, so it is the product's name and
   * stays that way.
   */
  storagePrefix: string
  /** Falls back to the first light theme of the catalogue. */
  defaultLightTheme?: string
  /** Falls back to the first dark theme of the catalogue. */
  defaultDarkTheme?: string
  /**
   * A look imposed by something other than the reader — an embedded view carrying its theme in its own
   * address, a print route, a screenshot harness.
   *
   * ⚠️ It seeds the initial state and is **never written back**: whoever opens an embed in Dracula must
   * still find their own theme where they left it. It sits above web storage, and it is read here
   * rather than applied by the screen because the provider is the only thing allowed to write the root
   * element — a screen applying a class in its own effect runs first and is overwritten on the next
   * paint.
   */
  initialOverrides?: { themeName?: string; fontScale?: FontScale }
  /**
   * Called after the theme class, the `.dark` toggle and the contrast pass have all been applied.
   *
   * ⚠️ After, never before: anything reading a COMPUTED custom property — painting a favicon from
   * `--primary`, measuring a colour — reads the outgoing theme if it runs a line earlier, which looks
   * like a caching bug for a week.
   */
  onThemeApplied?: (applied: { resolvedTheme: string; isDark: boolean }) => void
}

export function ThemeProvider({
  children,
  themes,
  storagePrefix,
  defaultLightTheme,
  defaultDarkTheme,
  initialOverrides,
  onThemeApplied,
}: ThemeProviderProperties) {
  const lightThemes = useMemo(() => lightThemesOf(themes), [themes])
  const darkThemes = useMemo(() => darkThemesOf(themes), [themes])

  const fallbackLightTheme = defaultLightTheme ?? lightThemes[0]?.name ?? ""
  const fallbackDarkTheme = defaultDarkTheme ?? darkThemes[0]?.name ?? ""

  const imposedTheme = initialOverrides?.themeName
    ? findTheme(themes, initialOverrides.themeName)
    : undefined

  // Held in a ref and kept out of the effect's dependencies on purpose: a caller passing an inline
  // arrow would otherwise re-run the whole apply pass on every render.
  const onThemeAppliedRef = useRef(onThemeApplied)
  onThemeAppliedRef.current = onThemeApplied

  const modeStorageKey = `${storagePrefix}.theme-mode`
  const lightThemeStorageKey = `${storagePrefix}.light-theme`
  const darkThemeStorageKey = `${storagePrefix}.dark-theme`
  const fontScaleStorageKey = `${storagePrefix}.font-scale`
  const contrastModeStorageKey = `${storagePrefix}.contrast-mode`
  const seasonalEffectStorageKey = `${storagePrefix}.seasonal-effect-enabled`

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (imposedTheme) {
      return imposedTheme.dark ? "dark" : "light"
    }

    return (localStorage.getItem(modeStorageKey) as ThemeMode | null) ?? "system"
  })
  const [lightTheme, setLightThemeState] = useState(() =>
    imposedTheme && !imposedTheme.dark
      ? imposedTheme.name
      : (localStorage.getItem(lightThemeStorageKey) ?? fallbackLightTheme),
  )
  const [darkTheme, setDarkThemeState] = useState(() =>
    imposedTheme?.dark
      ? imposedTheme.name
      : (localStorage.getItem(darkThemeStorageKey) ?? fallbackDarkTheme),
  )
  const [fontScale, setFontScaleState] = useState<FontScale>(
    () =>
      initialOverrides?.fontScale ??
      (localStorage.getItem(fontScaleStorageKey) as FontScale | null) ??
      "medium",
  )
  const [contrastMode, setContrastModeState] = useState<ContrastMode>(
    () => (localStorage.getItem(contrastModeStorageKey) as ContrastMode | null) ?? "normal",
  )
  const [seasonalEffectEnabled, setSeasonalEffectEnabledState] = useState(
    () => localStorage.getItem(seasonalEffectStorageKey) !== "false",
  )
  const [systemPrefersDark, setSystemPrefersDark] = useState(prefersDarkColorScheme)

  useEffect(() => {
    const mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setSystemPrefersDark(mediaQueryList.matches)
    mediaQueryList.addEventListener("change", onChange)
    return () => mediaQueryList.removeEventListener("change", onChange)
  }, [])

  const isDark = mode === "dark" || (mode === "system" && systemPrefersDark)
  const resolvedTheme = isDark ? darkTheme : lightTheme
  const activeEffect = findTheme(themes, resolvedTheme)?.effect

  useEffect(() => {
    const root = document.documentElement
    for (const theme of themes) {
      root.classList.remove(theme.name)
    }
    root.classList.add(resolvedTheme)
    root.classList.toggle("dark", isDark)
    applyContrastMode(contrastMode, isDark)
    onThemeAppliedRef.current?.({ resolvedTheme, isDark })
  }, [themes, resolvedTheme, isDark, contrastMode])

  useEffect(() => {
    applyFontScale(fontScale)
  }, [fontScale])

  const setMode = (nextMode: ThemeMode) => {
    localStorage.setItem(modeStorageKey, nextMode)
    setModeState(nextMode)
  }

  const setLightTheme = (themeName: string) => {
    localStorage.setItem(lightThemeStorageKey, themeName)
    setLightThemeState(themeName)
    setMode("light")
  }

  const setDarkTheme = (themeName: string) => {
    localStorage.setItem(darkThemeStorageKey, themeName)
    setDarkThemeState(themeName)
    setMode("dark")
  }

  const setFontScale = (scale: FontScale) => {
    localStorage.setItem(fontScaleStorageKey, scale)
    setFontScaleState(scale)
  }

  const setContrastMode = (nextContrastMode: ContrastMode) => {
    localStorage.setItem(contrastModeStorageKey, nextContrastMode)
    setContrastModeState(nextContrastMode)
  }

  const setSeasonalEffectEnabled = (enabled: boolean) => {
    localStorage.setItem(seasonalEffectStorageKey, String(enabled))
    setSeasonalEffectEnabledState(enabled)
  }

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      lightTheme,
      darkTheme,
      resolvedTheme,
      activeEffect,
      fontScale,
      contrastMode,
      seasonalEffectEnabled,
      themes,
      setMode,
      setLightTheme,
      setDarkTheme,
      setFontScale,
      setContrastMode,
      setSeasonalEffectEnabled,
    }),
    [mode, lightTheme, darkTheme, resolvedTheme, activeEffect, fontScale, contrastMode, seasonalEffectEnabled, themes],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}

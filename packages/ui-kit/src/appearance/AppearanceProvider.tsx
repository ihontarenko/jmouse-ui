import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react"
import {
  applyAppearance,
  defaultAppearance,
  palettes as standardPalettes,
  readStoredAppearance,
  resolveMode,
  resolveTheme,
  standardThemes,
  storeAppearance,
  type AppearanceAxis,
  type AppearanceChoice,
  type Mode,
  type PaletteDefinition,
  type ThemeDefinition,
} from "./appearance"

export interface AppearanceContextValue {
  choice: AppearanceChoice
  /** The theme being painted. */
  theme: ThemeDefinition
  /** The mode being painted — `choice.mode` may be "system". */
  mode: Mode
  themes: ThemeDefinition[]
  palettes: PaletteDefinition[]
  change<Axis extends AppearanceAxis>(axis: Axis, value: AppearanceChoice[Axis]): void
  reset(): void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

export interface AppearanceProviderProperties {
  /**
   * Namespaces what is stored (`<prefix>.appearance`). It is the product's name and must never change: changing it
   * forgets everybody's choice.
   */
  storagePrefix: string
  /** The product's theme catalogue — {@link standardThemes} plus its own, or its own alone. */
  themes?: ThemeDefinition[]
  palettes?: PaletteDefinition[]
  /** The product's defaults; the reader's stored choice is laid over them. */
  defaults?: Partial<AppearanceChoice>
  /**
   * Runs after the attributes are on <html> — the moment computed tokens are the new ones. Paint anything drawn from
   * a token (a favicon, a canvas) here, never from a screen's own effect, which reads the outgoing theme.
   */
  onApplied?(choice: AppearanceChoice, theme: ThemeDefinition, mode: Mode): void
  children: ReactNode
}

/**
 * Owns the reader's appearance choice: reads it, writes it onto <html>, stores it, and follows the operating system
 * while the mode is "system". Pair it with {@link appearanceBootScript} in the page's head, so the first paint is
 * already right.
 */
export function AppearanceProvider({ storagePrefix, themes = standardThemes, palettes = standardPalettes, defaults, onApplied, children }: AppearanceProviderProperties) {
  const initial = useMemo(() => ({ ...defaultAppearance, ...defaults }), [defaults])
  const [choice, setChoice] = useState<AppearanceChoice>(() => readStoredAppearance(storagePrefix, initial))
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches)

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const follow = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    query.addEventListener("change", follow)
    return () => query.removeEventListener("change", follow)
  }, [])

  const theme = resolveTheme(choice, themes)
  const mode = resolveMode(choice, prefersDark)

  useLayoutEffect(() => {
    applyAppearance(document.documentElement, choice, theme, mode)
    onApplied?.(choice, theme, mode)
  }, [choice, theme, mode, onApplied])

  const change = useCallback(
    <Axis extends AppearanceAxis>(axis: Axis, value: AppearanceChoice[Axis]) => {
      setChoice((current) => {
        const next = { ...current, [axis]: value }
        storeAppearance(storagePrefix, next)
        return next
      })
    },
    [storagePrefix],
  )

  const reset = useCallback(() => {
    storeAppearance(storagePrefix, initial)
    setChoice(initial)
  }, [storagePrefix, initial])

  // A theme with palettes of its own offers those; the rest share the kit's.
  const offeredPalettes = theme.palettes ?? palettes
  const value = useMemo<AppearanceContextValue>(
    () => ({ choice, theme, mode, themes, palettes: offeredPalettes, change, reset }),
    [choice, theme, mode, themes, offeredPalettes, change, reset],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

/** The appearance when a provider is mounted, null otherwise — for a component that only adapts to it. */
export function useOptionalAppearance(): AppearanceContextValue | null {
  return useContext(AppearanceContext)
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext)
  if (!context) {
    throw new Error("useAppearance() needs an <AppearanceProvider> above it.")
  }
  return context
}

/** Reads a token's value as written — a length, a font stack. For a colour use {@link readColorToken}. */
export function readToken(name: `--kit-${string}`, element: Element = document.documentElement): string {
  return getComputedStyle(element).getPropertyValue(name).trim()
}

/**
 * Reads a colour token as a colour a canvas, WebGL or a chart accepts. ⚠️ Reading the custom property itself returns
 * its expression (`oklch(from #5358c5 l calc(c * 0.42) h)`), not a colour; only a real `color` property computes it,
 * so a hidden probe inside `element` wears the token and is read back.
 */
export function readColorToken(name: `--kit-${string}`, element: Element = document.body): string {
  const probe = document.createElement("span")
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;color:var(${name})`
  element.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

import type { Extension } from "@codemirror/state"
import {
  amy,
  ayuLight,
  barf,
  bespin,
  birdsOfParadise,
  boysAndGirls,
  clouds,
  cobalt,
  coolGlow,
  dracula,
  espresso,
  noctisLilac,
  rosePineDawn,
  smoothy,
  solarizedLight,
  tomorrow,
} from "thememirror"

/**
 * `@jmouse/codemirror/themes` — the imported code themes, and the picker's catalogue.
 *
 * <h2>⚠️ A code theme is not a syntax palette, and the difference is the whole reason both exist</h2>
 *
 * <p>A **syntax palette** ({@link ./palettes}) changes only which colours the application's own
 * highlighting resolves to. The editor keeps sitting on the product's paper with the product's chrome,
 * and the palette applies **everywhere code is rendered** — including the static highlighter behind a
 * published page, which has no editor and therefore no theme at all.
 *
 * <p>A **code theme** is an imported CodeMirror theme. It brings its own background, gutter and
 * colours and replaces the editor's look wholesale — a deliberate, forced choice that stops tracking
 * the application theme. It applies **only inside an editor**, because that is the only place a
 * `EditorView.theme` means anything.
 *
 * <p>So the two are offered side by side rather than merged: one is "read code in these hues", the
 * other is "make this editor look like somebody else's editor".
 */
export interface CodeTheme {
  readonly id: string
  readonly name: string
  readonly dark: boolean
  /** `null` marks the app-adaptive default; every other theme is a standalone extension. */
  readonly extension: Extension | null
}

/**
 * The catalogue, in the order the picker shows it.
 *
 * <p>The default, `auto`, is the app-adaptive look — the host's own chrome plus the syntax palette in
 * force, so it tracks the active application theme. Everything after it is from `thememirror`.
 */
export const CODE_THEMES: readonly CodeTheme[] = [
  { id: "auto", name: "Auto — matches app", dark: false, extension: null },
  { id: "dracula", name: "Dracula", dark: true, extension: dracula },
  { id: "cobalt", name: "Cobalt", dark: true, extension: cobalt },
  { id: "espresso", name: "Espresso", dark: true, extension: espresso },
  { id: "birds", name: "Birds of Paradise", dark: true, extension: birdsOfParadise },
  { id: "cool-glow", name: "Cool Glow", dark: true, extension: coolGlow },
  { id: "tomorrow", name: "Tomorrow", dark: false, extension: tomorrow },
  { id: "solarized", name: "Solarized Light", dark: false, extension: solarizedLight },
  { id: "ayu-light", name: "Ayu Light", dark: false, extension: ayuLight },
  { id: "noctis-lilac", name: "Noctis Lilac", dark: false, extension: noctisLilac },
  { id: "rose-pine-dawn", name: "Rosé Pine Dawn", dark: false, extension: rosePineDawn },
  { id: "amy", name: "Amy", dark: true, extension: amy },
  { id: "barf", name: "Barf", dark: true, extension: barf },
  { id: "bespin", name: "Bespin", dark: true, extension: bespin },
  { id: "boys-and-girls", name: "Boys and Girls", dark: true, extension: boysAndGirls },
  { id: "clouds", name: "Clouds", dark: false, extension: clouds },
  { id: "smoothy", name: "Smoothy", dark: false, extension: smoothy },
]

export const DEFAULT_CODE_THEME = CODE_THEMES[0].id

/**
 * The editor extensions for a chosen code-theme id.
 *
 * <p>⚠️ **`appAdaptive` is a parameter and not a default**, because "matches the app" is the one thing
 * this package cannot know: it is the host's chrome and the host's palette, and no two of them are
 * proportioned alike. Pass `[editorChrome(), syntaxHighlighting(SYNTAX_HIGHLIGHT_STYLE)]` for the
 * ordinary answer.
 *
 * <p>An unknown id falls back to the adaptive set rather than to nothing — a theme dropped from the
 * catalogue degrades to the product's own look instead of to CodeMirror's bare default.
 */
export function codeThemeExtensions(
  codeThemeId: string,
  appAdaptive: readonly Extension[],
): Extension[] {
  const theme = CODE_THEMES.find((candidate) => candidate.id === codeThemeId)

  if (!theme || theme.extension === null) {
    return [...appAdaptive]
  }

  return [theme.extension]
}

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { syntaxHighlighting } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
import { editorChrome } from "./editor"
import { SYNTAX_HIGHLIGHT_STYLE } from "./highlight"
import { applySyntaxPalette, DEFAULT_SYNTAX_PALETTE, SYNTAX_PALETTES } from "./palettes"
import { CODE_THEMES, codeThemeExtensions, DEFAULT_CODE_THEME } from "./themes"

/**
 * `@jmouse/codemirror/react` — the picker every interface shows, and the hook every editor reads.
 *
 * <h2>⚠️ The React half is an entry point, not a second package</h2>
 *
 * <p>The root of `@jmouse/codemirror` has no React in it, which is what lets Identity consume the
 * grammars without the render layer. Importing **this** module is what asks for React, and `react` is
 * an optional peer for exactly that reason. Nothing else in the package imports it.
 *
 * <h2>⚠️ One picker, not one per product</h2>
 *
 * <p>The choice of syntax palette and code theme is not a product decision — it is the reader's, and
 * it means the same thing in every interface. A copy per product is how five interfaces came to render
 * the same policy five ways in the first place.
 *
 * <p>The markup is shadcn's vocabulary (`border`, `bg-accent`, `text-muted-foreground`), the same as
 * every other shared component here. ⚠️ Tailwind does not scan `node_modules`, so a consumer needs
 * `@source "../node_modules/@jmouse/codemirror/dist";` in its stylesheet or the picker comes up
 * unstyled with nothing anywhere to say why.
 */

interface CodeAppearance {
  readonly syntaxPaletteId: string
  readonly codeThemeId: string
}

/**
 * ⚠️ **A module-level store rather than a product's state library**, and deliberately so: the picker
 * and every open editor have to agree, they live in different trees, and the package cannot depend on
 * whichever store a given product happens to use. `useSyncExternalStore` is React's own answer to
 * exactly this and costs no dependency.
 */
let current: CodeAppearance = { syntaxPaletteId: DEFAULT_SYNTAX_PALETTE, codeThemeId: DEFAULT_CODE_THEME }
let storageKey = "jmouse.code-appearance"
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function persist(): void {
  if (typeof localStorage === "undefined") {
    return
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(current))
  } catch {
    // A full or blocked storage is not a reason to refuse a colour change.
  }
}

/**
 * Read the remembered choice and apply it.
 *
 * <p>⚠️ **Call this once at start-up, before the first render.** The palette is an attribute on
 * `<html>`, so a value restored into the store alone is a preference the page never obeys until the
 * reader happens to open the picker and set it again.
 *
 * @param key where to remember it — one per product, so two interfaces on the same origin do not
 *            overwrite each other.
 */
export function initialiseCodeAppearance(key: string): void {
  storageKey = key

  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CodeAppearance>
        current = {
          syntaxPaletteId: parsed.syntaxPaletteId ?? DEFAULT_SYNTAX_PALETTE,
          codeThemeId: parsed.codeThemeId ?? DEFAULT_CODE_THEME,
        }
      }
    } catch {
      // A corrupted preference degrades to the house palette rather than to a blank screen.
    }
  }

  applySyntaxPalette(current.syntaxPaletteId)
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot(): CodeAppearance {
  return current
}

/** How the reader wants code to look, and the two setters that change it. */
export function useCodeAppearance() {
  const appearance = useSyncExternalStore(subscribe, snapshot, snapshot)

  const setSyntaxPalette = useCallback((syntaxPaletteId: string) => {
    current = { ...current, syntaxPaletteId }
    applySyntaxPalette(syntaxPaletteId)
    persist()
    emit()
  }, [])

  const setCodeTheme = useCallback((codeThemeId: string) => {
    current = { ...current, codeThemeId }
    persist()
    emit()
  }, [])

  return { ...appearance, setSyntaxPalette, setCodeTheme }
}

/**
 * The extensions an editor needs to look the way the reader chose.
 *
 * <p>⚠️ **The palette is deliberately not in here.** Switching it rewrites an attribute on `<html>`
 * and the stylesheet does the rest, so no editor is rebuilt — which is also why a palette reaches a
 * rendered page with no editor behind it and a code theme does not.
 *
 * @param appAdaptive what "matches the app" means, for the `auto` entry. Omit for the shared answer:
 *                    `editorChrome()` plus the syntax palette in force.
 */
export function useCodeThemeExtensions(appAdaptive?: readonly Extension[]): Extension[] {
  const { codeThemeId } = useCodeAppearance()

  const adaptive = useMemo(
    () => appAdaptive ?? [editorChrome(), syntaxHighlighting(SYNTAX_HIGHLIGHT_STYLE)],
    [appAdaptive],
  )

  return useMemo(() => codeThemeExtensions(codeThemeId, adaptive), [codeThemeId, adaptive])
}

/**
 * The picker: which colours code is read in, and whether an editor keeps the product's own look.
 *
 * <p>⚠️ **Two settings, not one, because they answer different questions.** A palette recolours the
 * product's own highlighting *everywhere* code is rendered, including a fence on a page with no editor
 * behind it. A code theme replaces an editor's look wholesale and reaches nothing else.
 */
export function CodeAppearancePicker() {
  const { syntaxPaletteId, codeThemeId, setSyntaxPalette, setCodeTheme } = useCodeAppearance()
  const hint = SYNTAX_PALETTES.find((palette) => palette.id === syntaxPaletteId)?.hint

  return (
    <>
      <section className="py-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Syntax palette
        </h3>
        <Grid>
          {SYNTAX_PALETTES.map((palette) => (
            <Choice
              key={palette.id}
              label={palette.name}
              color={palette.swatch}
              selected={syntaxPaletteId === palette.id}
              onSelect={() => setSyntaxPalette(palette.id)}
            />
          ))}
        </Grid>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </section>

      <section className="py-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Code theme
        </h3>
        <Grid>
          {CODE_THEMES.map((codeTheme) => (
            <Choice
              key={codeTheme.id}
              label={codeTheme.name}
              color={
                codeTheme.extension === null
                  ? "var(--primary)"
                  : codeTheme.dark
                    ? "#2A2A29"
                    : "#F5F2EC"
              }
              selected={codeThemeId === codeTheme.id}
              onSelect={() => setCodeTheme(codeTheme.id)}
            />
          ))}
        </Grid>
        <p className="mt-2 text-xs text-muted-foreground">
          Applies inside the editors only. “Auto” keeps them on this application’s own look and the
          palette above.
        </p>
      </section>
    </>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1.5">{children}</div>
}

function Choice({
  label,
  color,
  selected,
  onSelect,
}: {
  label: string
  color: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
        selected ? "border-primary bg-accent text-accent-foreground" : "hover:bg-accent",
      ].join(" ")}
    >
      <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: color }} />
      <span className="flex-1 truncate">{label}</span>
    </button>
  )
}

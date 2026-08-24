/**
 * `@jmouse/codemirror/palettes` — the syntax palettes on offer, and the switch that applies one.
 *
 * <p>A **code theme** is an imported CodeMirror theme: it brings its own background, gutter and
 * colours, and replaces the editor's look wholesale. A **syntax palette** changes only which colours
 * the application's own highlighting resolves to, leaving the editor sitting on the product's paper
 * with the product's chrome. So a palette applies everywhere code is rendered — including the static
 * highlighter behind a published page, which has no editor and therefore no theme.
 *
 * <p>The values are in {@link ./styles.css}; this file is the index and the switch. ⚠️ **Nothing here
 * is a colour**, which is deliberate: light and dark are two different sets, and choosing between them
 * in JavaScript would mean re-choosing on every theme change.
 *
 * <p>⚠️ **Applying a palette is a DOM write and nothing else** — no React, no store, no persistence.
 * Where the choice is remembered is the product's business; every one of them already has somewhere to
 * put it.
 */
export interface SyntaxPalette {
  readonly id: string
  readonly name: string
  readonly hint: string
  /**
   * One colour standing for the whole palette, wherever it has to be shown as a dot rather than as a
   * sample of code.
   *
   * <p>⚠️ A literal rather than `var(--syntax-keyword)`, and that is the point: a swatch has to show
   * the colour of the palette it *offers*, while the variable always resolves to the palette in force.
   * Read from a token, every dot in the row would be the same colour — the one already chosen. The
   * value is each palette's light-mode keyword hue, which is the one a reader recognises it by.
   */
  readonly swatch: string
}

/** The attribute {@link ./styles.css} keys on. The default palette is the absence of it. */
const PALETTE_ATTRIBUTE = "data-syntax-palette"

export const SYNTAX_PALETTES: readonly SyntaxPalette[] = [
  { id: "innoventa", name: "Innoventa", swatch: "#C2185B", hint: "The house palette — pink for language words, green for roles" },
  { id: "orchid", name: "Orchid", swatch: "#8E24AA", hint: "Violet-forward and soft, easiest on a bright screen" },
  { id: "harbour", name: "Harbour", swatch: "#00697C", hint: "Blues and teals — the calmest for long reading" },
  { id: "ember", name: "Ember", swatch: "#C2410C", hint: "Warm and widely separated; survives a sunlit room" },
  { id: "moss", name: "Moss", swatch: "#7A5C00", hint: "Greens and olive — coloured, but quietly" },
  { id: "graphite", name: "Graphite", swatch: "#1F1F1E", hint: "Greys, one accent, and a loud deny — structure over hue" },
]

export const DEFAULT_SYNTAX_PALETTE = SYNTAX_PALETTES[0].id

/**
 * Point the document at a palette.
 *
 * <p>The default is written as *no attribute* rather than as its own name, so the bare `:root` block
 * in the stylesheet is what an unknown or missing value falls back to. A palette that has been removed
 * from the list therefore degrades to the house one instead of to no colour at all.
 */
export function applySyntaxPalette(paletteId: string): void {
  if (typeof document === "undefined") {
    return
  }

  const known = SYNTAX_PALETTES.some((palette) => palette.id === paletteId)
  const root = document.documentElement

  if (!known || paletteId === DEFAULT_SYNTAX_PALETTE) {
    root.removeAttribute(PALETTE_ATTRIBUTE)
    return
  }

  root.setAttribute(PALETTE_ATTRIBUTE, paletteId)
}

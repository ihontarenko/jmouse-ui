import type { Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

export interface EditorChromeOptions {
  /**
   * The type size, as a CSS length.
   *
   * <p>⚠️ **Read through a variable, and that is the whole of how an editor is resized.** The size
   * reaches the text and the gutter and nothing else. Zooming a wrapper instead scales the toolbar and
   * the dialogs with it — asked for bigger code, you get a bigger application in one corner of the
   * screen. What is passed here is only the fallback for when nobody set `--editor-font-size`.
   */
  readonly fontSize?: string
  /** Padding inside the content area. */
  readonly padding?: string
}

/**
 * The CodeMirror frame — background, caret, selection, gutters, brackets, the linter's underline and
 * its tooltip — mapped onto the host's own tokens, so the source surface sits inside the page rather
 * than on top of it and recolours with the theme. Syntax colours live in {@link ./highlight}; this is
 * only the frame around them.
 *
 * <p>⚠️ **Written in shadcn's names** — `--foreground`, `--primary`, `--border`, `--popover`,
 * `--muted-foreground`, `--font-mono` — not in any product's bridged aliases. Every consumer declares
 * that set; a bridged name would render an editor in the browser's defaults in every theme and look, to
 * anybody debugging it, like a CodeMirror problem.
 *
 * <p>⚠️ **`--ink-4` is the one exception and it falls back.** One interface has a dimmer ink ramp for
 * gutter digits and comment grey; the others do not, and there `--muted-foreground` is what a gutter
 * should have been all along.
 *
 * <p>⚠️ **Selectors for parts a host does not render cost nothing.** A product with no gutter and no
 * linter still gets those rules, and they match nothing — which is the point: the trimmed copy is the
 * copy that diverges the first time somebody turns a line-number gutter on.
 */
export function editorChrome(options: EditorChromeOptions = {}): Extension {
  const { fontSize = "0.8125rem", padding = "10px 12px" } = options

  return EditorView.theme({
    "&": {
      color: "var(--foreground)",
      backgroundColor: "transparent",
      fontSize: `var(--editor-font-size, ${fontSize})`,
      height: "100%",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      padding,
      caretColor: "var(--primary)",
    },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--primary)",
      borderLeftWidth: "2px",
    },
    ".cm-placeholder": { color: "var(--muted-foreground)" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--ink-4, var(--muted-foreground))",
      border: "none",
      borderRight: "1px solid var(--border)",
    },
    ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--primary) 6%, transparent)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
    ".cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "color-mix(in srgb, var(--primary) 26%, transparent)",
    },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
      outline: "1px solid color-mix(in srgb, var(--primary) 42%, transparent)",
    },
    // The linter's underline and its tooltip, which otherwise arrive in CodeMirror's own red.
    ".cm-lintRange-error": {
      backgroundImage: "none",
      borderBottom: "2px wavy var(--destructive)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
    },
  })
}

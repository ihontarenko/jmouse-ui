import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { LanguageDescription, syntaxHighlighting, type HighlightStyle } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
import { jmeLanguageDescription } from "./jmeSyntax"
import { jmmLanguageDescription } from "./jmmSyntax"
import { jmpLanguageDescription } from "./jmpSyntax"
import { jmqLanguageDescription } from "./jmqSyntax"

export interface MarkdownGrammarOptions {
  /** The palette — {@link ../highlight}'s `SYNTAX_HIGHLIGHT_STYLE`, or the host's own. */
  readonly highlightStyle: HighlightStyle
  /** The frame around it — {@link ../editor}'s `editorChrome()`, or the host's own theme. */
  readonly chrome: Extension
  /**
   * The fence catalogue — pass `languages` from `@codemirror/language-data`.
   *
   * <p>A catalogue rather than a fixed list, so a ` ```sql ` fence inside a document is parsed by the
   * SQL grammar, loaded lazily the first time one appears. Written the other way round, every grammar
   * CodeMirror knows would sit in the initial bundle for the sake of a fence most documents do not
   * contain.
   */
  readonly codeLanguages?: readonly LanguageDescription[]
}

/**
 * What turns a description field from a grey textarea into something that shows structure while it is
 * being typed: the Markdown grammar, a palette, and the chrome around them.
 *
 * <p>⚠️ **All four house dialects go in front of the catalogue**, because none of them is in it:
 * CodeMirror has never heard of jMouse Policy, Query, Mapping or the expression language, and a page
 * about authorization is exactly a ` ```jmp ` fence — as a page explaining a saved view is a ` ```jmq `
 * one, a manual for a mapping file a ` ```jmm ` one, and a validation rule a ` ```jme ` one. The same
 * grammars the static highlighter resolves, so a fence reads identically typed and saved.
 *
 * <p>⚠️ **A catalogue entry cannot stand in for one of these.** A dialect missing from this list does
 * not fail — it falls through to `@codemirror/language-data`, finds nothing, and renders as plain text,
 * which looks exactly like a fence somebody mislabelled.
 *
 * <p>⚠️ **`;;;` directive blocks stay plain in the source editor.** One interface carries a bespoke
 * block parser for them, and almost all of it exists to nest its expression language inside one. A host
 * with no language to nest — a mermaid body is mermaid, which CodeMirror has no grammar for either way —
 * would buy a fence mark in a different colour and nothing else. The preview is what tells an author
 * whether a diagram is right, and that is a click away.
 */
export function markdownGrammar(options: MarkdownGrammarOptions): readonly Extension[] {
  const { highlightStyle, chrome, codeLanguages = [] } = options

  return [
    markdown({
      base: markdownLanguage,
      codeLanguages: [
        jmpLanguageDescription,
        jmqLanguageDescription,
        jmmLanguageDescription,
        jmeLanguageDescription,
        ...codeLanguages,
      ],
    }),
    syntaxHighlighting(highlightStyle),
    chrome,
  ]
}

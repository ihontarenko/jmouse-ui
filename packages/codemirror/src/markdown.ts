import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { LanguageDescription, syntaxHighlighting, type HighlightStyle } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
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
 * <p>⚠️ **`jmp` and `jmq` go in front of the catalogue**, because neither is in it: CodeMirror has never
 * heard of jMouse Policy or jMouse Query, and a ticket or a page about authorization is exactly a
 * ` ```jmp ` fence — while a page explaining a saved view is a ` ```jmq ` one. Same grammars the static
 * highlighter resolves, so both read identically typed and saved.
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
      codeLanguages: [jmpLanguageDescription, jmqLanguageDescription, ...codeLanguages],
    }),
    syntaxHighlighting(highlightStyle),
    chrome,
  ]
}

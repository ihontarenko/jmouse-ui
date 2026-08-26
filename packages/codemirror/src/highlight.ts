import { HighlightStyle, LanguageDescription } from "@codemirror/language"
import type { Parser } from "@lezer/common"
import { highlightTree, tags } from "@lezer/highlight"
import { StyleModule } from "style-mod"
import { jmeSyntaxLanguage } from "./jmeSyntax"
import { jmpSyntaxLanguage } from "./jmpSyntax"
import { jmqSyntaxLanguage } from "./jmqSyntax"
import {
  expressionDelimiter,
  expressionField,
  expressionFilter,
  expressionKeyword,
  mappingImport,
  mappingType,
  policyAction,
  policyCapability,
  policyDeny,
  policyInstance,
  policyKeyword,
  policyNamespace,
  policyRole,
  policyScope,
  policyStatementKind,
  policySubject,
} from "./tags"

/**
 * The house syntax palette, as rules over `--syntax-*` tokens.
 *
 * <h2>Why code has its own tokens instead of the product's</h2>
 *
 * <p>The obvious thing is to paint from `--primary` / `--destructive` / `--muted-foreground`, so
 * highlighting follows the active theme. That was tried and it followed the theme into places code
 * cannot go: on a palette whose accent *is* its secondary, keywords and strings came out the same
 * colour, and on the darker themes a whole class of token landed a few percent from the background.
 * Decorative colour and legible colour are two different jobs, and only one of them may be chosen for
 * looks.
 *
 * <p>So syntax colour is normalised — the host declares the nineteen `--syntax-*` tokens once for light
 * and once for dark, and every theme leaves them alone. ⚠️ Which means picking a theme recolours the
 * *frame* around code and never the code itself, and that is the intended outcome rather than a gap.
 *
 * <p>⚠️ **One style, both surfaces.** An editor colours what is being written and
 * {@link createStaticHighlighter} colours the fenced blocks it produced, and both resolve *this* object
 * — so a snippet cannot read one way while typed and another way once saved.
 *
 * <p>⚠️ **A host painting from its own semantic tokens does not use this.** It defines its own
 * `HighlightStyle` and hands it to {@link createStaticHighlighter} and to `syntaxHighlighting`; that is
 * a supported choice rather than a deviation, and it is the reason the machinery below takes a style
 * instead of reaching for this one.
 */
export const SYNTAX_HIGHLIGHT_STYLE = HighlightStyle.define([
  // ── Structure — comments and plumbing recede ─────────────────────────────
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: "var(--syntax-comment)",
    fontStyle: "italic",
  },
  { tag: [tags.meta, tags.processingInstruction], color: "var(--syntax-punctuation)" },

  // ── The standard set ─────────────────────────────────────────────────────
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.operatorKeyword,
      tags.modifier,
      tags.namespace,
      tags.function(tags.variableName),
      tags.typeName,
      tags.className,
    ],
    color: "var(--syntax-keyword)",
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character],
    color: "var(--syntax-string)",
  },
  { tag: [tags.number, tags.bool, tags.atom, tags.null], color: "var(--syntax-literal)" },
  { tag: [tags.variableName], color: "var(--syntax-variable)" },
  {
    tag: [tags.definition(tags.variableName)],
    color: "var(--syntax-declaration)",
    fontWeight: "600",
  },
  {
    tag: [tags.propertyName, tags.attributeName, tags.labelName],
    color: "var(--syntax-property)",
  },
  { tag: [tags.operator, tags.separator], color: "var(--syntax-operator)" },
  { tag: [tags.punctuation], color: "var(--syntax-punctuation)" },
  { tag: [tags.invalid], color: "var(--syntax-invalid, var(--syntax-deny))" },

  // ── Policy (.jmp) — declared after the standard set, so these win ────────
  { tag: [policyKeyword], color: "var(--syntax-keyword)", fontWeight: "600" },

  // The keyword's own colour, on purpose. `declare` / `assign` do not name a thing — they say what
  // KIND the block beside them is — so a second hue would have made a label look like a subject.
  // Slant and weight separate them when the eye is scanning the margin and stay out of the way when
  // it is reading a line.
  {
    tag: [policyStatementKind],
    color: "var(--syntax-namespace)",
    textDecoration: "underline",
    fontWeight: "500",
  },
  // Loud on purpose. A denial is the one statement whose consequence cannot be undone by any other
  // line in the file, and a palette that lets it blend in has mis-ranked the whole document.
  { tag: [policyDeny], color: "var(--syntax-deny)", fontWeight: "700" },
  { tag: [policyRole], color: "var(--syntax-role)", fontWeight: "600" },
  { tag: [policySubject], color: "var(--syntax-subject)" },
  { tag: [policyScope], color: "var(--syntax-scope)", fontWeight: "600" },
  { tag: [policyInstance], color: "var(--syntax-instance)" },
  { tag: [policyNamespace], color: "var(--syntax-namespace)" },
  { tag: [policyAction], color: "var(--syntax-action)" },
  // The namespace colour, on purpose: a capability key sits where a permission's namespace sits — the
  // subject of the line — and one policy file should not need two vocabularies of colour to be read.
  // Separate tags so a palette can split them later without touching the grammar.
  { tag: [policyCapability], color: "var(--syntax-namespace)" },

  // ── Expressions (jME) ────────────────────────────────────────────────────
  //
  // ⚠️ A filter is loud on purpose. `| default('x')` is the half of an expression that changes what a
  // value *is* rather than what it is compared against, and it is the half a reader skims past.
  { tag: [expressionKeyword], color: "var(--syntax-keyword)", fontWeight: "600" },
  { tag: [expressionFilter], color: "var(--syntax-filter, var(--syntax-keyword))" },
  { tag: [expressionField], color: "var(--syntax-instance)" },
  { tag: [expressionDelimiter], color: "var(--syntax-punctuation)" },

  // ── Mapping (.jmm) ───────────────────────────────────────────────────────
  //
  // ⚠️ These two exist because the standard set sends `tags.typeName` and `tags.namespace` to the
  // keyword colour, which made `target` and `Project` the same colour — and the keyword repeats on
  // every block while the type is the only thing that says which block you are looking at.
  //
  // The scope colour for the block's subject: it answers the same question `@SPACE` answers in a
  // policy — what this is about — and one house palette should not need two vocabularies for that.
  { tag: [mappingType], color: "var(--syntax-scope)", fontWeight: "600" },
  // And the quieter of the two for a `use` line, which is read once and scanned past forever after.
  { tag: [mappingImport], color: "var(--syntax-namespace)" },

  // ── The Markdown surface itself — what a source editor is mostly showing ──
  { tag: [tags.heading], color: "var(--syntax-heading, var(--ink))", fontWeight: "700" },
  { tag: [tags.strong], color: "var(--syntax-heading, var(--ink))", fontWeight: "700" },
  { tag: [tags.emphasis], fontStyle: "italic" },
  { tag: [tags.strikethrough], textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--syntax-namespace)", textDecoration: "underline" },
  { tag: [tags.monospace], color: "var(--syntax-keyword)" },
  { tag: [tags.quote], color: "var(--syntax-comment)" },
  { tag: [tags.list], color: "var(--syntax-operator)" },
])

/** A grammar this host answers for by name, ahead of any catalogue lookup. */
export interface LanguageAlias {
  /** Every fence name that means this grammar, lower-case. */
  readonly names: readonly string[]
  readonly parser: Parser
}

/**
 * ⚠️ **Three names, because a policy turns up under all of them** — a manual documenting the language
 * writes one, a ticket quoting a file writes another.
 */
export const POLICY_LANGUAGE: LanguageAlias = {
  names: ["jmp", "jmouse-policy", "policy"],
  parser: jmpSyntaxLanguage.parser,
}

/** The same for jMouse-EL, which is written in a fence about as often as it is written in a field. */
export const EXPRESSION_LANGUAGE: LanguageAlias = {
  names: ["jme", "jmouse", "jmouse-el", "jmouseel"],
  parser: jmeSyntaxLanguage.parser,
}

/**
 * jMQ — a saved view, a filter in a URL, a page explaining either.
 *
 * ⚠️ Its own alias rather than jME's, even though a jMQ expression IS jME: a document adds `view`,
 * `source` and the clause words, and colouring one with the other leaves the words that give a query its
 * shape reading as ordinary identifiers.
 */
export const QUERY_LANGUAGE: LanguageAlias = {
  names: ["jmq", "jmouse-query", "jmousequery", "query"],
  parser: jmqSyntaxLanguage.parser,
}

export interface StaticHighlighterOptions {
  /** The palette both surfaces resolve — {@link SYNTAX_HIGHLIGHT_STYLE}, or the host's own. */
  readonly highlightStyle: HighlightStyle
  /**
   * Grammars answered synchronously, before anything is looked up. jMouse's own languages belong here
   * because no catalogue has ever heard of them.
   */
  readonly grammars?: readonly LanguageAlias[]
  /**
   * Everything else, resolved lazily and cached — pass `languages` from `@codemirror/language-data`.
   *
   * <p>⚠️ **Omit it and every other fence renders as plain text**, which is the right answer for a host
   * that shows one language on one screen: a catalogue is a dependency carried and a lazy-loading path
   * exercised for grammars nothing there can produce.
   */
  readonly catalogue?: readonly LanguageDescription[]
}

export interface StaticHighlighter {
  /** Render `code` to an HTML string of highlighted `<span>` runs using the given Lezer parser. */
  highlightToHtml(parser: Parser, code: string): string
  /** A fence's language name resolved to a parser, or `null` where nothing knows it. */
  resolveParser(languageName: string): Promise<Parser | null>
  /** The two above in one call — the shape a Markdown renderer's code plugin asks for. */
  highlightFencedCode(language: string, code: string): Promise<string | null>
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character])
}

/**
 * Highlighting for code that is being *read* rather than edited — there is no CodeMirror view behind a
 * rendered page, and this is what stands in for one.
 *
 * <p>⚠️ **It reuses the editor's own pieces, and that is the whole point.** The same grammars colour
 * what is being written and what was published, and the same `HighlightStyle` decides the colours — so a
 * snippet cannot read one way in the editor and another way two clicks later. Rendering through
 * CodeMirror's built-in `classHighlighter` instead would be a *second* tag→class mapping with different
 * coverage, which is exactly the drift this avoids.
 *
 * <p>⚠️ **The stylesheet has to be mounted by hand.** In an editor an `EditorView` does it; here there
 * is no view, so the generated token classes would have no colours at all — and the failure looks like
 * the highlighter silently not working rather than like a missing stylesheet. It happens on the first
 * render and once per highlighter.
 *
 * <p>⚠️ **An unknown language is `null`, cached as `null`, and that is not a failure** — the caller falls
 * back to plain text, which is the right rendering for a fence labelled `hcl` in a build with no HCL.
 */
export function createStaticHighlighter(options: StaticHighlighterOptions): StaticHighlighter {
  const { highlightStyle, grammars = [], catalogue } = options

  const known = new Map<string, Parser>()
  for (const grammar of grammars) {
    for (const name of grammar.names) {
      known.set(name, grammar.parser)
    }
  }

  /** Resolved parsers by normalised language name; `null` marks a language with no known grammar. */
  const resolved = new Map<string, Parser | null>()
  let stylesMounted = false

  function ensureStyles(): void {
    if (stylesMounted || typeof document === "undefined") {
      return
    }
    if (highlightStyle.module) {
      StyleModule.mount(document, highlightStyle.module)
    }
    stylesMounted = true
  }

  function highlightToHtml(parser: Parser, code: string): string {
    ensureStyles()

    const tree = parser.parse(code)
    let html = ""
    let position = 0

    // ⚠️ Every run is escaped, including the gaps between tokens — this returns HTML into a page.
    highlightTree(tree, highlightStyle, (from, to, classes) => {
      if (from > position) {
        html += escapeHtml(code.slice(position, from))
      }
      html += `<span class="${classes}">${escapeHtml(code.slice(from, to))}</span>`
      position = to
    })

    if (position < code.length) {
      html += escapeHtml(code.slice(position))
    }

    return html
  }

  async function resolveParser(languageName: string): Promise<Parser | null> {
    const normalised = languageName.trim().toLowerCase()

    if (!normalised) {
      return null
    }

    const ours = known.get(normalised)
    if (ours) {
      return ours
    }
    if (resolved.has(normalised)) {
      return resolved.get(normalised) ?? null
    }
    if (!catalogue) {
      return null
    }

    const description = LanguageDescription.matchLanguageName([...catalogue], normalised, true)
    if (!description) {
      resolved.set(normalised, null)
      return null
    }

    const support = await description.load()
    resolved.set(normalised, support.language.parser)

    return support.language.parser
  }

  async function highlightFencedCode(language: string, code: string): Promise<string | null> {
    const parser = await resolveParser(language)

    return parser ? highlightToHtml(parser, code) : null
  }

  return { highlightToHtml, resolveParser, highlightFencedCode }
}

/**
 * `@jmouse/codemirror` — the CodeMirror layer five interfaces share.
 *
 * <h2>⚠️ Why this is not inside `@jmouse/ui`</h2>
 *
 * <p>Two reasons, and either would be enough. `@jmouse/ui` is the React render layer and knows no
 * domain; `.jmp` is jMouse Policy — the language authorization is written in — which is a domain if
 * anything is. And nothing here renders: there is not a component, a hook or a `react` import in the
 * package, so a consumer that wants a tokenizer would have been made to take radix, lucide, recharts and
 * sonner to get one. Two of the five consumers are not on that render layer at all.
 *
 * <h2>⚠️ Four entry points, split by what they make you install</h2>
 *
 * <p>Not by topic. A host showing one policy on one screen needs `@codemirror/language` and
 * `@lezer/highlight` and nothing else, and it must not be made to install `@codemirror/view` for a
 * grammar it renders as static HTML. So:
 *
 * <ul>
 *   <li>`@jmouse/codemirror` — the tags and the two grammars.</li>
 *   <li>`@jmouse/codemirror/highlight` — the palette and the static renderer (`@lezer/common`,
 *       `style-mod`).</li>
 *   <li>`@jmouse/codemirror/editor` — the editor frame (`@codemirror/view`).</li>
 *   <li>`@jmouse/codemirror/completion` — catalogue-fed completion (`@codemirror/autocomplete`). ⚠️ Its
 *       own entry point for the same reason: a host rendering one policy as static HTML must not be
 *       made to install an autocomplete engine to get a tokenizer.</li>
 *   <li>`@jmouse/codemirror/markdown` — the Markdown source stack (`@codemirror/lang-markdown`).</li>
 *   <li>`@jmouse/codemirror/palettes` — the six syntax palettes and the switch.</li>
 *   <li>`@jmouse/codemirror/themes` — the imported code themes (`thememirror`).</li>
 *   <li>`@jmouse/codemirror/react-highlight` — a read-only block of code as a React component
 *       (`react`, and a type). ⚠️ Apart from `./react` for the usual reason: that entry reaches the
 *       editor frame, and a host rendering one static document must not install `@codemirror/view`
 *       to get a `<pre>`.</li>
 *   <li>`@jmouse/codemirror/styles.css` — ⚠️ **required**, and the one thing that fails silently:
 *       without it every `var(--syntax-*)` resolves to nothing and the highlighter looks broken.</li>
 * </ul>
 *
 * <h2>⚠️ This colours; it does not decide</h2>
 *
 * <p>Whether a policy or an expression is *valid* is answered by the real parser on a backend, never
 * here. A TypeScript re-implementation of either grammar would be a second grammar that agrees for about
 * a month — after which an editor calls a file good and the boot refuses it, or worse, the other way
 * round.
 *
 * <p>⚠️ The two grammar files are ported **verbatim** from the five copies they replace, formatting
 * included, so that the extraction shows up as a move rather than a rewrite. Their four-space, single-
 * quoted style is the one thing in this package that does not match the rest of it, and it is deliberate.
 */

export {
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
  expressionDelimiter,
  expressionField,
  expressionFilter,
  expressionKeyword,
  mappingImport,
  mappingType,
  scriptEvent,
  scriptFacade,
} from "./tags"

export { jmpSyntax, jmpSyntaxLanguage, jmpLanguageDescription } from "./jmpSyntax"
export { jmeSyntax, jmeSyntaxLanguage, jmeLanguageDescription } from "./jmeSyntax"
export { jmqSyntax, jmqSyntaxLanguage, jmqLanguageDescription } from "./jmqSyntax"
export { jmmSyntax, jmmSyntaxLanguage, jmmLanguageDescription } from "./jmmSyntax"
export { jmvSyntax, jmvSyntaxLanguage, jmvLanguageDescription } from "./jmvSyntax"
export { jmsSyntax, jmsSyntaxLanguage, jmsLanguageDescription } from "./jmsSyntax"

export type {
  CatalogueEntry,
  CatalogueFacade,
  CatalogueMethod,
  CompletionCatalogue,
  CompletionRules,
} from "./completion"

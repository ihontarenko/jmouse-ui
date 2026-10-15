import { LanguageDescription, LanguageSupport, StreamLanguage, type StreamParser, type StringStream } from "@codemirror/language"
import { tags, type Tag } from "@lezer/highlight"

/**
 * jMF — the formula language of `jmouse-formula-el`: a jME dialect for mathematics, with `^` as power,
 * own functions (`f(u) = …`), binding forms (`sum`, `product`, `integral`), cases and `n!`.
 *
 * <p>The vocabulary follows the TextMate grammar in `jmouse-formula-el/tools/jmf-textmate`, which is the
 * description the language's own authors keep. Like every grammar here it is a token scanner: it colours,
 * and the real parser on the backend decides — a refused formula comes back with the position to mark.
 */

/** Built-in functions, with their arity, for completion. */
export const JMF_FUNCTIONS: readonly { name: string; arity: number }[] = [
  ...["sin", "cos", "tan", "cot", "sec", "csc", "tg", "ctg", "asin", "acos", "atan", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
    "exp", "ln", "log", "log10", "log2", "sqrt", "cbrt", "abs", "sign", "sgn", "floor", "ceil", "round", "step", "re", "im", "arg", "conj", "gamma", "Gamma", "factorial", "erf"]
    .map((name) => ({ name, arity: 1 })),
  ...["atan2", "min", "max", "mod", "hypot", "pow", "binomial", "choose"].map((name) => ({ name, arity: 2 })),
]

/** Forms that bind a variable or choose between branches. */
export const JMF_FORMS: readonly string[] = ["sum", "product", "integral", "limit", "if", "piecewise", "diff", "derivative"]

export const JMF_CONSTANTS: readonly string[] = ["pi", "tau", "phi", "e", "inf", "i"]

const FUNCTIONS = new Set(JMF_FUNCTIONS.map((entry) => entry.name))
const FORMS = new Set(JMF_FORMS)
const CONSTANTS = new Set(["pi", "tau", "phi", "e", "inf", "π", "∞"])
const LOGICAL = new Set(["and", "or"])

const TOKEN_TAGS: Record<string, Tag> = {
  keyword: tags.controlKeyword,
  function: tags.function(tags.variableName),
  definition: tags.definition(tags.function(tags.variableName)),
  constant: tags.constant(tags.variableName),
  imaginary: tags.atom,
  number: tags.number,
  comment: tags.comment,
  operator: tags.operator,
  logical: tags.logicOperator,
  punctuation: tags.punctuation,
  label: tags.labelName,
  variable: tags.variableName,
  invalid: tags.invalid,
}

interface FormulaState {
  /** At the start of a statement — where `f(u) =` and `label:` may stand. */
  statementStart: boolean
}

const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/
const IDENTIFIER = /^[A-Za-z\p{L}][\w\p{L}]*/u
const SUPERSCRIPT = /^[⁰¹²³⁴⁵⁶⁷⁸⁹]+/
const MULTI_OPERATOR = /^(\*\*|<=|>=|==|!=|&&|\|\|)/
const DEFINITION_AHEAD = /^\s*(\([^()=]*\))?\s*=(?!=)/
const LABEL_AHEAD = /^\s*:(?!=)/

function identifierToken(stream: StringStream, state: FormulaState, word: string): string {
  const atStart = state.statementStart
  state.statementStart = false
  if (atStart && stream.match(LABEL_AHEAD, false)) {
    return "label"
  }
  if (atStart && stream.match(DEFINITION_AHEAD, false)) {
    return "definition"
  }
  if (FORMS.has(word) && stream.match(/^\s*\(/, false)) {
    return "keyword"
  }
  if (FUNCTIONS.has(word) && stream.match(/^\s*\(/, false)) {
    return "function"
  }
  if (stream.match(/^\s*\(/, false)) {
    return "function"
  }
  if (LOGICAL.has(word)) {
    return "logical"
  }
  if (word === "i") {
    return "imaginary"
  }
  if (CONSTANTS.has(word)) {
    return "constant"
  }
  return "variable"
}

const parser: StreamParser<FormulaState> = {
  name: "jmf",
  startState: () => ({ statementStart: true }),
  copyState: (state) => ({ ...state }),
  languageData: { commentTokens: { line: "#" } },
  tokenTable: TOKEN_TAGS,
  token(stream, state) {
    if (stream.sol()) {
      state.statementStart = true
    }
    if (stream.eatSpace()) {
      return null
    }
    const character = stream.peek()
    if (character === "#") {
      stream.skipToEnd()
      return "comment"
    }
    if (stream.match(NUMBER) || stream.match(SUPERSCRIPT)) {
      state.statementStart = false
      return "number"
    }
    if (stream.match(MULTI_OPERATOR)) {
      return "operator"
    }
    if (character === ";" || character === ":") {
      stream.next()
      state.statementStart = true
      return "punctuation"
    }
    if (character && "+-*/%^!=<>?·×÷−≤≥≠∧∨¬".includes(character)) {
      stream.next()
      return "operator"
    }
    if (character && "(),".includes(character)) {
      stream.next()
      return "punctuation"
    }
    if (character && "[]{}'\"".includes(character)) {
      stream.next()
      return "invalid"
    }
    if (character === "π" || character === "∞") {
      stream.next()
      return "constant"
    }
    if (stream.match(IDENTIFIER)) {
      return identifierToken(stream, state, stream.current())
    }
    stream.next()
    return null
  },
}

export const jmfSyntaxLanguage = StreamLanguage.define(parser)

export function jmfSyntax(): LanguageSupport {
  return new LanguageSupport(jmfSyntaxLanguage)
}

export const jmfLanguageDescription = LanguageDescription.of({
  name: "jmf",
  alias: ["formula", "jmouse-formula"],
  extensions: ["jmf"],
  support: jmfSyntax(),
})

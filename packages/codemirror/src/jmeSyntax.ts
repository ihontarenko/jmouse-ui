import {
    StreamLanguage, LanguageSupport, LanguageDescription, type StreamParser,
} from '@codemirror/language';
import { tags, type Tag } from '@lezer/highlight';
import {
    expressionDelimiter, expressionField, expressionFilter, expressionKeyword,
} from './tags';

/**
 * jMouse-EL — the one description of the expression language, beside {@link ./jmpSyntax}'s policy one.
 *
 * <p>⚠️ **A condition is not policy, and that is why this grammar is here at all.** The line around it
 * is `.jmp`, but what goes between the quotes after `when` is pure expression language — the same one a
 * form field's validation rule is written in. Colouring it with the policy grammar would highlight the
 * wrong words, and colouring it with nothing would leave the one surface that decides whether a
 * permission holds on this row and not the next reading as plain grey.
 *
 * <p>It is a `StreamLanguage` — a token scanner rather than a real parser. Deliberate: colouring is all
 * this is for, it is cheap per keystroke, and `.parser` still slots into `parseMixed` where a Markdown
 * host later wants ` ```jme ` fences.
 *
 * <p>⚠️ **This colours; it does not decide.** Whether an expression is well formed is answered by the
 * real parser over HTTP, on the document as a whole — a second opinion in the browser is a second
 * grammar that agrees for about a month.
 */

/** Template control keywords understood inside `{% … %}` tags (and the operator-words). */
const KEYWORDS = new Set([
    'set', 'for', 'endfor', 'in', 'if', 'elseif', 'elif', 'else', 'endif',
    'include', 'import', 'from', 'as', 'macro', 'endmacro', 'block', 'endblock',
    'with', 'endwith', 'do', 'filter', 'endfilter', 'and', 'or', 'not', 'is',
    'matches', 'class', 'range',
]);

/** Value literals rendered in the "number" hue. */
const LITERALS = new Set(['true', 'false', 'null', 'none']);

/**
 * Progress through a `$ALIAS:field-id[:placeholder]` binding line (only above the `---` split). The
 * scanner walks the three colon-separated parts so each gets its own colour without a real parser.
 */
type BindingStage = 'none' | 'colon' | 'fieldId' | 'placeholderColon' | 'placeholder';

interface JMouseELState {
    /** Inside a `{# … #}` template comment, which spans lines. */
    inComment:    boolean;
    /** The previous significant token was a lone `|`, so the next identifier is a filter name. */
    afterPipe:    boolean;
    /** The previous token was a `.`, so the next identifier is a property access. */
    afterDot:     boolean;
    /** Where we are within a binding line, if any. */
    bindingStage: BindingStage;
}

/**
 * Token names emitted by {@link tokenize}, mapped to highlight tags for both editor and preview.
 *
 * <p>The four that carry meaning specific to this language take tags of their own (see `./tags`), so
 * an expression can be recoloured without dragging every other grammar along — and so a field the
 * expression reads shares a colour with the *place* half of a policy, which is what both of them are.
 * Each names a standard parent, which is what keeps the imported code themes working.
 */
const TOKEN_TAGS: Record<string, Tag> = {
    keyword:     expressionKeyword,
    literal:     tags.bool,
    string:      tags.string,
    number:      tags.number,
    comment:     tags.comment,
    operator:    tags.operator,
    punctuation: tags.punctuation,
    filter:      expressionFilter,
    namespace:   tags.namespace,
    property:    tags.propertyName,
    alias:       tags.definition(tags.variableName),
    fieldId:     expressionField,
    placeholder: tags.comment,
    delimiter:   expressionDelimiter,
    variable:    tags.variableName,
};

const SEPARATOR       = /^---[ \t]*$/;
const BINDING_ALIAS   = /^\$[A-Za-z_]\w*(?=:)/;
const TEMPLATE_MARKS  = /^(\{\{|\}\}|\{%|%\}|\{!|!\})/;
const BEAN_ACCESS     = /^@[A-Za-z_]\w*/;
const ALIAS_REFERENCE = /^\$[A-Za-z_]\w*/;
const CONSTANT_ACCESS = /^#[A-Za-z_]\w*/;
const NUMBER          = /^\d+(\.\d+)?([eE][-+]?\d+)?[kKmMgGuUnNpP]?/;
const LEADING_DECIMAL  = /^\.\d+/;
const MULTI_OPERATOR  = /^(\*\*|\.\.|==|!=|<=|>=|&&|\|\||=>|->)/;
const IDENTIFIER      = /^[A-Za-z_]\w*/;
const FIELD_ID        = /^[^:\n]+/;

/** Advance through the parts of a `$ALIAS:field-id[:placeholder]` binding line. */
function tokenizeBinding(stream: import('@codemirror/language').StringStream, state: JMouseELState): string | null {
    switch (state.bindingStage) {
        case 'colon':
            if (stream.eat(':')) {
                state.bindingStage = 'fieldId';
                return 'operator';
            }
            state.bindingStage = 'none';
            return null;
        case 'fieldId':
            state.bindingStage = 'placeholderColon';
            if (stream.match(FIELD_ID)) {
                return 'fieldId';
            }
            stream.skipToEnd();
            state.bindingStage = 'none';
            return null;
        case 'placeholderColon':
            if (stream.eat(':')) {
                state.bindingStage = 'placeholder';
                return 'operator';
            }
            state.bindingStage = 'none';
            return null;
        case 'placeholder':
            stream.skipToEnd();
            state.bindingStage = 'none';
            return 'placeholder';
        default:
            state.bindingStage = 'none';
            return null;
    }
}

/** Consume a single-quote or double-quote string, honouring backslash escapes. */
function consumeString(stream: import('@codemirror/language').StringStream, quote: string): void {
    stream.next();
    let escaped = false;
    let current: string | void;
    while ((current = stream.next()) !== undefined) {
        if (current === quote && !escaped) {
            break;
        }
        escaped = current === '\\' && !escaped;
    }
}

const parser: StreamParser<JMouseELState> = {
    name: 'jme',
    startState: () => ({ inComment: false, afterPipe: false, afterDot: false, bindingStage: 'none' }),
    copyState: (state) => ({ ...state }),
    languageData: { commentTokens: { block: { open: '{#', close: '#}' } } },
    tokenTable: TOKEN_TAGS,

    token(stream, state) {
        // A `{# … #}` template comment spans lines, so it owns the stream until its close.
        if (state.inComment) {
            if (stream.match('#}')) {
                state.inComment = false;
                return 'delimiter';
            }
            stream.next();
            return 'comment';
        }

        // At the start of a line, reset per-line context and detect binding / separator lines.
        if (stream.sol()) {
            state.afterPipe = false;
            state.afterDot = false;
            state.bindingStage = 'none';
            if (stream.match(SEPARATOR)) {
                return 'punctuation';
            }
            if (stream.match(BINDING_ALIAS)) {
                state.bindingStage = 'colon';
                return 'alias';
            }
        }

        if (state.bindingStage !== 'none') {
            return tokenizeBinding(stream, state);
        }

        // Template delimiters open/close an interpolation, statement, or comment region.
        if (stream.match(TEMPLATE_MARKS)) {
            return 'delimiter';
        }
        if (stream.match('{#')) {
            state.inComment = true;
            return 'delimiter';
        }

        if (stream.eatSpace()) {
            return null;
        }

        const wasAfterPipe = state.afterPipe;
        const wasAfterDot = state.afterDot;
        state.afterPipe = false;
        state.afterDot = false;

        const character = stream.peek();

        if (character === '\'' || character === '"') {
            consumeString(stream, character);
            return 'string';
        }
        if (stream.match(BEAN_ACCESS)) {
            return 'namespace';
        }
        if (stream.match(ALIAS_REFERENCE)) {
            return 'alias';
        }
        if (stream.match(CONSTANT_ACCESS)) {
            return 'property';
        }
        if (stream.match(NUMBER) || stream.match(LEADING_DECIMAL)) {
            return 'number';
        }
        if (stream.match(MULTI_OPERATOR)) {
            return 'operator';
        }

        if (character && '+-*/%~<>!?:=|&^'.includes(character)) {
            stream.next();
            if (character === '|') {
                state.afterPipe = true;
            }
            return 'operator';
        }
        if (character === '.') {
            stream.next();
            state.afterDot = true;
            return 'operator';
        }
        if (character && '()[]{},;'.includes(character)) {
            stream.next();
            return 'punctuation';
        }

        if (stream.match(IDENTIFIER)) {
            const word = stream.current();
            if (wasAfterPipe) {
                return 'filter';
            }
            if (wasAfterDot) {
                return 'property';
            }
            if (KEYWORDS.has(word)) {
                return 'keyword';
            }
            if (LITERALS.has(word)) {
                return 'literal';
            }
            return 'variable';
        }

        stream.next();
        return null;
    },
};

/** The jMouse-EL language — a `StreamLanguage`; `.parser` is reused for nested/static highlighting. */
export const jmeSyntaxLanguage = StreamLanguage.define(parser);

/** Editor-ready language support (grammar only; theme/highlight-style are applied separately). */
export function jmeSyntax(): LanguageSupport {
    return new LanguageSupport(jmeSyntaxLanguage);
}

/** Lazy description so Markdown's `codeLanguages` can resolve ` ```jme ` fences to this grammar. */
export const jmeLanguageDescription = LanguageDescription.of({
    name:    'jme',
    alias:   ['jmouse', 'jmouse-el', 'jmouseel'],
    support: jmeSyntax(),
});

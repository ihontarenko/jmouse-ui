import {
    StreamLanguage, LanguageSupport, LanguageDescription, type StreamParser, type StringStream,
} from '@codemirror/language';
import { tags, type Tag } from '@lezer/highlight';
import { expressionField, expressionFilter, expressionKeyword } from './tags';

/**
 * `.jmv` — jMouse Validation, the fifth dialect on the same core, beside `.jmp`, `.jmm`, `.jmq` and the
 * template one.
 *
 * <p>⚠️ **It is jME plus eight words, and this grammar says so by construction.** Every guard, every
 * message and every check argument is the expression language already described in
 * {@link ./jmeSyntax}. What this file adds is the words that open a block (`validation`, `gate`,
 * `always`, `when`, `otherwise`) and the three that modify a line (`invariant`, `stop`, `optional`).
 *
 * <p>⚠️ **This colours; it does not decide.** Whether a document is valid — whether a check exists,
 * whether its arguments fit, whether a field is named twice — is answered by the reader on a backend
 * when the file loads. A TypeScript re-implementation of that would be a second checker agreeing for
 * about a month, after which an editor calls a file good and the boot refuses it.
 *
 * <h2>⚠️ The three colouring decisions that carry the file's meaning</h2>
 *
 * <p>**A field is the word a colon follows at the start of a line.** That is the column a reader scans
 * down, and it is the single most misleading thing this grammar could get wrong. Tested by looking
 * ahead rather than by remembering that no colon has been seen yet, because *before a colon* is true of
 * far too much — the `host` in `url(host: 'x')` is before one and is an argument's name.
 *
 * <p>**A check reads as an operation, not as a variable.** `size(3, 32)` is a named thing applied to
 * the field's value, which is exactly what a jME filter is — so it takes {@link expressionFilter}
 * rather than a new tag. A validation is not a fifth thing to recolour, and defining
 * `validationCheck` beside `expressionFilter` would give a host two switches for one decision.
 *
 * <p>**`optional` is an atom, the way `.jmm` colours `ignore`.** It is the one check that builds
 * nothing — a decision rather than a name — and colouring it like `required` would hide that nothing is
 * asked of the value, while colouring it like a variable would hide that somebody decided.
 */

/** What opens a block. ⚠️ `validation` is the file's own header and is coloured louder than the rest. */
const BLOCKS = new Set(['gate', 'always']);

/** Branching. Kept apart from {@link BLOCKS} because a reader scanning for *what applies when* scans for these. */
const BRANCHES = new Set(['when', 'otherwise']);

/**
 * Operator words and the tests, which read as words rather than symbols. Shared with jME.
 *
 * <p>⚠️ `null` is deliberately NOT here, for the reason `.jmm` gives: it is a value being compared
 * against, not the comparison.
 */
const OPERATORS = new Set([
    'and', 'or', 'not', 'is', 'in',
    'contains', 'starts', 'ends', 'empty', 'even', 'odd',
]);

const LITERALS = new Set(['true', 'false', 'null']);

interface JmvState {
    /** The previous token was a `.`, so the next identifier is part of a path. */
    afterDot:   boolean;
    /** Nothing but whitespace has been seen on this line, so a word here may open a block or be a field. */
    lineStart:  boolean;
    /**
     * How deep inside a check's parentheses the scanner is.
     *
     * <p>⚠️ This is what tells a named argument from a field. Both are an identifier followed by a
     * colon, and only their surroundings differ.</p>
     */
    parens:     number;
    /**
     * What the scanner is reading on this line.
     *
     * <h3>⚠️ Three positions, because a line has three</h3>
     *
     * <p>`part_number : required stop, size(3, 32) : 'looks like AB-1234'` runs through all of them,
     * and a single "have we passed a colon" flag cannot: the words after the FIRST colon are checks and
     * the words after the second are a message, which may be an expression — {@code field.label ~ ' is
     * needed'} — whose identifiers must not be painted as checks.</p>
     *
     * <p>⚠️ And a comma outside parentheses goes back to `check`, which is what makes the second half
     * of `required : 'a', size(3, 32)` read correctly.</p>
     */
    expect:     'field' | 'check' | 'message';
    /**
     * Whether a field has been named on this line.
     *
     * <p>⚠️ What tells a continuation line from a first one. `: 'looks like AB-1234'` opens with the
     * same colon a check list does, and only the absence of a field before it says which it is.</p>
     */
    named:      boolean;
}

/**
 * Token names emitted by the scanner, mapped to the tags both the editor and the static preview read.
 *
 * <p>⚠️ The same expression tags the other four dialects already emit, and no new ones.
 */
const TOKEN_TAGS: Record<string, Tag> = {
    declaration: expressionKeyword,
    keyword:     tags.keyword,
    branch:      tags.controlKeyword,
    modifier:    tags.modifier,
    field:       expressionField,
    check:       expressionFilter,
    argument:    tags.propertyName,
    property:    tags.propertyName,
    optional:    tags.atom,
    string:      tags.string,
    number:      tags.number,
    comment:     tags.comment,
    operator:    tags.operator,
    punctuation: tags.punctuation,
    literal:     tags.bool,
    variable:    tags.variableName,
};

const NUMBER         = /^\d+(\.\d+)?([eE][-+]?\d+)?/;
const MULTI_OPERATOR = /^(==|!=|<>|<=|>=|&&|\|\||\?\?|->|\.\.)/;
const IDENTIFIER     = /^[A-Za-z_][\w]*/;

const parser: StreamParser<JmvState> = {
    name: 'jmv',

    startState(): JmvState {
        return { afterDot: false, lineStart: true, parens: 0, expect: 'field', named: false };
    },

    token(stream: StringStream, state: JmvState): string | null {
        if (stream.sol()) {
            state.lineStart = true;
            state.expect    = 'field';
            state.named     = false;
        }

        if (stream.eatSpace()) {
            return null;
        }

        // ⚠️ Read before anything else: a comment may contain any word this grammar spends, and a `#`
        // inside a string is not one. Strings are handled below, so order is the whole rule here.
        if (stream.peek() === '#') {
            stream.skipToEnd();

            return 'comment';
        }

        const wasAfterDot   = state.afterDot;
        const wasLineStart  = state.lineStart;
        const wasExpecting  = state.expect;

        state.afterDot  = false;
        state.lineStart = false;

        const character = stream.peek();

        if (character === '"' || character === "'") {
            stream.next();
            let escaped = false;

            while (!stream.eol()) {
                const next = stream.next();

                if (escaped) {
                    escaped = false;
                } else if (next === '\\') {
                    escaped = true;
                } else if (next === character) {
                    break;
                }
            }

            return 'string';
        }

        if (character === '(') {
            stream.next();
            state.parens += 1;

            return 'punctuation';
        }

        if (character === ')') {
            stream.next();
            state.parens = Math.max(0, state.parens - 1);

            return 'punctuation';
        }

        if (character === ':') {
            stream.next();

            // ⚠️ Only a colon OUTSIDE parentheses moves the line along. The one separating a named
            // argument from its value leaves the line exactly where it was.
            //
            // ⚠️ And the FIRST one after a field opens the checks, while any after that opens a
            // message — which is why a continuation line, having named no field, goes straight to one.
            if (state.parens === 0) {
                state.expect = state.named && state.expect === 'field' ? 'check' : 'message';
            }

            return 'operator';
        }

        if (stream.match(NUMBER)) {
            return 'number';
        }

        if (stream.match(MULTI_OPERATOR)) {
            return 'operator';
        }

        if (character && '+-*/%<>!=|&^~?'.includes(character)) {
            stream.next();

            return 'operator';
        }

        if (character === '.') {
            stream.next();
            state.afterDot = true;

            return 'operator';
        }

        if (character && '{}[],;'.includes(character)) {
            stream.next();

            // ⚠️ A comma outside parentheses ends one check and starts the next, message or no message.
            if (character === ',' && state.parens === 0 && state.expect === 'message') {
                state.expect = 'check';
            }

            return 'punctuation';
        }

        if (stream.match(IDENTIFIER)) {
            const word = stream.current();

            if (wasAfterDot) {
                return 'property';
            }

            if (word === 'validation' && wasLineStart) {
                return 'declaration';
            }

            // ⚠️ A block word opens a block only at the start of a line — a field legitimately called
            // `gate`, `always` or `when` is why, and the backend's own parser asks the same second
            // question there: is a colon behind it.
            if (BLOCKS.has(word) && wasLineStart && !stream.match(/^\s*:/, false)) {
                return 'keyword';
            }

            if (BRANCHES.has(word) && !stream.match(/^\s*:/, false)) {
                return 'branch';
            }

            if (word === 'invariant' && wasLineStart && !stream.match(/^\s*:/, false)) {
                return 'keyword';
            }

            const inChecks = wasExpecting === 'check' && state.parens === 0;

            // ⚠️ `optional` is checked before the general check rule. It is the one check that builds
            // nothing, and it has to read as a decision rather than as one more thing being asked.
            if (word === 'optional' && inChecks) {
                return 'optional';
            }

            // `stop` modifies the check in front of it and never opens anything.
            if (word === 'stop' && inChecks) {
                return 'modifier';
            }

            if (OPERATORS.has(word)) {
                return 'operator';
            }

            if (LITERALS.has(word)) {
                return 'literal';
            }

            // ⚠️ An argument's name inside parentheses — `url(host: 'x')`. Tested before the field rule
            // because both are an identifier a colon follows, and only the parentheses tell them apart.
            if (state.parens > 0 && stream.match(/^\s*:/, false)) {
                return 'argument';
            }

            // ⚠️ A field is the word a colon follows AT THE START OF A LINE. That is the column a
            // reader scans down; colouring anything else as one is the most misleading thing this
            // grammar could do.
            if (wasLineStart && state.parens === 0 && stream.match(/^\s*:/, false)) {
                state.named = true;

                return 'field';
            }

            // ⚠️ Anything else standing where checks stand IS one — no look-ahead. Requiring a `(` or a
            // comma behind it read `required stop` as a variable, because what follows a bare check is
            // whatever modifies it. The position is the answer; the punctuation is not.
            if (inChecks) {
                return 'check';
            }

            return 'variable';
        }

        stream.next();

        return null;
    },

    tokenTable: TOKEN_TAGS,
};

/** The `.jmv` language — a `StreamLanguage`; `.parser` is reused for nested/static highlighting. */
export const jmvSyntaxLanguage = StreamLanguage.define(parser);

/** Editor-ready language support (grammar only; theme and highlight style are applied separately). */
export function jmvSyntax(): LanguageSupport {
    return new LanguageSupport(jmvSyntaxLanguage);
}

/** Lazy description so Markdown's `codeLanguages` can resolve ` ```jmv ` fences to this grammar. */
export const jmvLanguageDescription = LanguageDescription.of({
    name:    'jmv',
    alias:   ['jmouse-validation', 'jmousevalidation', 'validation'],
    support: jmvSyntax(),
});

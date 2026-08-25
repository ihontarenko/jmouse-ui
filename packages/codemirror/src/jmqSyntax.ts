import {
    StreamLanguage, LanguageSupport, LanguageDescription, type StreamParser, type StringStream,
} from '@codemirror/language';
import { tags, type Tag } from '@lezer/highlight';
import {
    expressionField, expressionFilter, expressionKeyword,
} from './tags';

/**
 * `.jmq` — jMouse Query, the third dialect on the same core, beside `.jmp` and the template one.
 *
 * <p>⚠️ **It is jME plus four tags, and this grammar says so by construction.** Everything between the
 * clause words — the operators, the converters, the tests, `entry[name]` — is the expression language
 * already described in {@link ./jmeSyntax}; what this file adds is the words that open a declaration
 * (`structure`, `mapping`, `view`, `function`) and the clauses inside one (`where`, `order`, `fetch`, `group`,
 * `having`). Writing a whole second scanner would have been writing jME twice, and the two would have
 * disagreed the first time an operator was added to one of them.
 *
 * <p>⚠️ **This colours; it does not decide.** Whether a query is valid — whether the attribute exists,
 * whether the comparison is typed, whether an aggregate is in the wrong clause — is answered by the
 * compiler on a backend, in sentences a person can act on. A TypeScript re-implementation of that would
 * be a second checker that agrees for about a month, after which an editor calls a query good and the
 * save refuses it.
 *
 * <p>Three token decisions worth knowing before changing anything:
 *
 * 1. **A clause word opens a clause only at the start of a line.** Inside one it is coloured quieter,
 *    which is what `attribute entry[x] from y text in bag` wants — and it leaves room for the case this
 *    language has to allow: a product whose column is called `value`, `key` or `order`. The backend's
 *    own parser makes the same allowance, for the same reason.
 * 2. **A converter is coloured after a lone `|`**, exactly as in jME. `| int` is not decoration in this
 *    language: it is what stops `"900" > "1000"` being true, so it is worth seeing.
 * 3. **`#` opens a comment to the end of the line** — the one piece of punctuation this dialect spends
 *    that the expression language does not.
 */

/** What opens a declaration. ⚠️ `source` is read but never written — it is what `structure` + `mapping` used to be. */
const DECLARATIONS = new Set(['structure', 'mapping', 'view', 'function', 'source']);

/** What appears inside a declaration — the clauses, and the words that shape a source. */
const CLAUSES = new Set([
    'where', 'order', 'fetch', 'group', 'having', 'limit',
    'from', 'file', 'bag', 'join', 'collection', 'attributes', 'uses',
    // ⚠️ Read but never written: `columns` is what `fetch` used to be called, and `attribute` is what a
    // mapping's bindings used to be. Colouring them keeps a stored document legible until it is saved
    // once and rewritten into the current spelling.
    'columns', 'attribute',
]);

/** Words that modify a clause rather than opening one. */
const MODIFIERS = new Set([
    'on', 'as', 'key', 'value', 'in', 'column', 'asc', 'desc',
    'default', 'identity', 'header', 'delimiter',
]);

/**
 * The kinds of value an attribute may be declared to hold.
 *
 * ⚠️ `unknown` is the important one and is coloured like the rest on purpose: it is an *admission*,
 * not a lesser `text`, and a reader has to see it sitting in the same column as a promise.
 */
const TYPES = new Set(['string', 'int', 'text', 'number', 'boolean', 'temporal', 'unknown']);

/** What the language answers to itself — aggregates, the clock, and lengths of time. */
const FUNCTIONS = new Set([
    'count', 'sum', 'avg', 'min', 'max', 'now',
    'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years',
]);

/** Operator words and the tests, which read as words rather than symbols. */
const OPERATORS = new Set([
    'and', 'or', 'not', 'is', 'in',
    'null', 'contains', 'starts', 'ends', 'hasAny', 'hasAll', 'hasNone',
]);

const LITERALS = new Set(['true', 'false', 'null']);

interface JmQueryState {
    /** The previous significant token was a lone `|`, so the next identifier is a converter. */
    afterPipe:   boolean;
    /** The previous token was a `.`, so the next identifier is part of a path. */
    afterDot:    boolean;
    /** Nothing but whitespace has been seen on this line, so a word here may open a clause. */
    lineStart:   boolean;
}

/**
 * Token names emitted by the scanner, mapped to the tags both the editor and the static preview read.
 *
 * <p>⚠️ The same four expression tags `.jmp` and jME already emit, and no new ones. A query is not a
 * fifth thing to recolour: an attribute IS the field half of an expression, and a clause word IS a
 * keyword. Defining `queryKeyword` beside `expressionKeyword` would have given a host two switches for
 * one decision, and the two would drift.
 */
const TOKEN_TAGS: Record<string, Tag> = {
    // ⚠️ A declaration word carries the bold keyword tag and a clause word the plain one, so `source`,
    // `view` and `function` stand out from the clauses inside them without a new tag being defined for
    // it. `.jmp` makes the same distinction between its `policy` line and everything under it.
    declaration: expressionKeyword,
    keyword:     tags.keyword,
    modifier:    tags.modifier,
    type:        tags.typeName,
    function:    tags.function(tags.variableName),
    converter:   expressionFilter,
    attribute:   expressionField,
    property:    tags.propertyName,
    string:      tags.string,
    number:      tags.number,
    comment:     tags.comment,
    operator:    tags.operator,
    punctuation: tags.punctuation,
    literal:     tags.bool,
    variable:    tags.variableName,
};

const NUMBER         = /^\d+(\.\d+)?([eE][-+]?\d+)?/;
const MULTI_OPERATOR = /^(==|!=|<>|<=|>=|&&|\|\||\?\?|->)/;
const IDENTIFIER     = /^[A-Za-z_]\w*/;

const parser: StreamParser<JmQueryState> = {
    name: 'jmq',

    startState(): JmQueryState {
        return { afterPipe: false, afterDot: false, lineStart: true };
    },

    token(stream: StringStream, state: JmQueryState): string | null {
        if (stream.sol()) {
            state.lineStart = true;
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

        const wasAfterPipe = state.afterPipe;
        const wasAfterDot  = state.afterDot;
        const wasLineStart = state.lineStart;

        state.afterPipe = false;
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

        if (stream.match(NUMBER)) {
            return 'number';
        }

        if (stream.match(MULTI_OPERATOR)) {
            return 'operator';
        }

        if (character && '+-*/%<>!=|&^'.includes(character)) {
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

        if (character && '()[]{},:;'.includes(character)) {
            stream.next();

            return 'punctuation';
        }

        if (stream.match(IDENTIFIER)) {
            const word = stream.current();

            if (wasAfterPipe) {
                return 'converter';
            }

            if (wasAfterDot) {
                return 'property';
            }

            if (DECLARATIONS.has(word)) {
                return 'declaration';
            }

            // ⚠️ A clause word opens a clause only at the start of a line; the same word inside one is
            // doing a smaller job and reads better quieter — `attribute entry[x] from y text in bag`
            // has `from` and `bag` in it, and neither is opening anything. It also leaves room for the
            // real case this language has to allow: a product whose column is called `value`, `key` or
            // `order`, which the backend's own parser accepts for the same reason.
            if (CLAUSES.has(word)) {
                return wasLineStart ? 'keyword' : 'modifier';
            }

            if (FUNCTIONS.has(word) && stream.peek() === '(') {
                return 'function';
            }

            if (OPERATORS.has(word)) {
                return 'operator';
            }

            if (LITERALS.has(word)) {
                return 'literal';
            }

            if (MODIFIERS.has(word)) {
                return 'modifier';
            }

            if (TYPES.has(word)) {
                return 'type';
            }

            // ⚠️ A bare word directly before a `[` is an attribute root — `entry[quantity]`,
            // `visit[doctor]`. The bracket is what tells it from an ordinary variable, and it is the
            // one shape this language leans on hardest.
            if (stream.peek() === '[') {
                return 'attribute';
            }

            return 'variable';
        }

        stream.next();

        return null;
    },

    tokenTable: TOKEN_TAGS,
};

/** The `.jmq` language — a `StreamLanguage`; `.parser` is reused for nested/static highlighting. */
export const jmqSyntaxLanguage = StreamLanguage.define(parser);

/** Editor-ready language support (grammar only; theme and highlight style are applied separately). */
export function jmqSyntax(): LanguageSupport {
    return new LanguageSupport(jmqSyntaxLanguage);
}

/** Lazy description so Markdown's `codeLanguages` can resolve ` ```jmq ` fences to this grammar. */
export const jmqLanguageDescription = LanguageDescription.of({
    name:    'jmq',
    alias:   ['jmouse-query', 'jmousequery', 'query'],
    support: jmqSyntax(),
});

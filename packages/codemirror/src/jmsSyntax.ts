import {
    StreamLanguage, LanguageSupport, LanguageDescription, type StreamParser, type StringStream,
} from '@codemirror/language';
import { tags, type Tag } from '@lezer/highlight';
import { expressionKeyword, scriptEvent, scriptFacade } from './tags';

/**
 * `.jms` — jMouse Script, the sixth dialect on the same core, beside `.jmp`, `.jmm`, `.jmq`, `.jmv` and
 * the template one.
 *
 * <p>⚠️ **It is jME plus a house and a handful of Lua-shaped statements**, and this grammar says so by
 * construction. Every condition, every argument and every value is the expression language already
 * described in {@link ./jmeSyntax}. What this file adds is the words that wrap a file (`include`,
 * `script`, `behaviour`), the one that binds a body to a host event (`on … when … do … end`), and the
 * statements written inside one.
 *
 * <p>⚠️ **This colours; it does not decide.** Whether a script is valid — whether the event exists,
 * whether `@world` is a facade this host declared, whether a function was ever defined — is answered by
 * the parser and the binder on a backend when the file loads. A TypeScript re-implementation of that
 * would be a second grammar agreeing for about a month, after which an editor calls a file good and the
 * load refuses it.
 *
 * <h2>⚠️ The four decisions that carry the file's meaning</h2>
 *
 * <p>**A keyword is only a keyword where a keyword can be.** The backend reads every one of this
 * dialect's keywords as an ordinary name wherever a name belongs — `ScriptToken.nameTokens()` — because
 * a host is entitled to an event called `on` or a facade method called `end`. So a word in a *name
 * position* is a name here too, whatever it is spelled: after `@`, after a `.`, after `on`, after
 * `function`, after `local`, after `for`. `@world.end()` is a facade call, not a block terminator, and
 * a grammar that got that wrong would make a correct file look broken.
 *
 * <p>**`#` is both a comment and a constant access.** `# a note` opens a line comment; the `#` of
 * `@player#MAX` does not. They are told apart by what precedes the hash — the backend does the same,
 * and it is why the facade state below survives whitespace.
 *
 * <p>**`=` and `==` are different things spelled with the same token type.** A single `=` after a
 * property path assigns; `==` compares, and writing it where an assignment was meant is refused at load
 * with a sentence, because it would otherwise evaluate, throw its answer away and report nothing. It is
 * the mistake this language expects people to make, so the two are not the same colour.
 *
 * <p>**An `@` name is the one thing in a script that reaches outside it** — see {@link scriptFacade}.
 */

/** What wraps a file. Coloured louder than the statements, the way `.jmv` colours `validation`. */
const DECLARATIONS = new Set(['include', 'script', 'behaviour', 'behavior']);

/** The house around a body — what opens a handler, guards it, and delimits it. */
const KEYWORDS = new Set(['on', 'when', 'do', 'then', 'end', 'function', 'local']);

/** Statements that move somewhere else. A reader scanning for *what happens when* scans for these. */
const BRANCHES = new Set(['if', 'elseif', 'else', 'for', 'return']);

/**
 * Operator words. Shared with jME, and they are jME's — Lua's spellings are deliberately not here.
 *
 * <p>⚠️ `not` is this engine's second spelling of `!=` and the partner of `is`, never a prefix. `null`
 * is not here either, for the reason `.jmm` gives: it is a value being compared against rather than the
 * comparison.
 */
const OPERATORS = new Set(['and', 'or', 'not', 'is', 'in']);

const LITERALS = new Set(['true', 'false', 'null', 'none']);

/**
 * What the scanner expects the next identifier to be, when the token before it decided.
 *
 * <p>⚠️ This is the whole of the "a keyword is only a keyword where a keyword can be" rule. Every value
 * but `null` means *a name goes here*, whatever it is spelled.
 */
type Expecting =
    | 'facade'    // just read `@`
    | 'member'    // just read `.` — a method or a property
    | 'constant'  // just read the `#` of `@name#CONST`
    | 'field'     // just read the `$` of `@name:$field`
    | 'event'     // just read `on`
    | 'name'      // just read `function`, `local` or `for`
    | null;

interface JmsState {
    /** What the next identifier must be read as, decided by the token before it. */
    expect:      Expecting;
    /**
     * The token just read was a facade name.
     *
     * <p>⚠️ What tells `@player#MAX` from a comment, and `@player:$id` from an ordinary colon. It
     * deliberately survives whitespace, because the backend matches on tokens and does not care about
     * it — and a bare `@name` with nothing after it is not a thing anybody can write, so nothing else
     * can be caught by keeping it.</p>
     */
    afterFacade: boolean;
    /** Nothing but whitespace has been seen on this line. */
    lineStart:   boolean;
}

/**
 * Token names emitted by the scanner, mapped to the tags both the editor and the static preview read.
 *
 * <p>⚠️ Two tags of this dialect's own — a facade and an event — and everything else borrowed from the
 * set the other five already emit. A sixth language is not five new colours.
 */
const TOKEN_TAGS: Record<string, Tag> = {
    declaration: expressionKeyword,
    keyword:     tags.keyword,
    branch:      tags.controlKeyword,
    event:       scriptEvent,
    facade:      scriptFacade,
    member:      tags.propertyName,
    constant:    tags.atom,
    field:       tags.attributeName,
    definition:  tags.definition(tags.variableName),
    string:      tags.string,
    number:      tags.number,
    comment:     tags.comment,
    operator:    tags.operator,
    assign:      tags.definitionOperator,
    punctuation: tags.punctuation,
    literal:     tags.bool,
    variable:    tags.variableName,
};

const NUMBER         = /^\d+(\.\d+)?([eE][-+]?\d+)?/;
const MULTI_OPERATOR = /^(==|!=|<>|<=|>=|&&|\|\||\?\?|->|\.\.)/;
const IDENTIFIER     = /^[A-Za-z_][\w]*/;

const parser: StreamParser<JmsState> = {
    name: 'jms',

    startState(): JmsState {
        return { expect: null, afterFacade: false, lineStart: true };
    },

    token(stream: StringStream, state: JmsState): string | null {
        if (stream.sol()) {
            state.lineStart   = true;
            state.expect      = null;
            state.afterFacade = false;
        }

        if (stream.eatSpace()) {
            return null;
        }

        const character = stream.peek();

        // ⚠️ The hash, before anything else and before the comment rule, because the same character
        // opens a comment and reaches a facade's constant. What precedes it is the only difference.
        if (character === '#' && state.afterFacade) {
            stream.next();
            state.expect      = 'constant';
            state.afterFacade = false;

            return 'operator';
        }

        if (character === '#') {
            stream.skipToEnd();

            return 'comment';
        }

        const wasExpecting = state.expect;
        const wasLineStart = state.lineStart;

        state.expect    = null;
        state.lineStart = false;

        if (character === '"' || character === "'") {
            state.afterFacade = false;
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

        if (character === '@') {
            stream.next();
            state.expect      = 'facade';
            state.afterFacade = false;

            return 'operator';
        }

        // ⚠️ Only where a facade has just been named. Everywhere else a colon is punctuation, and
        // reading one as the opening of `:$field` would swallow the next word.
        if (character === ':' && state.afterFacade) {
            stream.next();
            state.afterFacade = true;

            return 'operator';
        }

        if (character === '$' && state.afterFacade) {
            stream.next();
            state.expect      = 'field';
            state.afterFacade = false;

            return 'operator';
        }

        state.afterFacade = false;

        if (stream.match(NUMBER)) {
            return 'number';
        }

        if (stream.match(MULTI_OPERATOR)) {
            return 'operator';
        }

        // ⚠️ Read after the multi-character run, so `==` never reaches here. A lone `=` assigns, and it
        // is the one operator in this language worth telling apart from its neighbour by colour.
        if (character === '=') {
            stream.next();

            return 'assign';
        }

        if (character && '+-*/%<>!|&^~?'.includes(character)) {
            stream.next();

            return 'operator';
        }

        if (character === '.') {
            stream.next();
            state.expect = 'member';

            return 'operator';
        }

        if (character && '(){}[],;:'.includes(character)) {
            stream.next();

            return 'punctuation';
        }

        if (stream.match(IDENTIFIER)) {
            const word = stream.current();

            // ⚠️ Every branch here comes BEFORE the keyword sets, and that order is the rule: the token
            // in front decided that a name goes here, so what the name happens to be spelled is not this
            // grammar's business. `@world.end()`, `on end do`, `function end()` are all legal.
            switch (wasExpecting) {
                case 'facade':
                    state.afterFacade = true;

                    return 'facade';
                case 'member':
                    return 'member';
                case 'constant':
                    return 'constant';
                case 'field':
                    return 'field';
                case 'event':
                    return 'event';
                case 'name':
                    return 'definition';
                default:
                    break;
            }

            if (word === 'on') {
                state.expect = 'event';

                return 'keyword';
            }

            if (word === 'function' || word === 'local' || word === 'for') {
                state.expect = 'name';

                return BRANCHES.has(word) ? 'branch' : 'keyword';
            }

            // ⚠️ A file-scope word is only one at the start of a line. `include`, `script` and
            // `behaviour` are all plausible facade methods and property names, and the backend allows
            // every one of them there.
            if (DECLARATIONS.has(word) && wasLineStart) {
                return 'declaration';
            }

            if (OPERATORS.has(word)) {
                return 'operator';
            }

            if (LITERALS.has(word)) {
                return 'literal';
            }

            if (BRANCHES.has(word)) {
                return 'branch';
            }

            if (KEYWORDS.has(word)) {
                return 'keyword';
            }

            return 'variable';
        }

        stream.next();

        return null;
    },

    tokenTable: TOKEN_TAGS,
};

/** The `.jms` language — a `StreamLanguage`; `.parser` is reused for nested/static highlighting. */
export const jmsSyntaxLanguage = StreamLanguage.define(parser);

/** Editor-ready language support (grammar only; theme and highlight style are applied separately). */
export function jmsSyntax(): LanguageSupport {
    return new LanguageSupport(jmsSyntaxLanguage);
}

/** Lazy description so Markdown's `codeLanguages` can resolve ` ```jms ` fences to this grammar. */
export const jmsLanguageDescription = LanguageDescription.of({
    name:    'jms',
    alias:   ['jmouse-script', 'jmousescript', 'script'],
    support: jmsSyntax(),
});

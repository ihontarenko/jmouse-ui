import {
    StreamLanguage, LanguageSupport, LanguageDescription, type StreamParser, type StringStream,
} from '@codemirror/language';
import { tags, type Tag } from '@lezer/highlight';
import {
    expressionField, expressionFilter, expressionKeyword, mappingImport, mappingType,
} from './tags';

/**
 * `.jmm` — jMouse Mapping, the fourth dialect on the same core, beside `.jmp`, `.jmq` and the template one.
 *
 * <p>⚠️ **It is jME plus a dozen words, and this grammar says so by construction.** Everything to the
 * right of a `:` is the expression language already described in {@link ./jmeSyntax} — the filters, the
 * concatenation, the ternary, the paths. What this file adds is the words that open a block
 * (`mapping`, `target`, `from`, `always`, `fragment`, `refuse`) and the handful that modify one
 * (`use`, `include`, `let`, `when`, `unmapped`). Writing a second scanner for the expression half would
 * have been writing jME twice, and the two would disagree the first time an operator was added to one.
 *
 * <p>⚠️ **This colours; it does not decide.** Whether a mapping is valid — whether the property exists
 * on the target, whether the source path can be read, whether a `let` shadows something — is answered
 * by the reader on a backend when the file loads, in sentences a person can act on. A TypeScript
 * re-implementation of that would be a second checker agreeing for about a month, after which an editor
 * calls a file good and the boot refuses it.
 *
 * <h2>⚠️ The one thing that makes this grammar different from its three siblings</h2>
 *
 * <p>`:` is the only operator, and **what stands on each side of it is decided by the block it is in**:
 *
 * <ul>
 *   <li>in a rule block — a <strong>target property</strong> on the left, an expression on the right;</li>
 *   <li>in a {@code refuse} block — a <strong>condition</strong> on the left, a message on the right.</li>
 * </ul>
 *
 * <p>Colouring both left sides the same way would say they are the same kind of thing, and they are the
 * opposite: one is a name being written into, the other is an expression being tested. So the scanner
 * tracks whether it is inside a {@code refuse} block, and a word before the colon is a property there
 * and a plain expression here.
 *
 * <p>Three more token decisions worth knowing before changing anything:
 *
 * 1. **A structural word opens a block only at the start of a line.** A source property legitimately
 *    called `target`, `from` or `source` is why — the backend's own reader slices rule values out as
 *    text for exactly this reason, so that `source.total` reads as a path and not as a keyword.
 * 2. ⚠️ **`ignore` is not a keyword and not an identifier.** It is the one reserved *value*: the single
 *    thing on the right that is never evaluated. Colouring it like `from` would suggest it opens
 *    something; colouring it like a variable would hide that the property is deliberately not carried.
 *    It gets the atom tag, which is what a language's own constant looks like everywhere else.
 * 3. **`#` opens a comment to the end of the line** — including one trailing a rule, which the value
 *    reader stops at.
 */

/** What opens a block. ⚠️ `mapping` is the file's own header and is coloured louder than the rest. */
const BLOCKS = new Set(['target', 'from', 'always', 'fragment', 'refuse']);

/** Words that modify a block or a rule rather than opening one. */
const MODIFIERS = new Set(['use', 'include', 'let', 'unmapped']);

/**
 * Where a {@code refuse} block stands and when it runs.
 *
 * <p>⚠️ Kept apart from {@link MODIFIERS} because these four are the whole content of a refusal's
 * header — `refuse source before`, `refuse target after` — and a reader scanning for the guard in a
 * file is scanning for exactly this line.
 */
const PHASES = new Set(['source', 'target', 'before', 'after']);

/**
 * Operator words and the tests, which read as words rather than symbols. Shared with jME.
 *
 * <p>⚠️ {@code null} is deliberately NOT here, though it appears in `is null` more than anywhere else.
 * It is a value being compared against, not the comparison — and it is the same `null` that stands on
 * the right of a rule. Colouring it as an operator in `id is null` and as a literal in
 * `comment : null` would make one word look like two things.</p>
 */
const OPERATORS = new Set([
    'and', 'or', 'not', 'is', 'in',
    'contains', 'starts', 'ends', 'matches', 'empty', 'even', 'odd',
]);

const LITERALS = new Set(['true', 'false', 'null']);

interface JmmState {
    /** The previous significant token was a lone `|`, so the next identifier is a filter. */
    afterPipe:   boolean;
    /** The previous token was a `.`, so the next identifier is part of a path. */
    afterDot:    boolean;
    /** Nothing but whitespace has been seen on this line, so a word here may open a block. */
    lineStart:   boolean;
    /** No `:` has been seen on this line yet, so an identifier is still on its left-hand side. */
    beforeColon: boolean;
    /** How deep in braces the scanner is. */
    depth:       number;
    /**
     * The brace depth a {@code refuse} block opened at, or `-1` outside one.
     *
     * <p>⚠️ This is what makes the left of a `:` a condition rather than a property. A single boolean
     * would not survive a rule block nested after a refusal in the same target.</p>
     */
    refuseAt:    number;
    /** {@code refuse} has been read and its `{` has not arrived yet. */
    openingRefuse: boolean;
}

/**
 * Token names emitted by the scanner, mapped to the tags both the editor and the static preview read.
 *
 * <p>⚠️ The same expression tags `.jmp`, jME and `.jmq` already emit, and no new ones. A mapping is not
 * a fourth thing to recolour: a rule's right-hand side IS an expression, and a block word IS a keyword.
 * Defining `mappingKeyword` beside `expressionKeyword` would give a host two switches for one decision,
 * and the two would drift.
 */
const TOKEN_TAGS: Record<string, Tag> = {
    // ⚠️ The `mapping` header carries the bold keyword tag and a block word the plain one, so the file's
    // own name stands out from the blocks inside it. `.jmp` and `.jmq` make the same distinction.
    declaration: expressionKeyword,
    keyword:     tags.keyword,
    phase:       tags.controlKeyword,
    modifier:    tags.modifier,
    // ⚠️ The target property — the left column of a file, and the thing a reader scans down. It gets the
    // field tag rather than propertyName, which is what a path SEGMENT gets, so `spaceId` and the `id`
    // in `space.id` do not look like the same kind of thing on one line.
    target:      expressionField,
    property:    tags.propertyName,
    filter:      expressionFilter,
    ignore:      tags.atom,
    // ⚠️ The block's subject and the `use` header are two tags, not one. Under the house style
    // `tags.typeName` and `tags.namespace` both resolve to the keyword colour, so `target` and
    // `Project` came out identical — and the keyword repeats on every block while the type is the one
    // thing that says which block this is. `mappingType` is the louder of the two on purpose.
    type:        mappingType,
    import:      mappingImport,
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
/** ⚠️ `$` is here because a document names nested types the way a class loader does — `Dtos$Response`. */
const IDENTIFIER     = /^[A-Za-z_$][\w$]*/;
/** A `use` line names a whole type, dots and all, and colouring it segment by segment reads as noise. */
const QUALIFIED      = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+/;

const parser: StreamParser<JmmState> = {
    name: 'jmm',

    startState(): JmmState {
        return {
            afterPipe:     false,
            afterDot:      false,
            lineStart:     true,
            beforeColon:   true,
            depth:         0,
            refuseAt:      -1,
            openingRefuse: false,
        };
    },

    token(stream: StringStream, state: JmmState): string | null {
        if (stream.sol()) {
            state.lineStart   = true;
            state.beforeColon = true;
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

        const wasAfterPipe   = state.afterPipe;
        const wasAfterDot    = state.afterDot;
        const wasLineStart   = state.lineStart;
        const wasBeforeColon = state.beforeColon;
        const inRefuse       = state.refuseAt >= 0;

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

        if (character === '{') {
            stream.next();
            state.depth += 1;

            // ⚠️ The brace that follows `refuse …` is what opens the block, not the word itself — a
            // refusal's header carries three more words after it, and the left of a `:` is still a
            // property until the brace arrives.
            if (state.openingRefuse) {
                state.refuseAt      = state.depth;
                state.openingRefuse = false;
            }

            return 'punctuation';
        }

        if (character === '}') {
            stream.next();

            if (state.refuseAt === state.depth) {
                state.refuseAt = -1;
            }

            state.depth = Math.max(0, state.depth - 1);

            return 'punctuation';
        }

        if (character === ':') {
            stream.next();
            state.beforeColon = false;

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

        if (character && '()[],;'.includes(character)) {
            stream.next();

            return 'punctuation';
        }

        // ⚠️ Read as one token before the plain identifier rule, so `net.innoventa.…$Response` on a
        // `use` line is a single import rather than nine tokens with eight dots between them.
        //
        // ⚠️ And an `import`, not a `type`: a `use` line is bookkeeping — it says which types the file
        // will go on to name — while `target Project` says what the block in front of you is about. The
        // two were one tag until a reader pointed out that nothing told them apart.
        if (wasLineStart === false && wasBeforeColon && stream.match(QUALIFIED, false)
            && stream.string.slice(0, stream.pos).trimStart().startsWith('use ')) {
            stream.match(QUALIFIED);

            return 'import';
        }

        if (stream.match(IDENTIFIER)) {
            const word = stream.current();

            if (wasAfterPipe) {
                return 'filter';
            }

            if (wasAfterDot) {
                return 'property';
            }

            // ⚠️ `ignore` is checked before everything else on the right-hand side. It is the one value
            // the language never evaluates, and it has to read as a decision rather than as a name.
            if (word === 'ignore' && !wasBeforeColon) {
                return 'ignore';
            }

            if (word === 'mapping' && wasLineStart) {
                return 'declaration';
            }

            // ⚠️ A block word opens a block only at the start of a line. A source property called
            // `target`, `from` or `source` is legitimate — the backend's reader slices rule values out
            // as text precisely so that `source.total` is a path and not a keyword.
            if (BLOCKS.has(word) && wasLineStart) {
                if (word === 'refuse') {
                    state.openingRefuse = true;
                }

                return 'keyword';
            }

            // The three words after `refuse`, which are the whole content of a refusal's header.
            if (PHASES.has(word) && state.openingRefuse) {
                return 'phase';
            }

            if (MODIFIERS.has(word) && wasLineStart) {
                return 'modifier';
            }

            // `when` modifies a rule and never starts a line, so it is the one word here tested
            // without the line-start condition.
            if (word === 'when' && !wasBeforeColon) {
                return 'modifier';
            }

            if (OPERATORS.has(word)) {
                return 'operator';
            }

            if (LITERALS.has(word)) {
                return 'literal';
            }

            // ⚠️ A target property is a word the COLON FOLLOWS, not merely a word before one.
            //
            // Tested by looking ahead rather than by remembering that no colon has been seen on this
            // line, because "before a colon" is true of far too much: the type in `target Order`, the
            // name in `fragment place`, and the `fail` in `unmapped fail` are all before a colon and
            // none of them is a property. Colouring them as the left column is the single most
            // misleading thing this grammar could do — that column is what a reader scans down.
            //
            // ⚠️ And never inside a refuse block: there the left of a colon is a CONDITION. `id is null`
            // does not match this look-ahead anyway, but a one-word condition would, so the block still
            // has to be asked about.
            if (!inRefuse && stream.match(/^\s*:/, false)) {
                return 'target';
            }

            // A type name follows `target`, `from` and `use`, and is capitalised by convention rather
            // than by rule — which is enough to colour it and not enough to rely on for anything else.
            if (/^[A-Z]/.test(word)) {
                return 'type';
            }

            return 'variable';
        }

        stream.next();

        return null;
    },

    tokenTable: TOKEN_TAGS,
};

/** The `.jmm` language — a `StreamLanguage`; `.parser` is reused for nested/static highlighting. */
export const jmmSyntaxLanguage = StreamLanguage.define(parser);

/** Editor-ready language support (grammar only; theme and highlight style are applied separately). */
export function jmmSyntax(): LanguageSupport {
    return new LanguageSupport(jmmSyntaxLanguage);
}

/** Lazy description so Markdown's `codeLanguages` can resolve ` ```jmm ` fences to this grammar. */
export const jmmLanguageDescription = LanguageDescription.of({
    name:    'jmm',
    alias:   ['jmouse-mapping', 'jmousemapping', 'mapping'],
    support: jmmSyntax(),
});

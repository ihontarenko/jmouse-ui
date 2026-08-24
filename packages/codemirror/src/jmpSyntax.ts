import {
    StreamLanguage, LanguageSupport, LanguageDescription, type StreamParser, type StringStream,
} from '@codemirror/language';
import { tags, type Tag } from '@lezer/highlight';
import {
    policyAction, policyCapability, policyDeny, policyInstance, policyKeyword,
    policyNamespace, policyRole, policyScope, policyStatementKind, policySubject,
} from './tags';

/**
 * `.jmp` — jMouse Policy, the language authorization is written in.
 *
 * <p>Built exactly like {@link ./jmeSyntax}: a `StreamLanguage` token scanner rather than a real
 * parser, emitting {@link ./tags}' tags and nothing else — so a host decides what a policy *looks* like
 * without this file knowing a colour, a theme or a font scale.
 *
 * <p>⚠️ **This colours; it does not decide.** Whether a policy is *valid* is answered by the product's
 * own parser over HTTP, never here. A TypeScript re-implementation of the grammar would be a second
 * grammar that agrees for about a month — after which the editor calls a file good and the boot refuses
 * it, or worse, the other way round.
 *
 * <p>Three token decisions are worth knowing before changing anything:
 *
 * 1. **`deny` has a colour of its own.** A denial wins over every allow, at every level, across every
 *    grant source — it is the one line in a policy file nobody may skim past.
 * 2. **A keyword is only a keyword where a keyword can be.** `role:read` is an ordinary permission in
 *    a product that administers roles, so a word followed by `:` is read as a namespace and never as
 *    the `role` keyword. The backend's lexer makes the same allowance, for the same reason.
 * 3. **A hyphen inside a name is part of the name.** `storage-byte`, `parametric-search` and
 *    `id-organization-001` are one token each, not a subtraction between three. The backend reads them
 *    the same way — see `CursorMatcher.hyphenatedNameLength` — and the day it started accepting an
 *    unquoted hyphenated instance was the day this scanner had to stop rendering one as arithmetic.
 */

/**
 * Every word the language adds on top of names, strings and punctuation. That is all of it.
 *
 * ⚠️ The second row is the capability half, and it is a *vocabulary* rather than a grammar: `note`,
 * `order`, `paid`, `reason` and the rest are keywords only where a keyword can be, which is what lets
 * a product own a capability called `note` without the file becoming ambiguous.
 */
const KEYWORDS = new Set([
    'policy', 'scopes', 'permissions', 'role', 'subject',
    'grants', 'allow', 'when', 'include',


    'capabilities', 'paid', 'gate', 'limit', 'quota',
    'plans', 'plan', 'order', 'note', 'extends', 'unlimited', 'per',
    'entitlements', 'trial', 'from', 'until', 'reason',

    'actions', 'produces',
    'variables', 'constant', 'dynamic',

    'assignable'
]);
// ⚠️ `deny` is absent on purpose and always has been — it is matched before this set is consulted so
// that it keeps a colour of its own. Adding it here would be dead code that reads like a decision.

/**
 * Which kind of name follows a keyword — because "a name follows a keyword" is not one fact but three.
 *
 * <p>`subject 'usr_7f21c'` names *a person*; `role SPACE_ADMIN` and `grants SPACE_ADMIN` name *a
 * bundle of permissions*; `gate custody` and `allow storage-byte` name *a capability*. They were one
 * token for as long as they shared a colour, which made a policy file read as an undifferentiated list
 * of words — and the first question anybody asks of one is "who does this reach, and with what", which
 * is exactly the distinction that was missing.
 *
 * <p>A tier is the bundle distinction a second time: `plan business`, `extends team` and
 * `trial business` all name a *bundle*, so they take the bundle colour. Naming them after the person
 * would have said that a tier is somebody, and naming them after nothing would have made the one word
 * that decides what a customer gets look like a value.
 */
const NAMES_SOMETHING: Record<string, string | undefined> = {
    role:    'role',
    grants:  'role',
    plan:    'role',
    extends: 'role',
    trial:   'role',
    subject: 'subject',

    gate:    'capability',
    limit:   'capability',
    quota:   'capability',
    paid:    'capability',
    allow:   'capability',
    deny:    'capability',
};

/**
 * Whether an effect word is the *tail* of a grant rather than the *head* of an entitlement.
 *
 * <p>⚠️ `allow` and `deny` are written in both, at opposite ends. An entitlement leads with one —
 * `@ORGANIZATION:acme allow storage-byte 100` — so a capability follows it. A grant closes with one —
 * `@SELF form:write deny when …` — so nothing does, and reading the next word as a capability would
 * paint `when` as one.
 *
 * <p>What tells them apart is whether a permission has already been read on this line, which is the
 * one thing a scanner can know for certain: a grant always brings a colon, and an entitlement never
 * does.
 */
function isTrailingEffect(word: string, permissionSeen: boolean): boolean {
    return permissionSeen && (word === 'allow' || word === 'deny');
}

/** What a name written after `word` is, or `undefined` where the previous word pins nothing. */
function nameKindAfter(word: string | null): string | undefined {
    return word ? NAMES_SOMETHING[word] : undefined;
}

/** What the scanner is part-way through, where one token decides how to read the next. */
interface PolicyState {
    /** The previous significant word, so `role X` can colour `X` as a declaration. */
    afterWord:      string | null;
    /** A `@KIND` has just been read, so a following `:` opens an instance rather than a permission. */
    afterScope:     boolean;
    /** The next name is the instance half of `@KIND:instance`. */
    inScopeInstance: boolean;
    /** A `namespace:` has just been read, so the next name is the action half. */
    inAction:       boolean;
    /** A permission has been read on this line, so a closing `allow`/`deny` names nothing. */
    afterPermission: boolean;
    /** Inside `paid a, b, c`, where a comma continues the list instead of ending it. */
    inCapabilityList: boolean;
    /** Nothing has been read on this line yet — the only place a plan-body line may open with a name. */
    atStatementStart: boolean;
}

/**
 * Token names emitted by the scanner, mapped onto the tags the highlight style colours.
 *
 * <p>The policy-specific ones come from `./tags` rather than from the standard set, so this language
 * can be recoloured without repainting Markdown, SQL and everything else the editor renders — and so
 * a language word and a role name, which used to share `tags.keyword`'s colour, no longer do. Each
 * carries a standard parent, which is what keeps the imported code themes colouring a policy file at
 * all.
 */
const TOKEN_TAGS: Record<string, Tag> = {
    keyword:       policyKeyword,
    statementKind: policyStatementKind,
    deny:          policyDeny,
    scopeKind:     policyScope,
    scopeInstance: policyInstance,
    namespace:     policyNamespace,
    action:        policyAction,
    capability:    policyCapability,
    role:          policyRole,
    subject:       policySubject,
    placeholder:   tags.meta,
    string:        tags.string,
    number:        tags.number,
    comment:       tags.comment,
    operator:      tags.operator,
    punctuation:   tags.punctuation,
    variable:      tags.variableName,
};

/**
 * The two words that say what *kind* of statement a block is, rather than naming a thing.
 *
 * <p>`declare` opens something that says what exists at all — scopes, permissions, actions,
 * capabilities, plans, a role. `assign` opens something that says who has what — a subject, an
 * entitlement. That is ADR-0018's line moved to the left margin, and it is why they get a token of
 * their own rather than joining {@link KEYWORDS}: they are a label on a block, not a block.
 *
 * <p>⚠️ `include` is deliberately not prefixed — it is an operation on the file rather than a
 * statement about access, and being the one bare keyword is a useful signal in itself.
 */
const STATEMENT_KINDS = new Set(['declare', 'assign']);

/**
 * What has to follow for one of those to be a prefix at all.
 *
 * <p>⚠️ Without this they would paint every `declare` in the file, and a policy is allowed to contain
 * one: a permission segment, a capability key, a property a condition reads. A keyword is only a
 * keyword where a keyword can be — the same allowance the backend's lexer makes, for the same reason.
 */
const OPENS_A_BLOCK =
    /^\s+(policy|scopes|permissions|actions|capabilities|variables|plans|entitlements|role|subject)\b/;

/**
 * The attributes a `scopes` line may carry — `@SPACE place parameter=spaceId inside=@ORGANIZATION`.
 *
 * <p>Each asks a different question of the scope graph, which is why they are worth telling apart at
 * a glance: `inside=` makes a place a child of another so that a grant at the wider one reaches it,
 * `beside=` says the two are siblings wrapping nothing of each other's, and `requires=` says a target
 * naming the one must also name the other. Left plain they read as three names somebody chose.
 */
const SCOPE_ATTRIBUTES = new Set(['parameter', 'inside', 'beside', 'requires']);

/**
 * What makes one of those an attribute at all: the single `=` it is written in front of.
 *
 * <p>⚠️ The same allowance {@link OPENS_A_BLOCK} makes, for the same reason — a product is free to own
 * a permission called `inside` or a capability called `requires`, and `ScopeDeclarationParser` reads an
 * attribute only where an identifier is followed by `T_EQ` too.
 *
 * <p>⚠️ The `(?!=)` is not decoration: `==` is a comparison, and without it a condition reading a
 * property named after an attribute would paint that property as language.
 */
const ASSIGNS_A_SCOPE_ATTRIBUTE = /^[ \t]*=(?!=)/;

const PLACEHOLDER = /^\$\{[^}\n]*}/;
const SCOPE       = /^@[A-Za-z_]\w*/;

/** A name, hyphens and all — `storage-byte` is one word, not `storage` minus `byte`. */
const IDENTIFIER = /^[A-Za-z_]\w*(?:-\w+)*/;

/** The same, but allowed to open with a digit: an instance is an id, and an id may be `42`. */
const INSTANCE = /^\w+(?:-\w+)*/;

/**
 * ⚠️ Tried before {@link AMOUNT}, or `2026-08-11` colours as `2026` and the rest goes plain.
 *
 * <p>The backend has the mirror of this problem and solves it in the parser: its lexer hands
 * `EntitlementParser.readDate` a number and two hyphenated numbers, which are rejoined into the text
 * the file wrote. Here it is one regular expression, because nothing downstream needs the parts.
 */
const DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * An amount, with the unit suffix attached — `25`, `1_000`, `200MB`, `107374182400`.
 *
 * <p>What `GB` *means* is the product's business (`QuantityScale`), and what it means here is only
 * that it belongs to the number in front of it rather than being a name of its own.
 */
const AMOUNT = /^\d[\d_]*[A-Za-z]*/;

/**
 * What may follow the capability at the head of a plan-body line: an amount, `unlimited`, `per`, or
 * nothing at all. Peeked, never consumed.
 *
 * <p>This is `CursorMatcher.planGrantMatcher` written as a lookahead, and it is the only place the
 * scanner needs one — a plan body is the single shape in the language that opens with a bare name.
 */
const COMPLETES_A_PLAN_GRANT = /^[ \t]*(?:\d|unlimited\b|per\b|[#};]|$)/;

/**
 * An action declaration's name — `entry.listByPurpose`, dots and all, pinned by the description that
 * always follows it.
 *
 * ⚠️ The lookahead is what makes this safe to try at statement start. A dotted bare name is otherwise
 * indistinguishable from a property path somebody wrote in a condition, and colouring
 * `resource.status` as an action would be a lie about which half of the language a reader is looking
 * at. A quoted string after it appears in exactly one shape.
 *
 * <p>It is also the visible half of "dots, never colons": an action takes `policyAction`'s colour
 * through a dot, and a permission takes it through a colon, so the two never read as one vocabulary.
 */
const OPENS_AN_ACTION_DECLARATION = /^[A-Za-z_]\w*(?:\.\w+)+(?=[ \t]*['"])/;

/** Consume a single- or double-quoted name. The dialect has no escape sequence — the quote is chosen. */
function consumeString(stream: StringStream, quote: string): void {
    stream.next();
    while (stream.peek() !== undefined && stream.peek() !== quote) {
        stream.next();
    }
    stream.next();
}

/**
 * A name, `*`, a quoted name or a `${…}` — everything that may stand where an instance belongs.
 *
 * <p>⚠️ Hyphen-tolerant, and deliberately more tolerant than a *grant's* instance is. The backend
 * draws the line between the two — a grant's `@SPACE:'my-space'` needs its quotes, an entitlement's
 * `@ORGANIZATION:acme-warehouse` does not — because an entitlement addresses a slug, and slugs are
 * hyphenated by nature. Telling them apart here would mean knowing which block the line is in, and
 * paying for that with a block stack to win the right to render a *valid* file as arithmetic.
 */
function tokenizeInstance(stream: StringStream, state: PolicyState): string | null {
    state.inScopeInstance = false;

    const character = stream.peek();

    if (character === '\'' || character === '"') {
        consumeString(stream, character);
        return 'scopeInstance';
    }
    if (stream.match(PLACEHOLDER)) {
        return 'placeholder';
    }
    if (stream.eat('*') || stream.match(INSTANCE)) {
        return 'scopeInstance';
    }

    return null;
}

const parser: StreamParser<PolicyState> = {
    name: 'jmp',
    startState: () => ({
        afterWord:        null,
        afterScope:       false,
        inScopeInstance:  false,
        inAction:         false,
        afterPermission:  false,
        inCapabilityList: false,
        atStatementStart: true,
    }),
    copyState: (state) => ({ ...state }),
    languageData: { commentTokens: { line: '#' } },
    tokenTable: TOKEN_TAGS,

    token(stream, state) {
        // A statement is a line. Every "what came before" fact is about the line being read, so all of
        // them reset together and none can leak into the next one.
        if (stream.sol()) {
            state.afterWord = null;
            state.afterScope = false;
            state.afterPermission = false;
            state.inCapabilityList = false;
            state.atStatementStart = true;
        }

        if (stream.eatSpace()) {
            return null;
        }

        // A comment runs to the end of the line, and reaching this point means we are not inside a
        // quoted name — strings are consumed whole below.
        if (stream.peek() === '#') {
            stream.skipToEnd();
            return 'comment';
        }

        if (state.inScopeInstance) {
            state.atStatementStart = false;
            return tokenizeInstance(stream, state);
        }

        const character = stream.peek();

        if (character === ':') {
            stream.next();
            if (state.afterScope) {
                state.afterScope = false;
                state.inScopeInstance = true;
            } else {
                state.inAction = true;
            }
            return 'operator';
        }

        const wasAfterWord        = state.afterWord;
        const wasInAction         = state.inAction;
        const wasAfterPermission  = state.afterPermission;
        const wasInCapabilityList = state.inCapabilityList;
        const wasAtStatementStart = state.atStatementStart;

        state.afterWord        = null;
        state.afterScope       = false;
        state.inAction         = false;
        state.inCapabilityList = false;
        state.atStatementStart = false;

        if (character === '\'' || character === '"') {
            consumeString(stream, character);
            // `subject 'u-42'` names an account and `allow 'storage-byte'` a capability; a quoted word
            // anywhere else — a description, a note, a reason — is an ordinary value.
            return nameKindAfter(wasAfterWord) ?? 'string';
        }
        if (stream.match(PLACEHOLDER)) {
            return 'placeholder';
        }
        if (stream.match(SCOPE)) {
            state.afterScope = true;
            return 'scopeKind';
        }
        // A brace or a semicolon opens a fresh statement just as a newline does, so a plan body written
        // on one line reads the same as one written across four.
        if (character === '{' || character === '}' || character === ';') {
            stream.next();
            state.atStatementStart = true;
            return 'punctuation';
        }
        if (character === ',') {
            stream.next();
            // `paid a, b` is one statement about three words. Everywhere else a comma ends what came
            // before it, which is why this is the only fact a separator carries across.
            state.inCapabilityList = wasInCapabilityList;
            return 'punctuation';
        }
        if (character === '*') {
            stream.next();
            state.afterPermission = wasAfterPermission || wasInAction;
            return wasInAction ? 'action' : 'operator';
        }
        if (stream.match(DATE) || stream.match(AMOUNT)) {
            return 'number';
        }
        // Tried before the operator branch, or `entry.listByPurpose` reads as `entry`, a subtraction's
        // cousin, and `listByPurpose` — which is how a dotted vocabulary comes to look like arithmetic.
        if (wasAtStatementStart && stream.match(OPENS_AN_ACTION_DECLARATION)) {
            return 'action';
        }
        if (character && '=<>!&|+-/%.'.includes(character)) {
            stream.next();
            return 'operator';
        }

        if (stream.match(IDENTIFIER)) {
            const word = stream.current();

            if (wasInAction) {
                state.afterPermission = true;
                return 'action';
            }
            if (wasInCapabilityList) {
                state.inCapabilityList = true;
                return 'capability';
            }

            // ⚠️ A scope attribute only in front of its `=`; everywhere else these are ordinary words.
            if (SCOPE_ATTRIBUTES.has(word) && stream.match(ASSIGNS_A_SCOPE_ATTRIBUTE, false)) {
                return 'keyword';
            }

            const pinnedKind = nameKindAfter(wasAfterWord);

            if (pinnedKind) {
                return pinnedKind;
            }
            // `role:read` is a permission, not the `role` keyword — a word owning a colon is a
            // namespace wherever it appears, which is what lets a product administer its own roles.
            if (stream.peek() === ':') {
                return 'namespace';
            }
            if (word === 'deny') {
                state.afterWord = isTrailingEffect(word, wasAfterPermission) ? null : word;
                return 'deny';
            }
            // ⚠️ `declare` / `assign` are a prefix only where a block keyword follows. Everywhere else
            // they are ordinary words — a capability key, a plan line, a name after `is` — and the
            // backend's matcher makes exactly the same allowance for exactly the same reason.
            //
            // `afterWord` is deliberately left alone: what a name after `declare role X` means is
            // decided by `role`, not by the prefix, so the prefix must not become the previous word.
            if (STATEMENT_KINDS.has(word) && stream.match(OPENS_A_BLOCK, false)) {
                return 'statementKind';
            }
            if (KEYWORDS.has(word)) {
                state.afterWord = isTrailingEffect(word, wasAfterPermission) ? null : word;
                state.inCapabilityList = word === 'paid';
                return 'keyword';
            }
            // A plan body is the one shape opening with a bare name — `storage-byte 100GB per month`,
            // `seat unlimited`, or a lone `custody`. Pinned by what follows rather than by which block
            // we are in, exactly as the backend's matcher pins it.
            if (wasAtStatementStart && stream.match(COMPLETES_A_PLAN_GRANT, false)) {
                return 'capability';
            }

            return 'variable';
        }

        stream.next();
        return null;
    },
};

/** The `.jmp` language — a `StreamLanguage`; `.parser` is reused for static highlighting. */
export const jmpSyntaxLanguage = StreamLanguage.define(parser);

/** Editor-ready language support (grammar only; theme and highlight style are applied separately). */
export function jmpSyntax(): LanguageSupport {
    return new LanguageSupport(jmpSyntaxLanguage);
}

/** Lazy description, so a Markdown ` ```jmp ` fence resolves to this grammar like any other. */
export const jmpLanguageDescription = LanguageDescription.of({
    name:    'jmp',
    alias:   ['jmouse-policy', 'policy'],
    support: jmpSyntax(),
});

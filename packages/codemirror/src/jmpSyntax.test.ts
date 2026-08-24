import { describe, it, expect } from 'vitest';
import { classHighlighter, highlightTree, tagHighlighter } from '@lezer/highlight';
import { jmpSyntaxLanguage } from './jmpSyntax';
import { policyStatementKind } from './tags';

/**
 * Guards the `.jmp` token scanner — the one piece of this feature the type-checker cannot reach.
 *
 * <p>⚠️ **The fixture is the backend's.** `Smoke.DECLARATION` in `jmouse-access-el` is the text the
 * parser is checked against field by field; this file colours the same text. Two token surfaces over
 * one language will drift, and a shared fixture is what makes the drift visible instead of quiet.
 *
 * <p>Assertions are at the tag level, through the stable `classHighlighter` names, so they describe
 * the grammar rather than the theme it happens to be rendered in.
 */

/** The backend's `Smoke.DECLARATION`, verbatim. Keep them identical, or neither is a check. */
const DECLARATION = `policy "innoventa-bootstrap" {
    include 'startup.jmp'
    scopes {
        # default scoped that required for start
        @ORGANIZATION  place  parameter=organizationId # innoventa's organizationId
        @GLOBAL  everything
        @SPACE         place  parameter=spaceId
        @SELF          'own-rows'
    }
    permissions {
        form:read     "Read forms"
        form:write    "Create and edit forms"
    }
    actions {
        entry.list           "List submissions"
        entry.listByPurpose  "List one purpose"  produces purpose, tier
    }
    variables {
        constant  deployment
        dynamic   ambientType  "What this workspace counts"
    }
    capabilities {
        paid parametric-search
        gate   parametric-search  "Parametric search"
        limit  workspace          "Workspaces"  per ORGANIZATION
        quota  storage-byte       "Storage"     per ORGANIZATION, SPACE
    }
    plans {
        plan free "Free" order 10 note "Room to try the product properly." {
            workspace     1
            storage-byte  200MB per month
        }
        plan business "Business" order 30 extends free {
            workspace     25
            storage-byte  unlimited
            parametric-search
        }
    }
    entitlements {
        @ORGANIZATION:acme  plan business
        @ORGANIZATION:beta  trial business until 2026-09-12 reason "evaluating"
        @SPACE:kyiv         allow workspace 5 from 2026-08-01
        @SPACE:kyiv         deny parametric-search reason "not paid for here"
    }
    role INSTALLATION_OWNER {
        @GLOBAL  space:write
        @GLOBAL  user:manage
    }
    subject \${innoventa.bootstrap.owner} {
        @SELF  form:write  deny
        grants INSTALLATION_OWNER @GLOBAL
        grants SELF  @SPACE:kyiv
        grants SPACE_ADMIN  @SPACE:*
        grants SPACE_ADMIN  @ORGANIZATION:\${application.defaultOrganization}
        @SCOPE:\${application.defaultInstance}  form:write         # a direct grant, allow implied
        @SCOPE:*  form:*         # a direct grant, allow implied
        @SCOPE:instance  form:read  allow
        @SCOPE:instance  form:delete  deny when resource.status == 'DRAFT'
        @SCOPE:instance  entry:read  deny when {
            action == 'entry.listByPurpose'
            and purpose != 'HOLDER'
        }
    }
}
`;

/** Every (text, class) pair the grammar assigns across a snippet. */
function tokens(code: string): { text: string; token: string }[] {
    const found: { text: string; token: string }[] = [];
    const tree = jmpSyntaxLanguage.parser.parse(code);

    highlightTree(tree, classHighlighter, (from, to, tokenClasses) => {
        for (const tokenClass of tokenClasses.split(' ')) {
            found.push({ text: code.slice(from, to), token: tokenClass });
        }
    });

    return found;
}

function classesFor(code: string, text: string): string[] {
    return tokens(code).filter((token) => token.text === text).map((token) => token.token);
}

/**
 * Every word the grammar read as a `declare` / `assign` prefix.
 *
 * <p>⚠️ **Asked of our own tag rather than of `classHighlighter`, and it has to be.** That highlighter
 * collapses the whole keyword family — `modifier`, `definitionKeyword`, `controlKeyword` — onto
 * `tok-keyword`, which is exactly the graceful fallback we want in a foreign theme and exactly what
 * makes it useless as a check here. Our own style is what actually ships, and it names
 * `policyStatementKind` explicitly: same hue, italic and bold.
 */
function prefixesIn(code: string): string[] {
    const found: string[] = [];
    const highlighter = tagHighlighter([{ tag: policyStatementKind, class: 'prefix' }]);

    highlightTree(jmpSyntaxLanguage.parser.parse(code), highlighter, (from, to) => {
        found.push(code.slice(from, to));
    });

    return found;
}

describe('the .jmp grammar', () => {
    it('tags every keyword, and only where a keyword can be', () => {
        for (const keyword of ['policy', 'scopes', 'permissions', 'role', 'subject',
                               'grants', 'allow', 'when', 'include',
                               'capabilities', 'paid', 'gate', 'limit', 'quota',
                               'plans', 'plan', 'order', 'note', 'extends', 'unlimited', 'per',
                               'entitlements', 'trial', 'from', 'until', 'reason',
                               'actions', 'produces',
                               'variables', 'constant', 'dynamic']) {
            expect(classesFor(DECLARATION, keyword)).toContain('tok-keyword');
        }
    });

    // ── Actions ──────────────────────────────────────────────────────────────
    //  "Dots, never colons" is a rule about reading, so it has to survive into the colours. An action
    //  reaches `policyAction` through a dot and a permission reaches it through a colon; a reader who
    //  could not tell the two apart would be reading one vocabulary where the language has two.
    it('reads a dotted action name as one word, not as arithmetic', () => {
        expect(classesFor(DECLARATION, 'entry.listByPurpose')).toContain('tok-propertyName');
        expect(tokens('actions { entry.list "List" }').some((token) => token.text === '.')).toBe(false);
    });

    it('leaves a property path in a condition alone', () => {
        // The lookahead earns its place here: `resource.status` is a dotted bare name too, and
        // colouring it as an action would say a rule is scoped where it is only reading a row.
        const grant = "subject SU { @SELF form:delete deny when resource.status == 'DRAFT' }";

        expect(classesFor(grant, 'resource.status')).toHaveLength(0);
    });

    it('keeps colouring a condition written across lines', () => {
        // `when { … }` exists because the one-line form truncates at the newline. A scanner that only
        // knew the one-line form would paint the continuation lines as ordinary statements — which is
        // the reader being told the rule ends where it does not.
        expect(classesFor(DECLARATION, 'action')).toContain('tok-variableName');
        expect(classesFor(DECLARATION, "'HOLDER'")).toContain('tok-string');
    });

    it('colours the values an action produces as what a condition reads', () => {
        // `purpose` beside `produces` and `purpose` inside a `when` are the same name doing the same
        // job, and a reader following one to the other should not have to translate a colour.
        const declared = classesFor(DECLARATION, 'purpose');
        const read     = classesFor(
            "subject SU { @GLOBAL form:read deny when action == 'entry.list' and purpose != 'HOLDER' }",
            'purpose');

        expect(declared).toContain('tok-variableName');
        expect(read).toContain('tok-variableName');
    });

    it('colours a tier name as a bundle, because that is what it is', () => {
        // `plan business`, `extends free` and `trial business` all name a bundle of capabilities —
        // the same kind of thing `role` and `grants` name. Colouring them as values would make the
        // one word that decides what a customer gets look like data.
        expect(classesFor(DECLARATION, 'business')).toContain('tok-className');
        expect(classesFor(DECLARATION, 'free')).toContain('tok-className');
    });

    it('gives deny a colour of its own, because nobody may skim past a denial', () => {
        const denials = classesFor(DECLARATION, 'deny');

        expect(denials.length).toBeGreaterThan(0);
        expect(denials).not.toContain('tok-keyword');
        expect(denials).toContain('tok-atom');
    });

    it('reads a word owning a colon as a namespace, never as the keyword of the same spelling', () => {
        // `role:read` is an ordinary permission in a product that administers roles. Coloured as a
        // keyword it would read as a syntax error in a file that parses perfectly.
        const coloured = tokens('subject SU { @GLOBAL role:read }');

        expect(coloured.find((token) => token.text === 'role')?.token).toBe('tok-variableName');
        expect(coloured.find((token) => token.text === 'read')?.token).toBe('tok-propertyName');
    });

    // The classes below are the *parents* of this language's own tags — which is what a theme that
    // has never heard of `.jmp` falls back to, and therefore the thing worth pinning down. What our
    // own style paints them is `--syntax-scope` and `--syntax-instance`, and that is CSS, not a tree.
    it('colours a scope kind and its instance differently', () => {
        const kind     = classesFor(DECLARATION, '@SPACE');
        const instance = classesFor(DECLARATION, 'kyiv');

        expect(kind).toContain('tok-typeName');
        expect(instance).toContain('tok-string');
        expect(instance).not.toContain('tok-typeName');
    });

    // ── Hyphens ──────────────────────────────────────────────────────────────
    //  The backend stopped requiring quotes around a hyphenated entitlement instance, because a slug
    //  is hyphenated by nature and a block where every second line needs quotes is a block nobody
    //  proofreads. This scanner read the result as three names and two subtractions.
    it('reads a hyphenated instance as one name, not as arithmetic', () => {
        const line     = "entitlements { @ORGANIZATION:id-organization-001 allow custody }";
        const instance = classesFor(line, 'id-organization-001');

        expect(instance).toContain('tok-string');
        expect(tokens(line).some((token) => token.text === '-')).toBe(false);
    });

    it('reads a hyphenated capability as one name, quoted or bare', () => {
        expect(classesFor(DECLARATION, 'storage-byte')).not.toHaveLength(0);
        expect(classesFor(DECLARATION, 'parametric-search')).not.toHaveLength(0);
        expect(classesFor("plans { plan free { storage-byte 5GB per month } }", '-')).toHaveLength(0);
    });

    // ── Capabilities ─────────────────────────────────────────────────────────
    it('colours what a capability statement is about, wherever the statement is written', () => {
        // The same key in the five places it can appear: declared, sold, granted, refused — and, in the
        // last one, written the way the writer writes it back out, which is quoted.
        for (const [source, written] of [
            ['capabilities { gate custody "Custody" }',            'custody'],
            ['plans { plan free { custody } }',                    'custody'],
            ['entitlements { @ORGANIZATION:acme allow custody }',  'custody'],
            ['entitlements { @ORGANIZATION:acme deny custody }',   'custody'],
            ["entitlements { @ORGANIZATION:acme allow 'custody' }", "'custody'"],
        ]) {
            expect(classesFor(source, written)).toContain('tok-propertyName');
        }
    });

    it('carries a paid list across its commas', () => {
        const paid = 'capabilities { paid parametric-search, custody }';

        expect(classesFor(paid, 'custody')).toContain('tok-propertyName');
    });

    it('does not read a grant\'s trailing deny as naming a capability', () => {
        // `@SELF form:write deny when …` closes with an effect; an entitlement opens with one. Read
        // the wrong way round, `when` comes out as the name of something a plan could sell.
        const grant = "subject SU { @SELF form:write deny when resource.status == 'DRAFT' }";

        expect(classesFor(grant, 'when')).toContain('tok-keyword');
        expect(classesFor(grant, 'when')).not.toContain('tok-propertyName');
    });

    // ── Amounts and dates ────────────────────────────────────────────────────
    it('reads an amount with its unit, and a date whole', () => {
        expect(classesFor(DECLARATION, '200MB')).toContain('tok-number');
        expect(classesFor(DECLARATION, '25')).toContain('tok-number');
        expect(classesFor(DECLARATION, '2026-09-12')).toContain('tok-number');
        expect(classesFor(DECLARATION, '2026-08-01')).toContain('tok-number');
    });

    it('reads a ${…} placeholder whole, wherever one may stand', () => {
        expect(classesFor(DECLARATION, '${innoventa.bootstrap.owner}')).toContain('tok-meta');
        expect(classesFor(DECLARATION, '${application.defaultInstance}')).toContain('tok-meta');
    });

    it('names what a role and a subject declare', () => {
        expect(classesFor(DECLARATION, 'INSTALLATION_OWNER')).toContain('tok-className');
    });

    it('runs a # comment to the end of its line and no further', () => {
        const comments = tokens(DECLARATION).filter((token) => token.token === 'tok-comment');

        expect(comments.length).toBe(4);
        expect(comments.every((comment) => !comment.text.includes('\n'))).toBe(true);
    });

    it('does not read a # inside a quoted name as a comment', () => {
        const coloured = tokens("subject 'u#42' { @SELF form:read }");

        expect(coloured.some((token) => token.token === 'tok-comment')).toBe(false);
        expect(classesFor("subject 'u#42' { @SELF form:read }", 'read')).toContain('tok-propertyName');
    });

    it('covers the whole fixture, leaving nothing unparsed', () => {
        expect(jmpSyntaxLanguage.parser.parse(DECLARATION).length).toBe(DECLARATION.length);
    });

    // ── declare / assign ─────────────────────────────────────────────────────
    //  They label a block rather than being one, so they carry a token of their own — same hue as a
    //  keyword, set apart by slant and weight. A colour of their own would have read as a second kind
    //  of thing, which is the opposite of what a prefix is.

    it('reads declare and assign as their own kind of word, not as block keywords', () => {
        const prefixed = `declare role SPACE_ADMIN { @SPACE form:read }
assign subject 'u-1' { grants SPACE_ADMIN @SPACE:kyiv }`;

        expect(prefixesIn(prefixed)).toEqual(['declare', 'assign']);

        // ⚠️ And nothing else in the line is one. `role` and `subject` are still block keywords: the
        // prefix labels them, it does not replace them.
        expect(prefixesIn(prefixed)).not.toContain('role');
        expect(prefixesIn(prefixed)).not.toContain('subject');
    });

    it('still reads the block the prefix labels, and the name after it', () => {
        const prefixed = "declare role SPACE_ADMIN { @SPACE form:read }";

        // ⚠️ The prefix must not become the previous word: what `SPACE_ADMIN` means is decided by
        // `role`, and a prefix that swallowed that decision would leave the name uncoloured.
        expect(classesFor(prefixed, 'role')).toContain('tok-keyword');
        expect(classesFor(prefixed, 'SPACE_ADMIN')).toContain('tok-className');
    });

    it('leaves declare and assign alone where no block follows them', () => {
        // A keyword is only a keyword where a keyword can be — the same allowance the backend's lexer
        // makes, and a policy is allowed to hold these as ordinary words.
        const asAPermission = 'assign subject "u-1" { @GLOBAL declare:write }';

        expect(prefixesIn(asAPermission)).toEqual(['assign']);
        expect(classesFor(asAPermission, 'declare')).toContain('tok-variableName');
    });

    it('colours the bare spelling exactly as before, so a stored revision still reads right', () => {
        const bare = "role SPACE_ADMIN { @SPACE form:read }";

        expect(classesFor(bare, 'role')).toContain('tok-keyword');
        expect(classesFor(bare, 'SPACE_ADMIN')).toContain('tok-className');
        expect(prefixesIn(bare)).toEqual([]);
    });

    // ── Conditions where they were once refused ──────────────────────────────

    it('colours a condition on a bundle entry and on a role assignment', () => {
        const conditional = `declare role ALMOST_ADMIN {
    @GLOBAL user:write when caller.name is contains ('GOD')
}
assign subject 'u-1' {
    grants ALMOST_ADMIN @GLOBAL when caller.agent
}`;

        // Both `when`s are the language's word, wherever the condition hangs off.
        expect(tokens(conditional).filter(
            (token) => token.text === 'when' && token.token === 'tok-keyword',
        ).length).toBe(2);

        expect(classesFor(conditional, 'caller')).toContain('tok-variableName');
        expect(classesFor(conditional, "'GOD'")).toContain('tok-string');
    });
});

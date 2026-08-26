import { describe, it, expect } from 'vitest';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { jmmSyntaxLanguage } from './jmmSyntax';
import { expressionField, expressionFilter, expressionKeyword, mappingImport } from './tags';

/**
 * Guards the `.jmm` token scanner — the one piece of this feature the type-checker cannot reach.
 *
 * <p>⚠️ **The fixture is a real file.** It is `Innoventa/BE/src/main/resources/mapping/project.jmm`,
 * which loads against Innoventa's compiled classes rather than merely parsing. A grammar checked
 * against a document invented for the check is a grammar checked against its own author's assumptions;
 * this one carries the three shapes a real DTO group actually produced — an entity flattened into two
 * strings, a value the source cannot supply, and a fragment shared across responses.
 *
 * <h2>⚠️ Why this names the tags itself instead of using `classHighlighter`</h2>
 *
 * <p>`classHighlighter` has no class for `modifier`, for `controlKeyword`, or for any of this package's
 * own tags, so it collapses all of them onto `tok-keyword` or drops them. The palette in
 * {@link ./highlight} distinguishes every one — so a test written against `classHighlighter` would pass
 * while the grammar drew `use`, `refuse` and `after` identically, and fail to notice.
 *
 * <p>Naming the tags here is also what makes each assertion a sentence about the grammar rather than
 * about a library's default class list.
 */

/** Innoventa's `mapping/project.jmm`, verbatim. Keep them identical, or neither is a check. */
const PROJECT = `# ── mapping/project.jmm ──────────────────────────────────────────────────
# The project domain, on its way out to the API.

mapping "innoventa/project" {

    use net.innoventa.operation.project.domain.Project
    use net.innoventa.operation.project.dto.ProjectResponseDtos$ProjectSummaryResponse

    fragment place {
        spaceId   : space.id
        spaceName : space.name
    }

    target ProjectSummaryResponse {

        refuse target after {
            id is null : "a project summary was produced with no id"
        }

        from Project {
            include place
        }
    }
}
`;

/** The constructs `project.jmm` does not have, so nothing below is untested for lack of a case. */
const REST = `mapping "rest" {

    target Order {

        unmapped fail

        always {
            status : "CREATED"
        }

        from OrderRequest {
            reference : reference | trim | upper   # normalised on the way in
            buyerName : firstName ~ " " ~ lastName
            tier      : "gold" when total > 1000
            secret    : ignore
        }
    }
}
`;

/**
 * Every tag this grammar can emit, named.
 *
 * <p>⚠️ Listed exhaustively rather than only the ones under test: a tag missing from here is silently
 * unhighlighted, and the assertion that would have caught it is the one nobody wrote.</p>
 */
const highlighter = tagHighlighter([
    { tag: expressionKeyword, class: 'declaration' },
    { tag: expressionField, class: 'target' },
    { tag: expressionFilter, class: 'filter' },
    { tag: tags.keyword, class: 'keyword' },
    { tag: tags.controlKeyword, class: 'phase' },
    { tag: tags.modifier, class: 'modifier' },
    { tag: mappingImport, class: 'import' },
    { tag: tags.typeName, class: 'type' },
    { tag: tags.propertyName, class: 'property' },
    { tag: tags.variableName, class: 'variable' },
    { tag: tags.atom, class: 'ignore' },
    { tag: tags.bool, class: 'literal' },
    { tag: tags.string, class: 'string' },
    { tag: tags.number, class: 'number' },
    { tag: tags.comment, class: 'comment' },
    { tag: tags.operator, class: 'operator' },
    { tag: tags.punctuation, class: 'punctuation' },
]);

function tokens(code: string): { text: string; token: string }[] {
    const found: { text: string; token: string }[] = [];

    highlightTree(jmmSyntaxLanguage.parser.parse(code), highlighter, (from, to, tokenClasses) => {
        for (const tokenClass of tokenClasses.split(' ')) {
            found.push({ text: code.slice(from, to), token: tokenClass });
        }
    });

    return found;
}

function tokenFor(code: string, text: string): string[] {
    return tokens(code).filter((token) => token.text === text).map((token) => token.token);
}

function textsTagged(code: string, token: string): string[] {
    return tokens(code).filter((found) => found.token === token).map((found) => found.text);
}

describe('.jmm — the words that open something', () => {
    it('colours the file header louder than the blocks inside it', () => {
        expect(tokenFor(PROJECT, 'mapping')).toEqual(['declaration']);
        expect(tokenFor(PROJECT, 'fragment')).toEqual(['keyword']);
        expect(tokenFor(PROJECT, 'from')).toEqual(['keyword']);
    });

    it('colours a refusal header apart from the block it opens', () => {
        // `refuse target after` — the word opens a block, the two after it place it in time, and a
        // reader scanning a file for the guard is scanning for this line.
        expect(tokenFor(PROJECT, 'refuse')).toEqual(['keyword']);
        expect(tokenFor(PROJECT, 'after')).toEqual(['phase']);
    });

    it('colours the words that modify rather than open', () => {
        expect(tokenFor(PROJECT, 'use')).toEqual(['modifier', 'modifier']);
        expect(tokenFor(PROJECT, 'include')).toEqual(['modifier']);
        expect(tokenFor(REST, 'unmapped')).toEqual(['modifier']);
        expect(tokenFor(REST, 'when')).toEqual(['modifier']);
    });
});

describe('.jmm — the two sides of a colon', () => {
    it('⚠️ colours ONLY the words a colon actually follows as the target column', () => {
        // The column a reader scans down. `target Order`, `fragment place` and `unmapped fail` are all
        // before a colon and none of them is a property — colouring them here would be the single most
        // misleading thing this grammar could do.
        expect(textsTagged(PROJECT, 'target')).toEqual(['spaceId', 'spaceName']);
        expect(textsTagged(REST, 'target')).toEqual(['status', 'reference', 'buyerName', 'tier', 'secret']);
    });

    it('⚠️ does NOT colour the left of a colon as a property inside a refuse block', () => {
        // `id is null : "…"` — the left is a CONDITION, not a name being written into.
        expect(tokenFor(PROJECT, 'id')).not.toContain('target');
    });

    it('colours a path segment apart from the property it is assigned to', () => {
        // `spaceId : space.id` — two id-ish things on one line, and they must not look alike.
        expect(tokenFor(PROJECT, 'space')).toEqual(['variable', 'variable']);
        expect(tokenFor(PROJECT, 'id')).toContain('property');
    });
});

describe('.jmm — the expression half', () => {
    it('colours a filter after a lone pipe, exactly as jME does', () => {
        expect(tokenFor(REST, 'trim')).toEqual(['filter']);
        expect(tokenFor(REST, 'upper')).toEqual(['filter']);
    });

    it('colours strings and numbers', () => {
        expect(tokenFor(REST, '"CREATED"')).toEqual(['string']);
        expect(tokenFor(REST, '1000')).toEqual(['number']);
    });

    it('⚠️ colours `ignore` as an atom — neither a keyword nor a name', () => {
        // It opens nothing, so it must not look like `from`; and it is a decision, so it must not look
        // like a variable somebody forgot to define.
        expect(tokenFor(REST, 'ignore')).toEqual(['ignore']);
    });

    it('⚠️ colours `null` as a value, not as part of the comparison', () => {
        // It is the same `null` that may stand on the right of a rule. One word, one appearance.
        expect(tokenFor(PROJECT, 'null')).toEqual(['literal']);
        expect(tokenFor(PROJECT, 'is')).toEqual(['operator']);
    });
});

describe('.jmm — comments', () => {
    it('colours a whole-line comment', () => {
        expect(textsTagged(PROJECT, 'comment')
            .some((text) => text.startsWith('# The project domain'))).toBe(true);
    });

    it('⚠️ colours a comment trailing a rule, which the value reader stops at', () => {
        expect(textsTagged(REST, 'comment')
            .some((text) => text.includes('normalised on the way in'))).toBe(true);
    });

    it('does not spend a keyword inside a comment', () => {
        const commented = '# target from always ignore\nmapping "x" {}\n';

        expect(textsTagged(commented, 'keyword')).toEqual([]);
        expect(textsTagged(commented, 'declaration')).toEqual(['mapping']);
    });
});

describe('.jmm — the types a document names', () => {
    it('reads a qualified type on a use line as one token', () => {
        expect(tokenFor(PROJECT, 'net.innoventa.operation.project.domain.Project')).toEqual(['import']);
    });

    it('⚠️ reads a nested type with its class-loader spelling', () => {
        // A document names `Dtos$Response` the way a class loader does, so `$` is part of a name here
        // and splitting on it would leave `$ProjectSummaryResponse` as an operator and a word.
        expect(tokenFor(
            PROJECT,
            'net.innoventa.operation.project.dto.ProjectResponseDtos$ProjectSummaryResponse',
        )).toEqual(['import']);
    });

    it('colours a bare type after target and from', () => {
        expect(tokenFor(PROJECT, 'ProjectSummaryResponse')).toEqual(['type']);
        expect(tokenFor(PROJECT, 'Project')).toEqual(['type']);
    });

    it('⚠️ tells a use header apart from the type a block is about', () => {
        // The regression this guards is not that either one is uncoloured — it is that they are
        // coloured the SAME. `use` is bookkeeping, read once when a file is opened; `target Project`
        // is what a reader scans a file for, and the keyword beside it repeats on every block.
        //
        // ⚠️ `Project` appears in both places in this document — on its own after `target` and at the
        // end of the qualified name on the use line — which is exactly why the two must not share a
        // tag: on one line the word locates you, on the other it is the tail of a package path.
        expect(tokenFor(PROJECT, 'net.innoventa.operation.project.domain.Project'))
            .not.toEqual(tokenFor(PROJECT, 'Project'));
    });
});

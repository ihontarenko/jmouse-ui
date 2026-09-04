import { describe, it, expect } from 'vitest';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { jmvSyntaxLanguage } from './jmvSyntax';
import { expressionField, expressionFilter, expressionKeyword } from './tags';

/**
 * Guards the `.jmv` token scanner — the one piece of this feature the type-checker cannot reach.
 *
 * <p>⚠️ **The fixture carries every construct the language has**, because a grammar checked against a
 * document invented for the check is a grammar checked against its own author's assumptions. The
 * awkward cases are the point: a field spelled like a keyword, a named argument whose colon is not the
 * line's, a check list wrapped onto a second line, and an aside at the end of the first of them.
 *
 * <h2>⚠️ Why this names the tags itself instead of using `classHighlighter`</h2>
 *
 * <p>`classHighlighter` has no class for `modifier`, for `controlKeyword`, or for any of this package's
 * own tags, so it collapses them onto `tok-keyword` or drops them. A test written against it would pass
 * while the grammar drew `gate`, `when` and `stop` identically, and fail to notice.
 */

const PART = `# validation/part.jmv
# A part, as the catalogue needs it.

validation "innoventa/part" {

    gate {
        form_version : pattern('^2[.].*') : 'This form has moved on'
    }

    always {
        part_number : required stop, notBlank, size(3, 32)   # the common failure
                    : 'A part number looks like AB-1234'

        datasheet : optional, url(host: 'mouser.com')
    }

    when mount_type == 'SMD' {
        resistor_package : required, oneOf('0805', '0603')
    } otherwise {
        lead_spacing : required
    }

    invariant min_stock_threshold <= quantity : 'The threshold cannot exceed stock'
}
`;

/**
 * A document whose fields are spelled like the language's own words.
 *
 * <p>⚠️ Not exotic, and the backend parses it: every keyword-led decision there asks a second question,
 * *is a colon behind it*. A grammar that did not ask the same would colour a product's own field names
 * as structure.</p>
 */
const AWKWARD = `validation "awkward" {
    gate : required
    when : notBlank
    always : optional
    stop : required
    invariant : notBlank
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
    { tag: expressionField, class: 'field' },
    { tag: expressionFilter, class: 'check' },
    { tag: tags.keyword, class: 'keyword' },
    { tag: tags.controlKeyword, class: 'branch' },
    { tag: tags.modifier, class: 'modifier' },
    { tag: tags.propertyName, class: 'property' },
    { tag: tags.variableName, class: 'variable' },
    { tag: tags.atom, class: 'optional' },
    { tag: tags.bool, class: 'literal' },
    { tag: tags.string, class: 'string' },
    { tag: tags.number, class: 'number' },
    { tag: tags.comment, class: 'comment' },
    { tag: tags.operator, class: 'operator' },
    { tag: tags.punctuation, class: 'punctuation' },
]);

function tokens(code: string): { text: string; token: string }[] {
    const found: { text: string; token: string }[] = [];

    highlightTree(jmvSyntaxLanguage.parser.parse(code), highlighter, (from, to, tokenClasses) => {
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

describe('.jmv — the words that open something', () => {
    it('colours the file header louder than the blocks inside it', () => {
        expect(tokenFor(PART, 'validation')).toEqual(['declaration']);
        expect(tokenFor(PART, 'gate')).toEqual(['keyword']);
        expect(tokenFor(PART, 'always')).toEqual(['keyword']);
        expect(tokenFor(PART, 'invariant')).toEqual(['keyword']);
    });

    it('colours branching apart from the blocks', () => {
        // A reader scanning a file for *what applies when* is scanning for these two.
        expect(tokenFor(PART, 'when')).toEqual(['branch']);
        expect(tokenFor(PART, 'otherwise')).toEqual(['branch']);
    });
});

describe('.jmv — the column a reader scans down', () => {
    it('colours a field as a field, and only at the start of a line', () => {
        expect(textsTagged(PART, 'field')).toEqual([
            'form_version', 'part_number', 'datasheet', 'resistor_package', 'lead_spacing',
        ]);
    });

    it('does not colour a wrapped check list as a second field', () => {
        // `size(3, 32)` opens the second physical line of `part_number`. It is a check, not a field.
        expect(tokenFor(PART, 'size')).toEqual(['check']);
    });
});

describe('.jmv — checks read as operations, not as names', () => {
    it('colours every check', () => {
        expect(tokenFor(PART, 'required')).toEqual(['check', 'check', 'check']);
        expect(tokenFor(PART, 'notBlank')).toEqual(['check']);
        expect(tokenFor(PART, 'pattern')).toEqual(['check']);
        expect(tokenFor(PART, 'oneOf')).toEqual(['check']);
    });

    it('colours stop as a modifier, not as a check', () => {
        expect(tokenFor(PART, 'stop')).toEqual(['modifier']);
    });

    it('colours optional as an atom — the one check that asks nothing', () => {
        expect(tokenFor(PART, 'optional')).toEqual(['optional']);
    });

    it("colours a named argument's key as a key, not as a field", () => {
        // ⚠️ `host:` and `datasheet:` are both an identifier a colon follows. Only the parentheses tell
        // them apart, and getting this wrong paints an argument as the line's subject.
        expect(tokenFor(PART, 'host')).toEqual(['property']);
    });
});

describe('.jmv — a field may be spelled like a keyword', () => {
    it('colours every one of them as a field', () => {
        expect(textsTagged(AWKWARD, 'field')).toEqual([
            'gate', 'when', 'always', 'stop', 'invariant',
        ]);
    });

    it('and nothing in that document is read as structure', () => {
        expect(textsTagged(AWKWARD, 'keyword')).toEqual([]);
        expect(textsTagged(AWKWARD, 'branch')).toEqual([]);
    });
});

describe('.jmv — comments and strings', () => {
    it('keeps a comment whole, including one trailing a check list', () => {
        expect(textsTagged(PART, 'comment')).toEqual([
            '# validation/part.jmv',
            '# A part, as the catalogue needs it.',
            '# the common failure',
        ]);
    });

    it('reads a message as one string however much it contains', () => {
        expect(tokenFor(PART, "'A part number looks like AB-1234'")).toEqual(['string']);
    });
});

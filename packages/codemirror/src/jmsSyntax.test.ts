import { describe, it, expect } from 'vitest';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { jmsSyntaxLanguage } from './jmsSyntax';
import { expressionKeyword, scriptEvent, scriptFacade } from './tags';

/**
 * Guards the `.jms` token scanner — the one piece of this feature the type-checker cannot reach.
 *
 * <p>⚠️ **The fixture carries every construct the language has**, because a grammar checked against a
 * document invented for the check is a grammar checked against its own author's assumptions. The
 * awkward cases are the point: a facade method spelled `end`, an event called `on`, a `#` that reaches
 * a constant rather than opening a comment, and an assignment beside a comparison.
 *
 * <h2>⚠️ Why this names the tags itself instead of using `classHighlighter`</h2>
 *
 * <p>`classHighlighter` has no class for `controlKeyword`, for `definitionOperator`, or for any of this
 * package's own tags, so it collapses them onto `tok-keyword` or drops them. A test written against it
 * would pass while the grammar drew a facade, an event and a loop variable identically, and fail to
 * notice.
 */

const COUNTER = `# script/counter.jms
# The house, the statements, and the three ways an @ name is written.

include 'common.jms'

script "counter" {

    function busy()
        return @store.pending() > 2
    end

    on changed when entry.kind == 'delivery' do
        local weight = entry.weight

        if weight == 1 then
            @journal.record('first')
        elseif weight > @store#BULK then
            @journal.record('heavy')
        else
            @journal.record(@journal:$fallback)
        end
    end

    on ticked 180 do
        for entry in @store.pending_entries() do
            @alarm.arm('front', 30)
        end
    end
}

behaviour "clerk" do

    function step(item)
        item.state = 'moving'
    end

end
`;

/**
 * A document whose names are spelled like the language's own words.
 *
 * <p>⚠️ Not exotic, and the backend parses every line of it: `ScriptToken.nameTokens()` reads each of
 * this dialect's keywords as an ordinary name wherever a name belongs, because a host is entitled to an
 * event called `end` and a facade method called `do`. A grammar that did not do the same would colour a
 * correct file as broken.</p>
 */
const AWKWARD = `script "awkward" {
    on end do
        @world.do()
        local script = @world.behaviour()
        for include in @world.on() do
            @world.end()
        end
    end
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
    { tag: scriptFacade, class: 'facade' },
    { tag: scriptEvent, class: 'event' },
    { tag: tags.keyword, class: 'keyword' },
    { tag: tags.controlKeyword, class: 'branch' },
    { tag: tags.propertyName, class: 'member' },
    { tag: tags.attributeName, class: 'field' },
    { tag: tags.definition(tags.variableName), class: 'definition' },
    { tag: tags.variableName, class: 'variable' },
    { tag: tags.atom, class: 'constant' },
    { tag: tags.bool, class: 'literal' },
    { tag: tags.string, class: 'string' },
    { tag: tags.number, class: 'number' },
    { tag: tags.comment, class: 'comment' },
    { tag: tags.definitionOperator, class: 'assign' },
    { tag: tags.operator, class: 'operator' },
    { tag: tags.punctuation, class: 'punctuation' },
]);

function tokens(code: string): { text: string; token: string }[] {
    const found: { text: string; token: string }[] = [];

    highlightTree(jmsSyntaxLanguage.parser.parse(code), highlighter, (from, to, tokenClasses) => {
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

describe('.jms — the words that wrap a file', () => {
    it('colours the file-scope words louder than the statements', () => {
        expect(tokenFor(COUNTER, 'include')).toEqual(['declaration']);
        expect(tokenFor(COUNTER, 'script')).toEqual(['declaration']);
        expect(tokenFor(COUNTER, 'behaviour')).toEqual(['declaration']);
    });

    it('colours the house around a body as keywords', () => {
        expect(tokenFor(COUNTER, 'on')).toEqual(['keyword', 'keyword']);
        expect(tokenFor(COUNTER, 'when')).toEqual(['keyword']);
        expect(tokenFor(COUNTER, 'then')).toEqual(['keyword', 'keyword']);
        expect(tokenFor(COUNTER, 'function')).toEqual(['keyword', 'keyword']);
        expect(tokenFor(COUNTER, 'local')).toEqual(['keyword']);
    });

    it('colours what moves somewhere else apart from what delimits', () => {
        // A reader scanning a script for *what happens when* is scanning for these.
        expect(tokenFor(COUNTER, 'if')).toEqual(['branch']);
        expect(tokenFor(COUNTER, 'elseif')).toEqual(['branch']);
        expect(tokenFor(COUNTER, 'else')).toEqual(['branch']);
        expect(tokenFor(COUNTER, 'for')).toEqual(['branch']);
        expect(tokenFor(COUNTER, 'return')).toEqual(['branch']);
    });
});

describe('.jms — the column a reader scans down', () => {
    it('colours an event as an event, and only after on', () => {
        expect(textsTagged(COUNTER, 'event')).toEqual(['changed', 'ticked']);
    });

    it('colours every @ name as a facade, and the method after it as a member', () => {
        expect(textsTagged(COUNTER, 'facade')).toEqual([
            'store', 'journal', 'store', 'journal', 'journal', 'journal', 'store', 'alarm',
        ]);
        expect(tokenFor(COUNTER, 'pending')).toEqual(['member']);
        expect(tokenFor(COUNTER, 'record')).toEqual(['member', 'member', 'member']);
    });
});

describe('.jms — the three ways an @ name is written', () => {
    it('⚠️ tells a constant access from a comment', () => {
        // `#` opens a line comment everywhere except immediately after a facade name. Getting this
        // wrong swallows the rest of the line.
        expect(tokenFor(COUNTER, 'BULK')).toEqual(['constant']);
        expect(textsTagged(COUNTER, 'comment')).toEqual([
            '# script/counter.jms',
            '# The house, the statements, and the three ways an @ name is written.',
        ]);
    });

    it('reads a field access as a field', () => {
        expect(tokenFor(COUNTER, 'fallback')).toEqual(['field']);
    });
});

describe('.jms — an assignment is not a comparison', () => {
    it('⚠️ colours = apart from ==', () => {
        // One token type to the lexer, two different acts. Writing `==` where an assignment was meant
        // is refused at load, because it would otherwise evaluate and throw its answer away.
        expect(textsTagged(COUNTER, 'assign')).toEqual(['=', '=']);
        expect(tokenFor(COUNTER, '==')).toEqual(['operator', 'operator']);
    });

    it('colours a bound name as a definition', () => {
        expect(textsTagged(COUNTER, 'definition')).toEqual([
            'busy', 'weight', 'entry', 'step',
        ]);
    });
});

describe('.jms — a name may be spelled like a keyword', () => {
    it('⚠️ colours a facade method called end as a member, not as a terminator', () => {
        expect(tokenFor(AWKWARD, 'do')).toContain('member');
        expect(tokenFor(AWKWARD, 'behaviour')).toEqual(['member']);
        expect(tokenFor(AWKWARD, 'on')).toEqual(['keyword', 'member']);
    });

    it('colours an event called end as an event', () => {
        expect(textsTagged(AWKWARD, 'event')).toEqual(['end']);
    });

    it('colours a local and a loop variable spelled as keywords as definitions', () => {
        expect(textsTagged(AWKWARD, 'definition')).toEqual(['script', 'include']);
    });
});

/**
 * Every non-whitespace character the fixture holds, that no token claimed.
 *
 * <p>⚠️ `highlightTree` only calls back for ranges it has a style for, so anything the scanner returned
 * `null` for is simply absent — invisible to every other assertion in this file, and grey in an editor.
 * This is the one check that notices a construct nobody thought to write a test for.</p>
 */
function unscoped(code: string): string[] {
    const covered = new Array<boolean>(code.length).fill(false);

    highlightTree(jmsSyntaxLanguage.parser.parse(code), highlighter, (from, to) => {
        for (let index = from; index < to; index += 1) {
            covered[index] = true;
        }
    });

    const missed: string[] = [];

    for (let index = 0; index < code.length; index += 1) {
        if (!covered[index] && !/\s/.test(code[index])) {
            missed.push(code[index]);
        }
    }

    return missed;
}

describe('.jms — nothing is left grey', () => {
    it('⚠️ scopes every character of a document using every construction', () => {
        expect(unscoped(COUNTER)).toEqual([]);
    });

    it('scopes every character of a document whose names are keywords', () => {
        expect(unscoped(AWKWARD)).toEqual([]);
    });

    it('⚠️ and the check itself is capable of failing', () => {
        // A coverage assertion that cannot go red is worth nothing, and this one is a helper written
        // for this file rather than something the library guarantees. A backtick is in no rule of this
        // grammar — the language has no use for one — so it is what proves the two above mean something.
        expect(unscoped('script "x" { on end do ` end }')).toEqual(['`']);
    });
});

describe('.jms — literals and strings', () => {
    it('reads a string as one token however much it contains', () => {
        expect(tokenFor(COUNTER, "'common.jms'")).toEqual(['string']);
        expect(tokenFor(COUNTER, "'delivery'")).toEqual(['string']);
    });

    it('reads a handler argument as a number', () => {
        expect(tokenFor(COUNTER, '180')).toEqual(['number']);
    });
});

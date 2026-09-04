import { describe, it, expect } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import {
    catalogueCompletionSource, JMS_COMPLETION_RULES, type CompletionCatalogue,
} from './completion';
import { jmsSyntax } from './jmsSyntax';

/**
 * Guards the catalogue-fed completion source.
 *
 * <h2>⚠️ Half of these assert that nothing is offered</h2>
 *
 * <p>A completion list that appears is easy to test and easy to write. What decides whether people
 * leave the feature switched on is the other half — that it stays quiet inside a comment, inside a
 * string, over whitespace, and after a facade nobody declared. Every one of those is a way to make an
 * editor feel like it is fighting you, and none of them shows up in a screenshot.</p>
 *
 * <p>The document is real `.jms` and goes through the real grammar, because "quiet inside a comment"
 * is a question only the grammar can answer — see the note on `isQuiet`.</p>
 */

const CATALOGUE: CompletionCatalogue = {
    events: [
        { name: 'changed', detail: 'an entry was written', context: ['entry', 'incoming'] },
        { name: 'deleting', detail: 'an entry is about to go' },
    ],
    facades: [
        {
            name: 'store',
            detail: 'stock positions',
            methods: [
                { name: 'quantity', arity: 1 },
                { name: 'threshold', arity: 1, detail: 'the floor for this position' },
            ],
            constants: ['DEFAULT_FLOOR'],
        },
        { name: 'journal', methods: [{ name: 'record', arity: 1 }] },
    ],
    functions: [{ name: 'sqrt', detail: 'square root' }],
};

/** What the source offers at the end of the given document. */
function offered(document: string, catalogue: CompletionCatalogue | null = CATALOGUE, explicit = false) {
    const state = EditorState.create({ doc: document, extensions: [jmsSyntax()] });
    const source = catalogueCompletionSource({ catalogue: () => catalogue, rules: JMS_COMPLETION_RULES });
    const result = source(new CompletionContext(state, document.length, explicit));

    return result === null ? null : result.options.map((option) => option.label);
}

/** Where CodeMirror would start replacing — the whole point being that it replaces what was typed. */
function replacesFrom(document: string) {
    const state = EditorState.create({ doc: document, extensions: [jmsSyntax()] });
    const source = catalogueCompletionSource({ catalogue: () => CATALOGUE, rules: JMS_COMPLETION_RULES });

    return source(new CompletionContext(state, document.length, false))?.from ?? null;
}

const OPEN = 'script "s" {\n    on changed do\n        ';

describe('what is offered, and where', () => {
    it('offers facades after an @', () => {
        expect(offered(`${OPEN}@`)).toEqual(['store', 'journal']);
    });

    it('filters facades by what has been typed', () => {
        expect(offered(`${OPEN}@st`)).toEqual(['store', 'journal']);
        expect(replacesFrom(`${OPEN}@st`)).toBe(`${OPEN}@`.length);
    });

    it('offers a facade its own methods after a dot', () => {
        expect(offered(`${OPEN}@store.`)).toEqual(['quantity', 'threshold']);
    });

    it('offers a facade its own constants after a hash', () => {
        expect(offered(`${OPEN}@store#`)).toEqual(['DEFAULT_FLOOR']);
    });

    it('offers events after on', () => {
        expect(offered('script "s" {\n    on ')).toEqual(['changed', 'deleting']);
    });

    it('offers functions and the names the event carries', () => {
        // ⚠️ `entry` and `incoming` are the whole reason a catalogue beats reading the grammar: nothing
        // in the file says what a `changed` handler is handed.
        expect(offered(`${OPEN}sq`)).toEqual(['sqrt', 'entry', 'incoming']);
    });

    it('does not offer another event\'s context names', () => {
        const deleting = 'script "s" {\n    on deleting do\n        sq';

        expect(offered(deleting)).toEqual(['sqrt']);
    });
});

describe('⚠️ where it stays quiet', () => {
    it('offers nothing inside a comment', () => {
        expect(offered(`${OPEN}# talk to @`)).toBeNull();
    });

    it('offers nothing inside a string', () => {
        expect(offered(`${OPEN}@journal.record('write to @`)).toBeNull();
    });

    it('⚠️ offers nothing for a facade nobody declared', () => {
        // Worse than offering none: it would teach a name the binder refuses at load.
        expect(offered(`${OPEN}@ledger.`)).toBeNull();
    });

    it('offers nothing over whitespace unless asked outright', () => {
        expect(offered(OPEN)).toBeNull();
        expect(offered(OPEN, CATALOGUE, true)).not.toBeNull();
    });

    it('offers nothing at all with no catalogue, and does not throw', () => {
        expect(offered(`${OPEN}@`, null)).toBeNull();
    });

    it('and treats an undefined catalogue the same as a null one', () => {
        // ⚠️ Not through the helper above: a default parameter is applied when the argument is
        // `undefined`, so passing one there quietly tests the default instead. The first version of
        // this assertion did exactly that and passed while proving nothing.
        const document = `${OPEN}@store.`;
        const state = EditorState.create({ doc: document, extensions: [jmsSyntax()] });
        const source = catalogueCompletionSource({
            catalogue: () => undefined, rules: JMS_COMPLETION_RULES,
        });

        expect(source(new CompletionContext(state, document.length, false))).toBeNull();
    });

    it('offers nothing from an empty catalogue rather than an empty popup', () => {
        expect(offered(`${OPEN}@`, {})).toBeNull();
    });
});

describe('what an entry says about itself', () => {
    it('carries the detail a host supplied, and an arity where it did not', () => {
        const state = EditorState.create({
            doc: `${OPEN}@store.`, extensions: [jmsSyntax()],
        });
        const source = catalogueCompletionSource({
            catalogue: () => CATALOGUE, rules: JMS_COMPLETION_RULES,
        });
        const options = source(new CompletionContext(state, `${OPEN}@store.`.length, false))?.options ?? [];

        // ⚠️ The arity is shown and never applied — completing into `quantity(, )` guesses at the
        // arguments and puts the caret in the wrong one.
        expect(options.find((option) => option.label === 'quantity')?.detail).toBe('1 argument(s)');
        expect(options.find((option) => option.label === 'threshold')?.detail)
            .toBe('the floor for this position');
    });

    it('marks a context name as coming from the event', () => {
        const document = `${OPEN}en`;
        const state = EditorState.create({ doc: document, extensions: [jmsSyntax()] });
        const source = catalogueCompletionSource({
            catalogue: () => CATALOGUE, rules: JMS_COMPLETION_RULES,
        });
        const options = source(new CompletionContext(state, document.length, false))?.options ?? [];

        expect(options.find((option) => option.label === 'entry')?.detail).toBe('from the event');
    });
});

describe('⚠️ the catalogue is read afresh, not captured', () => {
    it('starts working when one arrives after the editor is already open', () => {
        // A product fetches its catalogue over HTTP. Capturing it by value would mean an editor opened
        // before the response landed never completes anything until it is rebuilt.
        let catalogue: CompletionCatalogue | null = null;

        const document = `${OPEN}@`;
        const state = EditorState.create({ doc: document, extensions: [jmsSyntax()] });
        const source = catalogueCompletionSource({
            catalogue: () => catalogue, rules: JMS_COMPLETION_RULES,
        });

        expect(source(new CompletionContext(state, document.length, false))).toBeNull();

        catalogue = CATALOGUE;

        expect(source(new CompletionContext(state, document.length, false))?.options.length).toBe(2);
    });
});

import type { ComponentType } from 'react';
import type { Extension }     from '@codemirror/state';
import type { Options }       from 'react-markdown';
import type { MarkdownBlock, SyntaxClaim } from './parse';
import type { EditorTrigger, ToolbarAction } from './toolbarModel';

/**
 * What one capability contributes to the Markdown stack.
 *
 * <p>Everything the engine can do beyond plain CommonMark arrives through this interface, and nothing
 * arrives any other way: there is no flag to enable diagrams, no boolean for maths, no `if (isJme)`
 * anywhere in the core. A capability is an object you construct with its own configuration and hand to
 * the renderer or the editor:
 *
 * ```ts
 * const plugins = [
 *     gfmPlugin(),
 *     mathPlugin(),
 *     mermaidPlugin(),
 *     jmePlugin({ execute: (request) => http.post('/api/jme/execute', request) }),
 * ];
 * ```
 *
 * <p>A plugin may fill any subset of the slots below, and the slots are orthogonal on purpose — the
 * jMouse-EL plugin claims a fence, renders it, contributes a toolbar button *and* a CodeMirror grammar,
 * while the maths plugin only extends the prose pipeline. Neither knows the other exists.
 *
 * @typeParam TContext ambient information the host passes down on every render — Innoventa passes the
 *                     surface a document is being read on. A plugin that needs none leaves it `unknown`
 *                     and composes with any host.
 */
export interface MarkdownPlugin<TContext = unknown> {
    /** Unique, and the key its resolved data is filed under. */
    readonly name: string;

    /** The `:::name` / `;;;name` constructs this plugin owns. Unclaimed syntax stays prose. */
    readonly claims?: readonly SyntaxClaim[];

    /** Renders any block matching one of {@link claims}. */
    readonly renderBlock?: ComponentType<BlockRenderProperties<TContext>>;

    /**
     * Resolves every claimed block in the document in one batch, keyed by {@link blockKey}.
     *
     * <p>A hook rather than a promise, so a plugin brings its own fetching — React Query, SWR, a raw
     * `fetch` — and the core needs no data layer at all. It is called once per render with the whole
     * claimed set, which is what keeps a page of twenty `:::stock` lines to a single round trip.
     *
     * <p>Must return a stable object while nothing changes; the result feeds a context.
     */
    useBlockData?(blocks: readonly MarkdownBlock[], context: TContext): BlockDataState;

    /** Extends the CommonMark pipeline itself — remark/rehype plugins and element overrides. */
    readonly prose?: ProseContribution;

    /**
     * Resolves whatever this plugin recognises in the document's **prose**, in one batch.
     *
     * <p>{@link useBlockData}'s counterpart for everything that is not a block. A `TES-42` in the middle
     * of a sentence, a `[label](issue:9f3a21)` link, an `@mention` — none of those are claimed
     * constructs, which is exactly what makes them worth having, and until this existed a plugin that
     * wanted to resolve one had nowhere to put a fetch. {@link ProseContribution}'s four slots are all
     * pure functions, so the batching ended up in the *host* instead: a provider around the renderer,
     * scanning the same document a second time, written once per product.
     *
     * <p>Called once per render with the **whole document source** — including the parts inside claimed
     * blocks. ⚠️ That is deliberate: deciding which text is prose means parsing it here as well, and the
     * cost of the two views disagreeing is one wasted lookup nobody sees, where the cost of agreeing is
     * a second parse on every keystroke.
     *
     * <p>Must return a stable object while nothing changes; the result feeds a context, read back with
     * `useProseDataFor(pluginName)`. The keys in {@link BlockDataState.byKey} are the plugin's own
     * business — nothing in the core constructs or interprets them.
     */
    useProseData?(markdown: string, context: TContext): BlockDataState;

    /** Toolbar buttons this plugin offers. Where they sit is the host's layout decision. */
    readonly actions?: readonly ToolbarAction[];

    /** Typed prefixes that open one of this plugin's dialogs. */
    readonly triggers?: readonly EditorTrigger[];

    /** CodeMirror extensions for the source editor — grammars, keymaps, decorations. */
    readonly editorExtensions?: readonly Extension[];

    /** The same, where they depend on live state (a theme store, a preference). */
    useEditorExtensions?(): readonly Extension[];
}

export type BlockDataStatus =
    /** Resolved, or nothing to resolve. */
    | 'ready'
    /** In flight. */
    | 'loading'
    /** This surface resolves nothing — show the block's own "not available here" state. */
    | 'unavailable';

export interface BlockDataState {
    /** Resolved payloads by {@link blockKey}; a claimed block missing from it simply has no data. */
    readonly byKey:  ReadonlyMap<string, unknown>;
    readonly status: BlockDataStatus;
}

export const EMPTY_BLOCK_DATA: BlockDataState = { byKey: new Map(), status: 'ready' };

export interface BlockRenderProperties<TContext = unknown> {
    readonly block:   MarkdownBlock;
    /** Whatever this plugin's {@link MarkdownPlugin.useBlockData} filed under this block's key. */
    readonly data:    unknown;
    readonly status:  BlockDataStatus;
    readonly context: TContext;
}

export interface ProseContribution {
    readonly remarkPlugins?: Options['remarkPlugins'];
    readonly rehypePlugins?: Options['rehypePlugins'];
    /** Element overrides merged across plugins; two plugins claiming one element is a conflict. */
    readonly components?:    Options['components'];
    /**
     * Link schemes this plugin's own destinations use — `['issue']` for `[label](issue:9f3a21)`.
     * Without the colon.
     *
     * <p>⚠️ **A destination whose scheme is not declared anywhere is ERASED before any override sees
     * it.** `react-markdown` rewrites an unknown protocol to the empty string, which is what stops
     * `[click me](javascript:…)` in a document anybody can write — a default worth keeping. But it
     * cannot tell a plugin's private scheme from an attack, so a plugin inventing one has to say so
     * here or its `a` override will test `startsWith('issue:')` against `''` and correctly conclude the
     * link is not its own. The symptom is an ordinary underlined link, a badge that never appears, and
     * nothing at all in the console.
     */
    readonly urlSchemes?:    readonly string[];
    /** A source pre-pass, applied before parsing (image size hints, custom shorthand). */
    readonly transform?:     (markdown: string) => string;
}

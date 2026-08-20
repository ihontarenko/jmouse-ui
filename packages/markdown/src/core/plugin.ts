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
    /** A source pre-pass, applied before parsing (image size hints, custom shorthand). */
    readonly transform?:     (markdown: string) => string;
}

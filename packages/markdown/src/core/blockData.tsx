import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { BlockDataState, MarkdownPlugin } from './plugin';
import { EMPTY_BLOCK_DATA } from './plugin';
import type { MarkdownBlock } from './parse';
import { claimKey } from './parse';

/**
 * Runs each data-bearing plugin's resolution hook and publishes the results to the block renderers.
 *
 * <p>One provider per plugin, nested — not a loop calling hooks, which the rules of hooks would make a
 * trap the first time a plugin list changed shape. Each provider owns exactly one hook call, so a
 * plugin can fetch however it likes and React still sees a fixed call order per component.
 */

const BlockDataContext = createContext<ReadonlyMap<string, BlockDataState>>(new Map());

/** The resolution state of the plugin that owns a block; `ready` with no data where none resolves. */
export function useBlockDataFor(pluginName: string | undefined): BlockDataState {
    const byPlugin = useContext(BlockDataContext);
    if (pluginName === undefined) {
        return EMPTY_BLOCK_DATA;
    }
    return byPlugin.get(pluginName) ?? EMPTY_BLOCK_DATA;
}

interface ScopeProperties<TContext> {
    readonly plugins:  readonly MarkdownPlugin<TContext>[];
    readonly blocks:   readonly MarkdownBlock[];
    readonly context:  TContext;
    readonly children: ReactNode;
}

/** Wraps `children` in one {@link PluginBlockData} per plugin that resolves anything. */
export function BlockDataScope<TContext>({ plugins, blocks, context, children }: ScopeProperties<TContext>) {
    return plugins.reduceRight<ReactNode>(
        (inner, plugin) => (
            <PluginBlockData key={plugin.name} plugin={plugin} blocks={blocks} context={context}>
                {inner}
            </PluginBlockData>
        ),
        children,
    );
}

function PluginBlockData<TContext>({ plugin, blocks, context, children }: {
    readonly plugin:   MarkdownPlugin<TContext>;
    readonly blocks:   readonly MarkdownBlock[];
    readonly context:  TContext;
    readonly children: ReactNode;
}) {
    const parent = useContext(BlockDataContext);
    const owned  = useOwnedBlocks(plugin, blocks);
    // Mounted only for plugins that have one — see `PluginRegistry.dataPlugins`.
    const state  = plugin.useBlockData!(owned, context);

    const value = useMemo(() => {
        const merged = new Map(parent);
        merged.set(plugin.name, state);
        return merged;
    }, [parent, plugin.name, state]);

    return <BlockDataContext.Provider value={value}>{children}</BlockDataContext.Provider>;
}

/** The subset of the document's blocks this plugin claims — it should never see anybody else's. */
function useOwnedBlocks<TContext>(plugin: MarkdownPlugin<TContext>, blocks: readonly MarkdownBlock[]) {
    const claimed = useMemo(
        () => new Set((plugin.claims ?? []).map((claim) => claimKey(claim.shape, claim.name))),
        [plugin.claims],
    );
    return useMemo(
        () => blocks.filter((block) => claimed.has(claimKey(block.shape, block.name))),
        [blocks, claimed],
    );
}

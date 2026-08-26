import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { BlockDataState, MarkdownPlugin } from './plugin';
import { EMPTY_BLOCK_DATA } from './plugin';

/**
 * Runs each plugin's prose-resolution hook and publishes the results to its element overrides.
 *
 * <p>{@link ./blockData} for prose: same shape, same nesting, and for the same reason — one provider
 * per plugin rather than a loop calling hooks, so a plugin list that changes shape cannot change hook
 * order underneath React.
 *
 * <p>⚠️ <strong>What reads it is an element override, not a block renderer.</strong> A block knows
 * which plugin owns it, because the registry says so; a `<a>` in the middle of a paragraph does not, so
 * the override names its own plugin when it asks. That is why {@link useProseDataFor} takes a name
 * rather than inferring one.
 */

const ProseDataContext = createContext<ReadonlyMap<string, BlockDataState>>(new Map());

/**
 * What the named plugin resolved from this document.
 *
 * <p>⚠️ <strong>`ready` with nothing in it outside a scope</strong>, never a throw. A plugin's `prose`
 * contribution is also used under a bare `ProseRenderer`, where no scope is mounted — and the right
 * behaviour there is the same one the whole library rests on: the construct quietly degrades to what it
 * was written as, rather than taking the page down with it.
 */
export function useProseDataFor(pluginName: string | undefined): BlockDataState {
    const byPlugin = useContext(ProseDataContext);
    if (pluginName === undefined) {
        return EMPTY_BLOCK_DATA;
    }
    return byPlugin.get(pluginName) ?? EMPTY_BLOCK_DATA;
}

interface ScopeProperties<TContext> {
    readonly plugins:  readonly MarkdownPlugin<TContext>[];
    readonly markdown: string;
    readonly context:  TContext;
    readonly children: ReactNode;
}

/** Wraps `children` in one {@link PluginProseData} per plugin that resolves anything from prose. */
export function ProseDataScope<TContext>({ plugins, markdown, context, children }: ScopeProperties<TContext>) {
    return plugins.reduceRight<ReactNode>(
        (inner, plugin) => (
            <PluginProseData key={plugin.name} plugin={plugin} markdown={markdown} context={context}>
                {inner}
            </PluginProseData>
        ),
        children,
    );
}

function PluginProseData<TContext>({ plugin, markdown, context, children }: {
    readonly plugin:   MarkdownPlugin<TContext>;
    readonly markdown: string;
    readonly context:  TContext;
    readonly children: ReactNode;
}) {
    const parent = useContext(ProseDataContext);
    // Mounted only for plugins that have one — see `PluginRegistry.proseDataPlugins`.
    const state  = plugin.useProseData!(markdown, context);

    const value = useMemo(() => {
        const merged = new Map(parent);
        merged.set(plugin.name, state);
        return merged;
    }, [parent, plugin.name, state]);

    return <ProseDataContext.Provider value={value}>{children}</ProseDataContext.Provider>;
}

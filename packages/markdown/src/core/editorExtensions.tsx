import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Extension } from '@codemirror/state';
import type { MarkdownPlugin } from './plugin';

/**
 * Collects the CodeMirror extensions plugins contribute, including the ones that depend on live state
 * (a theme store, a user preference) and therefore have to come from a hook.
 *
 * <p>Same shape as {@link ./blockData}, and for the same reason: one provider per contributing plugin
 * rather than a loop of hook calls. The source editor reads the accumulated list from context, so it
 * never imports a single plugin itself.
 */

const ExtensionContext = createContext<readonly Extension[]>([]);

export function useEditorExtensions(): readonly Extension[] {
    return useContext(ExtensionContext);
}

interface ScopeProperties<TContext> {
    /** Only those with a `useEditorExtensions` hook — see `PluginRegistry.extensionPlugins`. */
    readonly plugins:  readonly MarkdownPlugin<TContext>[];
    /** The statically-declared extensions, which need no hook and seed the list. */
    readonly base:     readonly Extension[];
    readonly children: ReactNode;
}

export function EditorExtensionScope<TContext>({ plugins, base, children }: ScopeProperties<TContext>) {
    return (
        <ExtensionContext.Provider value={base}>
            {plugins.reduceRight<ReactNode>(
                (inner, plugin) => (
                    <PluginExtensions key={plugin.name} plugin={plugin}>{inner}</PluginExtensions>
                ),
                children,
            )}
        </ExtensionContext.Provider>
    );
}

function PluginExtensions<TContext>({ plugin, children }: {
    readonly plugin:   MarkdownPlugin<TContext>;
    readonly children: ReactNode;
}) {
    const inherited = useContext(ExtensionContext);
    const own       = plugin.useEditorExtensions!();
    const value     = useMemo(() => [...inherited, ...own], [inherited, own]);

    return <ExtensionContext.Provider value={value}>{children}</ExtensionContext.Provider>;
}

import type { ComponentType } from 'react';
import type { Extension }     from '@codemirror/state';
import type { Options }       from 'react-markdown';
import type { BlockRenderProperties, MarkdownPlugin, ProseContribution } from './plugin';
import type { MarkdownBlock } from './parse';
import { claimKey }           from './parse';
import type { EditorTrigger, ToolbarAction } from './toolbarModel';

/**
 * The flattened view of a plugin list: who claims what, who renders it, which buttons exist, and the
 * merged prose pipeline. Built once per plugin list and read by both the renderer and the editor, so
 * the two can never disagree about what the document means.
 */
export interface PluginRegistry<TContext = unknown> {
    readonly plugins:      readonly MarkdownPlugin<TContext>[];
    /** Every `shape:name` some plugin claims — what the parser matches against. */
    readonly claimed:      ReadonlySet<string>;
    readonly actions:      ReadonlyMap<string, ToolbarAction>;
    readonly triggers:     readonly EditorTrigger[];
    readonly prose:        Required<Pick<ProseContribution, 'remarkPlugins' | 'rehypePlugins'>> & {
        readonly components: NonNullable<Options['components']>;
        readonly transform:  (markdown: string) => string;
        /** Every scheme some plugin owns — what survives the URL sanitiser. Lowercased. */
        readonly urlSchemes: readonly string[];
    };
    readonly staticExtensions: readonly Extension[];
    /** Plugins that resolve data for their blocks — mounted as one provider each, in list order. */
    readonly dataPlugins:      readonly MarkdownPlugin<TContext>[];
    /** Plugins that resolve data from prose — likewise, and independently. */
    readonly proseDataPlugins: readonly MarkdownPlugin<TContext>[];
    /** Plugins whose extensions depend on live state — likewise. */
    readonly extensionPlugins: readonly MarkdownPlugin<TContext>[];
    /** The plugin that owns a block, and the component that draws it. */
    rendererFor(block: MarkdownBlock): BlockRenderer<TContext> | undefined;
}

export interface BlockRenderer<TContext> {
    readonly pluginName: string;
    readonly component:  ComponentType<BlockRenderProperties<TContext>>;
}

export function buildRegistry<TContext>(plugins: readonly MarkdownPlugin<TContext>[]): PluginRegistry<TContext> {
    const claimed   = new Set<string>();
    const renderers = new Map<string, BlockRenderer<TContext>>();
    const actions   = new Map<string, ToolbarAction>();
    const triggers: EditorTrigger[] = [];

    const remarkPlugins: NonNullable<Options['remarkPlugins']> = [];
    const rehypePlugins: NonNullable<Options['rehypePlugins']> = [];
    const components:    Record<string, unknown>               = {};
    const transforms:    ((markdown: string) => string)[]      = [];
    const staticExtensions: Extension[] = [];
    const urlSchemes = new Set<string>();

    for (const plugin of plugins) {
        for (const claim of plugin.claims ?? []) {
            const key = claimKey(claim.shape, claim.name);
            if (claimed.has(key)) {
                throw new Error(`Markdown plugin "${plugin.name}" claims "${key}", already taken.`);
            }
            claimed.add(key);
            if (plugin.renderBlock) {
                renderers.set(key, { pluginName: plugin.name, component: plugin.renderBlock });
            }
        }

        for (const action of plugin.actions ?? []) {
            if (actions.has(action.id)) {
                throw new Error(`Markdown plugin "${plugin.name}" defines action "${action.id}" twice.`);
            }
            actions.set(action.id, action);
        }

        triggers.push(...(plugin.triggers ?? []));
        remarkPlugins.push(...(plugin.prose?.remarkPlugins ?? []));
        rehypePlugins.push(...(plugin.prose?.rehypePlugins ?? []));
        Object.assign(components, plugin.prose?.components ?? {});
        // Lowercased on the way in: a browser reads `Issue:` and `issue:` as one protocol, and a set
        // that told them apart would make the same document render two ways.
        for (const scheme of plugin.prose?.urlSchemes ?? []) {
            urlSchemes.add(scheme.toLowerCase());
        }
        if (plugin.prose?.transform) {
            transforms.push(plugin.prose.transform);
        }
        staticExtensions.push(...(plugin.editorExtensions ?? []));
    }

    const transform = (markdown: string) =>
        transforms.reduce((current, apply) => apply(current), markdown);

    return {
        plugins,
        claimed,
        actions,
        triggers,
        prose:            { remarkPlugins, rehypePlugins, components, transform, urlSchemes: [...urlSchemes] },
        staticExtensions,
        dataPlugins:      plugins.filter((plugin) => plugin.useBlockData !== undefined),
        proseDataPlugins: plugins.filter((plugin) => plugin.useProseData !== undefined),
        extensionPlugins: plugins.filter((plugin) => plugin.useEditorExtensions !== undefined),
        rendererFor:      (block) => renderers.get(claimKey(block.shape, block.name)),
    };
}

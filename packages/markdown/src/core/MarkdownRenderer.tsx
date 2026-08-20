import { useMemo } from 'react';
import type { PluginRegistry } from './registry';
import { buildRegistry } from './registry';
import type { MarkdownPlugin } from './plugin';
import type { MarkdownBlock, MarkdownSegment } from './parse';
import { blockKey, collectBlocks, parseMarkdown } from './parse';
import { BlockDataScope, useBlockDataFor } from './blockData';
import { ProseRenderer } from './ProseRenderer';

interface MarkdownRendererProperties<TContext> {
    readonly markdown:   string;
    readonly plugins:    readonly MarkdownPlugin<TContext>[];
    /** Ambient information every plugin receives — the host decides what it means. */
    readonly context:    TContext;
    readonly className?: string;
}

/**
 * Renders a Markdown document: prose runs through the composed CommonMark pipeline, and each claimed
 * `:::` / `;;;` block through the plugin that owns it.
 *
 * <p>Nothing here knows what any block *is*. It parses against the claimed names, lets each
 * data-bearing plugin resolve its own blocks in one batch, and dispatches. Add a plugin and a new
 * construct starts rendering; remove one and its syntax quietly reverts to prose.
 *
 * <p>The plugin list must be stable across renders — build it once at module scope, or memoise it.
 */
export function MarkdownRenderer<TContext>({
    markdown, plugins, context, className,
}: MarkdownRendererProperties<TContext>) {
    const registry = useMemo(() => buildRegistry(plugins), [plugins]);
    const segments = useMemo(() => parseMarkdown(markdown ?? '', registry.claimed), [markdown, registry]);
    const blocks   = useMemo(() => collectBlocks(segments), [segments]);

    return (
        <BlockDataScope plugins={registry.dataPlugins} blocks={blocks} context={context}>
            <div className={className}>
                {segments.map((segment, index) => (
                    <Segment key={index} segment={segment} registry={registry} context={context}/>
                ))}
            </div>
        </BlockDataScope>
    );
}

function Segment<TContext>({ segment, registry, context }: {
    readonly segment:  MarkdownSegment;
    readonly registry: PluginRegistry<TContext>;
    readonly context:  TContext;
}) {
    if (segment.kind === 'prose') {
        return <ProseRenderer markdown={segment.content} registry={registry}/>;
    }
    return <Block block={segment.block} registry={registry} context={context}/>;
}

function Block<TContext>({ block, registry, context }: {
    readonly block:    MarkdownBlock;
    readonly registry: PluginRegistry<TContext>;
    readonly context:  TContext;
}) {
    const renderer = registry.rendererFor(block);
    const data     = useBlockDataFor(renderer?.pluginName);

    // A name can be claimed without a renderer (a plugin that only teaches the parser about a
    // construct). Nothing to draw is the right answer, not a warning box.
    if (!renderer) {
        return null;
    }

    const Component = renderer.component;
    return <Component block={block} data={data.byKey.get(blockKey(block))} status={data.status} context={context}/>;
}

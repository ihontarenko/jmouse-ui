import ReactMarkdown from 'react-markdown';
import type { PluginRegistry } from './registry';

/**
 * Renders a run of plain Markdown through the pipeline the registered plugins compose: their remark
 * and rehype plugins, their element overrides, and their source pre-passes, in registration order.
 *
 * <p>The core brings no Markdown extensions of its own — a stack with no plugins renders CommonMark
 * and nothing else, which is the honest baseline. Tables, maths, highlighted code and image sizing are
 * all plugin contributions in this codebase.
 */
export function ProseRenderer<TContext>({ markdown, registry }: {
    readonly markdown: string;
    readonly registry: PluginRegistry<TContext>;
}) {
    return (
        <ReactMarkdown
            remarkPlugins={registry.prose.remarkPlugins}
            rehypePlugins={registry.prose.rehypePlugins}
            components={registry.prose.components}
        >
            {registry.prose.transform(markdown)}
        </ReactMarkdown>
    );
}

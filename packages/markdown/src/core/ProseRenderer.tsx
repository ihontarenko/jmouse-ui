import { useMemo } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
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
    const urlTransform = useUrlTransform(registry.prose.urlSchemes);

    return (
        <ReactMarkdown
            remarkPlugins={registry.prose.remarkPlugins}
            rehypePlugins={registry.prose.rehypePlugins}
            components={registry.prose.components}
            urlTransform={urlTransform}
        >
            {registry.prose.transform(markdown)}
        </ReactMarkdown>
    );
}

/**
 * Sanitises link destinations, letting through the schemes plugins declared.
 *
 * <h2>⚠️ Why this is not simply the default</h2>
 *
 * <p>`react-markdown` rewrites any destination whose protocol is not `http`, `https`, `mailto`, `xmpp`
 * or `irc` to the **empty string** — which is what stops `[click me](javascript:…)` in a document
 * anybody can write, and is worth keeping exactly as it is.
 *
 * <p>But it cannot tell a plugin's private scheme from an attack. So `[label](issue:9f3a21)` was erased
 * one step before the plugin's own `a` override ran, and that override then tested
 * `startsWith('issue:')` against `''` and correctly decided the link was not its own. A written
 * reference drew as an ordinary underlined link, a badge never appeared, and nothing was logged
 * anywhere.
 *
 * <h2>⚠️ Declared, never guessed</h2>
 *
 * <p>What gets through is exactly the set of schemes some installed plugin named in
 * `prose.urlSchemes`. A stack with no such plugin behaves precisely as before, and no document can
 * widen the set — only a plugin the host chose to install can.
 */
function useUrlTransform(schemes: readonly string[]) {
    return useMemo(() => {
        if (schemes.length === 0) {
            return defaultUrlTransform;
        }

        // Matched on the scheme alone and anchored at the start, so a `https://example.com/issue:4` is
        // still sanitised as the ordinary URL it is rather than claimed by a plugin.
        const claimed = new RegExp(`^(?:${schemes.join('|')}):`, 'i');

        return (url: string) => (claimed.test(url) ? url : defaultUrlTransform(url));
    }, [schemes]);
}

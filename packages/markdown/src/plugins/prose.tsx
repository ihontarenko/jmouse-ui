import remarkGfm   from 'remark-gfm';
import remarkMath  from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { MarkdownPlugin } from '../core';
import { CodeBlock } from './CodeBlock';
import type { Highlighter } from './CodeBlock';
import s from './prose.module.css';

/**
 * Plugins that extend CommonMark itself rather than adding a block construct. Each is one capability
 * with one reason to be left out, so a comment box can take {@link gfmPlugin} alone while a
 * documentation page takes the lot.
 */

/** Tables, strikethrough, task lists and autolinks — plus a wide table scrolling inside its own box. */
export function gfmPlugin(): MarkdownPlugin<unknown> {
    return {
        name:  'gfm',
        prose: {
            remarkPlugins: [remarkGfm],
            components: {
                table: ({ node: _node, ...properties }) => (
                    <div className={s.tableScroll}><table {...properties}/></div>
                ),
            },
        },
    };
}

/** `$inline$` and `$$display$$` formulas, typeset offline by KaTeX. */
export function mathPlugin(): MarkdownPlugin<unknown> {
    return {
        name:  'math',
        prose: { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] },
    };
}

/** Links open in a new tab, and never hand the opener over. */
export function externalLinkPlugin(): MarkdownPlugin<unknown> {
    return {
        name:  'external-links',
        prose: {
            components: {
                a: ({ node: _node, ...properties }) => (
                    <a {...properties} target="_blank" rel="noopener noreferrer"/>
                ),
            },
        },
    };
}

export interface CodeHighlightOptions {
    /** Produces highlighted HTML for a language, or null to leave the block plain. */
    readonly highlight: Highlighter;
}

/**
 * Fenced code, highlighted by whatever the host already uses.
 *
 * <p>The highlighter is injected rather than bundled: a product that highlights its editor with
 * CodeMirror grammars wants its rendered snippets to look identical, and one that ships Shiki or
 * Prism wants those. Without the option, code renders plain — which is a legitimate choice, not a
 * degraded one.
 */
export function codeHighlightPlugin(options: CodeHighlightOptions): MarkdownPlugin<unknown> {
    return {
        name:  'code-highlight',
        prose: {
            components: {
                // A fenced block carries a `language-x` class. Inline code and language-less fences
                // have none and stay plain `<code>`.
                code: ({ node: _node, className, children, ...properties }) => {
                    const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
                    if (!language) {
                        return <code className={className} {...properties}>{children}</code>;
                    }
                    return (
                        <CodeBlock
                            language={language}
                            code={String(children).replace(/\n$/, '')}
                            highlight={options.highlight}
                        />
                    );
                },
            },
        },
    };
}

export interface ImagePluginOptions {
    /**
     * Wraps an image in a link — a lightbox, a branded viewer, a download page. Return null to leave
     * it bare. Innoventa uses it to open its own files full-size; another host may not need it.
     */
    readonly linkify?: (source: string | undefined) => string | null;
}

/**
 * `![alt](url 320x240)` and `![alt](url 50%)` size hints.
 *
 * <p>An unquoted title is not valid CommonMark, so the hint is promoted into a quoted title on the way
 * in and read back off it by the renderer — which keeps the sugar entirely inside this plugin.
 */
export function imagePlugin(options: ImagePluginOptions = {}): MarkdownPlugin<unknown> {
    return {
        name:  'images',
        prose: {
            transform: promoteImageSizes,
            components: {
                img: ({ node: _node, src, alt, title }) => {
                    const size  = parseImageSize(title);
                    const image = <img src={src} alt={alt} style={size ?? undefined}/>;
                    const href  = options.linkify?.(src) ?? null;
                    return href
                        ? <a href={href} target="_blank" rel="noopener noreferrer">{image}</a>
                        : image;
                },
            },
        },
    };
}

function promoteImageSizes(markdown: string): string {
    return markdown.replace(/(!\[[^\]]*\]\([^\s)]+)\s+(\d+x\d+|\d+%)\)/g, '$1 "$2")');
}

/** A `320x240` / `50%` image title as a CSS size, or null when the title is a real caption. */
export function parseImageSize(title?: string): { width: string; height?: string } | null {
    const hint       = title?.trim() ?? '';
    const dimensions = /^(\d+)x(\d+)$/.exec(hint);
    if (dimensions) {
        return { width: `${dimensions[1]}px`, height: `${dimensions[2]}px` };
    }
    const percent = /^(\d+)%$/.exec(hint);
    if (percent) {
        return { width: `${percent[1]}%` };
    }
    return null;
}

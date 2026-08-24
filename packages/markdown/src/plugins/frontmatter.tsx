import type { ComponentType } from 'react';
import type { MarkdownPlugin, ProseContribution } from '../core';
import { FrontmatterCard, toFrontmatterView } from './frontmatter/FrontmatterCard';
import type { FrontmatterRenderProperties } from './frontmatter/FrontmatterCard';
import { createRemarkFrontmatter, FRONTMATTER_ELEMENT, FRONTMATTER_PROPERTY } from './frontmatter/remark';
import type { YamlMapping } from './frontmatter/yaml';

/**
 * The `---` delimited YAML block a generated document opens with, rendered as what it is.
 *
 * <p>Without this plugin such a document is not merely unstyled — it is actively misread. CommonMark
 * makes the opening `---` a thematic break, the metadata lines a paragraph, and the closing `---`
 * directly beneath them a setext underline, so `name:` and `description:` render as the page's largest
 * heading. Every skill file and every agent memory in this workspace begins that way.
 *
 * ```ts
 * frontmatterPlugin()                                     // the card
 * frontmatterPlugin({ mode: 'strip' })                     // parse it away, draw nothing
 * frontmatterPlugin({ render: MyOwnHeader })               // the same view model, another face
 * frontmatterPlugin({ titleKeys: ['slug'] })               // another vocabulary
 * ```
 *
 * <p>⚠️ **Position zero is the whole definition.** A `---` fence further down a document is a thematic
 * break, and a ` ```yaml ` fence is quoted code that belongs to the highlighter. A plugin that claimed
 * every YAML block it met would eat both.
 *
 * <p>⚠️ **The parsed mapping is worth more than the card**, and `parseFrontmatter` is exported beside
 * this so a host can have it without rendering anything: `name` and `description` are what a page
 * title, a browser tab or a search snippet wants, and re-typing them beside the document is how the two
 * drift apart.
 */

/** Where the card's heading comes from, first match winning. */
export const DEFAULT_TITLE_KEYS: readonly string[] = ['name', 'title'];

/** Where the card's lead sentence comes from, first match winning. */
export const DEFAULT_DESCRIPTION_KEYS: readonly string[] = ['description', 'summary'];

export interface FrontmatterPluginOptions {
    /** Unique among the installed plugins; defaults to `frontmatter`. */
    readonly name?: string;
    /** `card` draws it, `strip` removes it and draws nothing. Default `card`. */
    readonly mode?: 'card' | 'strip';
    readonly titleKeys?: readonly string[];
    readonly descriptionKeys?: readonly string[];
    /** A face of the host's own, given the same view model the default card receives. */
    readonly render?: ComponentType<FrontmatterRenderProperties>;
}

export function frontmatterPlugin(options: FrontmatterPluginOptions = {}): MarkdownPlugin<unknown> {
    const {
        name            = 'frontmatter',
        mode            = 'card',
        titleKeys       = DEFAULT_TITLE_KEYS,
        descriptionKeys = DEFAULT_DESCRIPTION_KEYS,
        render: Render  = FrontmatterCard,
    } = options;

    const strip = mode === 'strip';

    // The mapping travels from the remark pass to here as JSON on the carrier element, which keeps the
    // whole plugin stateless: two documents rendering at once cannot read each other's metadata, and a
    // re-render needs nothing kept between them.
    const Carrier = (properties: Record<string, unknown>) => {
        const encoded = properties[FRONTMATTER_PROPERTY];
        const data    = typeof encoded === 'string' ? readMapping(encoded) : null;

        if (!data) {
            return null;
        }

        return <Render {...toFrontmatterView(data, titleKeys, descriptionKeys)}/>;
    };

    return {
        name,
        prose: {
            remarkPlugins: [createRemarkFrontmatter(strip)],
            // ⚠️ The cast is the element name, not the component: `components` is typed to the HTML
            // elements react-markdown knows, and this one is deliberately a name none of them can
            // collide with. Everything inside it is checked.
            components: strip
                ? undefined
                : { [FRONTMATTER_ELEMENT]: Carrier } as ProseContribution['components'],
        },
    };
}

function readMapping(encoded: string): YamlMapping | null {
    try {
        const value = JSON.parse(encoded) as unknown;
        return typeof value === 'object' && value !== null && !Array.isArray(value)
            ? value as YamlMapping
            : null;
    } catch {
        return null;
    }
}

export { parseFrontmatter } from './frontmatter/parseFrontmatter';
export { FrontmatterCard, toFrontmatterView } from './frontmatter/FrontmatterCard';
export type { Frontmatter } from './frontmatter/parseFrontmatter';
export type { FrontmatterField, FrontmatterRenderProperties } from './frontmatter/FrontmatterCard';
export type { YamlMapping, YamlScalar, YamlValue } from './frontmatter/yaml';

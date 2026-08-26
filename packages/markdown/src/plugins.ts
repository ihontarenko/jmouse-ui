/**
 * `@jmouse/markdown/plugins` — everything the engine can be taught, minus the two constructs that
 * cost a consumer a dependency (`@jmouse/markdown/jme`, `@jmouse/markdown/wavedrom`).
 *
 * <p>Every one is a factory: you build it with its configuration and hand it in. A plugin you do not
 * construct is a construct nobody claims, and unclaimed syntax stays prose.
 *
 * <p>The root entry point re-exports all of this, so `@jmouse/markdown` is the equivalent import and
 * the one most hosts want. The subpath exists so a plugin list can be written where it is read —
 * `import { calloutPlugin, mermaidPlugin } from '@jmouse/markdown/plugins'` next to the engine import
 * says which half of the package a file is using.
 */

// ── Prose ────────────────────────────────────────────────────────────────────────
export {
    codeHighlightPlugin, externalLinkPlugin, gfmPlugin, imagePlugin, mathPlugin, parseImageSize,
}                                                                             from './plugins/prose';
export type { CodeHighlightOptions, ImagePluginOptions as ImageProseOptions } from './plugins/prose';
export { CodeBlock }                                                          from './plugins/CodeBlock';
export type { Highlighter }                                                   from './plugins/CodeBlock';

export { frontmatterPlugin, parseFrontmatter, FrontmatterCard, toFrontmatterView, DEFAULT_TITLE_KEYS, DEFAULT_DESCRIPTION_KEYS }
                                                               from './plugins/frontmatter';
export type {
    Frontmatter, FrontmatterField, FrontmatterPluginOptions, FrontmatterRenderProperties, YamlMapping,
    YamlScalar, YamlValue,
}                                                              from './plugins/frontmatter';

// ── Blocks ───────────────────────────────────────────────────────────────────────
export { calloutPlugin, youtubePlugin, DEFAULT_CALLOUT_KINDS } from './plugins/callouts';
export type { CalloutKind }                                    from './plugins/callouts';
export { Callout, CALLOUT_ICONS }                              from './plugins/Callout';
export type { CalloutProperties, CalloutStyle }                from './plugins/Callout';
export { BlockNotice }                                         from './plugins/BlockNotice';
export { mermaidPlugin }                                       from './plugins/diagrams';
export { dataBlockPlugin, promiseLoader }                      from './plugins/dataBlocks';
export { referencePlugin, ReferenceBadge, referenceKey }       from './plugins/references';
export type {
    ReferenceAutolink, ReferencePluginOptions, ReferenceRenderProperties, ReferenceState, ReferenceToken,
} from './plugins/references';
export type {
    DataBlockLoad, DataBlockLoader, DataBlockPluginOptions, DataBlockRenderProperties, DataBlockRequest,
    DataBlockResult,
}                                                              from './plugins/dataBlocks';

// ── Authoring ────────────────────────────────────────────────────────────────────
export { blockPickerPlugin, snippetPickerPlugin }                         from './plugins/pickers';
export type {
    BlockDescriptor, BlockPickerOptions, SnippetPickerOptions, SnippetTemplate,
}                                                                         from './plugins/pickers';
export { dialogActionPlugin, imageInsertPlugin, linkPlugin, tablePlugin } from './plugins/inserts';
export type { ImagePluginOptions, LinkPluginOptions }                     from './plugins/inserts';

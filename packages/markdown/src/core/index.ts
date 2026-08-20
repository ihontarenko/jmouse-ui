/**
 * A plugin-driven Markdown renderer and editor.
 *
 * <p>The core knows CommonMark, two block shapes (`:::name argument` and `;;;name … ;;;`) and nothing
 * else. Diagrams, maths, live data, syntax highlighting, applets and every toolbar button arrive as
 * {@link MarkdownPlugin}s the host constructs and passes in, so the same two components serve a
 * documentation page, a comment box and a field's help text — and drop into another product unchanged.
 *
 * <p>Its only dependencies are React, CodeMirror 6 and react-markdown. Nothing here imports a domain
 * type, an API client, a store or a route.
 */

export { MarkdownRenderer }   from './MarkdownRenderer';
export { MarkdownEditor, PREVIEW_TOGGLE_ACTION } from './MarkdownEditor';
export type { PreviewOptions } from './MarkdownEditor';
export { CodeSurface }        from './CodeSurface';
export { ProseRenderer }      from './ProseRenderer';
export { Toolbar }            from './Toolbar';

export { buildRegistry }      from './registry';
export type { PluginRegistry } from './registry';

export { parseMarkdown, collectBlocks, blockKey, claimKey } from './parse';
export type { BlockShape, MarkdownBlock, MarkdownSegment, SyntaxClaim } from './parse';

export { EMPTY_BLOCK_DATA }   from './plugin';
export type {
    BlockDataState, BlockDataStatus, BlockRenderProperties, MarkdownPlugin, ProseContribution,
} from './plugin';

export { FORMAT_ACTIONS, FORMAT_ACTION_IDS } from './formatActions';
export { TOOLBAR_SEPARATOR, TOOLBAR_SPACER, rowToggle, normalizeRow } from './toolbarModel';
export type {
    EditorHandle, EditorRange, EditorTrigger, InsertOptions, ToolbarAction, ToolbarActionReference,
    ToolbarDialogProperties, ToolbarLayout, ToolbarRow,
} from './toolbarModel';

export { useBlockDataFor }    from './blockData';
export { useEditorExtensions } from './editorExtensions';
export { useAsyncResource }   from './useAsyncResource';
export type { AsyncResource } from './useAsyncResource';

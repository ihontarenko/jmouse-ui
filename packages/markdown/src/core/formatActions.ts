import type { ToolbarAction } from './toolbarModel';

/**
 * The CommonMark formatting actions — the one set of buttons that needs no plugin, because it needs no
 * knowledge beyond "this is Markdown". Everything here is a pure text operation on the selection.
 *
 * <p>Registered by the editor itself, so a host can name any of them in its layout without importing
 * anything. Ids are stable and listed in {@link FORMAT_ACTION_IDS}.
 */

export const FORMAT_ACTIONS: readonly ToolbarAction[] = [
    { id: 'bold',       label: 'B',       title: 'Bold',           mono: true, run: (editor) => editor.wrap('**', '**', 'bold text') },
    { id: 'italic',     label: 'I',       title: 'Italic',         mono: true, run: (editor) => editor.wrap('*', '*', 'italic') },
    { id: 'strike',     label: 'S',       title: 'Strikethrough',  mono: true, run: (editor) => editor.wrap('~~', '~~', 'struck') },
    { id: 'code',       label: '</>',     title: 'Inline code',    mono: true, run: (editor) => editor.wrap('`', '`', 'code') },
    { id: 'heading-1',  label: 'H1',      title: 'Heading 1',      mono: true, run: (editor) => editor.prefixLines('# ') },
    { id: 'heading-2',  label: 'H2',      title: 'Heading 2',      mono: true, run: (editor) => editor.prefixLines('## ') },
    { id: 'heading-3',  label: 'H3',      title: 'Heading 3',      mono: true, run: (editor) => editor.prefixLines('### ') },
    { id: 'list',       label: '• List',  title: 'Bullet list',    mono: true, run: (editor) => editor.prefixLines('- ') },
    { id: 'ordered',    label: '1. List', title: 'Numbered list',  mono: true, run: (editor) => editor.prefixLines('1. ') },
    { id: 'quote',      label: '❝ Quote', title: 'Blockquote',     mono: true, run: (editor) => editor.prefixLines('> ') },
    { id: 'inline-link',label: '🔗 Link', title: 'Link',           mono: true, run: (editor) => editor.wrap('[', '](https://)', 'text') },
    { id: 'code-block', label: '{} Block',title: 'Code block',     mono: true, run: (editor) => editor.wrap('```\n', '\n```', 'code') },
];

export const FORMAT_ACTION_IDS: readonly string[] = FORMAT_ACTIONS.map((action) => action.id);

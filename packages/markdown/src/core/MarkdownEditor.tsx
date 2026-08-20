import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { MarkdownPlugin } from './plugin';
import { buildRegistry } from './registry';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeSurface } from './CodeSurface';
import { EditorExtensionScope } from './editorExtensions';
import { Toolbar } from './Toolbar';
import { FORMAT_ACTIONS } from './formatActions';
import type {
    EditorHandle, EditorRange, InsertOptions, ToolbarAction, ToolbarLayout,
} from './toolbarModel';
import { normalizeRow } from './toolbarModel';
import s from './editor.module.css';

/** The id of the built-in preview switch, registered only when {@link preview} is configured. */
export const PREVIEW_TOGGLE_ACTION = 'preview.toggle';

export interface PreviewOptions {
    /** Defaults to this editor's own plugins and context — override to theme it or restyle it. */
    readonly render?:           (markdown: string) => ReactNode;
    readonly className?:        string;
    readonly initiallyVisible?: boolean;
}

interface MarkdownEditorProperties<TContext> {
    readonly value:        string;
    readonly onChange:     (value: string) => void;
    readonly plugins:      readonly MarkdownPlugin<TContext>[];
    readonly context:      TContext;
    /** Rows of action ids. Omit for a bare editor with no toolbar at all. */
    readonly toolbar?:     ToolbarLayout;
    readonly preview?:     PreviewOptions;
    readonly placeholder?: string;
    readonly className?:   string;
    readonly readOnly?:    boolean;
}

/**
 * A Markdown editor assembled entirely from what it is given: the plugins decide what the document can
 * contain, the layout decides what the toolbar offers, and this shell owns only the three pieces of
 * state that are genuinely its own — which dialog is open, which collapsible rows are expanded, and
 * whether the preview is showing.
 *
 * ```tsx
 * <MarkdownEditor
 *     value={content}
 *     onChange={setContent}
 *     plugins={INNOVENTA_MARKDOWN_PLUGINS}
 *     context={{ surface: APP_SURFACE }}
 *     toolbar={[
 *         ['link', 'image', 'live-block', 'jme', TOOLBAR_SPACER, PREVIEW_TOGGLE_ACTION, 'help'],
 *         { id: 'format', hidden: true, actions: FORMAT_ACTION_IDS },
 *     ]}
 *     preview={{ className: proseClass }}
 * />
 * ```
 *
 * <p>There is no capability flag anywhere in it. Dropping this into another product means passing a
 * different plugin list — not editing this file.
 *
 * <p>The plugin list must be stable across renders; build it at module scope or memoise it.
 */
export function MarkdownEditor<TContext>({
    value, onChange, plugins, context, toolbar, preview, placeholder, className, readOnly = false,
}: MarkdownEditorProperties<TContext>) {
    const editorReference = useRef<EditorHandle>(null);
    const registry        = useMemo(() => buildRegistry(plugins), [plugins]);

    const rows = useMemo(() => (toolbar ?? []).map(normalizeRow), [toolbar]);
    const [openRows, setOpenRows] = useState<ReadonlySet<string>>(
        () => new Set(rows.filter((row) => row.id !== undefined && !row.hidden).map((row) => row.id!)),
    );
    const [previewVisible, setPreviewVisible] = useState(preview?.initiallyVisible ?? true);
    const [dialog, setDialog] = useState<{ action: ToolbarAction; range?: EditorRange } | null>(null);

    const actions = useMemo(() => {
        const merged = new Map<string, ToolbarAction>(registry.actions);
        for (const action of FORMAT_ACTIONS) {
            merged.set(action.id, action);
        }
        if (preview) {
            merged.set(PREVIEW_TOGGLE_ACTION, {
                id:    PREVIEW_TOGGLE_ACTION,
                label: previewVisible ? '◧ Editor only' : '◨ Show preview',
                title: previewVisible ? 'Hide the live preview' : 'Show the live preview',
            });
        }
        return merged;
    }, [registry, preview, previewVisible]);

    function invoke(action: ToolbarAction) {
        if (action.id === PREVIEW_TOGGLE_ACTION) {
            setPreviewVisible((visible) => !visible);
            return;
        }
        if (action.toggles !== undefined) {
            setOpenRows((current) => toggled(current, action.toggles!));
            return;
        }
        if (action.dialog) {
            setDialog({ action });
            return;
        }
        if (editorReference.current) {
            action.run?.(editorReference.current);
        }
    }

    /** Watches what is typed for a plugin's trigger prefix — `:::` opening the block picker. */
    function handleChange(next: string, caret: number) {
        onChange(next);

        const lineStart = next.lastIndexOf('\n', caret - 1) + 1;
        const typed     = next.slice(lineStart, caret);

        for (const trigger of registry.triggers) {
            const match  = trigger.pattern.exec(typed);
            const action = match ? registry.actions.get(trigger.action) : undefined;
            if (match && action?.dialog) {
                setDialog({ action, range: { from: caret - match[0].length, to: caret } });
                return;
            }
        }
    }

    function insertFromDialog(snippet: string, options?: InsertOptions) {
        editorReference.current?.insert(snippet, { ...options, range: options?.range ?? dialog?.range });
        setDialog(null);
    }

    const Dialog     = dialog?.action.dialog;
    const renderPreview = preview?.render
        ?? ((markdown: string) => (
            <MarkdownRenderer markdown={markdown} plugins={plugins} context={context} className={preview?.className}/>
        ));

    return (
        <EditorExtensionScope plugins={registry.extensionPlugins} base={registry.staticExtensions}>
            <div className={[s.editor, className].filter(Boolean).join(' ')}>
                {rows.length > 0 && (
                    <Toolbar rows={rows} actions={actions} openRows={openRows} onInvoke={invoke}/>
                )}

                <div className={`${s.split}${preview && previewVisible ? '' : ` ${s.splitSolo}`}`}>
                    <CodeSurface
                        ref={editorReference}
                        value={value}
                        onChange={handleChange}
                        placeholder={placeholder}
                        readOnly={readOnly}
                        className={s.source}
                    />
                    {preview && previewVisible && renderPreview(value)}
                </div>

                {Dialog && editorReference.current && (
                    <Dialog
                        editor={editorReference.current}
                        insert={insertFromDialog}
                        close={() => setDialog(null)}
                    />
                )}
            </div>
        </EditorExtensionScope>
    );
}

function toggled(current: ReadonlySet<string>, rowId: string): ReadonlySet<string> {
    const next = new Set(current);
    if (!next.delete(rowId)) {
        next.add(rowId);
    }
    return next;
}

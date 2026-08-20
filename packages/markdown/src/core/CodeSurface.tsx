import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import type { EditorHandle } from './toolbarModel';
import { useEditorExtensions } from './editorExtensions';
import s from './editor.module.css';

interface CodeSurfaceProperties {
    readonly value:        string;
    /** Receives the new document and the caret offset after the edit — what typing triggers read. */
    readonly onChange:     (value: string, caret: number) => void;
    readonly placeholder?: string;
    readonly className?:   string;
    readonly readOnly?:    boolean;
}

/**
 * The Markdown source editor: CodeMirror 6, with every language, grammar, keymap and decoration coming
 * from the plugins in scope (see {@link ./editorExtensions}) rather than from imports here. On its own
 * it edits plain text with line wrapping — which is exactly what a stack with no plugins should do.
 *
 * <p>A controlled component: `value` is the single source of truth and edits flow back through
 * `onChange`. {@link EditorHandle} is the whole imperative surface toolbars and dialogs get.
 */
export const CodeSurface = forwardRef<EditorHandle, CodeSurfaceProperties>(
    ({ value, onChange, placeholder, className, readOnly = false }, reference) => {
        const viewReference = useRef<ReactCodeMirrorRef>(null);
        const pluginExtensions = useEditorExtensions();

        const extensions = useMemo(
            () => [...pluginExtensions, EditorView.lineWrapping],
            [pluginExtensions],
        );

        useImperativeHandle(reference, () => new CodeMirrorHandle(viewReference, value), [value]);

        return (
            <CodeMirror
                ref={viewReference}
                className={[s.surface, className].filter(Boolean).join(' ')}
                value={value}
                placeholder={placeholder}
                editable={!readOnly}
                theme="none"
                basicSetup={{
                    lineNumbers:               false,
                    foldGutter:                false,
                    highlightActiveLine:       false,
                    highlightActiveLineGutter: false,
                    autocompletion:            false,
                    bracketMatching:           true,
                }}
                extensions={extensions}
                onChange={(next, update) => onChange(next, update.state.selection.main.head)}
            />
        );
    },
);
CodeSurface.displayName = 'CodeSurface';

/**
 * {@link EditorHandle} over a CodeMirror view. A class rather than an object literal so each operation
 * reads as one method against one guarded view, instead of six closures repeating the same null check.
 */
class CodeMirrorHandle implements EditorHandle {

    // ⚠️ Fields and assignments rather than constructor parameter properties. A parameter property is
    // TypeScript that emits code, so a consumer compiling with `erasableSyntaxOnly` fails on TS1294 —
    // and it fails the build rather than the dev server, which is how a bare editor once shipped
    // unnoticed. The library has no say in a consumer's compiler options, so it stays erasable.
    private readonly reference: { current: ReactCodeMirrorRef | null };
    private readonly fallback:  string;

    constructor(reference: { current: ReactCodeMirrorRef | null }, fallback: string) {
        this.reference = reference;
        this.fallback  = fallback;
    }

    private get view() {
        return this.reference.current?.view ?? null;
    }

    insert(snippet: string, options?: { ownLine?: boolean; range?: { from: number; to: number } }): void {
        const view = this.view;
        if (!view) {
            return;
        }

        const range = options?.range;
        const from  = range?.from ?? view.state.selection.main.from;
        const to    = range?.to   ?? view.state.selection.main.to;

        // A block construct only resolves on a line of its own, so guarantee one. Replacing an
        // explicit range never needs this — the range is the prefix the author already typed.
        const text = options?.ownLine && !range
            ? `${startsLine(view, from) ? '' : '\n'}${snippet}\n`
            : snippet;

        view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
        view.focus();
    }

    getCursor(): number {
        return this.view?.state.selection.main.head ?? this.fallback.length;
    }

    getValue(): string {
        return this.view?.state.doc.toString() ?? this.fallback;
    }

    focus(): void {
        this.view?.focus();
    }

    wrap(before: string, after: string, placeholder = ''): void {
        const view = this.view;
        if (!view) {
            return;
        }
        const { from, to } = view.state.selection.main;
        const selected     = view.state.sliceDoc(from, to);
        const body         = selected || placeholder;

        view.dispatch({
            changes: { from, to, insert: before + body + after },
            // With a real selection, place the caret after the wrapped text; with none, select the
            // inserted placeholder so the author can just type over it.
            selection: selected
                ? { anchor: from + before.length + body.length + after.length }
                : { anchor: from + before.length, head: from + before.length + body.length },
        });
        view.focus();
    }

    prefixLines(prefix: string): void {
        const view = this.view;
        if (!view) {
            return;
        }
        const { from, to } = view.state.selection.main;
        const firstLine    = view.state.doc.lineAt(from).number;
        const lastLine     = view.state.doc.lineAt(to).number;
        const changes      = [];

        for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
            const line = view.state.doc.line(lineNumber);
            changes.push(line.text.startsWith(prefix)
                ? { from: line.from, to: line.from + prefix.length, insert: '' }
                : { from: line.from, insert: prefix });
        }

        view.dispatch({ changes });
        view.focus();
    }
}

function startsLine(view: EditorView, position: number): boolean {
    return position === view.state.doc.lineAt(position).from;
}

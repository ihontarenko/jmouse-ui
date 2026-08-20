import type { ComponentType } from 'react';

/**
 * The toolbar model: an *action* is a named thing the editor can do, and a *layout* is rows of action
 * names. The two are deliberately separate — a plugin contributes actions without knowing where they
 * will sit, and the host arranges rows without knowing how any action works:
 *
 * ```ts
 * toolbar={[
 *     ['link', 'image', 'live-block', 'jme', TOOLBAR_SPACER, 'help'],
 *     { id: 'format', hidden: true, actions: FORMAT_ACTION_IDS },
 * ]}
 * ```
 *
 * A row may also carry an inline {@link ToolbarAction} where naming one would be ceremony.
 */

export interface EditorRange {
    readonly from: number;
    readonly to:   number;
}

export interface InsertOptions {
    /** Put the snippet on a line of its own — what every block construct needs to resolve. */
    readonly ownLine?: boolean;
    /** Replace this range instead of inserting at the caret (used by typing triggers). */
    readonly range?:   EditorRange;
}

/** What an action may do to the document. The editor's imperative surface, and the whole of it. */
export interface EditorHandle {
    insert(snippet: string, options?: InsertOptions): void;
    getCursor(): number;
    getValue(): string;
    focus(): void;
    /** Wrap the selection in `before`/`after`; with no selection, insert `placeholder` and select it. */
    wrap(before: string, after: string, placeholder?: string): void;
    /** Toggle a line prefix (e.g. `## `, `- `, `> `) on every line the selection touches. */
    prefixLines(prefix: string): void;
}

export interface ToolbarDialogProperties {
    readonly editor: EditorHandle;
    /** Insert and close, in one call — what a dialog's confirm button wants. */
    readonly insert: (snippet: string, options?: InsertOptions) => void;
    readonly close:  () => void;
}

export interface ToolbarAction {
    readonly id:     string;
    readonly label:  string;
    readonly title?: string;
    /** An immediate edit. */
    readonly run?:   (editor: EditorHandle) => void;
    /** Or a dialog that composes the insertion. Mutually exclusive with {@link run}. */
    readonly dialog?: ComponentType<ToolbarDialogProperties>;
    /** Or a switch over a collapsible row — see {@link rowToggle}. */
    readonly toggles?: string;
    /** Rendered in the mono face; suits the terse format buttons (`B`, `H1`, `1. List`). */
    readonly mono?:  boolean;
}

/** A visual divider between groups of buttons. */
export const TOOLBAR_SEPARATOR = '|';

/** Pushes everything after it to the far end of the row. */
export const TOOLBAR_SPACER = '>>';

export type ToolbarActionReference = string | ToolbarAction;

export interface ToolbarRow {
    /** Required for a collapsible row — it is what {@link rowToggle} names. */
    readonly id?:      string;
    /** Starts collapsed; only meaningful with an {@link id} and a toggle pointing at it. */
    readonly hidden?:  boolean;
    readonly actions:  readonly ToolbarActionReference[];
}

export type ToolbarLayout = readonly (ToolbarRow | readonly ToolbarActionReference[])[];

/** A button that shows or hides a collapsible row. */
export function rowToggle(rowId: string, label: string, title?: string): ToolbarAction {
    return { id: `toggle:${rowId}`, label, title, toggles: rowId };
}

export function normalizeRow(row: ToolbarRow | readonly ToolbarActionReference[]): ToolbarRow {
    return Array.isArray(row) ? { actions: row } : (row as ToolbarRow);
}

/**
 * A trigger turns something the author *types* into a dialog — `:::` opening the block picker being
 * the one everybody expects. The matched text is handed to the dialog as a range, so what it inserts
 * replaces the prefix rather than stacking a second one after it.
 */
export interface EditorTrigger {
    /** Matched against the current line up to the caret. */
    readonly pattern: RegExp;
    /** The id of the action whose dialog opens. */
    readonly action:  string;
}

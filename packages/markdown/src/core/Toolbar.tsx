import type { FC } from 'react';
import type { ToolbarAction, ToolbarActionReference, ToolbarRow } from './toolbarModel';
import { TOOLBAR_SEPARATOR, TOOLBAR_SPACER } from './toolbarModel';
import s from './editor.module.css';

interface ToolbarProperties {
    readonly rows:      readonly ToolbarRow[];
    /** Every registered action, by id — plugin-contributed, built-in formatting and shell controls. */
    readonly actions:   ReadonlyMap<string, ToolbarAction>;
    /** Ids of rows currently expanded; a row with no id is always shown. */
    readonly openRows:  ReadonlySet<string>;
    readonly onInvoke:  (action: ToolbarAction) => void;
}

/**
 * Draws the toolbar rows. It resolves names to actions and nothing else — it neither knows what any
 * button does nor holds any state, so a host can rearrange rows, drop buttons or add its own without
 * touching this file.
 *
 * <p>A name with no registered action is skipped silently. That is deliberate: a layout naming
 * `'jme'` should degrade to a toolbar without that button when the plugin is not installed, not to a
 * crash — the same layout then works across products with different plugin sets.
 */
export const Toolbar: FC<ToolbarProperties> = ({ rows, actions, openRows, onInvoke }) => (
    <>
        {rows.map((row, index) => {
            if (row.id !== undefined && !openRows.has(row.id)) {
                return null;
            }
            return (
                <div key={row.id ?? index} className={index === 0 ? s.toolbar : s.toolbarRow}>
                    {row.actions.map((reference, position) => (
                        <ToolbarItem
                            key={itemKey(reference, position)}
                            reference={reference}
                            actions={actions}
                            active={isActive(reference, actions, openRows)}
                            onInvoke={onInvoke}
                        />
                    ))}
                </div>
            );
        })}
    </>
);

const ToolbarItem: FC<{
    reference: ToolbarActionReference;
    actions:   ReadonlyMap<string, ToolbarAction>;
    active:    boolean;
    onInvoke:  (action: ToolbarAction) => void;
}> = ({ reference, actions, active, onInvoke }) => {
    if (reference === TOOLBAR_SPACER) {
        return <span className={s.spacer}/>;
    }
    if (reference === TOOLBAR_SEPARATOR) {
        return <span className={s.separator} aria-hidden="true"/>;
    }

    const action = typeof reference === 'string' ? actions.get(reference) : reference;
    if (!action) {
        return null;
    }

    return (
        <button
            type="button"
            className={`${action.mono ? s.formatButton : s.toolButton}${active ? ` ${s.toolButtonActive}` : ''}`}
            title={action.title ?? action.label}
            onClick={() => onInvoke(action)}
        >
            {action.label}
        </button>
    );
};

function isActive(
    reference: ToolbarActionReference,
    actions:   ReadonlyMap<string, ToolbarAction>,
    openRows:  ReadonlySet<string>,
): boolean {
    const action = typeof reference === 'string' ? actions.get(reference) : reference;
    return action?.toggles !== undefined && openRows.has(action.toggles);
}

function itemKey(reference: ToolbarActionReference, position: number): string {
    return typeof reference === 'string' ? `${reference}-${position}` : `${reference.id}-${position}`;
}

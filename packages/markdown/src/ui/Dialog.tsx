import type { ReactNode } from 'react';
import { useMarkdownUi } from './kit';
import s from './dialogs.module.css';

/**
 * The frame every dialog in this library uses: the host's modal, with a body that spaces its own
 * children.
 *
 * <p>Spacing between a dialog's controls belongs to the dialog, not to the host's modal — a modal
 * that added gaps would break every other use of it in the application, and a dialog that relied on
 * one would lay out differently in every product. So the rhythm lives here, once, and the host keeps
 * supplying only the chrome.
 */
export function Dialog({ title, width, onClose, footer, tabBar, children }: {
    readonly title:    string;
    readonly width?:   number;
    readonly onClose:  () => void;
    readonly footer?:  ReactNode;
    readonly tabBar?:  ReactNode;
    readonly children: ReactNode;
}) {
    const { Modal } = useMarkdownUi();

    return (
        <Modal title={title} width={width} onClose={onClose} footer={footer} tabBar={tabBar}>
            <div className={s.body}>{children}</div>
        </Modal>
    );
}

/** A group of controls that belong together inside a dialog — spaced tighter than the body's rows. */
export function DialogGroup({ children }: { children: ReactNode }) {
    return <div className={s.group}>{children}</div>;
}

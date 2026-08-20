import { createContext, useContext } from 'react';
import type { ComponentType, ReactNode } from 'react';

/**
 * The handful of widgets the library's own dialogs need, supplied by the host.
 *
 * <p>The library draws documents, not chrome. Every modal it ships — the block palette, the link
 * dialog, the resource picker — is built out of these, so it inherits the host application's buttons,
 * inputs and modal behaviour instead of shipping a second design system that slowly drifts from the
 * first. A product binds it once:
 *
 * ```tsx
 * <MarkdownUiProvider kit={{ Modal, Button, Input, Select, Textarea, Tabs, Field }}>
 * ```
 *
 * <p>Nothing here is styled by the library. Layout inside a dialog is; appearance is not.
 */

export interface ModalProperties {
    readonly title:     string;
    readonly width?:    number;
    readonly onClose:   () => void;
    /** The action row; rendered at the bottom of the modal. */
    readonly footer?:   ReactNode;
    /** An optional row of tabs directly under the title. */
    readonly tabBar?:   ReactNode;
    readonly children:  ReactNode;
}

export interface ButtonProperties {
    readonly variant?:  'primary' | 'ghost';
    readonly disabled?: boolean;
    readonly onClick:   () => void;
    readonly children:  ReactNode;
    readonly className?: string;
}

export interface InputProperties {
    readonly value:        string;
    readonly onChange:     (value: string) => void;
    readonly placeholder?: string;
    readonly type?:        'text' | 'number';
    readonly autoFocus?:   boolean;
    readonly spellCheck?:  boolean;
    readonly ariaLabel?:   string;
    readonly className?:   string;
}

export interface SelectOption {
    readonly value: string;
    readonly label: string;
}

export interface SelectProperties {
    readonly value:    string;
    readonly onChange: (value: string) => void;
    readonly options:  readonly SelectOption[];
}

export interface TextareaProperties {
    readonly value:        string;
    readonly onChange:     (value: string) => void;
    readonly rows?:        number;
    readonly placeholder?: string;
    readonly spellCheck?:  boolean;
}

export interface TabsProperties {
    readonly value:    string;
    readonly onChange: (value: string) => void;
    readonly tabs:     readonly SelectOption[];
}

/** A labelled row: the label, an optional muted hint beside it, and the control underneath. */
export interface FieldProperties {
    readonly label:    string;
    readonly hint?:    string;
    readonly children: ReactNode;
}

export interface MarkdownUiKit {
    readonly Modal:    ComponentType<ModalProperties>;
    readonly Button:   ComponentType<ButtonProperties>;
    readonly Input:    ComponentType<InputProperties>;
    readonly Select:   ComponentType<SelectProperties>;
    readonly Textarea: ComponentType<TextareaProperties>;
    readonly Tabs:     ComponentType<TabsProperties>;
    readonly Field:    ComponentType<FieldProperties>;
}

const MarkdownUiContext = createContext<MarkdownUiKit | null>(null);

export function MarkdownUiProvider({ kit, children }: { kit: MarkdownUiKit; children: ReactNode }) {
    return <MarkdownUiContext.Provider value={kit}>{children}</MarkdownUiContext.Provider>;
}

/**
 * The bound kit. Throws rather than degrading: a dialog with no modal to open is a blank screen and a
 * bug report, whereas this message names the missing provider.
 */
export function useMarkdownUi(): MarkdownUiKit {
    const kit = useContext(MarkdownUiContext);
    if (!kit) {
        throw new Error('Markdown dialogs need a <MarkdownUiProvider kit={…}> above them.');
    }
    return kit;
}

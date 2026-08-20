import { useState } from 'react';
import type { MarkdownPlugin, ToolbarDialogProperties } from '../core';
import { useMarkdownUi } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import s from '../ui/dialogs.module.css';

/**
 * Authoring palettes — plugins that contribute a way to *write* a construct without owning one.
 *
 * <p>Separate from the plugins that render those constructs, on purpose. A palette spans several of
 * them (the block picker lists callouts, embeds and live data side by side), and a read-only stack
 * wants every renderer and no palette at all. Coupling the two would force each renderer to know which
 * other renderers exist.
 */

export interface BlockDescriptor {
    /** The directive name — what `:::` is followed by. */
    readonly name:    string;
    readonly label:   string;
    /** What the argument means, shown beside its input. */
    readonly hint:    string;
    readonly example: string;
}

export interface BlockPickerOptions {
    readonly id?:     string;
    readonly label?:  string;
    readonly title?:  string;
    /** What the palette offers — normally assembled from the installed plugins by the host. */
    readonly blocks:  readonly BlockDescriptor[];
    /**
     * Typed on an otherwise empty line, this opens the palette and is replaced by what it inserts.
     * Omit for a toolbar-only palette.
     */
    readonly trigger?: RegExp;
}

/** The `:::` palette: choose a block, fill its one argument, get it on a line of its own. */
export function blockPickerPlugin(options: BlockPickerOptions): MarkdownPlugin<unknown> {
    const { id = 'block-picker', label = '⧉ Live block', title = 'Insert a live block', blocks, trigger } = options;

    return {
        name:     'block-picker',
        triggers: trigger ? [{ pattern: trigger, action: id }] : undefined,
        actions:  [{
            id,
            label,
            title,
            dialog: ({ insert, close }) => (
                <BlockPickerDialog title={title} blocks={blocks} insert={insert} close={close}/>
            ),
        }],
    };
}

function BlockPickerDialog({ title, blocks, insert, close }: {
    title:  string;
    blocks: readonly BlockDescriptor[];
} & Pick<ToolbarDialogProperties, 'insert' | 'close'>) {
    const { Button, Input, Field } = useMarkdownUi();
    const [name, setName]         = useState(blocks[0]?.name ?? '');
    const [argument, setArgument] = useState('');

    const active = blocks.find((block) => block.name === name) ?? blocks[0];
    if (!active) {
        return null;
    }

    const directive = `:::${active.name}${argument.trim() ? ` ${argument.trim()}` : ''}`;

    return (
        <Dialog
            title={title}
            width={480}
            onClose={close}
            footer={<>
                <Button variant="ghost" onClick={close}>Cancel</Button>
                <Button variant="primary" onClick={() => insert(directive, { ownLine: true })}>Insert</Button>
            </>}
        >
            <div className={s.optionList}>
                {blocks.map((block) => (
                    <button
                        key={block.name}
                        type="button"
                        className={`${s.option}${block.name === name ? ` ${s.optionActive}` : ''}`}
                        onClick={() => setName(block.name)}
                    >
                        <code className={s.optionName}>:::{block.name}</code>
                        <span className={s.optionLabel}>{block.label}</span>
                    </button>
                ))}
            </div>

            <Field label="Argument" hint={active.hint}>
                <Input value={argument} autoFocus placeholder={active.example} onChange={setArgument}/>
            </Field>

            <div className={s.preview}>
                :::{active.name} {argument.trim() || active.example}
            </div>
        </Dialog>
    );
}

export interface SnippetTemplate {
    readonly key:      string;
    readonly label:    string;
    readonly hint:     string;
    /** Whether the snippet lands on its own lines or inline at the cursor. */
    readonly ownLine:  boolean;
    readonly template: string;
}

export interface SnippetPickerOptions {
    readonly id:        string;
    readonly label:     string;
    readonly title:     string;
    readonly templates: readonly SnippetTemplate[];
}

/** A palette of ready-made snippets — diagram scaffolds, formula skeletons, anything template-shaped. */
export function snippetPickerPlugin(options: SnippetPickerOptions): MarkdownPlugin<unknown> {
    const { id, label, title, templates } = options;

    return {
        name:    `snippet-picker:${id}`,
        actions: [{
            id,
            label,
            title,
            dialog: ({ insert, close }) => (
                <SnippetPickerDialog title={title} templates={templates} insert={insert} close={close}/>
            ),
        }],
    };
}

function SnippetPickerDialog({ title, templates, insert, close }: {
    title:     string;
    templates: readonly SnippetTemplate[];
} & Pick<ToolbarDialogProperties, 'insert' | 'close'>) {
    const { Button } = useMarkdownUi();
    const [key, setKey] = useState(templates[0]?.key ?? '');

    const active = templates.find((template) => template.key === key) ?? templates[0];
    if (!active) {
        return null;
    }

    return (
        <Dialog
            title={title}
            width={520}
            onClose={close}
            footer={<>
                <Button variant="ghost" onClick={close}>Cancel</Button>
                <Button
                    variant="primary"
                    onClick={() => insert(active.template, { ownLine: active.ownLine })}
                >
                    Insert
                </Button>
            </>}
        >
            <div className={s.optionList}>
                {templates.map((template) => (
                    <button
                        key={template.key}
                        type="button"
                        className={`${s.option}${template.key === key ? ` ${s.optionActive}` : ''}`}
                        onClick={() => setKey(template.key)}
                    >
                        <span className={s.optionLabel}>{template.label}</span>
                        <span className={s.optionHint}>{template.hint}</span>
                    </button>
                ))}
            </div>

            <div className={s.preview}>{active.template}</div>
        </Dialog>
    );
}

import { useState } from 'react';
import type { ComponentType } from 'react';
import type { MarkdownPlugin, ToolbarDialogProperties } from '../core';
import { useMarkdownUi } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { ResourcePicker } from '../ui/ResourcePicker';
import type { ResourceItem, ResourceSource } from '../ui/resource';
import s from '../ui/dialogs.module.css';

/**
 * The insertion dialogs the library ships. Each is a plugin, so a host offers exactly the ones it can
 * back — a comment box has no file store to pick images out of and no page index to link into, and
 * should not show buttons that open empty dialogs.
 *
 * <p>Where a dialog reaches outside the document it does so through {@link ResourceSource}s the host
 * supplies. There is no endpoint, payload shape or client anywhere in this file.
 */

export interface LinkPluginOptions {
    readonly id?:      string;
    readonly label?:   string;
    /** Places to link into — pages, documents, anything addressable. The URL tab is always there. */
    readonly sources?: readonly ResourceSource[];
}

/** `[text](url)` — typed by hand, or picked from a source. */
export function linkPlugin(options: LinkPluginOptions = {}): MarkdownPlugin<unknown> {
    const { id = 'link', label = '🔗 Link', sources = [] } = options;
    return {
        name:    `insert:${id}`,
        actions: [{
            id,
            label,
            title:  'Insert a link',
            dialog: ({ insert, close }) => <LinkDialog sources={sources} insert={insert} close={close}/>,
        }],
    };
}

function LinkDialog({ sources, insert, close }: {
    sources: readonly ResourceSource[];
} & Pick<ToolbarDialogProperties, 'insert' | 'close'>) {
    const { Button, Input, Tabs, Field } = useMarkdownUi();
    const [tab, setTab]   = useState(URL_TAB);
    const [text, setText] = useState('');
    const [url, setUrl]   = useState('');

    const source = sources.find((candidate) => candidate.id === tab);

    return (
        <Dialog
            title="Insert link"
            width={sources.length > 0 ? 520 : 440}
            onClose={close}
            tabBar={sources.length > 0 ? <Tabs value={tab} onChange={setTab} tabs={tabsFor(sources)}/> : undefined}
            footer={<>
                <Button variant="ghost" onClick={close}>Cancel</Button>
                {!source && (
                    <Button
                        variant="primary"
                        disabled={url.trim() === ''}
                        onClick={() => insert(`[${text.trim() || url.trim()}](${url.trim()})`)}
                    >
                        Insert
                    </Button>
                )}
            </>}
        >
            <Field label="Text" hint="optional">
                <Input value={text} autoFocus placeholder="Link text" onChange={setText}/>
            </Field>

            {source
                ? <ResourcePicker
                    source={source}
                    onPick={(item) => insert(`[${text.trim() || item.label}](${item.value})`)}
                  />
                : <Field label="URL">
                    <Input value={url} placeholder="https://…" onChange={setUrl}/>
                  </Field>}
        </Dialog>
    );
}

export interface ImagePluginOptions {
    readonly id?:      string;
    readonly label?:   string;
    /** Image stores to pick from. Items may carry a `kind` (a MIME type) and are filtered on it. */
    readonly sources?: readonly ResourceSource[];
}

/** `![alt](url 320x240)` — by URL or picked, with the library's size-hint syntax. */
export function imageInsertPlugin(options: ImagePluginOptions = {}): MarkdownPlugin<unknown> {
    const { id = 'image', label = '🖼 Image', sources = [] } = options;
    return {
        name:    `insert:${id}`,
        actions: [{
            id,
            label,
            title:  'Insert an image',
            dialog: ({ insert, close }) => <ImageDialog sources={sources} insert={insert} close={close}/>,
        }],
    };
}

function ImageDialog({ sources, insert, close }: {
    sources: readonly ResourceSource[];
} & Pick<ToolbarDialogProperties, 'insert' | 'close'>) {
    const { Button, Input, Tabs, Field } = useMarkdownUi();
    const [tab, setTab]   = useState(URL_TAB);
    const [alt, setAlt]   = useState('');
    const [url, setUrl]   = useState('');
    const [size, setSize] = useState('');

    const source = sources.find((candidate) => candidate.id === tab);
    const suffix = size.trim() ? ` ${size.trim()}` : '';

    return (
        <Dialog
            title="Insert image"
            width={520}
            onClose={close}
            tabBar={sources.length > 0 ? <Tabs value={tab} onChange={setTab} tabs={tabsFor(sources)}/> : undefined}
            footer={<>
                <Button variant="ghost" onClick={close}>Cancel</Button>
                {!source && (
                    <Button
                        variant="primary"
                        disabled={url.trim() === ''}
                        onClick={() => insert(`![${alt.trim()}](${url.trim()}${suffix})`)}
                    >
                        Insert
                    </Button>
                )}
            </>}
        >
            {!source && (
                <Field label="Alt text">
                    <Input value={alt} autoFocus placeholder="Describe the image" onChange={setAlt}/>
                </Field>
            )}

            <Field label="Size" hint="optional — e.g. 320x240 or 50%">
                <Input value={size} placeholder="320x240 or 50%" onChange={setSize}/>
            </Field>

            {source
                ? <ResourcePicker
                    source={source}
                    accept={isImage}
                    onPick={(item) => insert(`![${alt.trim() || item.label}](${item.value}${suffix})`)}
                  />
                : <Field label="Image URL">
                    <Input value={url} placeholder="https://…/image.png" onChange={setUrl}/>
                  </Field>}
        </Dialog>
    );
}

/** A GFM table scaffold of the chosen size. */
export function tablePlugin(options: { id?: string; label?: string } = {}): MarkdownPlugin<unknown> {
    const { id = 'table', label = '▦ Table' } = options;
    return {
        name:    `insert:${id}`,
        actions: [{
            id,
            label,
            title:  'Insert a table',
            dialog: ({ insert, close }) => <TableDialog insert={insert} close={close}/>,
        }],
    };
}

function TableDialog({ insert, close }: Pick<ToolbarDialogProperties, 'insert' | 'close'>) {
    const { Button, Input, Field } = useMarkdownUi();
    const [columns, setColumns] = useState('3');
    const [rows, setRows]       = useState('2');

    const table = buildTable(bounded(columns), bounded(rows));

    return (
        <Dialog
            title="Insert table"
            width={440}
            onClose={close}
            footer={<>
                <Button variant="ghost" onClick={close}>Cancel</Button>
                <Button variant="primary" onClick={() => insert(table, { ownLine: true })}>Insert</Button>
            </>}
        >
            <Field label="Columns">
                <Input value={columns} type="number" autoFocus onChange={setColumns}/>
            </Field>
            <Field label="Rows" hint="not counting the header">
                <Input value={rows} type="number" onChange={setRows}/>
            </Field>
            <div className={s.preview}>{table}</div>
        </Dialog>
    );
}

/**
 * One toolbar button over a dialog the host writes. The escape hatch that keeps a product from having
 * to fork the library to add its own insertion — Innoventa's datasheet picker is one of these.
 */
export function dialogActionPlugin(options: {
    id:     string;
    label:  string;
    title:  string;
    dialog: ComponentType<ToolbarDialogProperties>;
}): MarkdownPlugin<unknown> {
    const { id, label, title, dialog } = options;
    return { name: `insert:${id}`, actions: [{ id, label, title, dialog }] };
}

const URL_TAB = 'url';

function tabsFor(sources: readonly ResourceSource[]) {
    return [
        { value: URL_TAB, label: 'From URL' },
        ...sources.map((source) => ({ value: source.id, label: source.label })),
    ];
}

/** A source may or may not report MIME types; an unlabelled item is offered rather than hidden. */
function isImage(item: ResourceItem): boolean {
    return item.kind === undefined || item.kind.startsWith('image/');
}

function bounded(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        return 1;
    }
    return Math.min(Math.max(parsed, 1), 12);
}

function buildTable(columns: number, rows: number): string {
    const header    = `| ${Array.from({ length: columns }, (_cell, index) => `Column ${index + 1}`).join(' | ')} |`;
    const separator = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`;
    const body      = Array.from({ length: rows }, () => `| ${Array.from({ length: columns }, () => ' ').join('| ')}|`);
    return [header, separator, ...body].join('\n');
}

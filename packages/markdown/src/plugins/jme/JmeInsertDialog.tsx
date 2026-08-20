import { useState } from 'react';
import { useMarkdownUi } from '../../ui/kit';
import { Dialog, DialogGroup } from '../../ui/Dialog';
import type { ToolbarDialogProperties } from '../../core';
import type { JmeBinding, JmeInputType } from './parse';
import { buildJmeBlock, JME_ALIAS_PATTERN, JME_INPUT_TYPES } from './parse';
import s from '../../ui/dialogs.module.css';

/**
 * Composes a `;;;jme` block: declare the inputs the reader will fill in, name them for the code, and
 * write the expression that combines them.
 *
 * <p>⚠️ **This dialog used to pick a field from the host.** It offered a {@link ResourceSource} of the
 * product's form fields and wrote the chosen field's id into each binding — which read as though the
 * block were bound to that field, and it never was: the block posts `{ code, variables }` and the
 * evaluator resolves nothing. Now the author declares *what kind of input to draw*, which is the thing
 * the block actually does with the answer, and a block composed here means the same in every product.
 */
export function JmeInsertDialog({ insert, close }: Pick<ToolbarDialogProperties, 'insert' | 'close'>) {
    const { Button, Input, Select, Textarea, Field } = useMarkdownUi();

    const [bindings, setBindings] = useState<readonly JmeBinding[]>([]);
    const [code, setCode]         = useState('');

    const aliases        = bindings.map((binding) => binding.alias);
    const hasDuplicate   = new Set(aliases).size !== aliases.length;
    const hasInvalid     = bindings.some((binding) => !JME_ALIAS_PATTERN.test(binding.alias));
    const hasEmptyChoice = bindings.some(
        (binding) => binding.type === 'select' && binding.options.length === 0);
    const canInsert      = code.trim() !== '' && !hasDuplicate && !hasInvalid && !hasEmptyChoice;

    function addBinding() {
        const taken = new Set(aliases);
        setBindings((current) => [
            ...current,
            { alias: nextAlias(taken), type: 'numeric', title: '', options: [] },
        ]);
    }

    function updateBinding(index: number, patch: Partial<JmeBinding>) {
        setBindings((current) =>
            current.map((binding, position) => (position === index ? { ...binding, ...patch } : binding)));
    }

    function removeBinding(index: number) {
        setBindings((current) => current.filter((_binding, position) => position !== index));
    }

    return (
        <Dialog
            title="Insert applet"
            width={600}
            onClose={close}
            footer={<>
                <Button variant="ghost" onClick={close}>Cancel</Button>
                <Button
                    variant="primary"
                    disabled={!canInsert}
                    onClick={() => insert(buildJmeBlock(bindings, code), { ownLine: true })}
                >
                    Insert
                </Button>
            </>}
        >
            <Field label="Inputs" hint="each becomes a control the reader fills">
                <DialogGroup>
                    {bindings.length > 0 && (
                        <div className={s.bindings}>
                            {bindings.map((binding, index) => (
                                <div key={index} className={s.bindingRow}>
                                    <span className={s.sigil}>$</span>
                                    <Input
                                        className={s.bindingAlias}
                                        value={binding.alias}
                                        ariaLabel="Alias"
                                        spellCheck={false}
                                        onChange={(alias) => updateBinding(index, { alias })}
                                    />
                                    <div className={s.bindingType}>
                                        <Select
                                            value={binding.type}
                                            options={TYPE_OPTIONS}
                                            onChange={(type) => updateBinding(index, {
                                                type:    type as JmeInputType,
                                                // A type that cannot hold options must not keep them:
                                                // `numeric(Low,1)` is a parse error, not a leftover.
                                                options: type === 'select' ? binding.options : [],
                                            })}
                                        />
                                    </div>
                                    <Input
                                        className={s.bindingPlaceholder}
                                        value={binding.title ?? ''}
                                        ariaLabel="Title"
                                        placeholder="title (optional)"
                                        spellCheck={false}
                                        onChange={(title) => updateBinding(index, { title })}
                                    />
                                    <button
                                        type="button"
                                        className={s.remove}
                                        aria-label="Remove"
                                        onClick={() => removeBinding(index)}
                                    >
                                        ✕
                                    </button>

                                    {binding.type === 'select' && (
                                        <div className={s.bindingChoices}>
                                            <Input
                                                value={formatOptions(binding)}
                                                ariaLabel="Choices"
                                                placeholder="Low,1;High,2"
                                                spellCheck={false}
                                                onChange={(source) =>
                                                    updateBinding(index, { options: parseOptionDraft(source) })}
                                            />
                                            <span className={s.bindingMeta}>label,key — separated by “;”</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <Button variant="ghost" onClick={addBinding}>＋ Add input</Button>

                    {hasInvalid && (
                        <div className={s.warning}>
                            An alias must start with a letter or “_” and contain only letters, digits or “_”.
                        </div>
                    )}
                    {hasDuplicate && <div className={s.warning}>Two inputs share an alias — make each unique.</div>}
                    {hasEmptyChoice && <div className={s.warning}>A dropdown needs at least one label,key pair.</div>}
                </DialogGroup>
            </Field>

            <Field label="Expression or template">
                <Textarea
                    rows={4}
                    value={code}
                    spellCheck={false}
                    placeholder={"(I * R) ~ ' V'\n\n— or a template —\nVout: {{ Vin * R2 / (R1 + R2) | double }} V"}
                    onChange={setCode}
                />
            </Field>

            <div className={s.preview}>{buildJmeBlock(bindings, code)}</div>
        </Dialog>
    );
}

const TYPE_LABELS: Record<JmeInputType, string> = {
    numeric: 'Number',
    select:  'Dropdown',
    text:    'Text',
    boolean: 'Yes / no',
    date:    'Date',
};

const TYPE_OPTIONS = JME_INPUT_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] }));

/** `Low,1;High,2` as one editable line — the same text the block itself carries. */
function formatOptions(binding: JmeBinding): string {
    return binding.options.map((option) => `${option.label},${option.key}`).join(';');
}

function parseOptionDraft(source: string) {
    return source
        .split(';')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '')
        .map((entry) => {
            const comma = entry.lastIndexOf(',');
            return comma <= 0
                ? { label: entry, key: entry }
                : { label: entry.slice(0, comma).trim(), key: entry.slice(comma + 1).trim() };
        });
}

/** `value`, `value_2`, `value_3` — a valid, unique identifier with nothing to seed it from. */
function nextAlias(taken: ReadonlySet<string>): string {
    let candidate = 'value';
    let suffix    = 2;
    while (taken.has(candidate)) {
        candidate = `value_${suffix}`;
        suffix += 1;
    }
    return candidate;
}

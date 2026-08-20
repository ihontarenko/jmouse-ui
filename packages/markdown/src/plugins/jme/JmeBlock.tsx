import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import type { JmeBinding, JmeBindingProblem } from './parse';
import {
    bindingLabel, bindingValue, defaultBindingValue, isBindingUnanswered, parseJmeBlock,
} from './parse';
import type { JmeEvaluator, JmeResult } from './evaluator';
import { evaluationMessage } from './evaluator';
import s from './jme.module.css';

/** How one binding's input is drawn. Replace it to render the host's own controls instead. */
export interface JmeInputProperties {
    readonly binding:  JmeBinding;
    readonly value:    string;
    readonly onChange: (value: string) => void;
}

/** How long after the last keystroke before the block re-evaluates. */
const EVALUATE_DEBOUNCE_MS = 500;

/**
 * An applet: one input per bound alias, and a result that recomputes as the reader types.
 *
 * <p>Neither the evaluator nor the inputs are decided here. That is the whole point — the same block
 * renders with plain text boxes against a public endpoint on a shared page, and with the host's own
 * controls against an authenticated one in-app, with no branch anywhere in this file.
 *
 * <p>What each input *is*, though, is decided by the document: a binding declares `numeric`, `select`,
 * `text`, `boolean` or `date`, and that same declaration is what types the value on the way out.
 */
export function JmeBlock({ source, evaluate, Input = TypedInput }: {
    source:   string;
    evaluate: JmeEvaluator;
    Input?:   ComponentType<JmeInputProperties>;
}) {
    const parsed = useMemo(() => parseJmeBlock(source), [source]);

    const [values, setValues]             = useState<Record<string, string>>({});
    const [result, setResult]             = useState<JmeResult | null>(null);
    const [error, setError]               = useState<string | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);

    // Seeded types start answered — see `defaultBindingValue` for why that is correctness rather than
    // politeness. Re-seeded whenever the document changes, because a block can be edited live.
    useEffect(() => {
        setValues((current) => {
            const seeded: Record<string, string> = {};
            for (const binding of parsed.bindings) {
                seeded[binding.alias] = current[binding.alias] ?? defaultBindingValue(binding);
            }
            return seeded;
        });
    }, [parsed]);

    // Every bound input must have a value before we evaluate. Arithmetic against a blank operand
    // fails — that is not a real error, just an unfinished form — so we wait and prompt gently.
    const hasEmptyInput = parsed.bindings.some(
        (binding) => isBindingUnanswered(binding, values[binding.alias] ?? ''));

    // ⚠️ A block whose declaration does not parse evaluates nothing at all — not the surviving half.
    // A result computed from four of five declared inputs is a wrong number wearing a right one's
    // clothes. The inputs that *did* parse are still drawn, though: they are the other half of the
    // error message, showing the author exactly which lines landed.
    const isBroken = parsed.problems.length > 0;

    useEffect(() => {
        if (isBroken || parsed.code === '' || hasEmptyInput) {
            setResult(null);
            setError(null);
            return;
        }

        let cancelled = false;

        const timer = setTimeout(() => {
            const variables: Record<string, unknown> = {};
            for (const binding of parsed.bindings) {
                variables[binding.alias] = bindingValue(binding, values[binding.alias] ?? '');
            }

            setIsEvaluating(true);
            evaluate({ code: parsed.code, variables })
                .then((evaluated) => {
                    if (!cancelled) {
                        setResult(evaluated);
                        setError(null);
                    }
                })
                .catch((evaluateError) => {
                    if (!cancelled) {
                        setError(evaluationMessage(evaluateError));
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setIsEvaluating(false);
                    }
                });
        }, EVALUATE_DEBOUNCE_MS);

        return () => { cancelled = true; clearTimeout(timer); };
    }, [parsed, values, hasEmptyInput, isBroken, evaluate]);

    function updateValue(alias: string, value: string) {
        setValues((current) => ({ ...current, [alias]: value }));
    }

    return (
        <div className={s.block}>
            <div className={s.header}>
                <span className={s.badge}>jme</span>
                {result && <span className={s.mode}>{result.mode}</span>}
                {isEvaluating && <span className={s.spinner} aria-hidden="true"/>}
            </div>

            {isBroken && <Problems problems={parsed.problems}/>}

            {parsed.bindings.length > 0 && (
                <div className={s.inputs}>
                    {parsed.bindings.map((binding) => (
                        <div key={binding.alias} className={s.field}>
                            <span className={s.fieldLabel}>{bindingLabel(binding)}</span>
                            <Input
                                binding={binding}
                                value={values[binding.alias] ?? ''}
                                onChange={(value) => updateValue(binding.alias, value)}
                            />
                        </div>
                    ))}
                </div>
            )}

            {!isBroken && (
                <div className={`${s.output}${error ? ` ${s.outputError}` : ''}`}>
                    <Output result={result} error={error} waiting={hasEmptyInput}/>
                </div>
            )}
        </div>
    );
}

/**
 * Every binding line that did not parse, quoted verbatim with the reason.
 *
 * <p>Verbatim on purpose: the author is looking for this line in a document, and a tidied-up version
 * of it is one they cannot search for.
 */
function Problems({ problems }: { problems: readonly JmeBindingProblem[] }) {
    return (
        <div className={s.problems} role="alert">
            <span className={s.problemsTitle}>
                {problems.length === 1
                    ? 'A binding line does not parse, so nothing is evaluated.'
                    : `${problems.length} binding lines do not parse, so nothing is evaluated.`}
            </span>
            {problems.map((problem) => (
                <div key={problem.line} className={s.problem}>
                    <code className={s.problemLine}>{problem.line}</code>
                    <span className={s.problemReason}>{problem.reason}</span>
                </div>
            ))}
        </div>
    );
}

function Output({ result, error, waiting }: {
    result:  JmeResult | null;
    error:   string | null;
    waiting: boolean;
}) {
    if (waiting) {
        return <span className={s.placeholder}>Enter values to see the result.</span>;
    }
    if (error) {
        return <span className={s.error}>{error}</span>;
    }
    if (!result) {
        return <span className={s.placeholder}>Computing…</span>;
    }
    if (result.mode === 'template') {
        // Template output is author-authored — the page's writer composed the block — so it may be
        // rich HTML, on the same trust model as HTML they write in the page itself.
        return <div className={s.htmlBody} dangerouslySetInnerHTML={{ __html: String(result.result ?? '') }}/>;
    }
    return <span className={s.value}>{formatResult(result.result)}</span>;
}

function formatResult(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    return String(value);
}

/** The input the binding asked for. Five types, one component, no host involvement. */
const TypedInput: ComponentType<JmeInputProperties> = ({ binding, value, onChange }) => {
    if (binding.type === 'select') {
        return (
            <select
                className={s.input}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                {binding.options.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                ))}
            </select>
        );
    }

    if (binding.type === 'boolean') {
        return (
            <label className={s.checkbox}>
                <input
                    type="checkbox"
                    checked={value === 'true'}
                    onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
                />
                <span>{value === 'true' ? 'Yes' : 'No'}</span>
            </label>
        );
    }

    return (
        <input
            className={s.input}
            type={binding.type === 'numeric' ? 'number' : binding.type === 'date' ? 'date' : 'text'}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={binding.type === 'numeric' ? '0' : ''}
            autoComplete="off"
            spellCheck={false}
        />
    );
};

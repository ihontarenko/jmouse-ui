import { useMemo } from 'react';
import type { ComponentType } from 'react';
import type { MarkdownPlugin } from '../../core';
import { JmeBlock } from './JmeBlock';
import type { JmeInputProperties } from './JmeBlock';
import type { JmeEvaluator } from './evaluator';
import { JmeInsertDialog } from './JmeInsertDialog';

export type { JmeInputProperties } from './JmeBlock';
export type { JmeEvaluator, JmeRequest, JmeResult } from './evaluator';
export { fetchEvaluator, EvaluationError, evaluationMessage } from './evaluator';
export type { JmeBinding, JmeBindingProblem, JmeInputType, JmeSelectOption, ParsedJmeBlock } from './parse';
export {
    bindingLabel, bindingValue, buildJmeBlock, coerceJmeValue, defaultBindingValue, isBindingUnanswered,
    JME_ALIAS_PATTERN, JME_INPUT_TYPES, parseJmeBlock,
} from './parse';

export interface JmePluginOptions<TContext> {
    /**
     * The evaluator to use for a given context — the plugin's central piece of configuration.
     *
     * ```ts
     * // pointed at a URL
     * jmePlugin({ evaluator: () => fetchEvaluator('/api/jme/execute') })
     *
     * // or through the host's own client, so it inherits auth and token refresh
     * jmePlugin({ evaluator: (context) => context.signedIn ? privateEvaluator : publicEvaluator })
     * ```
     */
    readonly evaluator: (context: TContext) => JmeEvaluator;

    /**
     * Draws every input instead of the plugin, per context — a **full** override, not a fallback.
     *
     * <p>Rarely wanted now that a binding declares its own type: the shipped inputs already draw a
     * number box, a dropdown, a checkbox and a date picker from the document itself. Reach for this
     * only when a host has controls of its own it would rather show, and remember it then owns all
     * five types.
     */
    readonly resolveInput?: (context: TContext) => ComponentType<JmeInputProperties> | undefined;

    readonly actionId?: string;
    readonly label?:    string;
}

/**
 * `;;;jme … ;;;` — an applet: inputs the reader fills, and a result computed somewhere else.
 *
 * <p>Rendering and evaluation are separated on purpose. This plugin owns the syntax, the layout, the
 * debounce and the empty-input etiquette; where the code runs, what the inputs look like and what may
 * be bound all arrive as configuration. Nothing here names an endpoint, an HTTP client or a field API.
 *
 * <p>The source-editor grammar that highlights the language inside the fence is a separate concern
 * again — contribute it as a plugin with `editorExtensions`.
 */
export function jmePlugin<TContext>(options: JmePluginOptions<TContext>): MarkdownPlugin<TContext> {
    const { evaluator, resolveInput, actionId = 'jme', label = '🧮 Applet' } = options;

    return {
        name:   'jme',
        claims: [{ shape: 'fence', name: 'jme' }],

        renderBlock: ({ block, context }) => (
            <ConfiguredJmeBlock
                source={block.body}
                context={context}
                evaluator={evaluator}
                resolveInput={resolveInput}
            />
        ),

        actions: [{
            id:     actionId,
            label,
            title:  'Insert an interactive block',
            dialog: ({ insert, close }) => <JmeInsertDialog insert={insert} close={close}/>,
        }],
    };
}

/**
 * Resolves the context-dependent configuration once per context.
 *
 * <p>Not a nicety: the evaluator is a dependency of the block's debounced effect, so handing it a
 * freshly-built function on every render would re-evaluate on every render. The host must keep its
 * context object stable for this to hold — the same requirement the plugin list already carries.
 */
function ConfiguredJmeBlock<TContext>({ source, context, evaluator, resolveInput }: {
    source:        string;
    context:       TContext;
    evaluator:     (context: TContext) => JmeEvaluator;
    resolveInput?: (context: TContext) => ComponentType<JmeInputProperties> | undefined;
}) {
    const evaluate = useMemo(() => evaluator(context), [evaluator, context]);
    const Input    = useMemo(() => resolveInput?.(context), [resolveInput, context]);

    return <JmeBlock source={source} evaluate={evaluate} Input={Input}/>;
}

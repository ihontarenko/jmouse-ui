/**
 * `@jmouse/markdown/jme` — the applet block: a `;;;jme` fence that draws one input per declared
 * binding and evaluates an expression against what the reader typed.
 *
 * <p>⚠️ **Its own entry point because it needs an endpoint to be useful, not because it belongs to
 * anybody.** The block resolves its bindings against *nothing*: it renders the inputs and posts
 * `{ code, variables }` to whatever `evaluate` function the host handed it. Its entire dependency on a
 * product is one URL — which is why it ships here rather than in the product it was written in.
 *
 * <p>A host without an evaluator simply does not install it, and a `;;;jme` fence in that host is
 * unclaimed syntax, which stays prose.
 *
 * ```ts
 * import { jmePlugin, fetchEvaluator } from '@jmouse/markdown/jme';
 *
 * jmePlugin({ evaluator: () => fetchEvaluator('/api/jme/execute') })
 * ```
 */

export * from './plugins/jme';

/**
 * `@jmouse/markdown` — a plugin-driven Markdown renderer and editor.
 *
 * <p>The engine knows CommonMark, two block shapes (`:::name argument` and `;;;name … ;;;`) and
 * nothing else. Diagrams, maths, live data, applets, syntax highlighting and every toolbar button
 * arrive as plugins the host constructs and passes in — each with its own configuration, so an
 * endpoint, a picker or a renderer is something you *give* the library rather than something it knows.
 *
 * <p>This is the whole package bar two constructs, each of which costs a dependency and therefore
 * lives behind its own specifier:
 *
 * <ul>
 *   <li>`@jmouse/markdown/jme` — the applet block, which needs an evaluator endpoint to mean anything.
 *   <li>`@jmouse/markdown/wavedrom` — timing diagrams, whose renderer pulls `wavedrom` and `json5`.
 * </ul>
 *
 * <p>⚠️ **The stylesheet is not imported for you.** A library that injects its own CSS takes the
 * consumer's cascade order away from it, so import it once, wherever you import your own:
 *
 * ```ts
 * import '@jmouse/markdown/styles.css';
 * ```
 *
 * <p>And every colour in it is a `--markdown-*` custom property the host defines. See `README.md`.
 */

// ── The engine ───────────────────────────────────────────────────────────────────
export * from './core';

// ── Host bindings ────────────────────────────────────────────────────────────────
export { MarkdownUiProvider, useMarkdownUi } from './ui/kit';
export type {
    ButtonProperties, FieldProperties, InputProperties, MarkdownUiKit, ModalProperties,
    SelectOption, SelectProperties, TabsProperties, TextareaProperties,
}                                            from './ui/kit';

export { Dialog, DialogGroup }                                                       from './ui/Dialog';
export { httpResource, matchesQuery }                                                from './ui/resource';
export type { HttpResourceOptions, ResourceItem, ResourceSource, ResourceTransport } from './ui/resource';
export { ResourcePicker }                                                            from './ui/ResourcePicker';

// ── The shipped plugins ──────────────────────────────────────────────────────────
export * from './plugins';

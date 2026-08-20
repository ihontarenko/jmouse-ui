import type { MarkdownPlugin } from '../core';
import { MermaidDiagram } from './diagrams/MermaidDiagram';

/**
 * The `;;;name … ;;;` diagram renderers. One plugin each, because they are separate libraries with
 * separate weights — a product that wants flowcharts and not waveforms installs one and pays for one.
 * The renderer loads dynamically, so a document without diagrams costs nothing.
 *
 * <p>⚠️ `wavedromPlugin` lives in `../wavedrom` rather than here, and the reason is the packaging
 * rather than the domain. Its renderer imports `wavedrom` and `json5` dynamically, but a bundler
 * resolves a dynamic import at **build** time — so a module reachable from this package's main entry
 * point would make every consumer install two electronics libraries to render a document that never
 * mentions one. Reachable only from `@jmouse/markdown/wavedrom`, it costs nothing to anybody else.
 */

/** `;;;mermaid` — flowcharts, sequence and state diagrams. */
export function mermaidPlugin(): MarkdownPlugin<unknown> {
    return {
        name:        'mermaid',
        claims:      [{ shape: 'fence', name: 'mermaid' }],
        renderBlock: ({ block }) => <MermaidDiagram source={block.body}/>,
    };
}

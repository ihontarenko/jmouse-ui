/**
 * `@jmouse/markdown/wavedrom` — `;;;wavedrom` digital timing diagrams and register maps.
 *
 * <p>⚠️ **Its own entry point, and the reason is the bill rather than the domain.** The renderer
 * imports `wavedrom` and `json5` dynamically, which a bundler resolves at *build* time — so shipping
 * it from the main entry point would make every consumer install two electronics libraries to render
 * a document that never mentions one. Behind a subpath, a consumer that never imports it never pays.
 *
 * <p>The two are **optional peers**: install them alongside this package to use this plugin, and
 * ignore both otherwise. A `;;;wavedrom` fence in a host without the plugin is unclaimed syntax, and
 * unclaimed syntax stays prose — which is what lets one document cross between products.
 *
 * ```ts
 * import { wavedromPlugin } from '@jmouse/markdown/wavedrom';
 * ```
 */

import type { MarkdownPlugin } from './core';
import { WavedromDiagram } from './plugins/diagrams/WavedromDiagram';

export { WavedromDiagram };

/** `;;;wavedrom` — digital timing diagrams and register maps. */
export function wavedromPlugin(): MarkdownPlugin<unknown> {
    return {
        name:        'wavedrom',
        claims:      [{ shape: 'fence', name: 'wavedrom' }],
        renderBlock: ({ block }) => <WavedromDiagram source={block.body}/>,
    };
}

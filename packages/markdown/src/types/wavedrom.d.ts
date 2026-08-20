/**
 * WaveDrom ships no types.
 *
 * ⚠️ This file is why `MD-2`'s "zero imports leave the library tree" was *nearly* true rather than
 * true: `WavedromDiagram` compiled in Innoventa only because an ambient declaration sat two
 * directories away, in `src/types/`. Not an import statement, so no grep for one found it — and it
 * would have been the package's first build error. It travels with the code that needs it now.
 *
 * <p>Dev-only: the emitted `.d.ts` for `@jmouse/markdown/wavedrom` names `MarkdownPlugin`, never
 * `wavedrom`, so a consumer needs nothing of this even when it installs the optional peer.
 */
declare module 'wavedrom' {
    const wavedrom: {
        renderAny: (index: number, source: unknown, waveSkin: unknown) => unknown;
        waveSkin:  unknown;
        onml:      { stringify: (tree: unknown) => string };
    };
    export default wavedrom;
}

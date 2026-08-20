import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Library build — four entry points, one stylesheet, nothing bundled that a consumer already has.
 *
 * ⚠️ **`jme` and `wavedrom` are separate entries so that a consumer pays for what it imports.** A
 * bundler resolves a *dynamic* import at build time, so a module merely reachable from the main entry
 * point drags its libraries into every consumer's install. Rollup keeps a module in the chunk of the
 * entry that reaches it, and nothing but `wavedrom.tsx` reaches `WavedromDiagram` — which is what makes
 * `npm i` cost no electronics packages.
 */

/**
 * Everything a host already owns stays the host's. Two Reacts in one bundle is a hook-rules crash whose
 * message names none of this, and a second `@codemirror/state` is a runtime error that names the wrong
 * one — both are the ordinary reason a library externalises rather than bundles.
 */
const PEERS = [
    'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
    'react-markdown', 'remark-gfm', 'remark-math', 'rehype-katex',
    '@codemirror/state', '@codemirror/view', '@uiw/react-codemirror',
    'mermaid', 'wavedrom', 'json5',

    // ⚠️ `katex` is here for its **stylesheet**, which `plugins/prose.tsx` imports. Bundled, Vite
    // inlines KaTeX's four woff2 faces as data URIs and this package's one stylesheet becomes 1.4 MB —
    // most of it fonts, paid for by every consumer whether or not it renders maths. Left external, the
    // import survives into `dist/` and the consumer's own bundler resolves it exactly as it does today.
    'katex',
];

const entry = (file: string) => fileURLToPath(new URL(`src/${file}`, import.meta.url));

export default defineConfig({
    plugins: [react()],
    build: {
        outDir:      'dist',
        emptyOutDir: true,
        sourcemap:   true,
        // One stylesheet the consumer imports explicitly. Injected CSS is how a library takes the
        // cascade order away from the application that installed it.
        cssCodeSplit: false,
        lib: {
            entry: {
                index:    entry('index.ts'),
                plugins:  entry('plugins.ts'),
                jme:      entry('jme.ts'),
                wavedrom: entry('wavedrom.tsx'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: (id) => PEERS.some((peer) => id === peer || id.startsWith(`${peer}/`)),
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                // ⚠️ Keep the placeholders. A literal filename here names *every* asset, and the
                // stylesheet's own sourcemap is one of them — the two then collide into a single
                // 1.4 MB file that is CSS at both ends and base64 in the middle. Consumers never see
                // this name anyway; they import the `@jmouse/markdown/styles.css` subpath.
                assetFileNames: '[name][extname]',
            },
        },
    },
});

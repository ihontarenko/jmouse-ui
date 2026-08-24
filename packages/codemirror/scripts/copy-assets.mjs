import { copyFile } from "node:fs/promises"

/**
 * ⚠️ `tsc` is not a bundler and ignores `.css` entirely, so the stylesheet has to be carried into
 * `dist` by hand. Forgetting this ships a package whose `./styles.css` export points at nothing —
 * and a consumer importing it fails at build time with a resolution error rather than anywhere near
 * the colours it was for.
 */
await copyFile(new URL("../src/styles.css", import.meta.url), new URL("../dist/styles.css", import.meta.url))

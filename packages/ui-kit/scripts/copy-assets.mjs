import { cp } from "node:fs/promises"

/**
 * ⚠️ `tsc` is not a bundler and ignores everything that is not TypeScript, so the stylesheets, the themes and the
 * typefaces are carried into `dist` by hand. Forgetting this ships a package whose `./styles.css` export points at
 * nothing, and a consumer fails at build time with a resolution error rather than anywhere near the look.
 */
for (const directory of ["styles", "themes"]) {
  await cp(new URL(`../src/${directory}`, import.meta.url), new URL(`../dist/${directory}`, import.meta.url), { recursive: true })
}

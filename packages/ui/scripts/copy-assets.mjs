import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `tsc` emits JavaScript and declarations and ignores everything else, so the two stylesheets are
 * copied into `dist` by hand. They are part of the published contract — `@jmouse/ui/styles.css` is
 * what maps a product's custom properties onto Tailwind's tokens, and without it every primitive
 * renders unstyled.
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const assets = [
  ["src/styles.css", "dist/styles.css"],
  ["src/presets/themes.css", "dist/presets/themes.css"],
];

for (const [from, to] of assets) {
  const destination = join(packageRoot, to);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(packageRoot, from), destination);
  console.log("copied " + from + " -> " + to);
}

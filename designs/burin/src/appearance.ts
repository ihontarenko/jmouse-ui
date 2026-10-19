import type { AppearanceChoice } from "../../../packages/ui-kit/src/appearance/appearance";

/*
 * ⚠️ Imported by vite.config.ts as well, which runs in Node before any alias applies — so this file reaches the kit by
 * a relative path to one dependency-free module, never through "@jmouse/ui-kit".
 */

/** Namespaces what Burin stores; never changes. */
export const burinStoragePrefix = "burin-ui";

/** Burin opens dark, on its own theme; every other axis is "as the theme says". */
export const burinDefaults: Partial<AppearanceChoice> = { theme: "burin", mode: "dark" };

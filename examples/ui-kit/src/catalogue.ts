import { standardThemes, type ThemeDefinition } from "../../../packages/ui-kit/src/appearance/appearance";

/*
 * ⚠️ Imported by vite.config.ts as well, which runs in Node before any alias applies — so this file reaches the kit by
 * a relative path to one dependency-free module, never through "@jmouse/ui-kit".
 */

/** Namespaces what the showcase stores; a product uses its own name here and never changes it. */
export const showcaseStoragePrefix = "jmouse-ui-kit";

/**
 * The kit's product themes plus one the showcase defines itself in `themes/graphite.css` — the proof that a product adds
 * a theme with a CSS file and this one line, and touches nothing in the kit.
 */
export const showcaseThemes: ThemeDefinition[] = [...standardThemes, { name: "graphite", label: "Graphite", description: "The showcase's own theme: charcoal and amber." }];

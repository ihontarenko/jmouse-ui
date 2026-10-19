/**
 * `@jmouse/explorer` — the embeddable file manager drawn with `@jmouse/ui-kit`.
 *
 * ⚠️ **A product writes one thing: an {@link ExplorerAdapter}.** Everything the explorer offers — the "⋯" menus, the
 * toolbar, the keys — follows from which of its methods exist and what `permits` answers. Import
 * `@jmouse/ui-kit/styles.css` once; the explorer brings no stylesheet of its own.
 *
 * ⚠️ **`@jmouse/files` is its predecessor, still in use.** Products move across one at a time and drop their
 * `@jmouse/files` import as they do; the decisions both share live in `@jmouse/explorer/headless`.
 */

export { Explorer, type ExplorerLabels, type ExplorerProperties } from "./Explorer"
export { ExplorerViewer, type ExplorerViewerLabels, type ExplorerViewerProperties } from "./ExplorerViewer"
export type { ExplorerAction, ExplorerAdapter, ExplorerEntry } from "./adapter"
export { entryActions, permits, placeActions } from "./actions"
export { useExplorerCatalogue, type ExplorerCatalogue, type FolderState } from "./useExplorerCatalogue"
export * from "./headless"

/**
 * `@jmouse/explorer` — the embeddable file manager drawn with `@jmouse/ui-kit`.
 *
 * ⚠️ **A product writes one thing: an {@link ExplorerAdapter}.** Everything the explorer offers — the "⋯" menus, the
 * toolbar, the keys — follows from which of its methods exist and what `permits` answers. Import the kit's stylesheet
 * once; the explorer brings no stylesheet of its own, and its look is whatever the host's tokens make the kit's.
 *
 * ⚠️ **`@jmouse/files` is its predecessor, still in use.** Products move across one at a time and drop their
 * `@jmouse/files` import as they do. What both decide about a file lives in `@jmouse/file-handling`, which neither
 * of them owns.
 */

export { Explorer, type ExplorerLabels, type ExplorerProperties } from "./Explorer"
export { ExplorerViewer, type ExplorerViewerLabels, type ExplorerViewerProperties } from "./ExplorerViewer"
export type { ExplorerAction, ExplorerAdapter, ExplorerEntry, ExplorerTarget } from "./adapter"
export { entryActions, permits, placeActions } from "./actions"
export { useExplorerCatalogue, type CatalogueFailure, type ExplorerCatalogue, type FolderState } from "./useExplorerCatalogue"

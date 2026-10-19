import type { ExplorerAction, ExplorerAdapter, ExplorerEntry } from "./adapter"

/**
 * What may be done, decided once.
 *
 * ⚠️ **The "⋯" menu, the toolbar and the keys all read this, and nothing else decides.** A menu that offered rename
 * while F2 refused it — or the reverse — is the drift that happens the moment two places answer the same question.
 */

/** Which method each act needs. */
const REQUIRED_METHOD: Record<ExplorerAction, keyof ExplorerAdapter> = {
  download: "read",
  copyLink: "shareUrl",
  rename: "rename",
  move: "move",
  remove: "remove",
  createFolder: "createFolder",
  upload: "upload",
}

/** The acts on one entry, in the order a menu lists them. */
const ENTRY_ACTIONS: ExplorerAction[] = ["download", "copyLink", "rename", "move", "remove"]

/** The acts on a folder as a place — what its toolbar offers. */
const PLACE_ACTIONS: ExplorerAction[] = ["upload", "createFolder"]

/**
 * Whether one act is on offer.
 *
 * @param adapter what the product can do
 * @param action the act
 * @param entry what it is done to; null for the root as a place
 * @return true when the method exists, the act fits the entry, and the product permits it
 */
export function permits(adapter: ExplorerAdapter, action: ExplorerAction, entry: ExplorerEntry | null): boolean {
  if (adapter[REQUIRED_METHOD[action]] === undefined) {
    return false
  }

  if (!fitsEntry(action, entry)) {
    return false
  }

  return adapter.permits?.(action, entry) ?? true
}

function fitsEntry(action: ExplorerAction, entry: ExplorerEntry | null): boolean {
  if (action === "download") {
    return entry?.kind === "file"
  }

  if (action === "copyLink") {
    return entry !== null
  }

  if (action === "upload" || action === "createFolder") {
    return entry === null || entry.kind === "folder"
  }

  return entry !== null
}

/**
 * The acts on one entry — a file or a folder in the listing or the tree.
 *
 * ⚠️ `copyLink` is offered only when the product actually has a link for this entry; "copy" that puts nothing on the
 * clipboard is a control that lies.
 */
export function entryActions(adapter: ExplorerAdapter, entry: ExplorerEntry): ExplorerAction[] {
  return ENTRY_ACTIONS.filter((action) => {
    if (!permits(adapter, action, entry)) {
      return false
    }

    if (action === "copyLink") {
      return Boolean(adapter.shareUrl?.(entry))
    }

    return true
  })
}

/** The acts on the shown folder as a place — upload into it, make a folder in it. */
export function placeActions(adapter: ExplorerAdapter, folder: ExplorerEntry | null): ExplorerAction[] {
  return PLACE_ACTIONS.filter((action) => permits(adapter, action, folder))
}

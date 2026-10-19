/**
 * What the explorer needs from the outside world — the one thing a product writes.
 *
 * <h2>⚠️ Nothing in this package fetches</h2>
 *
 * <p>The rule `@jmouse/files` already paid for: three products authenticate three ways, and one of them is called
 * cross-origin by the other two. An HTTP client chosen here would be chosen for all of them. The explorer calls these
 * functions; the product wrote them over its own client, against its own routes.
 *
 * <h2>⚠️ A capability is a method that exists</h2>
 *
 * <p>Every act but `list` is optional, and leaving one out is how a product says "not here": the act then appears
 * nowhere — no menu entry, no key, no button that always refuses. {@link ExplorerAdapter.permits} narrows further, per
 * entry and per reader, and can only take away what the methods offer.
 */

/** A folder or a file, as the explorer draws one. */
export interface ExplorerEntry {
  /** Unique within the adapter, and stable across a rename. */
  id: string
  /** The folder it is filed in; null is the root. */
  parentId: string | null
  /** What a person typed — never a storage key or a slug. */
  name: string
  kind: "folder" | "file"
  /** The media type, when the backend knows it. The name gets a vote too — see `fileKindOf`. */
  mediaType?: string
  /** Bytes. Absent for a folder. */
  size?: number
  /** ISO-8601. Formatted by the explorer through `formatDate`. */
  modified?: string
}

/** Every act the explorer can offer. */
export type ExplorerAction = "open" | "download" | "copyLink" | "rename" | "move" | "remove" | "createFolder" | "upload"

/**
 * What an act is done to: one entry, or a folder as a PLACE — somewhere to upload into or make a folder in.
 *
 * ⚠️ **A place is named by its ID, and the folder itself only when the explorer knows it.** Opened deep without the
 * folders above, the explorer has listed a folder it has never been told the name of; asking the product about that
 * place must not pretend it is the root.
 */
export type ExplorerTarget =
  | { entry: ExplorerEntry }
  | { place: string | null; folder?: ExplorerEntry }

export interface ExplorerAdapter {
  /** The children of one folder — folders and files together. null is the root. */
  list(folderId: string | null): Promise<ExplorerEntry[]>

  /**
   * Every folder at once, when the backend can answer it in one call.
   *
   * ⚠️ **Optional, and the tree is the difference.** Without it the tree grows as somebody browses, folder by folder;
   * with it the whole shape is there on the first paint.
   */
  folders?(): Promise<ExplorerEntry[]>

  /** The folders above one, root first and the folder itself last — to open somewhere deep. */
  ancestors?(folderId: string): Promise<ExplorerEntry[]>

  /**
   * One entry by its ID, wherever it is filed — for a file opened from a link before its folder was ever listed.
   *
   * ⚠️ Without it, a file the host names as open is shown only once somebody lists the folder it is in.
   */
  find?(entryId: string): Promise<ExplorerEntry>

  /**
   * A file's bytes, fetched the way this product authenticates.
   *
   * ⚠️ **A fetch, not a URL.** An `<img src>` pointed at an authenticated route carries no credentials, answers 401
   * and draws as a damaged file. Without this the viewer says the file cannot be shown here and nothing downloads.
   */
  read?(file: ExplorerEntry): Promise<Blob>

  createFolder?(parentId: string | null, name: string): Promise<ExplorerEntry>
  rename?(entry: ExplorerEntry, name: string): Promise<ExplorerEntry>
  move?(entry: ExplorerEntry, folderId: string | null): Promise<ExplorerEntry>

  /**
   * ⚠️ **A folder that still holds something may be refused**, and being refused is the right answer — a one-click
   * delete that takes a branch with it is a click nobody meant. The refusal is shown in the server's own words.
   */
  remove?(entry: ExplorerEntry): Promise<void>

  upload?(folderId: string | null, file: File): Promise<ExplorerEntry>

  /** A public, absolute link worth copying — or null where this entry has none. */
  shareUrl?(entry: ExplorerEntry): string | null

  /**
   * Whether this reader may do this to this target.
   *
   * ⚠️ **It narrows, never widens.** An act whose method is absent stays absent whatever this answers.
   */
  permits?(action: ExplorerAction, target: ExplorerTarget): boolean
}

/**
 * What a file manager is made of, and the one thing a product has to supply (UIK-7).
 *
 * ⚠️ **The shapes are the LIBRARY's, not any product's.** `Directory` and `ManagedFile` mirror
 * `jmouse-storage-management`'s `DirectoryView` and `FileView` field for field. A product whose own DTO
 * has drifted is a product that should come back to these — the alternative is a package that grows a
 * union type per consumer and stops describing anything.
 */

/** A folder in the library's tree. */
export interface Directory {
  id: string
  name: string
  /**
   * The full path, slash-separated — `innoventa/files/datasheets`.
   *
   * ⚠️ **A storage key, not a label.** It is built from slugs, so a folder somebody called
   * "Datasheets 2026" has `datasheets-2026` here. Never render it as a name — see {@link directoryLabel}.
   */
  path: string
  /**
   * ⚠️ **OPTIONAL, not nullable, and the difference has teeth.** The backends serialise non-null only,
   * so a root arrives with the key **absent** rather than set to `null` — and `parentId === null` is
   * then silently false for every root there is. Ask {@link root}, or test for falsiness; never for
   * `null`.
   */
  parentId?: string
  /** Whether this is a tree's own top. The reliable way to find one. */
  root: boolean
  /** How deep it sits, with a root at 1 — enough to indent a flat list without rebuilding the tree. */
  depth: number
}

/**
 * A file, as the library describes one.
 *
 * ⚠️ **`uploadedBy` is an IDENTIFIER, never a person.** Assembling the member server-side is what made
 * one product keep seven duplicated routes; drawing the face from the id is a lookup an interface can
 * already do. See `KW-0079`.
 */
export interface ManagedFile {
  id: string
  name: string
  contentType: string
  sizeBytes: number
  uploadedBy: string | null
  createdAt: string
}

/**
 * How a folder's acceptance lists are read.
 *
 * ⚠️ Part of the folder's own rule rather than the installation's, which is what lets a folder be
 * *stricter* as easily as looser. Without it the mechanism would only work in one direction, and that
 * is the more alarming direction.
 */
export type AcceptanceMode = "ALLOWLIST" | "DENYLIST"

/**
 * The upload rule that actually applies to a folder — after inheritance.
 *
 * ⚠️ **`admitsActiveContent` is a FACT, not a verdict.** The library reserves no file type and refuses
 * nothing on an owner's behalf: a folder may be configured to admit `.svg`, `.html`, even `.exe`. What
 * was never declined is *saying so*, and a folder quietly admitting active content because a rule three
 * levels up allows it is hidden risk rather than the understood kind. Draw it as information — never as
 * an error, and never with a word like "unsafe" the API deliberately does not use.
 */
export interface EffectiveUploadRule {
  mode: AcceptanceMode
  contentTypes: string[]
  extensions: string[]
  maxSizeBytes: number
  admitsActiveContent: boolean
  /** An allowlist listing nothing — a folder nobody can upload into. Legitimate, and worth saying. */
  admitsNothing: boolean
}

/** Where a rule came from. */
export type ConfigurationOrigin = "SELF" | "INHERITED" | "INSTALLATION"

/**
 * What applies to a folder, of one kind, and where it came from.
 *
 * ⚠️ **The origin is the half a screen cannot work out for itself.** From below, an inherited rule and a
 * folder's own look identical — and "inherited from `innoventa/files`" against "set here" is exactly the
 * sentence somebody needs before they change anything.
 */
export interface DirectoryConfiguration<T = unknown> {
  effective: T
  origin: ConfigurationOrigin
  /** The ancestor's whole address when inherited, otherwise null. */
  originPath: string | null
  /** Whether this folder carries a row of its own — what "clear" is drawn from. */
  own: boolean
}

/**
 * A folder with everything that applies to it, keyed by kind.
 *
 * ⚠️ **Keyed by KIND rather than flattened into `uploadMode`, `uploadExtensions`, …** The backend's table
 * takes any kind of directory configuration, and a shape named after `upload` would have to be redesigned
 * the day a second one arrives.
 */
export interface DirectoryDetail extends Directory {
  configurations: Record<string, DirectoryConfiguration>
}

/** The kind name the upload rule is filed under. */
export const UPLOAD_CONFIGURATION = "upload"

/**
 * Everything the manager needs from the outside world.
 *
 * <h2>⚠️ Nothing in this package fetches</h2>
 *
 * <p>The package's own rule, and it is not ceremony: three products authenticate differently, one of
 * them is called cross-origin by two others, and an HTTP client baked in here would decide that for all
 * of them. What the manager does is call these functions — the product wrote them, over its own client,
 * against its own routes.
 *
 * <h2>⚠️ The last three are PRESENTATION seams, and they exist because the products genuinely disagree</h2>
 *
 * <p>Innoventa reaches a file's bytes through a Sharing Center token — a public URL an `<img>` can use
 * directly. Kiwi has no such token by design: a file there is reachable exactly while a published page
 * points at it (`KW-0072`), so an authenticated fetch and an object URL are the only way for a signed-in
 * reader. A package that assumed either would have been wrong in one product and unusable in the other,
 * so it asks and draws a glyph when the answer is nothing.
 */
export interface FileLibraryPort {
  /** One directory and everything under it, shallowest first. */
  subtree(directoryId: string): Promise<Directory[]>

  /** What is filed directly in one directory. */
  filesIn(directoryId: string): Promise<ManagedFile[]>

  /**
   * A file's bytes, fetched the way this product authenticates.
   *
   * ⚠️ **Required, because the viewer is part of the manager rather than part of a product.** Looking
   * at a file is the reason a file manager exists, and a manager that could only offer a download in
   * one product and a preview in another would be two different screens wearing one name.
   *
   * ⚠️ **A fetch, not a URL, and the difference is the whole reason this is a port member.** Every one
   * of these routes is authenticated, and an `<img src>` or an `<iframe src>` pointed at one carries no
   * credentials at all — it answers 401, which draws as *the file is missing*. The bytes have to arrive
   * through the product's own client and be held as an object URL.
   */
  bytes(file: ManagedFile): Promise<Blob>

  upload(directoryId: string, file: File, onProgress?: (percent: number) => void): Promise<ManagedFile>

  /**
   * Fetch a web address and keep what comes back — offered only where the product supplies it.
   *
   * ⚠️ **Optional because the library route is**, behind `jmouse.files.management.import.enabled`, and
   * for a good reason: "import this URL" is the server fetching an address on somebody else's behalf.
   * The backend refuses loopback, site-local and link-local addresses — for every address the host
   * resolves to, not the first — because otherwise it is a way to reach cloud metadata endpoints and
   * internal services and be handed the result.
   *
   * ⚠️ **The manager shows the control only when this is here.** A product that has not turned the route
   * on gets no field to type into, rather than a field that always fails.
   */
  importFrom?(directoryId: string, url: string): Promise<ManagedFile>

  createDirectory(parentId: string, name: string): Promise<Directory>
  renameDirectory(directoryId: string, name: string): Promise<Directory>

  /**
   * One folder with everything that applies to it — offered only where the product supplies it.
   *
   * <h2>⚠️ Optional, and the reason is a permission rather than a route</h2>
   *
   * <p>The library reserves no file type, so *who may change a folder's upload rule* is literally *who
   * may put an executable into this installation*. Products gate it on a right of its own — never the
   * one that renames a folder — and plenty of accounts will not hold it. Leaving these three out is how
   * a product says "not for this reader": the manager then shows no Configuration item at all, rather
   * than one that always refuses.
   *
   * <p>⚠️ **A separate call from `subtree`, deliberately.** Resolving a rule walks a folder's ancestors,
   * so answering it per row would turn drawing a tree into a resolve per node. This is asked for one
   * folder, when somebody opens its configuration.
   */
  directoryDetail?(directoryId: string): Promise<DirectoryDetail>

  /**
   * Say what a folder does, of one kind.
   *
   * @returns the configuration as the backend normalised it — lower-cased, dots stripped, content-type
   *          parameters removed. Show what came back rather than what was typed.
   */
  writeDirectoryConfiguration?(directoryId: string, kind: string, document: unknown): Promise<unknown>

  /**
   * Stop saying anything of this kind, and go back to inheriting.
   *
   * ⚠️ **Offered whenever writing is.** A rule that can be set and not removed is a one-way door on
   * every folder somebody ever touches.
   */
  clearDirectoryConfiguration?(directoryId: string, kind: string): Promise<void>

  /**
   * ⚠️ **Without taking the subtree.** The backend refuses a folder that still holds something, and
   * being refused is the right answer — a one-click delete that takes a branch with it is a click
   * nobody meant.
   */
  deleteDirectory(directoryId: string): Promise<void>

  renameFile(fileId: string, name: string): Promise<ManagedFile>
  refileFile(fileId: string, directoryId: string): Promise<ManagedFile>
  deleteFile(fileId: string): Promise<void>

  /**
   * A URL an `<img>` can load for this file, or null where there is none.
   *
   * ⚠️ Returning null is a real answer, not a failure: the manager draws the type's glyph instead of a
   * broken image frame.
   */
  thumbnailUrl?(file: ManagedFile): string | null

  /** Where "open this" goes, or null where the product has nowhere to send somebody. */
  openUrl?(file: ManagedFile): string | null

  /** A link worth copying — public, absolute — or null where this file has none. */
  shareUrl?(file: ManagedFile): string | null
}

/**
 * What the manager says when it cannot do something.
 *
 * ⚠️ **A callback rather than a toast.** `sonner` is one of three notification libraries these products
 * could be using, and a package that picked one would make that choice for everybody. The product
 * already has somewhere to put a message.
 */
export type FileManagerNotice = (message: string) => void

/** How a folder's contents may be looked at. */
export type FilesLayout = "rows" | "tiles"

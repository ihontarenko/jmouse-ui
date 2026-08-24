/**
 * `@jmouse/files` — the file composites three products share.
 *
 * ⚠️ **Composites, not primitives**, which is why this is not inside `@jmouse/ui`. That package holds
 * dialog, button and table and knows no domain; this one has opinions — what a media type means, how big
 * a thing may be before it stops being showable, what to say when it cannot be shown. Putting the first
 * composite in there would quietly redefine `@jmouse/ui` as "shared components", and everything after it
 * would follow.
 *
 * ⚠️ **Nothing here fetches.** Every product authenticates differently and one of them is called
 * cross-origin by two others, so the bytes and the lists always arrive through functions the caller
 * supplies — `FileLibraryPort` for the manager, a loader for `FileViewerDialog`.
 *
 * ⚠️ **The manager was Innoventa's and is nobody's now (UIK-7).** Taking it out meant naming the three
 * things it had assumed: where the tree starts, how to fetch, and how to reach a file's bytes. All three
 * are parameters, and each one is a place the products genuinely disagree rather than a generalisation
 * for its own sake.
 */

export { FileViewerDialog, type FileViewerProperties } from "./FileViewerDialog"
export {
  fileKindOf,
  readableFileSize,
  MAXIMUM_TEXT_BYTES,
  type FileKind,
  type ViewableFile,
} from "./fileKinds"

export { FileManager, type FileManagerProperties } from "./FileManager"
export { DirectoryTree } from "./DirectoryTree"
export { FileList } from "./FileList"
export { FileRows, RenameField } from "./FileRows"
export { FileTiles } from "./FileTiles"
export { FileThumbnail } from "./FileThumbnail"
export { FolderGlyph, CabinetGlyph } from "./FolderGlyph"
export { fileGlyphOf, glyphTint, GLYPH_HUES, type FileGlyphSpecification } from "./fileGlyph"
export { canPreview, filePreview, useFilePreview, useOnScreen, MAXIMUM_PREVIEW_BYTES } from "./filePreviews"
export { useManagerLocation, type ManagerLocation } from "./managerLocation"
export { ancestorIds, parentIds, useDirectoryExpansion, visibleDirectories } from "./treeExpansion"
export { FileActionButtons, useFileActions, type FileActions } from "./useFileActions"

export {
  FILE_DRAG_TYPE,
  directoryLabel,
  directoryTrail,
  fileDragProperties,
  formatBytes,
  formatFileDate,
  isImage,
  isPdf,
  saveBlob,
  typeLabel,
} from "./fileDisplay"

export type {
  Directory,
  FileLibraryPort,
  FileManagerNotice,
  FilesLayout,
  ManagedFile,
} from "./types"

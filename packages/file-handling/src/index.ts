/**
 * `@jmouse/file-handling` — what a file is, with nothing to install for it.
 *
 * ⚠️ **A package of its own because three packages read it and none of them may own it.** `@jmouse/ui-kit` draws a
 * file's glyph, `@jmouse/explorer` (drawn with the kit) shows the file, and `@jmouse/files` (drawn with `@jmouse/ui`)
 * shows it too. Kept in the kit, the old manager would install the new kit to learn whether a `.md` can be shown; kept
 * in the explorer, the kit would depend on its own consumer. Here, every arrow points one way.
 */

export { fileFamilyOf, fileKindOf, MAXIMUM_TEXT_BYTES, type FileFamily, type FileKind, type ViewableFile } from "./fileKinds"
export { readableFileSize } from "./fileSizes"
export { because, failureStatus, reasonOf } from "./failures"
export { saveBlob } from "./saveBlob"

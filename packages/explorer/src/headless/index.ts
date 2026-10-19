/**
 * `@jmouse/explorer/headless` — what a file is, with nothing to install for it.
 *
 * ⚠️ **No React and no kit in this entry, and that is why it is an entry of its own.** `@jmouse/files` reads these
 * decisions too, and it draws with `@jmouse/ui`; importing the explorer's root would have made every product on the old
 * manager install the new kit to learn whether a `.md` can be shown.
 */

export { fileKindOf, readableFileSize, MAXIMUM_TEXT_BYTES, type FileKind, type ViewableFile } from "./fileKinds"
export { because } from "./failures"
export { saveBlob } from "./saveBlob"

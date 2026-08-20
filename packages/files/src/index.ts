/**
 * `@jmouse/files` — the file composites three products share.
 *
 * ⚠️ **Composites, not primitives**, which is why this is not inside `@jmouse/ui`. That package holds
 * dialog, button and table and knows no domain; this one has opinions — what a media type means, how big
 * a thing may be before it stops being showable, what to say when it cannot be shown. Putting the first
 * composite in there would quietly redefine `@jmouse/ui` as "shared components", and everything after it
 * would follow.
 *
 * ⚠️ **Nothing here fetches.** Every product authenticates differently, so the bytes always arrive
 * through a function the caller supplies — see `FileViewerDialog`.
 */

export { FileViewerDialog, type FileViewerProperties } from "./FileViewerDialog"
export {
  fileKindOf,
  readableFileSize,
  MAXIMUM_TEXT_BYTES,
  type FileKind,
  type ViewableFile,
} from "./fileKinds"

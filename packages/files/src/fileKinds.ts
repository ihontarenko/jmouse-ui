/**
 * What a file is, for the purpose of showing it.
 *
 * ⚠️ **A decision, not a lookup table.** Every product that lists files asks the same question — *can I
 * show this, and how* — and each of them answering it separately is how one screen previews a `.md` and
 * the next one offers it as a download.
 */
export type FileKind = "image" | "pdf" | "markdown" | "text" | "unshowable"

/** The least a viewer needs to know about a file. Products carry more; none of it belongs here. */
export interface ViewableFile {
  name: string
  contentType: string
  sizeBytes: number
}

/**
 * ⚠️ **Raster only, and SVG is absent by name.** It is an image by every intuition and a script host by
 * specification — and a viewer that framed one would run it against the reader's own session.
 */
const IMAGE = /^image\/(png|jpeg|gif|webp|bmp)$/

const PDF = "application/pdf"

/**
 * ⚠️ **Markdown is decided by the extension AS WELL AS the media type**, because the type is unreliable
 * for exactly this format. A `.md` dropped from a desktop arrives as `text/markdown` on one machine,
 * `text/plain` on another and `application/octet-stream` on a third — the browser guesses from a registry
 * the server never sees. The filename is the thing a person actually chose, so it gets a vote.
 */
const MARKDOWN_TYPE = /^text\/(x-)?markdown$/
const MARKDOWN_EXTENSION = /\.(md|markdown|mdown|mkd)$/i

/**
 * ⚠️ Inert text only. `text/html`, `application/xhtml+xml` and every JavaScript type are excluded here
 * for the same reason they are excluded from the upload policy that lets these bytes in: they are text
 * by encoding and a script host by specification.
 */
const TEXT = /^(text\/(plain|csv|tab-separated-values|x-log|yaml|x-yaml|markdown|x-markdown)$|application\/(json|x-ndjson|yaml|x-yaml)$)/

/**
 * How much text may be rendered at once.
 *
 * ⚠️ A ceiling rather than a truncation: a 40 MB log laid out into a `<pre>` is four hundred thousand
 * lines of layout and a frozen tab, and nobody reads a 40 MB log in a dialog anyway. Over this it is
 * offered as a download, which is what somebody actually wants with a file that size.
 */
export const MAXIMUM_TEXT_BYTES = 512 * 1024

/**
 * Which of the five ways this file can be shown.
 *
 * ⚠️ **Markdown is tested first**, and the order is load-bearing: tested after the generic text branch it
 * would lose every time a `.md` arrived as `text/plain` — which is most of the time — and be shown as its
 * own source, which is precisely what somebody attaching a note does not want to read.
 *
 * @param file what is being shown
 * @return the kind
 */
export function fileKindOf(file: ViewableFile | null | undefined): FileKind {
  if (!file) {
    return "unshowable"
  }

  if (IMAGE.test(file.contentType)) {
    return "image"
  }

  if (file.contentType === PDF) {
    return "pdf"
  }

  const looksLikeMarkdown = MARKDOWN_TYPE.test(file.contentType) || MARKDOWN_EXTENSION.test(file.name)

  if (looksLikeMarkdown && file.sizeBytes <= MAXIMUM_TEXT_BYTES) {
    return "markdown"
  }

  if (TEXT.test(file.contentType) && file.sizeBytes <= MAXIMUM_TEXT_BYTES) {
    return "text"
  }

  return "unshowable"
}

/**
 * Bytes, as somebody reads them.
 *
 * @param bytes how many
 * @return a short human-readable size
 */
export function readableFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ["KB", "MB", "GB"]

  let size = bytes / 1024
  let unit = 0

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }

  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`
}

/**
 * What a file is, for the purpose of showing it.
 *
 * ⚠️ **A decision, not a lookup table.** Every product that lists files asks the same question — *can I
 * show this, and how* — and each of them answering it separately is how one screen previews a `.md` and
 * the next one offers it as a download.
 */
export type FileKind =
  | "image"
  | "pdf"
  | "markdown"
  | "text"
  | "audio"
  | "video"
  | "document"
  | "unshowable"

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
const IMAGE = /^image\/(png|jpeg|gif|webp|bmp|avif)$/

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
const TEXT =
  /^(text\/(plain|csv|tab-separated-values|x-log|yaml|x-yaml|markdown|x-markdown)$|application\/(json|x-ndjson|yaml|x-yaml|xml|sql|toml)$)/

/**
 * Text recognised by its NAME, for everything the browser refuses to name.
 *
 * ⚠️ **The same argument as Markdown's, and it costs the same to get wrong.** A `.log`, a `.sql`, a
 * `.java` and a `.env` all arrive as `application/octet-stream` from most desktops, because the type is
 * guessed from a registry the server never sees. Judged on the type alone, every one of them is
 * unshowable — which turns a viewer into a download button for exactly the files somebody most wants to
 * glance at without leaving the page.
 *
 * ⚠️ **Shown as SOURCE, never run.** These land in the `text` branch, which reads the blob and lays it
 * out in a `<pre>` — so `.html` and `.svg` are here on purpose and are safe here specifically because
 * nothing frames them. The moment anything renders one of these, this list stops being safe.
 */
const TEXT_EXTENSION =
  /\.(txt|log|csv|tsv|json|jsonl|ndjson|ya?ml|toml|ini|cfg|conf|properties|env|sql|xml|svg|html?|css|scss|less|jsx?|tsx?|mjs|cjs|java|kt|kts|gradle|py|rb|go|rs|php|cs|c|h|cpp|hpp|sh|bash|zsh|ps1|bat|dockerfile|gitignore|editorconfig|patch|diff|jmp|el)$/i

/**
 * Sound and moving pictures, which the browser draws better than any library could.
 *
 * ⚠️ **`<audio controls>` and `<video controls>` over an object URL, and nothing else.** A player built
 * here would be a scrub bar, a volume control and a keyboard map re-implemented worse — and the native
 * one already follows the platform's own captions, playback-rate and picture-in-picture settings.
 */
const AUDIO = /^audio\/(mpeg|mp3|ogg|wav|x-wav|webm|aac|flac|mp4)$/
const VIDEO = /^video\/(mp4|webm|ogg|quicktime)$/

/**
 * An office document — named rather than shrugged at.
 *
 * ⚠️ **A kind of its own even though nothing draws one yet, and that is deliberate.** Folded into
 * `unshowable` it would be indistinguishable from a `.zip`, and somebody looking at a `.docx` would be
 * told *this cannot be shown* where the truthful answer is *this needs converting first*. It is also the
 * one place a converter would be plugged in, and a branch that already exists is a much smaller change
 * than a branch that has to be invented across three products.
 */
const DOCUMENT =
  /^application\/(msword|vnd\.ms-\w+|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.oasis\.opendocument\.[\w.]+|rtf)$/

const DOCUMENT_EXTENSION = /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|pages|numbers|key)$/i

/**
 * How much text may be rendered at once.
 *
 * ⚠️ A ceiling rather than a truncation: a 40 MB log laid out into a `<pre>` is four hundred thousand
 * lines of layout and a frozen tab, and nobody reads a 40 MB log in a dialog anyway. Over this it is
 * offered as a download, which is what somebody actually wants with a file that size.
 */
export const MAXIMUM_TEXT_BYTES = 512 * 1024

/**
 * Which of the ways this file can be shown.
 *
 * ⚠️ **The order is load-bearing, twice over.**
 *
 * <ul>
 *   <li><strong>Markdown before text.</strong> Tested after the generic text branch it would lose every
 *       time a `.md` arrived as `text/plain` — which is most of the time — and be shown as its own
 *       source, which is precisely what somebody attaching a note does not want to read;
 *   <li><strong>Documents before the extension fallback.</strong> A `.docx` is a zip of XML: judged by
 *       name against a permissive text list it would be read as text and drawn as mojibake, which reads
 *       as a corrupted file rather than as one that needs converting.
 * </ul>
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

  if (AUDIO.test(file.contentType)) {
    return "audio"
  }

  if (VIDEO.test(file.contentType)) {
    return "video"
  }

  if (DOCUMENT.test(file.contentType) || DOCUMENT_EXTENSION.test(file.name)) {
    return "document"
  }

  const looksLikeMarkdown = MARKDOWN_TYPE.test(file.contentType) || MARKDOWN_EXTENSION.test(file.name)

  if (looksLikeMarkdown && file.sizeBytes <= MAXIMUM_TEXT_BYTES) {
    return "markdown"
  }

  // ⚠️ The name gets a vote here too, and it is the vote that matters: a `.log` or a `.sql` from a
  // desktop arrives as `application/octet-stream`, so the type alone would send every one of them to
  // the downloads folder.
  const looksLikeText = TEXT.test(file.contentType) || TEXT_EXTENSION.test(file.name)

  if (looksLikeText && file.sizeBytes <= MAXIMUM_TEXT_BYTES) {
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

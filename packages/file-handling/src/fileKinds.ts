/**
 * What a file is — how it is drawn, and whether and how it may be shown.
 *
 * ⚠️ **One table answers both questions, so the two answers cannot drift apart.** The glyph used to come from the kit's
 * own extension list and the viewer's decision from this one; they disagreed about `.svg`, `.md` and `.pdf` before
 * anyone noticed, on one screen. Every format is now one row naming its FAMILY (the glyph) and, where the name is
 * enough to decide it, its KIND (the viewer) — so where the two differ, the row says so on purpose.
 */

/** How a file may be shown. */
export type FileKind =
  | "image"
  | "pdf"
  | "markdown"
  | "text"
  | "audio"
  | "video"
  | "document"
  | "unshowable"

/** How a file is drawn — the glyph's family. */
export type FileFamily = "document" | "code" | "data" | "image" | "audio" | "video" | "archive" | "sheet" | "file"

/** The least a viewer needs to know about a file. Products carry more; none of it belongs here. */
export interface ViewableFile {
  name: string
  contentType: string
  sizeBytes: number
}

interface FileFormat {
  extensions: readonly string[]
  family: FileFamily
  /**
   * The kind the NAME alone decides, or absent where only the media type may decide it.
   *
   * ⚠️ Absent for raster images, PDF, sound and video: those are shown only when the server says what they are,
   * because a viewer that trusted a `.png` suffix on arbitrary bytes would hand the browser something to sniff.
   */
  kind?: FileKind
}

/**
 * Every format recognised by name.
 *
 * ⚠️ **SVG is an image to look at and TEXT to show.** It is an image by every intuition and a script host by
 * specification, so it is drawn with the image glyph and laid out as source — never framed, never put in an `<img>`
 * from an authenticated route.
 *
 * ⚠️ **Text by name is shown as SOURCE, never run.** `.html` is here on purpose and is safe here specifically because
 * nothing frames it; the moment anything renders one of these, this table stops being safe.
 */
const FORMATS: readonly FileFormat[] = [
  { extensions: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "heic", "tif", "tiff"], family: "image" },
  { extensions: ["svg"], family: "image", kind: "text" },
  { extensions: ["mp3", "wav", "flac", "ogg", "m4a", "aac"], family: "audio" },
  { extensions: ["mp4", "mkv", "webm", "mov", "avi", "m4v"], family: "video" },
  { extensions: ["zip", "rar", "7z", "tar", "gz", "jar", "war", "iso", "apk"], family: "archive" },
  { extensions: ["csv", "tsv"], family: "sheet", kind: "text" },
  { extensions: ["xls", "xlsx", "ods", "numbers"], family: "sheet", kind: "document" },
  { extensions: ["doc", "docx", "ppt", "pptx", "odt", "odp", "rtf", "pages", "key"], family: "document", kind: "document" },
  { extensions: ["pdf"], family: "document" },
  { extensions: ["md", "markdown", "mdown", "mkd"], family: "document", kind: "markdown" },
  { extensions: ["txt", "log", "patch", "diff"], family: "document", kind: "text" },
  { extensions: ["json", "jsonl", "ndjson", "yaml", "yml", "toml", "ini", "cfg", "conf", "properties", "env"], family: "data", kind: "text" },
  {
    extensions: [
      "java", "kt", "kts", "gradle", "js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "mdx", "py", "rb", "go", "rs",
      "php", "cs", "c", "h", "cpp", "hpp", "sql", "html", "htm", "css", "scss", "less", "xml", "sh", "bash", "zsh",
      "ps1", "bat", "jmp", "jms", "el", "dockerfile", "gitignore", "editorconfig",
    ],
    family: "code",
    kind: "text",
  },
]

const FORMAT_BY_EXTENSION = new Map(FORMATS.flatMap((format) => format.extensions.map((extension) => [extension, format] as const)))

function formatOf(name: string): FileFormat | undefined {
  const dot = name.lastIndexOf(".")

  if (dot < 0) {
    return undefined
  }

  return FORMAT_BY_EXTENSION.get(name.slice(dot + 1).toLowerCase())
}

/** Raster only — SVG is absent by name, for the reason given on {@link FORMATS}. */
const IMAGE = /^image\/(png|jpeg|gif|webp|bmp|avif)$/

const PDF = "application/pdf"

/**
 * ⚠️ **Markdown is decided by the extension AS WELL AS the media type**, because the type is unreliable for exactly
 * this format: a `.md` dropped from a desktop arrives as `text/markdown`, `text/plain` or `application/octet-stream`
 * depending on the machine. The filename is the thing a person actually chose, so it gets a vote.
 */
const MARKDOWN_TYPE = /^text\/(x-)?markdown$/

/**
 * ⚠️ Inert text only. `text/html`, `application/xhtml+xml` and every JavaScript type are excluded for the same reason
 * they are excluded from the upload policy that lets these bytes in: text by encoding, a script host by specification.
 */
const TEXT =
  /^(text\/(plain|csv|tab-separated-values|x-log|yaml|x-yaml|markdown|x-markdown)$|application\/(json|x-ndjson|yaml|x-yaml|xml|sql|toml)$)/

/** Sound and moving pictures, which the browser draws better than any library could. */
const AUDIO = /^audio\/(mpeg|mp3|ogg|wav|x-wav|webm|aac|flac|mp4)$/
const VIDEO = /^video\/(mp4|webm|ogg|quicktime)$/

/**
 * An office document — named rather than shrugged at, so a `.docx` is "needs converting", not "cannot be shown", and
 * so a converter has one branch to plug into.
 */
const DOCUMENT =
  /^application\/(msword|vnd\.ms-\w+|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.oasis\.opendocument\.[\w.]+|rtf)$/

/**
 * How much text may be rendered at once.
 *
 * ⚠️ A ceiling rather than a truncation: a 40 MB log laid out into a `<pre>` is a frozen tab. Over this it is offered
 * as a download, which is what somebody actually wants with a file that size.
 */
export const MAXIMUM_TEXT_BYTES = 512 * 1024

/**
 * Which of the ways this file can be shown.
 *
 * ⚠️ **The order is load-bearing.** Documents before text: a `.docx` is a zip of XML and would be drawn as mojibake.
 * Markdown before text: tested after it, a `.md` arriving as `text/plain` would be shown as its own source.
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

  const kindByName = formatOf(file.name)?.kind

  if (DOCUMENT.test(file.contentType) || kindByName === "document") {
    return "document"
  }

  const fitsAsText = file.sizeBytes <= MAXIMUM_TEXT_BYTES

  if ((MARKDOWN_TYPE.test(file.contentType) || kindByName === "markdown") && fitsAsText) {
    return "markdown"
  }

  if ((TEXT.test(file.contentType) || kindByName === "text") && fitsAsText) {
    return "text"
  }

  return "unshowable"
}

/**
 * Which glyph a file is drawn with.
 *
 * @param name what the file is called — its extension decides first
 * @param mediaType what the server says it is, when it says
 * @return the family
 */
export function fileFamilyOf(name: string, mediaType = ""): FileFamily {
  if (mediaType.startsWith("image/")) {
    return "image"
  }

  if (mediaType.startsWith("audio/")) {
    return "audio"
  }

  if (mediaType.startsWith("video/")) {
    return "video"
  }

  const format = formatOf(name)

  if (format) {
    return format.family
  }

  if (mediaType.startsWith("text/")) {
    return "document"
  }

  return "file"
}

import {
  File as AnyFile,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  Presentation,
  type LucideIcon,
} from "lucide-react"
import { fileKindOf, type ViewableFile } from "./fileKinds"

/**
 * The icon a file gets, and the colour it gets it in.
 *
 * <h2>⚠️ One paperclip for everything was the whole problem</h2>
 *
 * <p>A folder listing is scanned, not read — the icon is what tells a spreadsheet from a zip before any
 * of the names are. Three glyphs across every type there is (a picture, a page, a paperclip) means the
 * column is decorative, and a decorative column is width spent on nothing.</p>
 *
 * <h2>⚠️ The hue is MIXED with a theme token rather than named outright</h2>
 *
 * <p>Recognising a PDF by its red is worth keeping — it is the one thing people genuinely know about
 * file icons. A literal `#dc2626` would also be the one thing on the screen that ignored the palette,
 * across 29 of them and both light and dark, which is the mistake `FolderGlyph` exists not to repeat.
 * Mixing each hue into `--muted-foreground` keeps the family recognisable and keeps its contrast tied to
 * the theme's own text colour, so it darkens and lightens with everything else.</p>
 *
 * <h2>⚠️ Decided by kind FIRST and by extension only where the kind cannot tell</h2>
 *
 * <p>{@link fileKindOf} already knows what may be drawn and how, and it already knows that the media
 * type is unreliable for exactly the files people care about. Asking it first means the icon and the
 * viewer can never disagree — a thing shown as a spreadsheet and opened as plain text is the kind of
 * small lie an interface never recovers from.</p>
 */
export interface FileGlyphSpecification {
  Icon: LucideIcon
  /** A CSS colour, already mixed against the theme. */
  tint: string
}

/**
 * The family's hues, named for what they mean so the mapping below reads as a decision rather than as hex.
 *
 * ⚠️ **Exported because a product files things that are document-shaped and are not files.** A knowledge
 * base's pages sit in a tree beside this one and must be the same blue; the alternative is a hex literal
 * in a product, which is the one thing on a screen that ignores the palette.
 */
export const GLYPH_HUES = {
  picture: "#8b5cf6",
  document: "#3b82f6",
  sheet: "#16a34a",
  slides: "#f97316",
  portable: "#dc2626",
  sound: "#ec4899",
  motion: "#6366f1",
  code: "#06b6d4",
  data: "#eab308",
  bundle: "#f59e0b",
  plain: "#94a3b8",
} as const

/**
 * ⚠️ **65% of the hue against the theme's own muted text**, which is the ratio at which the family stays
 * apart in a light theme without any of them shouting in a dark one. Less and a spreadsheet and a
 * document stop being different colours; more and the row grows a set of stickers.
 */
export function glyphTint(hue: string): string {
  return `color-mix(in srgb, ${hue} 65%, var(--muted-foreground))`
}

const SHEET_EXTENSION = /\.(xlsx?|ods|numbers|csv|tsv)$/i
const SLIDES_EXTENSION = /\.(pptx?|odp|key)$/i
const ARCHIVE = /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|jar|war|iso)$/i
const DATA_EXTENSION = /\.(json|jsonl|ndjson|ya?ml|toml|ini|cfg|conf|properties|env)$/i
const CODE_EXTENSION =
  /\.(jsx?|tsx?|mjs|cjs|java|kt|kts|gradle|py|rb|go|rs|php|cs|c|h|cpp|hpp|sh|bash|zsh|ps1|bat|sql|xml|html?|css|scss|less|svg|patch|diff|jmp|el|dockerfile)$/i

/**
 * Which icon, and in which colour.
 *
 * @param file what is being drawn
 * @return the glyph and its tint
 */
export function fileGlyphOf(file: ViewableFile): FileGlyphSpecification {
  const kind = fileKindOf(file)

  if (kind === "image") {
    return { Icon: FileImage, tint: glyphTint(GLYPH_HUES.picture) }
  }

  if (kind === "pdf") {
    return { Icon: FileText, tint: glyphTint(GLYPH_HUES.portable) }
  }

  if (kind === "audio") {
    return { Icon: FileAudio, tint: glyphTint(GLYPH_HUES.sound) }
  }

  if (kind === "video") {
    return { Icon: FileVideo, tint: glyphTint(GLYPH_HUES.motion) }
  }

  if (kind === "markdown") {
    return { Icon: FileType, tint: glyphTint(GLYPH_HUES.document) }
  }

  // ⚠️ A spreadsheet and a deck before the generic document branch: all three are the `document` kind,
  // and all three would otherwise draw as a page — which is the paperclip problem one level in.
  if (SHEET_EXTENSION.test(file.name)) {
    return { Icon: FileSpreadsheet, tint: glyphTint(GLYPH_HUES.sheet) }
  }

  if (SLIDES_EXTENSION.test(file.name)) {
    return { Icon: Presentation, tint: glyphTint(GLYPH_HUES.slides) }
  }

  if (kind === "document") {
    return { Icon: FileText, tint: glyphTint(GLYPH_HUES.document) }
  }

  if (ARCHIVE.test(file.name)) {
    return { Icon: FileArchive, tint: glyphTint(GLYPH_HUES.bundle) }
  }

  if (DATA_EXTENSION.test(file.name)) {
    return { Icon: FileJson, tint: glyphTint(GLYPH_HUES.data) }
  }

  if (CODE_EXTENSION.test(file.name)) {
    return { Icon: FileCode, tint: glyphTint(GLYPH_HUES.code) }
  }

  if (kind === "text") {
    return { Icon: FileText, tint: glyphTint(GLYPH_HUES.plain) }
  }

  return { Icon: AnyFile, tint: glyphTint(GLYPH_HUES.plain) }
}

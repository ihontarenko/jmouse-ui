import type { CSSProperties } from "react"
import { fileFamilyOf, type FileFamily } from "@jmouse/file-handling"
import { joinClassNames } from "../lib/classNames"

export type FileGlyphKind = FileFamily | "folder"

/**
 * File recognition belongs to the library; products can supply a kind for their own formats.
 *
 * ⚠️ **The family comes from `@jmouse/file-handling`**, the same table the viewers decide by — the kit kept its own
 * extension list until it disagreed with them about `.svg`, `.md` and `.pdf` on one screen.
 */
export function fileGlyphKind(name: string, mediaType = ""): FileGlyphKind {
  return fileFamilyOf(name, mediaType)
}

export interface FileGlyphProperties {
  name: string
  mediaType?: string
  kind?: FileGlyphKind
  size?: "small" | "large"
  className?: string
}

/** The same folded document and extension band at tile, tree and tab sizes. */
export function FileGlyph({ name, mediaType, kind = fileGlyphKind(name, mediaType), size = "small", className }: FileGlyphProperties) {
  const suffix = name.includes(".") ? name.split(".").pop()! : "FILE"
  const label = (suffix.length <= 4 ? suffix : kind === "document" ? "DOC" : "FILE").toUpperCase()
  return (
    <svg viewBox="0 0 48 56" className={joinClassNames("kit-file-glyph", className)} data-kind={kind} data-size={size} aria-hidden="true" focusable="false" style={{ "--kit-file-glyph-color": `var(--kit-file-${kind}, var(--kit-accent))` } as CSSProperties}>
      {kind === "folder" ? <><path d="M3 12a3 3 0 0 1 3-3h12l6 6h18a3 3 0 0 1 3 3v26a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" fill="currentColor" /><path d="M3 20h42" stroke="var(--kit-surface)" strokeOpacity=".4" strokeWidth="3" /></> : <>
        <path d="M7 2h24l10 10v41H7Z" fill="var(--kit-surface)" stroke="var(--kit-line-strong)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M31 2v11h10" fill="var(--kit-surface-2)" stroke="var(--kit-line-strong)" strokeWidth="2" />
        {kind === "image" ? <path d="m12 32 8-9 6 6 4-4 6 7M16 18h.1" fill="none" stroke="currentColor" strokeWidth="3" /> : kind === "audio" || kind === "video" ? <path d="m20 18 12 8-12 8Z" fill="currentColor" /> : kind === "archive" ? <path d="M22 14h5v5h-5v5h5v5h-5v5h5" fill="none" stroke="currentColor" strokeWidth="3" /> : kind === "code" || kind === "data" ? <path d="m18 18-7 7 7 7m12-14 7 7-7 7m-4-16-4 20" fill="none" stroke="currentColor" strokeWidth="2.5" /> : kind === "sheet" ? <path d="M13 17h22v16H13Zm0 8h22M23 17v16" fill="none" stroke="currentColor" strokeWidth="2" /> : <path d="M15 19h18M15 25h18M15 31h12" stroke="currentColor" strokeWidth="2.5" />}
        <path d="M6 37h36v17H6Z" fill="currentColor" />
        <text x="24" y="49" textAnchor="middle" fill="var(--kit-on-accent)" fontFamily="var(--kit-font-technical)" fontSize="10" fontWeight="700">{label}</text>
      </>}
    </svg>
  )
}

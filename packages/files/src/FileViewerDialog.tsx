import { useEffect, useState, type ReactNode } from "react"
import { Download, FileQuestion, Loader2 } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@jmouse/ui"
import { fileKindOf, readableFileSize, type ViewableFile } from "./fileKinds"

/**
 * Looking at a file without leaving the page it belongs to.
 *
 * <h2>⚠️ A dialog rather than a new tab, and it is not a preference</h2>
 *
 * <p>A file is read <em>against</em> the thing it is attached to — "the screenshot shows the field
 * empty, which the description says it is not". A new tab puts the two in different windows, so
 * checking one against the other becomes alt-tabbing; and a tab showing a `blob:` URL has no filename,
 * no size and no way back.</p>
 *
 * <h2>⚠️ Not only images</h2>
 *
 * <p>The reason to attach a PDF or a log is for somebody to read it. A viewer that handled pictures and
 * sent everything else to the downloads folder would be a viewer for the easy half. What genuinely
 * cannot be shown <strong>says so and keeps the download reachable</strong> — which is a different thing
 * from an empty frame.</p>
 *
 * <h2>⚠️ The fetch is the PRODUCT'S, and that is the whole shape of this component</h2>
 *
 * <p>{@link FileViewerProperties#bytes} is a function the caller supplies. Every product authenticates
 * differently — a bearer header here, a share token there — and an `&lt;img src&gt;` or an
 * `&lt;iframe src&gt;` pointed at an authenticated route carries no credentials at all and answers 401,
 * which renders as <em>the file is missing</em>. A library that fetched would have to pick one product's
 * answer or grow a configuration axis for something the product already has.</p>
 */
export interface FileViewerProperties {
  /** The file to show, or {@code null} to show nothing. */
  file: ViewableFile | null

  /** How to get its bytes — the product's own authenticated request. */
  bytes: (file: ViewableFile) => Promise<Blob>

  /**
   * How to render Markdown, where the product has a renderer.
   *
   * <p>⚠️ A slot rather than a dependency. Every product's Markdown means something slightly different —
   * Tessera resolves `TES-42` into a live reference, Kiwi resolves page addresses — and a renderer
   * chosen here would be the wrong one everywhere. Omitted, Markdown falls back to its own source, which
   * is honest rather than clever.</p>
   */
  renderMarkdown?: (markdown: string) => ReactNode

  /** What the Download button does. Omit to leave it out. */
  onDownload?: (file: ViewableFile) => void

  /** Closing. */
  onOpenChange: (open: boolean) => void
}

export function FileViewerDialog({
  file,
  bytes,
  renderMarkdown,
  onDownload,
  onOpenChange,
}: FileViewerProperties) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const kind = fileKindOf(file)
  const asText = kind === "text" || kind === "markdown"

  // ⚠️ Two kinds are decided WITHOUT the bytes, so the bytes are never asked for. Fetching a 30 MB
  // `.docx` in order to say "download this to open it" is a download nobody asked for, over a link
  // somebody may only have hovered.
  const undrawable = kind === "unshowable" || kind === "document"

  useEffect(() => {
    if (!file || undrawable) {
      return
    }

    let stale = false
    let created: string | null = null

    setObjectUrl(null)
    setText(null)
    setFailed(false)

    bytes(file)
      .then(async (blob) => {
        if (stale) {
          return
        }

        if (asText) {
          // ⚠️ Read as text rather than framed. A text/plain blob in an iframe is drawn by the browser's
          // own viewer, which ignores the theme and cannot be scrolled with the dialog.
          setText(await blob.text())

          return
        }

        created = URL.createObjectURL(blob)
        setObjectUrl(created)
      })
      .catch(() => {
        if (!stale) {
          setFailed(true)
        }
      })

    return () => {
      stale = true

      // ⚠️ Revoked, always. Without this every file ever opened stays in memory for the life of the tab,
      // and the leak is invisible until a long session gets heavy.
      if (created) {
        URL.revokeObjectURL(created)
      }
    }
    // `bytes` is deliberately not a dependency: callers pass an inline closure, so depending on it would
    // refetch on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, undrawable, asText])

  if (!file) {
    return null
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      {/* Wide and tall, because the point is to LOOK at the thing — a dialog sized for a form shows a
          screenshot at postage-stamp scale and defeats the reason it is here. */}
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="truncate">{file.name}</DialogTitle>
          <DialogDescription>
            {file.contentType} · {readableFileSize(file.sizeBytes)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] min-h-48 items-center justify-center overflow-auto rounded-md border bg-muted/30">
          {failed && <Unshowable reason="Those bytes could not be fetched." />}

          {!failed && kind === "unshowable" && (
            <Unshowable reason={`A ${file.contentType} cannot be shown here. Download it to open it.`} />
          )}

          {/* ⚠️ Says what it IS and what would be needed, rather than refusing flatly — the two are
              genuinely different answers and somebody looking at a `.docx` deserves the second one. */}
          {!failed && kind === "document" && (
            <Unshowable reason="An office document has to be converted before it can be shown. Download it to open it in the application that owns it." />
          )}

          {!failed && !undrawable && objectUrl === null && text === null && (
            <span className="flex items-center gap-2 py-12 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </span>
          )}

          {kind === "image" && objectUrl && (
            <img src={objectUrl} alt={file.name} className="max-h-[70vh] w-auto object-contain" />
          )}

          {kind === "pdf" && objectUrl && (
            <iframe src={objectUrl} title={file.name} className="h-[70vh] w-full" />
          )}

          {/* ⚠️ The browser's own players, deliberately. A scrub bar, a volume control and a keyboard
              map re-implemented here would be worse than the native ones and would ignore the
              platform's captions, playback-rate and picture-in-picture settings. */}
          {kind === "audio" && objectUrl && (
            <audio controls src={objectUrl} className="w-full max-w-xl px-6 py-10">
              <track kind="captions" />
            </audio>
          )}

          {kind === "video" && objectUrl && (
            <video controls src={objectUrl} className="max-h-[70vh] w-full bg-black">
              <track kind="captions" />
            </video>
          )}

          {kind === "markdown" && text !== null && (
            <div className="max-h-[70vh] w-full overflow-auto p-4 text-left">
              {/* ⚠️ Without a renderer this shows the source, and that is the intended fallback: a note
                  shown as its own text is readable, where a half-rendered one is a bug report. */}
              {renderMarkdown ? renderMarkdown(text) : <PlainText text={text} />}
            </div>
          )}

          {kind === "text" && text !== null && <PlainText text={text} />}
        </div>

        <DialogFooter className="sm:justify-between">
          {onDownload ? (
            <Button type="button" variant="outline" onClick={() => onDownload(file)}>
              <Download className="mr-1 size-4" />
              Download
            </Button>
          ) : (
            <span />
          )}

          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PlainText({ text }: { text: string }) {
  return (
    <pre className="max-h-[70vh] w-full overflow-auto p-3 text-left font-mono text-xs leading-relaxed">
      {text}
    </pre>
  )
}

/** ⚠️ Says WHY, and keeps the download reachable — an empty frame is not an answer. */
function Unshowable({ reason }: { reason: string }) {
  return (
    <span className="flex flex-col items-center gap-2 px-6 py-12 text-center text-xs text-muted-foreground">
      <FileQuestion className="size-6" />
      {reason}
    </span>
  )
}

import { Button, Code, EmptyState, Notice, Waiting } from "@jmouse/ui-kit"
import { fileKindOf, readableFileSize, reasonOf, type FileKind } from "@jmouse/file-handling"
import { useEffect, useState } from "react"
import type { ExplorerAdapter, ExplorerEntry } from "./adapter"

export interface ExplorerViewerLabels {
  reading: string
  readFailed(name: string, reason: string): string
  notShowable: string
  notShowableDescription: string
  needsConverting: string
  noBytes: string
  download: string
}

export interface ExplorerViewerProperties {
  file: ExplorerEntry
  adapter: ExplorerAdapter
  labels: ExplorerViewerLabels
  onDownload?(): void
}

type Reading =
  | { state: "reading" }
  | { state: "failed"; reason: string }
  | { state: "read"; kind: FileKind; address: string; text?: string }

/**
 * A file, looked at without leaving the explorer.
 *
 * ⚠️ **The kind is decided by `fileKindOf`, the same decision `@jmouse/files` makes** — one package previewing a `.md`
 * while the other offered it as a download is the drift the headless entry exists to stop.
 *
 * ⚠️ **Text is laid out as source, never framed.** `.html` and `.svg` land in the text branch on purpose: as a `<pre>`
 * they are inert; framed, they would run against the reader's own session.
 */
export function ExplorerViewer({ file, adapter, labels, onDownload }: ExplorerViewerProperties) {
  const [reading, setReading] = useState<Reading>({ state: "reading" })
  const read = adapter.read

  useEffect(() => {
    if (!read) {
      return
    }

    let current = true
    let address: string | undefined

    setReading({ state: "reading" })

    read(file)
      .then(async (blob) => {
        const kind = fileKindOf({ name: file.name, contentType: file.mediaType ?? blob.type, sizeBytes: file.size ?? blob.size })
        const text = kind === "text" || kind === "markdown" ? await blob.text() : undefined

        // ⚠️ Only while still shown. Unmounted before the bytes arrived, the cleanup has already run — an address made
        // now would never be revoked and would keep the whole file alive for the life of the tab.
        if (!current) {
          return
        }

        address = URL.createObjectURL(blob)
        setReading({ state: "read", kind, address, text })
      })
      .catch((failure: unknown) => {
        if (current) {
          setReading({ state: "failed", reason: reasonOf(failure) })
        }
      })

    return () => {
      current = false

      if (address) {
        URL.revokeObjectURL(address)
      }
    }
    // ⚠️ Keyed on the ID, and only the words are left out of the reading: a listing refresh hands over a new object
    // with the same bytes, and reading it again would flash the viewer every time somebody renames a sibling. The
    // failure keeps the server's reason, and the sentence around it is written at render with today's labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, read])

  const download = onDownload ? <Button icon="download" onClick={onDownload}>{labels.download}</Button> : undefined

  if (!read) {
    return <EmptyState flush icon="file" title={labels.notShowable} description={labels.noBytes} />
  }

  if (reading.state === "reading") {
    return <Waiting label={labels.reading} />
  }

  if (reading.state === "failed") {
    return <div className="kit-file-view" data-kind="failed"><Notice tone="danger">{labels.readFailed(file.name, reading.reason)}</Notice></div>
  }

  const { kind, address, text } = reading

  if (kind === "image") {
    return <div className="kit-file-view" data-kind={kind}><img src={address} alt={file.name} /></div>
  }

  if (kind === "pdf") {
    return <div className="kit-file-view" data-kind={kind}><iframe src={address} title={file.name} /></div>
  }

  if (kind === "audio") {
    return <div className="kit-file-view" data-kind={kind}><audio src={address} controls aria-label={file.name} /></div>
  }

  if (kind === "video") {
    return <div className="kit-file-view" data-kind={kind}><video src={address} controls aria-label={file.name} /></div>
  }

  if (text !== undefined) {
    return <div className="kit-file-view" data-kind={kind}><Code code={text} label={file.name} /></div>
  }

  const size = file.size === undefined ? "" : ` · ${readableFileSize(file.size)}`

  return <EmptyState flush icon="file" title={labels.notShowable}
    description={`${kind === "document" ? labels.needsConverting : labels.notShowableDescription}${size}`}
    actions={download} />
}

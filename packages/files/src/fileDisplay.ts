import type { DragEvent } from "react"
import type { Directory, ManagedFile } from "./types"

/**
 * How a file is presented, in one place.
 *
 * The list, the tree and the detail panel all render the same file and were formatting it three times
 * over before this existed. Nothing here talks to a server or to React; it is the vocabulary those
 * three share.
 */

/**
 * ⚠️ **A custom MIME type rather than `text/plain`.** `dataTransfer.getData` is unreadable during
 * `dragover` — only the *type* is — so this is the only thing a drop target can use to decide whether to
 * light up before the drop lands.
 *
 * ⚠️ **Named for the library, not for a product.** It was `application/x-innoventa-file`, which meant a
 * file dragged in one product and a drop target in another disagreed about a string neither of them
 * chose deliberately. It is one namespace because it is one mechanism.
 */
export const FILE_DRAG_TYPE = "application/x-jmouse-file"

/**
 * What makes a file draggable onto the tree, written once.
 *
 * ⚠️ **Both layouts must set the SAME payload type**, or dragging works in rows and silently does
 * nothing in tiles — the tree decides whether to light up from `dataTransfer.types` alone, so a layout
 * that spelt the type differently would look like a broken drop target rather than a broken drag.
 */
export function fileDragProperties(fileId: string) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(FILE_DRAG_TYPE, fileId)
      event.dataTransfer.effectAllowed = "move" as const
    },
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatFileDate(value: string): string {
  return new Date(value).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })
}

/** The short type label a row shows — `image/png` reads as `png`. */
export function typeLabel(contentType: string): string {
  return contentType.split("/")[1] ?? contentType
}

export function isImage(file: Pick<ManagedFile, "contentType">): boolean {
  return file.contentType.startsWith("image/")
}

export function isPdf(file: Pick<ManagedFile, "contentType">): boolean {
  return file.contentType === "application/pdf"
}

/**
 * Hand a blob to the browser as a download.
 *
 * ⚠️ **From the BYTES already fetched, not from a URL, and that is what makes it library-side at all.**
 * Every file route in these products is authenticated, so an `<a href>` pointed at one downloads a 401
 * page under the right filename. The viewer has the blob in hand; saving it is then the same three lines
 * in every product, which is three places for the object URL to stop being revoked.
 *
 * ⚠️ **Revoked on the next tick rather than immediately.** Chrome starts the download asynchronously —
 * revoking in the same statement cancels it — and never revoking keeps every file ever downloaded alive
 * for the life of the tab.
 *
 * @param blob what to save
 * @param name what to call it
 */
export function saveBlob(blob: Blob, name: string): void {
  const address = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = address
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(address), 0)
}

/**
 * What to call a directory on screen.
 *
 * ⚠️ **`name`, never the last segment of `path`.** The two are different things and only look alike on a
 * root: a folder named "Datasheets 2026" has the path `…/datasheets-2026`, because the path is built
 * from slugs and is the storage key everything beneath it is written under. Reading the label off the
 * path shows people the slug — lower-cased, hyphenated, and not what they typed.
 *
 * ⚠️ **A ROOT is renamed, and the name for it is the product's to choose.** A root's own `name` is its
 * storage prefix — `innoventa/files`, `kiwi/files` — which is not anything a person picked, and in a
 * product where every account has a tree it would call every cabinet the same thing. Innoventa says
 * "My files"; a product with one shared tree wants something else entirely, which is why this is a
 * parameter and not a constant.
 */
export function directoryLabel(directory: Pick<Directory, "name" | "root">, rootLabel = "Files"): string {
  return directory.root ? rootLabel : directory.name
}

/**
 * Where a directory sits, in names a person recognises.
 *
 * ⚠️ **Built from `name`, never from `path`** — see {@link directoryLabel}. The tree arrives flat but
 * ordered, so walking `parentId` up costs one map and a walk bounded by the depth rather than by the
 * size of the tree.
 */
export function directoryTrail(
  directories: Array<Pick<Directory, "id" | "name" | "parentId" | "root">>,
  directoryId: string | null,
  rootLabel = "Files",
): string[] {
  if (!directoryId) {
    return []
  }

  const byId = new Map(directories.map((directory) => [directory.id, directory]))
  const trail: string[] = []

  let current = byId.get(directoryId)

  while (current) {
    trail.unshift(directoryLabel(current, rootLabel))
    current = current.parentId ? byId.get(current.parentId) : undefined
  }

  return trail
}

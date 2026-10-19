import { failureStatus, reasonOf } from "@jmouse/file-handling"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ExplorerAdapter, ExplorerEntry } from "./adapter"

/**
 * Everything the explorer has learned about the adapter's tree, and the one folder being looked at.
 *
 * ⚠️ **A flat map of every entry seen, not a tree.** The kit's workspace draws the tree, the breadcrumb and the
 * listing from one flat list in which every folder names its parent — so what is kept here is exactly what it reads,
 * and a folder learned from `ancestors` and one learned from `list` land in the same place.
 *
 * ⚠️ **A folder's listing REPLACES its children.** What `list` answers is the truth about that folder; merging it
 * would keep showing a file somebody removed in another tab until the page reloads.
 *
 * ⚠️ **Words are the caller's.** What is kept here is the server's reason and whether the folder has gone; the
 * sentence around them is written where the labels are, so a translation decides its own word order.
 */

/** Why a request about the tree failed. */
export interface CatalogueFailure {
  /** The server's words, or empty when it said nothing. */
  reason: string
  /** The folder is not there any more — it was answered as missing, not refused. */
  gone: boolean
}

/** The state of the shown folder's listing. */
export interface FolderState {
  loading: boolean
  failure?: CatalogueFailure
}

export interface ExplorerCatalogue {
  entries: ExplorerEntry[]
  folder: FolderState
  /** The folder shape — `folders` or `ancestors` — could not be had. The listing itself may still be fine. */
  shapeFailure?: CatalogueFailure
  dismissShapeFailure(): void
  /** Put what an act answered in place without waiting for a listing. */
  record(entry: ExplorerEntry): void
  /** Take an entry out — and, for a folder, everything filed under it. */
  forget(entryId: string): void
}

const GONE_STATUSES = new Set([404, 410])

/** Joins entry IDs into one dependency key; a character no ID carries. */
const ID_SEPARATOR = "\u0000"

function catalogueFailureOf(failure: unknown): CatalogueFailure {
  const status = failureStatus(failure)

  return { reason: reasonOf(failure), gone: status !== undefined && GONE_STATUSES.has(status) }
}

/**
 * @param adapter how this product reaches its files
 * @param folderId the folder being looked at; null is the root
 * @param wantedIds entries the host names — opened files — that must be known whatever folder is shown
 */
export function useExplorerCatalogue(adapter: ExplorerAdapter, folderId: string | null, wantedIds: readonly string[] = []): ExplorerCatalogue {
  const [entries, setEntries] = useState<Map<string, ExplorerEntry>>(() => new Map())
  const [folder, setFolder] = useState<FolderState>({ loading: true })
  const [shapeFailure, setShapeFailure] = useState<CatalogueFailure>()

  // ⚠️ The newest request per folder wins. Stepping quickly through three folders starts three listings, and the
  // slowest one answering last must not paint its children under the folder somebody is now looking at.
  const latestRequest = useRef(0)

  const learn = useCallback((learned: ExplorerEntry[], replacingChildrenOf?: string | null) => {
    setEntries((current) => {
      const next = new Map(current)

      if (replacingChildrenOf !== undefined) {
        for (const entry of current.values()) {
          if (entry.parentId === replacingChildrenOf) {
            next.delete(entry.id)
          }
        }
      }

      for (const entry of learned) {
        next.set(entry.id, entry)
      }

      return next
    })
  }, [])

  useEffect(() => {
    latestRequest.current += 1
    const request = latestRequest.current

    setFolder({ loading: true })

    adapter.list(folderId).then((children) => {
      if (request === latestRequest.current) {
        learn(children, folderId)
        setFolder({ loading: false })
      }
    }, (failure: unknown) => {
      if (request === latestRequest.current) {
        setFolder({ loading: false, failure: catalogueFailureOf(failure) })
      }
    })
  }, [adapter, folderId, learn])

  // The whole folder shape once, when the backend can give it; otherwise the trail to where we start.
  useEffect(() => {
    if (!adapter.folders) {
      return
    }

    let current = true

    adapter.folders().then((folders) => {
      if (current) {
        learn(folders)
      }
    }, (failure: unknown) => {
      if (current) {
        setShapeFailure(catalogueFailureOf(failure))
      }
    })

    return () => {
      current = false
    }
  }, [adapter, learn])

  const known = folderId === null || entries.has(folderId)

  useEffect(() => {
    if (folderId === null || known || !adapter.ancestors) {
      return
    }

    let current = true

    adapter.ancestors(folderId).then((trail) => {
      if (current) {
        learn(trail)
      }
    }, (failure: unknown) => {
      if (current) {
        setShapeFailure(catalogueFailureOf(failure))
      }
    })

    return () => {
      current = false
    }
  }, [adapter, folderId, known, learn])

  // ⚠️ Keyed on the IDs as one string: the host hands over a new array on every render, and a lookup per render would
  // ask for the same entry again whenever anything else changed.
  const missing = wantedIds.filter((entryId) => !entries.has(entryId)).join(ID_SEPARATOR)

  useEffect(() => {
    if (missing === "" || !adapter.find) {
      return
    }

    let current = true

    for (const entryId of missing.split(ID_SEPARATOR)) {
      adapter.find(entryId).then((found) => {
        if (current) {
          learn([found])
        }
      }, (failure: unknown) => {
        if (current) {
          setShapeFailure(catalogueFailureOf(failure))
        }
      })
    }

    return () => {
      current = false
    }
  }, [adapter, missing, learn])

  const record = useCallback((entry: ExplorerEntry) => learn([entry]), [learn])

  const forget = useCallback((entryId: string) => {
    setEntries((current) => {
      const next = new Map(current)
      const leaving = [entryId]

      while (leaving.length > 0) {
        const id = leaving.pop()!

        next.delete(id)

        for (const entry of next.values()) {
          if (entry.parentId === id) {
            leaving.push(entry.id)
          }
        }
      }

      return next
    })
  }, [])

  const dismissShapeFailure = useCallback(() => setShapeFailure(undefined), [])

  const list = useMemo(() => Array.from(entries.values()), [entries])

  return { entries: list, folder, shapeFailure, dismissShapeFailure, record, forget }
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ExplorerAdapter, ExplorerEntry } from "./adapter"
import { because } from "./headless/failures"

/**
 * Everything the explorer has learned about the adapter's tree, and the one folder being looked at.
 *
 * ⚠️ **A flat map of every entry seen, not a tree.** The kit's workspace draws the tree, the breadcrumb and the
 * listing from one flat list in which every folder names its parent — so what is kept here is exactly what it reads,
 * and a folder learned from `ancestors` and one learned from `list` land in the same place.
 *
 * ⚠️ **A folder's listing REPLACES its children.** What `list` answers is the truth about that folder; merging it
 * would keep showing a file somebody removed in another tab until the page reloads.
 */

/** The state of the shown folder's listing. */
export interface FolderState {
  loading: boolean
  /** The server's words, when the listing could not be had. */
  failure?: string
}

export interface ExplorerCatalogue {
  entries: ExplorerEntry[]
  folder: FolderState
  /** Load the shown folder again — after an act, or when somebody asks. */
  refresh(): Promise<void>
  /** Put what an act answered in place without waiting for a listing. */
  record(entry: ExplorerEntry): void
  forget(entryId: string): void
}

/**
 * @param adapter how this product reaches its files
 * @param folderId the folder being looked at; null is the root
 * @param unreadable the words for a listing that failed, before the server's own
 */
export function useExplorerCatalogue(adapter: ExplorerAdapter, folderId: string | null, unreadable: string): ExplorerCatalogue {
  const [entries, setEntries] = useState<Map<string, ExplorerEntry>>(() => new Map())
  const [folder, setFolder] = useState<FolderState>({ loading: true })

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

  const load = useCallback(async () => {
    latestRequest.current += 1
    const request = latestRequest.current

    setFolder({ loading: true })

    try {
      const children = await adapter.list(folderId)

      if (request !== latestRequest.current) {
        return
      }

      learn(children, folderId)
      setFolder({ loading: false })
    } catch (failure) {
      if (request === latestRequest.current) {
        setFolder({ loading: false, failure: `${unreadable}${because(failure)}` })
      }
    }
  }, [adapter, folderId, learn, unreadable])

  useEffect(() => {
    void load()
  }, [load])

  // The whole folder shape once, when the backend can give it; otherwise the trail to where we start.
  useEffect(() => {
    let current = true

    if (adapter.folders) {
      void adapter.folders().then((folders) => {
        if (current) {
          learn(folders)
        }
      }, () => undefined)
    }

    return () => {
      current = false
    }
  }, [adapter, learn])

  useEffect(() => {
    if (folderId === null || entries.has(folderId) || !adapter.ancestors) {
      return
    }

    let current = true

    void adapter.ancestors(folderId).then((trail) => {
      if (current) {
        learn(trail)
      }
    }, () => undefined)

    return () => {
      current = false
    }
    // ⚠️ Not keyed on `entries`: once the trail is known this has nothing to do, and re-running on every learned entry
    // would ask for the same ancestors again whenever a listing lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, folderId, learn])

  const record = useCallback((entry: ExplorerEntry) => learn([entry]), [learn])

  const forget = useCallback((entryId: string) => {
    setEntries((current) => {
      const next = new Map(current)

      next.delete(entryId)

      return next
    })
  }, [])

  const list = useMemo(() => Array.from(entries.values()), [entries])

  return { entries: list, folder, refresh: load, record, forget }
}

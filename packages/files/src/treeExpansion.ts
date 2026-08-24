import { useTreeExpansion, type TreeExpansion } from "@jmouse/ui"
import type { Directory } from "./types"

/**
 * Which folders are open, and which rows that leaves on screen.
 *
 * <h2>⚠️ The state machine itself is `@jmouse/ui`'s (UIK-22)</h2>
 *
 * <p>Collapsed by default, the linked branch opened once and never re-opened on a refetch, optionally
 * remembered in storage — none of that is about <em>files</em>, and a knowledge base's section tree
 * wanted every word of it. What stayed here is the half that genuinely is about files: turning the
 * library's flat, `depth`-carrying subtree into the two things the shared hook and the render need — a
 * chain down to the selected folder, and the rows that survive the closed branches.</p>
 */

/**
 * The folders above this one, outermost first — the one asked about is not among them.
 *
 * ⚠️ Walks `parentId` up a map rather than searching per level, so it costs the depth and not the size
 * of the tree. A cycle cannot happen in a nested set, but a `seen` guard is a cheap way not to hang the
 * interface if one ever did.
 */
export function ancestorIds(directories: Directory[], directoryId: string): string[] {
  const byId = new Map(directories.map((directory) => [directory.id, directory]))
  const ancestors: string[] = []
  const seen = new Set<string>([directoryId])

  let current = byId.get(directoryId)?.parentId

  while (current && !seen.has(current)) {
    seen.add(current)
    ancestors.unshift(current)
    current = byId.get(current)?.parentId
  }

  return ancestors
}

/** The ids that have something under them — everything else is a leaf and is offered no twisty. */
export function parentIds(directories: Directory[]): Set<string> {
  return new Set(
    directories
      .map((directory) => directory.parentId)
      .filter((parentId): parentId is string => Boolean(parentId)),
  )
}

/**
 * The rows to draw: a root always, anything else only while every folder above it is open.
 *
 * ⚠️ **One pass, because the list is ordered shallowest first.** A parent is therefore already decided
 * by the time its children are read, so visibility is `parent is visible AND parent is open` rather than
 * a walk up the chain per row.
 */
export function visibleDirectories(directories: Directory[], expanded: ReadonlySet<string>): Directory[] {
  const shown = new Set<string>()

  return directories.filter((directory) => {
    const visible = directory.root || Boolean(directory.parentId && shown.has(directory.parentId))

    if (visible && expanded.has(directory.id)) {
      shown.add(directory.id)
    }

    return visible
  })
}

/**
 * Open folders, with the branch the manager is standing in opened for whoever arrived there.
 *
 * ⚠️ **The chain is `null` until the folder is actually in the subtree.** On a deep link the address is
 * read before the tree has arrived, so the named folder's ancestors are not knowable yet — handing the
 * shared hook nothing is what makes it wait and try again rather than open the wrong thing.
 */
export function useDirectoryExpansion(
  directories: Directory[],
  selectedId: string | null,
  storageKey?: string,
): TreeExpansion {
  const known = Boolean(selectedId && directories.some((directory) => directory.id === selectedId))

  return useTreeExpansion({
    storageKey,
    revealPath: known && selectedId ? [...ancestorIds(directories, selectedId), selectedId] : null,
  })
}

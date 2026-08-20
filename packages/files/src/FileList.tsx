import { Skeleton } from "@jmouse/ui"
import { FileRows } from "./FileRows"
import { FileTiles } from "./FileTiles"
import type { FileActions } from "./useFileActions"
import type { Directory, FileLibraryPort, FilesLayout, ManagedFile } from "./types"

/**
 * What is filed in the selected folder.
 *
 * ⚠️ **A row is draggable, and that is the only way to move a file.** The alternative — a "move to…"
 * dialog listing every folder — is a second copy of the tree that has to be kept in step with the real
 * one. Dragging onto the tree already on screen needs neither. Both layouts drag; that is what
 * `fileDragProperties` is for.
 *
 * ⚠️ **This file decides which drawing, and nothing else.** The two layouts and the actions they share
 * are three modules beside it, because the version that held all of them was one screen's worth of
 * markup with the state for both threaded through it.
 */
export function FileList({
  directories,
  files,
  port,
  actions,
  layout,
  isLoading,
  emptyHint,
  onOpenDirectory,
  onOpenFile,
  onChanged,
  rootLabel,
  canWrite = true,
}: {
  /** The folders directly inside the one being looked at — drawn by the tile layout only. */
  directories: Directory[]
  files: ManagedFile[]
  port: FileLibraryPort
  actions: FileActions
  layout: FilesLayout
  isLoading: boolean
  emptyHint: string
  onOpenDirectory: (directoryId: string) => void
  /** Clicking a file opens it in the viewer — see `FileManager`. */
  onOpenFile: (file: ManagedFile) => void
  onChanged: () => void
  rootLabel?: string
  canWrite?: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (files.length === 0 && directories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyHint}
      </div>
    )
  }

  if (layout === "tiles") {
    return (
      <FileTiles
        directories={directories}
        files={files}
        port={port}
        actions={actions}
        onOpenDirectory={onOpenDirectory}
        onOpenFile={onOpenFile}
        onChanged={onChanged}
        rootLabel={rootLabel}
        canWrite={canWrite}
      />
    )
  }

  return <FileRows files={files} port={port} actions={actions} onOpen={onOpenFile} />
}

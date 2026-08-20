import { useState } from "react"
import { FileThumbnail } from "./FileThumbnail"
import { FolderGlyph } from "./FolderGlyph"
import { RenameField } from "./FileRows"
import { FileActionButtons, type FileActions } from "./useFileActions"
import { directoryLabel, fileDragProperties, FILE_DRAG_TYPE, formatBytes } from "./fileDisplay"
import type { Directory, FileLibraryPort, ManagedFile } from "./types"

/**
 * Folders and files as tiles — the layout for *recognising* something rather than reading about it.
 *
 * ⚠️ **A folder of screenshots is unusable as a list of names**, which is the whole argument for tiles
 * existing at all. An interface that offers only rows has quietly decided nobody stores pictures.
 *
 * ⚠️ **Folders are here too, and a grid without them is only half a file manager.** The tree in the
 * aside says where you are in the whole cabinet; the grid says what is in front of you — and what is in
 * front of you includes the way further in. Every file manager anybody has used works this way, and one
 * that hid its folders in a second control would be the odd one out.
 *
 * ⚠️ **Square, not 4:3.** A grid of mixed proportions reads as a broken layout rather than as varied
 * content — and a folder tile beside a picture tile is exactly the mix that makes that visible.
 *
 * ⚠️ **A folder tile is a drop target, like its row in the tree.** Dragging a file onto it re-files it,
 * which is what somebody looking at a grid of folders expects to be able to do without going back to
 * the aside.
 *
 * ⚠️ **A tile OPENS the file.** Recognising something and then having to hunt for the way to look at it
 * is the half-finished version of this layout — the picture is the affordance, so the picture is the
 * button.
 *
 * ⚠️ **`auto-fill` with a minimum, not a fixed column count.** The panel width varies with the sidebar,
 * the tree column and the window; a `grid-cols-4` that looked right on one machine is four squeezed
 * tiles on a laptop and four stretched ones on a wide monitor.
 */
export function FileTiles({
  directories,
  files,
  port,
  actions,
  onOpenDirectory,
  onOpenFile,
  onChanged,
  rootLabel,
  canWrite = true,
}: {
  /** The folders directly inside the one being looked at. Empty is normal and draws nothing. */
  directories: Directory[]
  files: ManagedFile[]
  port: FileLibraryPort
  actions: FileActions
  onOpenDirectory: (directoryId: string) => void
  /** Show this file. The manager mounts the viewer; this layout only says which. */
  onOpenFile: (file: ManagedFile) => void
  onChanged: () => void
  rootLabel?: string
  canWrite?: boolean
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))" }}>
      {directories.map((directory) => (
        <button
          key={directory.id}
          type="button"
          onClick={() => onOpenDirectory(directory.id)}
          className={[
            "group flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors hover:bg-accent/40",
            hovered === directory.id ? "ring-2 ring-primary" : "",
          ].join(" ")}
          onDragOver={(event) => {
            if (canWrite && event.dataTransfer.types.includes(FILE_DRAG_TYPE)) {
              event.preventDefault()
              setHovered(directory.id)
            }
          }}
          onDragLeave={() => setHovered(null)}
          onDrop={(event) => {
            event.preventDefault()
            setHovered(null)

            const fileId = event.dataTransfer.getData(FILE_DRAG_TYPE)

            if (canWrite && fileId) {
              void port.refileFile(fileId, directory.id).then(onChanged)
            }
          }}
        >
          {/* ⚠️ The same square as a file's thumbnail, so the grid keeps one rhythm. The glyph is
              centred inside it rather than filling it — a folder drawn edge to edge stops reading as
              an object and starts reading as a coloured tile. */}
          <span className="flex aspect-square w-full items-center justify-center rounded-md bg-muted">
            <FolderGlyph size={44} />
          </span>

          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium" title={directoryLabel(directory, rootLabel)}>
              {directoryLabel(directory, rootLabel)}
            </p>
            <p className="text-[11px] text-muted-foreground">Folder</p>
          </div>
        </button>
      ))}

      {files.map((file) => (
        <div
          key={file.id}
          {...fileDragProperties(file.id)}
          className="group relative flex flex-col gap-1.5 rounded-lg border p-2 transition-colors hover:bg-accent/40"
        >
          {/* ⚠️ A `<button>` around the picture and the name, not a handler on the tile: the actions
              float over this same square, and a click on one of them bubbles. Opening the viewer behind
              every Delete is the bug that arrangement produces. */}
          {actions.renaming === file.id ? (
            <>
              <FileThumbnail file={file} port={port} className="aspect-square w-full" />
              <div className="min-w-0">
                <RenameField file={file} actions={actions} />
                <p className="text-[11px] text-muted-foreground">{formatBytes(file.sizeBytes)}</p>
              </div>
            </>
          ) : (
            <button
              type="button"
              title={file.name}
              className="flex flex-col gap-1.5 text-left"
              onClick={() => onOpenFile(file)}
            >
              <FileThumbnail file={file} port={port} className="aspect-square w-full" />

              <span className="block min-w-0">
                <span className="block truncate text-[12.5px] font-medium">{file.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {formatBytes(file.sizeBytes)}
                </span>
              </span>
            </button>
          )}

          {/* ⚠️ Floated over the thumbnail rather than given a row of its own: a tile that grew a
              toolbar on hover would reflow the whole grid every time the pointer crossed it. */}
          <div className="absolute top-1.5 right-1.5 rounded-md bg-background/85 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <FileActionButtons file={file} port={port} actions={actions} />
          </div>
        </div>
      ))}
    </div>
  )
}

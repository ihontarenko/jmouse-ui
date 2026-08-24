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
 *
 * <h2>⚠️ The tile is the OLDER interface's, restored (`UIK-17`)</h2>
 *
 * <p>The first cut of this drew every tile as a bordered card holding a grey square, and the folder
 * glyph sat small and centred inside that square. It is a defensible layout and it is not the one this
 * product had: Innoventa's `FilesExplorerView` drew a <em>big</em> folder on a transparent tile with the
 * name centred under it, and that is the screen Ivan asked to have back.
 *
 * <p>So the three differences are deliberate rather than incidental, and all three are the reason it
 * reads as a file manager instead of a card list:
 *
 * <ul>
 *   <li>⚠️ <strong>no grey square behind the glyph.</strong> A 44px folder centred in a 9rem panel of
 *       `bg-muted` is a swatch with a small drawing on it — the folder stops being the object and the
 *       square becomes it. Drawn at 66px on nothing, the folder is the tile;
 *   <li>⚠️ <strong>no border until the pointer arrives.</strong> A grid of bordered boxes draws the
 *       grid; a grid of objects draws the objects. The hover fill is the whole affordance and it is
 *       enough;
 *   <li>⚠️ <strong>centred, with the meta line in the monospace face.</strong> Sizes and counts are
 *       figures somebody compares down a column, and a proportional face makes that impossible.
 * </ul>
 *
 * <p>⚠️ <strong>The name clamps to two lines rather than truncating to one.</strong> A centred tile has
 * width to spare vertically and none horizontally, and `Посібник Innoventa.pdf` cut to `Посібник…` is a
 * tile nobody can tell from its neighbour.
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
    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(8.875rem, 1fr))" }}>
      {directories.map((directory) => (
        <button
          key={directory.id}
          type="button"
          onClick={() => onOpenDirectory(directory.id)}
          className={[
            TILE,
            hovered === directory.id
              ? "border-dashed border-primary bg-primary/15 hover:bg-primary/15"
              : "",
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
          {/* ⚠️ The glyph itself, at the size the older interface drew it and with nothing behind it —
              see the note on the component. `GLYPH_BOX` is what keeps a folder and a file thumbnail on
              one baseline even though one is 0.8× as tall as it is wide. */}
          <span className={GLYPH_BOX}>
            <FolderGlyph size={66} />
          </span>

          <span className={TILE_NAME} title={directoryLabel(directory, rootLabel)}>
            {directoryLabel(directory, rootLabel)}
          </span>
          <span className={TILE_META}>Folder</span>
        </button>
      ))}

      {files.map((file) => (
        <div
          key={file.id}
          {...fileDragProperties(file.id)}
          className={`${TILE} cursor-default`}
        >
          {/* ⚠️ A `<button>` around the picture and the name, not a handler on the tile: the actions
              float over this same square, and a click on one of them bubbles. Opening the viewer behind
              every Delete is the bug that arrangement produces. */}
          {actions.renaming === file.id ? (
            <>
              <span className={GLYPH_BOX}>
                <FileThumbnail file={file} port={port} size={56} className={THUMBNAIL} />
              </span>
              <span className="w-full min-w-0">
                <RenameField file={file} actions={actions} />
              </span>
              <span className={TILE_META}>{formatBytes(file.sizeBytes)}</span>
            </>
          ) : (
            <button
              type="button"
              title={file.name}
              className="flex w-full cursor-pointer flex-col items-center gap-[7px]"
              onClick={() => onOpenFile(file)}
            >
              <span className={GLYPH_BOX}>
                <FileThumbnail file={file} port={port} size={56} className={THUMBNAIL} />
              </span>

              <span className={TILE_NAME}>{file.name}</span>
              <span className={TILE_META}>{formatBytes(file.sizeBytes)}</span>
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

/**
 * The tile itself — transparent until hovered, bordered only then.
 *
 * ⚠️ **`border border-transparent`, never no border at all.** The drop target and the hover state both
 * paint one, and a tile that grows its first border on hover grows by two pixels with it — a grid that
 * nudges every time the pointer crosses a cell.
 */
const TILE =
  "group relative flex min-h-[8.375rem] cursor-pointer flex-col items-center gap-[7px] " +
  "rounded-md border border-transparent bg-transparent px-2 pt-3 pb-2.5 text-center " +
  "transition-colors hover:bg-accent/40 active:scale-[0.97]"

/**
 * The fixed band the glyph sits in.
 *
 * ⚠️ **A folder is 0.8× as tall as it is wide and a thumbnail is square**, so without one band of their
 * own the two kinds of tile put their names at different heights and the grid loses its baseline.
 */
const GLYPH_BOX = "flex h-[3.3125rem] items-center justify-center"

/** ⚠️ Two lines then an ellipsis — see the note on the component. */
const TILE_NAME =
  "line-clamp-2 w-full text-[12px] leading-[1.3] font-medium break-words text-foreground"

/** ⚠️ Monospace, because everything drawn here is a figure to compare down a column. */
const TILE_META = "w-full truncate font-mono text-[10px] text-muted-foreground"

/**
 * ⚠️ **No `bg-muted`: the glyph fallback is a drawing, not a swatch, exactly as the folder is.** The
 * hairline and the shadow that a picture wants are `FileThumbnail`'s, applied only when it drew one.
 */
const THUMBNAIL = "rounded-[4px] bg-transparent"

import { Badge, Input } from "@jmouse/ui"
import { FileThumbnail } from "./FileThumbnail"
import { FileActionButtons, type FileActions } from "./useFileActions"
import { fileDragProperties, formatBytes, formatFileDate, typeLabel } from "./fileDisplay"
import type { FileLibraryPort, ManagedFile } from "./types"

/**
 * Files as a dense list — the layout for reading names, sizes and dates.
 *
 * ⚠️ **One row, one line, 40px.** The version this replaced stacked the name over a wrapping metadata
 * line inside a bordered card and came out at nearly twice the height, which is how a folder of a dozen
 * files needed scrolling. The metadata is on the same line and gives way first when the width runs out.
 *
 * ⚠️ **The row OPENS the file, and it is a `<button>` rather than a click handler on the `<li>`.** The
 * actions sit in the same row, and a handler on the line would open the viewer behind every Delete — a
 * click on a child bubbles, and stopping propagation in four places to undo one convenience is how that
 * bug comes back. A button also gets the keyboard and the focus ring for nothing.
 */
export function FileRows({
  files,
  port,
  actions,
  onOpen,
}: {
  files: ManagedFile[]
  port: FileLibraryPort
  actions: FileActions
  /** Show this file. The manager mounts the viewer; this layout only says which. */
  onOpen: (file: ManagedFile) => void
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {files.map((file) => (
        <li
          key={file.id}
          {...fileDragProperties(file.id)}
          className="group flex h-10 items-center gap-2.5 px-2 transition-colors hover:bg-accent/40"
        >
          {actions.renaming === file.id ? (
            <>
              <FileThumbnail file={file} port={port} size={24} />
              <div className="flex min-w-0 flex-1 items-center">
                <RenameField file={file} actions={actions} />
              </div>
            </>
          ) : (
            <button
              type="button"
              title="Open"
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              onClick={() => onOpen(file)}
            >
              <FileThumbnail file={file} port={port} size={24} />

              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate text-[13px] font-medium">{file.name}</span>

                {/* ⚠️ `hidden sm:flex` and `shrink-0` together: the metadata is the part worth losing on
                    a narrow panel, and losing it is better than letting it squeeze the name to nothing. */}
                <span className="hidden shrink-0 items-baseline gap-2 text-[11px] text-muted-foreground sm:flex">
                  <Badge variant="secondary" className="px-1.5 py-0 font-mono text-[10px]">
                    {typeLabel(file.contentType)}
                  </Badge>
                  <span>{formatBytes(file.sizeBytes)}</span>
                  <span className="hidden lg:inline">{formatFileDate(file.createdAt)}</span>
                </span>
              </span>
            </button>
          )}

          <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <FileActionButtons file={file} port={port} actions={actions} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** The name, in place, while it is being changed. Shared so both layouts edit the same way. */
export function RenameField({ file, actions }: { file: ManagedFile; actions: FileActions }) {
  return (
    <Input
      autoFocus
      className="h-6 text-[13px]"
      value={actions.draftName}
      onChange={(event) => actions.setDraftName(event.target.value)}
      onBlur={() => actions.submitRename(file.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          actions.submitRename(file.id)
        }

        if (event.key === "Escape") {
          actions.cancelRename()
        }
      }}
    />
  )
}

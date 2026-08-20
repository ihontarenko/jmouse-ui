import { useState } from "react"
import { FolderPlus, Pencil, X } from "lucide-react"
import { Button, Input } from "@jmouse/ui"
import { CabinetGlyph, FolderGlyph } from "./FolderGlyph"
import { directoryLabel, FILE_DRAG_TYPE } from "./fileDisplay"
import type { Directory, FileLibraryPort, FileManagerNotice } from "./types"

/**
 * The tree, as a column of folders.
 *
 * ⚠️ **Indented by `depth`, not nested.** The library returns the subtree flat, in order, with each row
 * carrying how deep it sits — so this draws a list and pads it. A nested render would have to be rebuilt
 * whenever anything moves, and moving is the one thing this screen is for.
 *
 * ⚠️ **A folder is a drop target.** Dragging a file onto one re-files it, which is the whole reason the
 * drag payload has a type of its own — `dataTransfer.getData` is unreadable during `dragover`, so the
 * type is the only thing that can decide whether to light up *before* the drop lands.
 *
 * ⚠️ **The row is a flex line with exactly one thing allowed to shrink**, and it is the label. The
 * actions were text buttons on a 200px-wide aside, which is wider than the aside at any depth — they
 * pushed out past the panel instead of the name truncating. `min-w-0` on the name and `shrink-0` on
 * everything else is what makes `truncate` able to do its job at all.
 *
 * ⚠️ **Every indent in here is PADDING, never a margin, and the field taught that lesson twice.** A
 * margin does not come off an element's width — so an indented full-width field keeps its full width and
 * simply starts further in, sliding out past the aside's border by exactly the depth it was indented by.
 * The row is padded; the field's wrapper is padded; both stay inside the column.
 *
 * ⚠️ **It calls the PORT, and it used to call hooks.** In its first home this component reached for
 * `useCreateDirectory`, `useRenameDirectory`, `useDeleteDirectory` and `useRefileFile` directly — which
 * is why it could not leave that product. What replaced them is the port and one `onChanged` callback:
 * whoever mounted this knows what it keeps and refetches it.
 */
export function DirectoryTree({
  directories,
  port,
  selectedId,
  onSelect,
  onChanged,
  onNotice,
  rootLabel,
  canWrite = true,
}: {
  directories: Directory[]
  port: FileLibraryPort
  selectedId: string | null
  onSelect: (directoryId: string) => void
  onChanged: () => void
  onNotice?: FileManagerNotice
  rootLabel?: string
  /** Whether the folder actions are offered at all. A reader gets a tree to navigate and nothing more. */
  canWrite?: boolean
}) {
  const [addingUnder, setAddingUnder] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [renaming, setRenaming] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  function submitNew(parentId: string) {
    const name = draftName.trim()

    setAddingUnder(null)
    setDraftName("")

    if (!name) {
      return
    }

    port
      .createDirectory(parentId, name)
      .then(onChanged)
      .catch(() => onNotice?.("That folder was not created."))
  }

  function submitRename(directoryId: string) {
    const name = draftName.trim()

    setRenaming(null)
    setDraftName("")

    if (!name) {
      return
    }

    port
      .renameDirectory(directoryId, name)
      .then(onChanged)
      .catch(() => onNotice?.("That was not renamed."))
  }

  return (
    <div className="flex flex-col">
      {directories.map((directory) => {
        const isSelected = directory.id === selectedId
        const isDropTarget = hovered === directory.id

        // ⚠️ 10px a level, capped: a deep branch otherwise spends the whole aside on indentation and
        // leaves nothing for the name it is indenting.
        const indent = 4 + Math.min(directory.depth - 1, 6) * 10

        return (
          <div key={directory.id} className="flex min-w-0 flex-col">
            <div
              className={[
                "group flex h-7 min-w-0 items-center gap-1 rounded-md pr-1 text-[13px] transition-colors",
                isSelected ? "bg-accent font-medium" : "hover:bg-accent/50",
                isDropTarget ? "ring-2 ring-primary" : "",
              ].join(" ")}
              style={{ paddingLeft: `${indent}px` }}
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
                  port
                    .refileFile(fileId, directory.id)
                    .then(onChanged)
                    .catch(() => onNotice?.("That file was not moved."))
                }
              }}
            >
              {renaming === directory.id ? (
                <Input
                  autoFocus
                  className="h-6 w-full min-w-0 text-[13px]"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={() => submitRename(directory.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      submitRename(directory.id)
                    }

                    if (event.key === "Escape") {
                      setRenaming(null)
                    }
                  }}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    onClick={() => onSelect(directory.id)}
                  >
                    {directory.root ? <CabinetGlyph size={16} /> : <FolderGlyph size={16} />}
                    <span className="truncate">{directoryLabel(directory, rootLabel)}</span>
                  </button>

                  {/* ⚠️ Hidden by opacity rather than removed, so the row does not reflow under the
                      pointer — and `shrink-0`, so it never eats the name's width. */}
                  {canWrite && (
                    <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="New folder inside"
                        onClick={() => {
                          setAddingUnder(directory.id)
                          setDraftName("")
                        }}
                      >
                        <FolderPlus />
                      </Button>

                      {/* ⚠️ A root has no name of its own to rename and nothing above it to be deleted
                          from — a tree's top is made by the backend, not by anybody here. */}
                      {!directory.root && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Rename"
                            onClick={() => {
                              setRenaming(directory.id)
                              setDraftName(directory.name)
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Delete"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              // ⚠️ Never with the subtree. The backend refuses a folder that still holds
                              // something, and being refused is the right answer — a one-click delete
                              // that takes a branch with it is a click nobody meant.
                              port
                                .deleteDirectory(directory.id)
                                .then(onChanged)
                                .catch(() =>
                                  onNotice?.("That folder is not empty — move or delete what is in it first."),
                                )
                            }
                          >
                            <X />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ⚠️ The indent is PADDING on a wrapper, and the field fills what is left — see the note on
                the component. A margin here is what made this field slide out past the aside. */}
            {addingUnder === directory.id && (
              <div className="min-w-0 py-1 pr-1" style={{ paddingLeft: `${indent + 16}px` }}>
                <Input
                  autoFocus
                  placeholder="Folder name"
                  className="h-6 w-full min-w-0 text-[13px]"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={() => submitNew(directory.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      submitNew(directory.id)
                    }

                    if (event.key === "Escape") {
                      setAddingUnder(null)
                    }
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

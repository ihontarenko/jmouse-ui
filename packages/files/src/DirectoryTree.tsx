import { useState } from "react"
import { FolderPlus, Pencil, X } from "lucide-react"
import { Button, Input, TreeRow, treeIndent, treeLabelClassName } from "@jmouse/ui"
import { CabinetGlyph, FolderGlyph } from "./FolderGlyph"
import { directoryLabel, FILE_DRAG_TYPE } from "./fileDisplay"
import { parentIds, useDirectoryExpansion, visibleDirectories } from "./treeExpansion"
import type { Directory, FileLibraryPort, FileManagerNotice } from "./types"

/**
 * The tree, as a column of folders.
 *
 * ⚠️ **Indented by `depth`, not nested.** The library returns the subtree flat, in order, with each row
 * carrying how deep it sits — so this draws a list and pads it. A nested render would have to be rebuilt
 * whenever anything moves, and moving is the one thing this screen is for.
 *
 * ⚠️ **Closed until opened, and the branch you are standing in is opened for you.** The flat subtree used
 * to be drawn whole, which is a scroll of two hundred names whose only structure is ten pixels of
 * indentation. What decides which rows survive is {@link visibleDirectories}, and what opens the chain
 * down to a folder somebody was linked to is {@link useDirectoryExpansion} — the reasoning for both,
 * including why a refetch must not re-open what somebody just closed, lives on that module and on
 * `@jmouse/ui`'s `useTreeExpansion` underneath it.
 *
 * ⚠️ **A folder is a drop target.** Dragging a file onto one re-files it, which is the whole reason the
 * drag payload has a type of its own — `dataTransfer.getData` is unreadable during `dragover`, so the
 * type is the only thing that can decide whether to light up *before* the drop lands.
 *
 * ⚠️ **The row itself is `@jmouse/ui`'s `TreeRow` (`UIK-22`).** The indent, the twisty, the one-thing-may-
 * shrink flex line, the actions floated over the name's tail on hover, and what selected looks like are
 * all shared with the section tree a knowledge base draws in the same shaped aside — the reasoning for
 * each of them, `UIK-16`'s floating actions included, lives on that component. What is left here is what
 * a *directory* is: a drop target, a name that can be edited in place, and a root that cannot.
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

  const { expanded, open, toggle } = useDirectoryExpansion(directories, selectedId)
  const withChildren = parentIds(directories)
  const rows = visibleDirectories(directories, expanded)

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
      {rows.map((directory) => {
        const isSelected = directory.id === selectedId
        const isDropTarget = hovered === directory.id
        const isOpen = expanded.has(directory.id)
        const isParent = withChildren.has(directory.id)

        // ⚠️ The library's roots sit at depth 1, and `treeIndent` counts from 0.
        const indent = treeIndent(directory.depth - 1)

        return (
          <div key={directory.id} className="flex min-w-0 flex-col">
            <TreeRow
              indent={indent}
              branch={isParent}
              open={isOpen}
              onToggle={() => toggle(directory.id)}
              name={directoryLabel(directory, rootLabel)}
              selected={isSelected}
              dropTarget={isDropTarget}
              actions={
                canWrite && renaming !== directory.id ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="New folder inside"
                      onClick={() => {
                        setAddingUnder(directory.id)
                        setDraftName("")
                        // ⚠️ Opened as the field appears, or a folder made inside a closed one is
                        // created and then hidden — which reads as the creation having failed.
                        open(directory.id)
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
                  </>
                ) : null
              }
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
                <button type="button" className={treeLabelClassName} onClick={() => onSelect(directory.id)}>
                  {directory.root ? <CabinetGlyph size={16} /> : <FolderGlyph size={16} />}
                  <span className="truncate">{directoryLabel(directory, rootLabel)}</span>
                </button>
              )}
            </TreeRow>

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

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { Icon } from "../icons/Icon"
import type { IconSource } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"

/** What happened to a file since it was last committed or saved — coloured on the name, as in a tree. */
export type FileChange = "added" | "modified" | "deleted" | "conflict" | "ignored"

export interface OpenFile {
  id: string
  name: string
  /** Told apart when two open files share a name: the folder they sit in. */
  hint?: string
  /** An icon, or a file-type glyph — a letter in a tinted square. */
  icon?: IconSource
  /** Custom library glyph, shared with the tree and listing. */
  glyph?: ReactNode
  fileType?: { letter: string; color: string }
  change?: FileChange
  /** Edited and not saved: a dot where the close cross will be. */
  unsaved?: boolean
  /** Kept at the start and never closed by "close others". */
  pinned?: boolean
  /** Opened by a single click and replaced by the next one — written in italics until it is edited or pinned. */
  preview?: boolean
}

export interface EditorTabsProperties {
  label: string
  files: OpenFile[]
  activeId: string | undefined
  onActivate(id: string): void
  onClose(id: string): void
  /** Given, the tabs can be dragged into a new order: the moved file and the index it lands at. */
  onReorder?(id: string, targetIndex: number): void
  /** A file's own menu, opened by a right click or Shift+F10 on its tab. */
  onContextMenu?(id: string, event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>): void
  /** Actions at the strip's end: the list of every open file, split, more. */
  end?: ReactNode
  closeLabel?: string
  unsavedLabel?: string
  className?: string
}

/**
 * The files that are open — Burin's editor tabs, made the one strip every product uses (Raccoon's documents, Kitsu's
 * viewer, Parallax's sources). A tablist: the arrow keys move and open, Delete closes the focused tab, the middle
 * button closes, a dragged tab lands where the marker shows. The active tab scrolls into view.
 */
export function EditorTabs({ label, files, activeId, onActivate, onClose, onReorder, onContextMenu, end, closeLabel = "Close", unsavedLabel = "unsaved", className }: EditorTabsProperties) {
  const scrollerReference = useRef<HTMLDivElement>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropMarker, setDropMarker] = useState<{ id: string; side: "before" | "after" } | null>(null)

  useEffect(() => {
    if (!activeId) {
      return
    }
    scrollerReference.current?.querySelector<HTMLElement>(`[data-file-id="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeId])

  function focusTab(id: string) {
    scrollerReference.current?.querySelector<HTMLElement>(`[data-file-id="${CSS.escape(id)}"]`)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>, file: OpenFile) {
    const index = files.findIndex((candidate) => candidate.id === file.id)
    let next: OpenFile | undefined
    if (event.key === "ArrowRight") {
      next = files[(index + 1) % files.length]
    } else if (event.key === "ArrowLeft") {
      next = files[(index - 1 + files.length) % files.length]
    } else if (event.key === "Home") {
      next = files[0]
    } else if (event.key === "End") {
      next = files[files.length - 1]
    } else if (event.key === "Delete") {
      event.preventDefault()
      const neighbour = files[index + 1] ?? files[index - 1]
      onClose(file.id)
      if (neighbour) {
        requestAnimationFrame(() => focusTab(neighbour.id))
      }
      return
    } else if (event.key === "F10" && event.shiftKey && onContextMenu) {
      event.preventDefault()
      onContextMenu(file.id, event)
      return
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onActivate(file.id)
      return
    }
    if (next) {
      event.preventDefault()
      onActivate(next.id)
      focusTab(next.id)
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>, file: OpenFile) {
    if (!draggedId || draggedId === file.id) {
      return
    }
    event.preventDefault()
    const box = event.currentTarget.getBoundingClientRect()
    setDropMarker({ id: file.id, side: event.clientX < box.left + box.width / 2 ? "before" : "after" })
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (draggedId && dropMarker && onReorder) {
      const withoutDragged = files.filter((file) => file.id !== draggedId)
      const targetIndex = withoutDragged.findIndex((file) => file.id === dropMarker.id) + (dropMarker.side === "after" ? 1 : 0)
      onReorder(draggedId, targetIndex)
    }
    setDraggedId(null)
    setDropMarker(null)
  }

  return (
    <div className={joinClassNames("kit-editor-tabs", className)}>
      <div ref={scrollerReference} className="kit-editor-tabs-scroller" role="tablist" aria-label={label}>
        {files.map((file) => {
          const selected = file.id === activeId
          return (
            <div
              key={file.id}
              role="tab"
              aria-selected={selected}
              tabIndex={selected || (!activeId && file === files[0]) ? 0 : -1}
              title={file.hint ? `${file.hint}/${file.name}` : file.name}
              className="kit-editor-tab"
              data-file-id={file.id}
              data-change={file.change}
              data-pinned={file.pinned ? "" : undefined}
              data-preview={file.preview ? "" : undefined}
              data-dragging={draggedId === file.id ? "" : undefined}
              data-drop={dropMarker?.id === file.id ? dropMarker.side : undefined}
              draggable={Boolean(onReorder)}
              onClick={() => onActivate(file.id)}
              onAuxClick={(event) => {
                if (event.button === 1 && !file.pinned) {
                  event.preventDefault()
                  onClose(file.id)
                }
              }}
              onContextMenu={onContextMenu ? (event) => {
                event.preventDefault()
                onContextMenu(file.id, event)
              } : undefined}
              onKeyDown={(event) => onKeyDown(event, file)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData("text/plain", file.name)
                setDraggedId(file.id)
              }}
              onDragOver={(event) => onDragOver(event, file)}
              onDragLeave={() => setDropMarker((marker) => (marker?.id === file.id ? null : marker))}
              onDrop={onDrop}
              onDragEnd={() => {
                setDraggedId(null)
                setDropMarker(null)
              }}
            >
              {file.glyph ? <span className="kit-editor-tab-glyph" aria-hidden="true">{file.glyph}</span> : file.fileType ? (
                <span className="kit-file-type" style={{ ["--kit-file-type-color" as string]: file.fileType.color }} aria-hidden="true">{file.fileType.letter}</span>
              ) : (
                file.icon && <Icon name={file.icon} size="small" />
              )}
              <span className="kit-editor-tab-name">{file.name}</span>
              {file.hint && <span className="kit-editor-tab-hint">{file.hint}</span>}
              {file.unsaved && <span className="kit-visually-hidden">, {unsavedLabel}</span>}
              {file.pinned ? (
                <Icon name="pin" size="small" />
              ) : (
                <button
                  type="button"
                  className="kit-editor-tab-close"
                  tabIndex={-1}
                  aria-label={`${closeLabel} ${file.name}`}
                  data-unsaved={file.unsaved ? "" : undefined}
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose(file.id)
                  }}
                >
                  <Icon name="close" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {end && <div className="kit-editor-tabs-end">{end}</div>}
    </div>
  )
}

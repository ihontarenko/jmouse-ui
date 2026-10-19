import { readableFileSize } from "@jmouse/file-handling"
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react"
import { Button, IconButton } from "../controls/Button"
import { Segmented } from "../controls/Choices"
import { Input, SearchField, Select } from "../controls/Inputs"
import { Split } from "../containers/Split"
import { Tile, TileGrid } from "../data/Records"
import { Table, type TableColumn, type TableSort } from "../data/Table"
import { Tree, type TreeNode } from "../data/Tree"
import { EmptyState, Notice, Waiting } from "../feedback/Feedback"
import { Editor, ToolWindow } from "../ide/Ide"
import { joinClassNames } from "../lib/classNames"
import { Crumbs } from "../navigation/Crumbs"
import { EditorTabs, type OpenFile } from "../navigation/EditorTabs"
import { RowMenu, type MenuEntry } from "../navigation/Menu"
import { Toolbar, ToolbarPush } from "../navigation/Toolbar"
import { StatusBar, StatusItem } from "../shell/AppShell"
import { FileGlyph, type FileGlyphKind } from "./FileGlyph"

export interface FileWorkspaceEntry {
  /** Unique within the workspace, stable across renames. */
  id: string
  /** null is the workspace root. Supply ancestors as well as the displayed children. */
  parentId: string | null
  name: string
  kind: "folder" | "file"
  mediaType?: string
  glyphKind?: FileGlyphKind
  size?: number
  /** Display-ready metadata; the product owns locale and date formatting. */
  modified?: string
}

const defaultLabels = {
  folders: "Folders", files: "Files", root: "All files", path: "Folder path", up: "Parent folder",
  showFolders: "Show folders", hideFolders: "Hide folders", search: "Search this folder", view: "View",
  tiles: "Tiles", list: "List", sort: "Sort", name: "Name", size: "Size", modified: "Modified",
  ascending: "Name: A-Z", descending: "Name: Z-A", folder: "Folder", empty: "This folder is empty",
  emptyDescription: "Choose another folder or add files here.", noResults: "No matching files",
  clearSearch: "Clear search", loading: "Loading files", unavailable: "Folder is unavailable",
  unavailableDescription: "It may have been moved, removed, or access may have changed.",
  preview: "File preview", close: "Close", options: "Options", items: "items", newName: "New name", dropFiles: "Drop files to add them to this folder",
}
export type FileWorkspaceLabels = typeof defaultLabels

/** One entry's name, being edited where it is drawn. Enter or leaving the field keeps it; Escape restores it. */
export interface FileWorkspaceRename {
  id: string
  onCommit(name: string): void
  onCancel(): void
  /**
   * Why a name cannot be used, or undefined when it can — the same check the host's own rename dialog makes.
   *
   * ⚠️ Enter on a refused name keeps the field open and says why; leaving the field restores the old name rather than
   * keeping one the host would refuse.
   */
  problemWith?(name: string): string | undefined
}

/**
 * The field a name is edited in. The stem is selected, not the suffix — renaming `report.pdf` is almost always about
 * `report`, and a selected `.pdf` is one keystroke from a file nothing can open.
 *
 * ⚠️ **Settled once, and the guard is a ref.** Enter commits and then the field unmounts, which blurs it: as state the
 * guard would still read "unsettled" in that blur, before the next render, and commit the same name twice.
 */
function FileNameField({ entry, rename, label }: { entry: FileWorkspaceEntry; rename: FileWorkspaceRename; label: string }) {
  const [value, setValue] = useState(entry.name)
  const [shownProblem, setShownProblem] = useState<string>()
  const settled = useRef(false)
  const problemId = useId()

  function cancel() {
    if (settled.current) {
      return
    }
    settled.current = true
    rename.onCancel()
  }

  function commit(leaving: boolean) {
    if (settled.current) {
      return
    }
    const name = value.trim()
    if (!name || name === entry.name) {
      cancel()
      return
    }
    const problem = rename.problemWith?.(name)
    if (problem !== undefined) {
      if (leaving) {
        cancel()
      } else {
        setShownProblem(problem)
      }
      return
    }
    settled.current = true
    rename.onCommit(name)
  }

  return <span className="kit-file-rename-field">
    <Input size="small" className="kit-file-rename" aria-label={`${label}: ${entry.name}`} value={value} autoFocus
      aria-invalid={shownProblem === undefined ? undefined : true} aria-describedby={shownProblem === undefined ? undefined : problemId}
      ref={(element) => {
        if (element && element.dataset.selected === undefined) {
          element.dataset.selected = ""
          const suffix = entry.kind === "file" ? entry.name.lastIndexOf(".") : -1
          element.setSelectionRange(0, suffix > 0 ? suffix : entry.name.length)
        }
      }}
      onChange={(event) => {
        setValue(event.target.value)
        setShownProblem(undefined)
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onBlur={() => commit(true)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Enter") {
          event.preventDefault()
          commit(false)
        } else if (event.key === "Escape") {
          event.preventDefault()
          cancel()
        }
      }} />
    {shownProblem === undefined ? null : <span id={problemId} className="kit-file-rename-problem" role="alert">{shownProblem}</span>}
  </span>
}

export interface FileWorkspaceProperties {
  entries: FileWorkspaceEntry[]
  directoryId: string | null
  onDirectoryChange(id: string | null): void
  /** The product provides its viewer/editor; no fetching or product policy lives here. */
  renderFile(entry: FileWorkspaceEntry): ReactNode
  /** Upload, new folder, and other product capabilities, composed from kit controls. */
  actions?: ReactNode
  entryActions?(entry: FileWorkspaceEntry): MenuEntry[]
  loading?: boolean
  error?: ReactNode
  /**
   * The host knows the shown folder has gone — its listing was refused as missing. The listing then says so and offers
   * the way back to the root.
   *
   * ⚠️ **A folder the entries do not include is NOT unavailable by itself.** A host opened deep, without the folders
   * above it, still lists that folder correctly; judging it missing would hide a listing that succeeded.
   */
  unavailable?: boolean
  labels?: Partial<FileWorkspaceLabels>
  formatSize?(bytes: number): string
  defaultView?: "tiles" | "list"
  storageKey?: string
  /** Given, the selection is the host's: the one entry its toolbar and keys act on. */
  selectedId?: string
  onSelectedChange?(entry: FileWorkspaceEntry | undefined): void
  /** The entry whose name is being edited in place. */
  renaming?: FileWorkspaceRename
  /** Given, files dragged from the desktop may be dropped on the listing; they land in the shown folder. */
  onDropFiles?(files: File[]): void
  /** A band above the panes — an act that failed, an upload in progress. The listing stays usable under it. */
  notice?: ReactNode
  /**
   * Given, the opened files are the host's — kept in its address, usually, so a link can reopen a document. Every ID
   * named must be among the entries for its tab to be drawn; one the host has not supplied yet waits, unshown.
   */
  openFileIds?: string[]
  /** The opened file in front; undefined shows the folder. */
  activeFileId?: string
  onOpenFilesChange?(openFileIds: string[], activeFileId: string | undefined): void
  /** Keys pressed anywhere inside — where a host binds F2 or Delete to the selection. */
  onKeyDown?(event: KeyboardEvent<HTMLElement>): void
  className?: string
}

/**
 * A second file-manager presentation, composed from the kit's existing workspace parts.
 * The product owns location, data and capabilities. Tabs, selection and presentation are local UI state.
 * Entries form an acyclic tree, with stable unique IDs and folders as parents; null names the root.
 */
export function FileWorkspace({ entries, directoryId, onDirectoryChange, renderFile, actions, entryActions, loading, error, unavailable, labels, formatSize = readableFileSize, defaultView = "tiles", storageKey, selectedId: hostSelectedId, onSelectedChange, renaming, onDropFiles, notice, openFileIds: hostOpenFileIds, activeFileId: hostActiveFileId, onOpenFilesChange, onKeyDown, className }: FileWorkspaceProperties) {
  const text = { ...defaultLabels, ...labels }
  const browserId = useId()
  const [ownOpenIds, setOwnOpenIds] = useState<string[]>([])
  const [ownActiveFileId, setOwnActiveFileId] = useState<string>()
  const openFilesControlled = onOpenFilesChange !== undefined
  const openIds = openFilesControlled ? (hostOpenFileIds ?? []) : ownOpenIds
  const activeFileId = openFilesControlled ? hostActiveFileId : ownActiveFileId
  function setOpenFiles(nextOpenIds: string[], nextActiveId: string | undefined) {
    if (openFilesControlled) {
      onOpenFilesChange(nextOpenIds, nextActiveId)
    } else {
      setOwnOpenIds(nextOpenIds)
      setOwnActiveFileId(nextActiveId)
    }
  }
  const [ownSelection, setOwnSelection] = useState<{ directoryId: string | null; id: string }>()
  const [dropTargeted, setDropTargeted] = useState(false)
  const selectionControlled = onSelectedChange !== undefined
  const selection = selectionControlled ? (hostSelectedId === undefined ? undefined : { directoryId, id: hostSelectedId }) : ownSelection
  function setSelection(next: { directoryId: string | null; id: string } | undefined) {
    if (selectionControlled) {
      onSelectedChange(next === undefined ? undefined : entries.find((entry) => entry.id === next.id))
    } else {
      setOwnSelection(next)
    }
  }
  const [search, setSearch] = useState({ directoryId, value: "" })
  const query = search.directoryId === directoryId ? search.value : ""
  const [view, setView] = useState(defaultView)
  const [sort, setSort] = useState<TableSort>({ key: "name", direction: "ascending" })
  const [treeVisible, setTreeVisible] = useState(true)
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])
  const directory = directoryId === null ? undefined : byId.get(directoryId)
  const directoryAvailable = !unavailable && (directory === undefined || directory.kind === "folder")
  // ⚠️ Unknown, not root: a folder opened deep without its ancestors has a parent nobody has named yet.
  const parentKnown = directoryId !== null && directory !== undefined
  const selectedId = selection?.directoryId === directoryId ? selection.id : undefined
  const activeFile = activeFileId ? byId.get(activeFileId) : undefined
  const showingFile = activeFile?.kind === "file"
  const openedFiles = openIds.map((id) => byId.get(id)).filter((entry): entry is FileWorkspaceEntry => entry?.kind === "file")

  const ancestors: FileWorkspaceEntry[] = []
  const visited = new Set<string>()
  let ancestor = directory
  while (ancestor && !visited.has(ancestor.id)) {
    visited.add(ancestor.id)
    ancestors.unshift(ancestor)
    ancestor = ancestor.parentId === null ? undefined : byId.get(ancestor.parentId)
  }
  useEffect(() => {
    const parents: string[] = directoryId === null ? [] : [directoryId]
    const seen = new Set<string>()
    let current = directoryId === null ? undefined : byId.get(directoryId)
    while (current?.parentId && !seen.has(current.parentId)) {
      seen.add(current.parentId)
      parents.push(current.parentId)
      current = byId.get(current.parentId)
    }
    setExpandedIds((previous) => Array.from(new Set([...previous, ...parents])))
  }, [directoryId, byId])
  const glyph = (entry: FileWorkspaceEntry, size: "small" | "large" = "small") => <FileGlyph name={entry.name} mediaType={entry.mediaType} kind={entry.kind === "folder" ? "folder" : entry.glyphKind} size={size} />
  const metadata = (entry: FileWorkspaceEntry) => entry.kind === "folder" ? text.folder : entry.size === undefined ? "\u2014" : formatSize(entry.size)
  const menu = (entry: FileWorkspaceEntry) => {
    const items = entryActions?.(entry)
    return items?.length ? <span onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><RowMenu label={`${text.options}: ${entry.name}`} items={items} /></span> : undefined
  }

  const childrenByParent = new Map<string | null, FileWorkspaceEntry[]>()
  for (const entry of entries) {
    const children = childrenByParent.get(entry.parentId) ?? []
    children.push(entry)
    childrenByParent.set(entry.parentId, children)
  }
  function treeNodes(parentId: string | null): TreeNode[] {
    return (childrenByParent.get(parentId) ?? []).filter((entry) => entry.kind === "folder").map((entry) => ({
      id: entry.id, name: entry.name, glyph: glyph(entry), children: treeNodes(entry.id), end: menu(entry),
    }))
  }
  const rows = (childrenByParent.get(directoryId) ?? []).filter((entry) => entry.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((first, second) => {
    if (first.kind !== second.kind) { return first.kind === "folder" ? -1 : 1 }
    const comparison = sort.key === "size" ? (first.size ?? 0) - (second.size ?? 0) : first.name.localeCompare(second.name, undefined, { numeric: true })
    return sort.direction === "descending" ? -comparison : comparison
  })

  function navigate(id: string | null) {
    if (activeFileId !== undefined) {
      setOpenFiles(openIds, undefined)
    }
    setSelection(undefined)
    setSearch({ directoryId: id, value: "" })
    onDirectoryChange(id)
  }
  function open(entry: FileWorkspaceEntry) {
    if (entry.kind === "folder") {
      navigate(entry.id)
    } else {
      setOpenFiles(openIds.includes(entry.id) ? openIds : [...openIds, entry.id], entry.id)
    }
  }
  function close(id: string) {
    if (id === browserId) { return }
    const remaining = openIds.filter((openId) => openId !== id)
    setOpenFiles(remaining, activeFileId === id ? remaining.at(-1) : activeFileId)
  }
  const tabs: OpenFile[] = [
    { id: browserId, name: directory?.name ?? text.root, icon: "folder", pinned: true },
    ...openedFiles.map((entry) => ({ id: entry.id, name: entry.name, glyph: glyph(entry), hint: entry.parentId ? byId.get(entry.parentId)?.name : text.root })),
  ]
  const columns: TableColumn<FileWorkspaceEntry>[] = [
    { key: "name", header: text.name, sortable: true, cell: (entry) => <span className="kit-file-name">{glyph(entry)}{renaming?.id === entry.id ? <FileNameField entry={entry} rename={renaming} label={text.newName} /> : <span>{entry.name}</span>}</span> },
    { key: "size", header: text.size, sortable: true, align: "end", technical: true, shrink: true, cell: metadata },
    { key: "modified", header: text.modified, shrink: true, cell: (entry) => entry.modified ?? "\u2014" },
    ...(entryActions ? [{ key: "actions", header: text.options, shrink: true, cell: menu } satisfies TableColumn<FileWorkspaceEntry>] : []),
  ]

  const browser = <div className="kit-file-browser">
    <Toolbar label={text.files}>
      <SearchField label={text.search} placeholder={text.search} size="small" value={query} onValueChange={(value) => setSearch({ directoryId, value })} />
      <ToolbarPush />
      <Select aria-label={text.sort} size="small" value={sort.direction} onChange={(event) => setSort({ key: "name", direction: event.target.value as TableSort["direction"] })} options={[{ value: "ascending", label: text.ascending }, { value: "descending", label: text.descending }]} />
      <Segmented<"tiles" | "list"> label={text.view} size="small" value={view} onValueChange={setView} options={[{ value: "tiles", label: text.tiles }, { value: "list", label: text.list }]} />
      {actions}
    </Toolbar>
    <div className="kit-file-listing" aria-busy={loading || undefined} data-targeted={dropTargeted ? "" : undefined} {...(onDropFiles && directoryAvailable ? {
      onDragOver: (event: DragEvent) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault()
          event.dataTransfer.dropEffect = "copy"
          setDropTargeted(true)
        }
      },
      onDragLeave: (event: DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropTargeted(false)
        }
      },
      onDrop: (event: DragEvent) => {
        setDropTargeted(false)
        if (event.dataTransfer.files.length > 0) {
          event.preventDefault()
          onDropFiles(Array.from(event.dataTransfer.files))
        }
      },
    } : {})}>
      {/* ⚠️ The live region is always there and only its words change: one inserted together with its text is
          usually not announced at all. */}
      <p className="kit-file-drop-hint" aria-live="polite">{dropTargeted ? text.dropFiles : ""}</p>
      {error ? <Notice tone="danger">{error}</Notice> : loading ? <Waiting label={text.loading} /> : !directoryAvailable ? <EmptyState flush icon="folder" title={text.unavailable} description={text.unavailableDescription} actions={<Button onClick={() => navigate(null)}>{text.root}</Button>} /> : rows.length === 0 ? <EmptyState flush icon={query ? "search" : "folder"} title={query ? text.noResults : text.empty} description={query ? undefined : text.emptyDescription} actions={query ? <Button onClick={() => setSearch({ directoryId, value: "" })}>{text.clearSearch}</Button> : undefined} /> : view === "list" ? <Table label={text.files} columns={columns} rows={rows} rowKey={(entry) => entry.id} sort={sort} onSortChange={setSort} selectedKey={rows.some((entry) => entry.id === selectedId) ? selectedId : undefined} onRowSelect={(entry) => setSelection({ directoryId, id: entry.id })} onRowActivate={open} /> : <TileGrid>
        {rows.map((entry) => <Tile key={entry.id} name={entry.name} glyph={glyph(entry, "large")} meta={metadata(entry)} active={selectedId === entry.id} onOpen={() => setSelection({ directoryId, id: entry.id })} onActivate={() => open(entry)} actions={menu(entry)} editor={renaming?.id === entry.id ? <FileNameField entry={entry} rename={renaming} label={text.newName} /> : undefined} />)}
      </TileGrid>}
    </div>
  </div>

  return <section className={joinClassNames("kit-file-workspace", className)} aria-label={text.files} data-tree-visible={treeVisible ? "" : undefined} onKeyDown={onKeyDown}>
    <div className="kit-file-location">
      <IconButton icon="folder" size="small" label={treeVisible ? text.hideFolders : text.showFolders} aria-expanded={treeVisible} onClick={() => setTreeVisible(!treeVisible)} />
      <IconButton icon="arrow-up" size="small" label={text.up} disabled={!parentKnown} onClick={() => {
        if (directory !== undefined) {
          navigate(directory.parentId)
        }
      }} />
      <Crumbs label={text.path} items={[{ label: text.root, onNavigate: () => navigate(null) }, ...ancestors.map((entry) => ({ label: entry.name, onNavigate: () => navigate(entry.id) }))]} renderLink={(crumb, className) => <button className={className} type="button" onClick={crumb.onNavigate}>{crumb.label}</button>} />
    </div>
    {notice ? <div className="kit-file-notice">{notice}</div> : null}
    <div className="kit-file-panes">
      <Split label={text.folders} defaultSize={260} minimum={180} maximum={480} collapsed={!treeVisible} storageKey={storageKey}>
        <ToolWindow title={text.folders} onHide={() => setTreeVisible(false)} hideLabel={text.hideFolders} toolbar={<Button variant="quiet" size="small" icon="folder" onClick={() => navigate(null)}>{text.root}</Button>}>
          <Tree label={text.folders} nodes={treeNodes(null)} selectedId={directoryId ?? undefined} expandedIds={expandedIds} onExpandedChange={setExpandedIds} onSelect={navigate} />
        </ToolWindow>
        <Editor tabs={<EditorTabs label={text.files} files={tabs} activeId={showingFile ? activeFile.id : browserId} onActivate={(id) => setOpenFiles(openIds, id === browserId ? undefined : id)} onClose={close} closeLabel={text.close} />}>
          {showingFile ? <section className="kit-file-preview" aria-label={`${text.preview}: ${activeFile.name}`}>{renderFile(activeFile)}</section> : browser}
        </Editor>
      </Split>
    </div>
    <StatusBar start={<StatusItem>{showingFile ? activeFile.name : directory?.name ?? text.root}</StatusItem>} end={<StatusItem>{loading ? text.loading : `${rows.length} ${text.items}`}</StatusItem>} />
  </section>
}


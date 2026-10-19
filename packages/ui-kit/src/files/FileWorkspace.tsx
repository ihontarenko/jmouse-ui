import { useEffect, useId, useMemo, useState, type ReactNode } from "react"
import { Button, IconButton } from "../controls/Button"
import { Segmented } from "../controls/Choices"
import { SearchField, Select } from "../controls/Inputs"
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
  preview: "File preview", close: "Close", options: "Options", items: "items",
}
export type FileWorkspaceLabels = typeof defaultLabels

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
  labels?: Partial<FileWorkspaceLabels>
  formatSize?(bytes: number): string
  defaultView?: "tiles" | "list"
  storageKey?: string
  className?: string
}

function readableSize(bytes: number): string {
  if (bytes < 1024) { return `${bytes} B` }
  if (bytes < 1024 ** 2) { return `${(bytes / 1024).toFixed(1)} KB` }
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

/**
 * A second file-manager presentation, composed from the kit's existing workspace parts.
 * The product owns location, data and capabilities. Tabs, selection and presentation are local UI state.
 * Entries form an acyclic tree, with stable unique IDs and folders as parents; null names the root.
 */
export function FileWorkspace({ entries, directoryId, onDirectoryChange, renderFile, actions, entryActions, loading, error, labels, formatSize = readableSize, defaultView = "tiles", storageKey, className }: FileWorkspaceProperties) {
  const text = { ...defaultLabels, ...labels }
  const browserId = useId()
  const [openIds, setOpenIds] = useState<string[]>([])
  const [activeFileId, setActiveFileId] = useState<string>()
  const [selection, setSelection] = useState<{ directoryId: string | null; id: string }>()
  const [search, setSearch] = useState({ directoryId, value: "" })
  const query = search.directoryId === directoryId ? search.value : ""
  const [view, setView] = useState(defaultView)
  const [sort, setSort] = useState<TableSort>({ key: "name", direction: "ascending" })
  const [treeVisible, setTreeVisible] = useState(true)
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])
  const directory = directoryId === null ? undefined : byId.get(directoryId)
  const directoryAvailable = directoryId === null || directory?.kind === "folder"
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
    setActiveFileId(undefined)
    setSelection(undefined)
    setSearch({ directoryId: id, value: "" })
    onDirectoryChange(id)
  }
  function open(entry: FileWorkspaceEntry) {
    if (entry.kind === "folder") {
      navigate(entry.id)
    } else {
      setOpenIds((current) => current.includes(entry.id) ? current : [...current, entry.id])
      setActiveFileId(entry.id)
    }
  }
  function close(id: string) {
    if (id === browserId) { return }
    const remaining = openedFiles.filter((entry) => entry.id !== id)
    setOpenIds(remaining.map((entry) => entry.id))
    if (activeFileId === id) { setActiveFileId(remaining.at(-1)?.id) }
  }
  const tabs: OpenFile[] = [
    { id: browserId, name: directory?.name ?? text.root, icon: "folder", pinned: true },
    ...openedFiles.map((entry) => ({ id: entry.id, name: entry.name, glyph: glyph(entry), hint: entry.parentId ? byId.get(entry.parentId)?.name : text.root })),
  ]
  const columns: TableColumn<FileWorkspaceEntry>[] = [
    { key: "name", header: text.name, sortable: true, cell: (entry) => <span className="kit-file-name">{glyph(entry)}<span>{entry.name}</span></span> },
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
    <div className="kit-file-listing" aria-busy={loading || undefined}>
      {error ? <Notice tone="danger">{error}</Notice> : loading ? <Waiting label={text.loading} /> : !directoryAvailable ? <EmptyState flush icon="folder" title={text.unavailable} description={text.unavailableDescription} actions={<Button onClick={() => navigate(null)}>{text.root}</Button>} /> : rows.length === 0 ? <EmptyState flush icon={query ? "search" : "folder"} title={query ? text.noResults : text.empty} description={query ? undefined : text.emptyDescription} actions={query ? <Button onClick={() => setSearch({ directoryId, value: "" })}>{text.clearSearch}</Button> : undefined} /> : view === "list" ? <Table label={text.files} columns={columns} rows={rows} rowKey={(entry) => entry.id} sort={sort} onSortChange={setSort} selectedKey={rows.some((entry) => entry.id === selectedId) ? selectedId : undefined} onRowSelect={(entry) => setSelection({ directoryId, id: entry.id })} onRowActivate={open} /> : <TileGrid>
        {rows.map((entry) => <Tile key={entry.id} name={entry.name} glyph={glyph(entry, "large")} meta={metadata(entry)} active={selectedId === entry.id} onOpen={() => setSelection({ directoryId, id: entry.id })} onActivate={() => open(entry)} actions={menu(entry)} />)}
      </TileGrid>}
    </div>
  </div>

  return <section className={joinClassNames("kit-file-workspace", className)} aria-label={text.files} data-tree-visible={treeVisible ? "" : undefined}>
    <div className="kit-file-location">
      <IconButton icon="folder" size="small" label={treeVisible ? text.hideFolders : text.showFolders} aria-expanded={treeVisible} onClick={() => setTreeVisible(!treeVisible)} />
      <IconButton icon="arrow-up" size="small" label={text.up} disabled={directoryId === null} onClick={() => navigate(directory?.parentId ?? null)} />
      <Crumbs label={text.path} items={[{ label: text.root, onNavigate: () => navigate(null) }, ...ancestors.map((entry) => ({ label: entry.name, onNavigate: () => navigate(entry.id) }))]} renderLink={(crumb, className) => <button className={className} type="button" onClick={crumb.onNavigate}>{crumb.label}</button>} />
    </div>
    <div className="kit-file-panes">
      <Split label={text.folders} defaultSize={260} minimum={180} maximum={480} collapsed={!treeVisible} storageKey={storageKey}>
        <ToolWindow title={text.folders} onHide={() => setTreeVisible(false)} hideLabel={text.hideFolders} toolbar={<Button variant="quiet" size="small" icon="folder" onClick={() => navigate(null)}>{text.root}</Button>}>
          <Tree label={text.folders} nodes={treeNodes(null)} selectedId={directoryId ?? undefined} expandedIds={expandedIds} onExpandedChange={setExpandedIds} onSelect={navigate} />
        </ToolWindow>
        <Editor tabs={<EditorTabs label={text.files} files={tabs} activeId={showingFile ? activeFile.id : browserId} onActivate={(id) => setActiveFileId(id === browserId ? undefined : id)} onClose={close} closeLabel={text.close} />}>
          {showingFile ? <section className="kit-file-preview" aria-label={`${text.preview}: ${activeFile.name}`}>{renderFile(activeFile)}</section> : browser}
        </Editor>
      </Split>
    </div>
    <StatusBar start={<StatusItem>{showingFile ? activeFile.name : directory?.name ?? text.root}</StatusItem>} end={<StatusItem>{loading ? text.loading : `${rows.length} ${text.items}`}</StatusItem>} />
  </section>
}


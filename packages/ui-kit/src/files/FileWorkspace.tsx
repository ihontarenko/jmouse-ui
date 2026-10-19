import { fileFamilyOf, readableFileSize, type FileFamily } from "@jmouse/file-handling"
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from "react"
import { Button, IconButton } from "../controls/Button"
import { Segmented } from "../controls/Choices"
import { Input, SearchField, Select } from "../controls/Inputs"
import { Chip } from "../controls/Labels"
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
  /** Bytes — of the file, or of everything a folder holds when the host knows it. */
  size?: number
  /** Display-ready metadata; the product owns locale and date formatting. */
  modified?: string
  /**
   * Taken out, and still there to be put back. Drawn receded, struck through and marked with a word — never by colour
   * alone.
   */
  removed?: boolean
}

/** The order the type filter lists families in: what is read, then what is looked at, then the rest. */
const FAMILY_ORDER: readonly FileFamily[] = ["document", "code", "data", "sheet", "image", "audio", "video", "archive", "file"]

const defaultLabels = {
  folders: "Folders", files: "Files", root: "All files", path: "Folder path", up: "Parent folder",
  showFolders: "Show folders", hideFolders: "Hide folders", search: "Search this folder", view: "View",
  tiles: "Tiles", list: "List", sort: "Sort", name: "Name", size: "Size", modified: "Modified",
  ascending: "Name: A-Z", descending: "Name: Z-A", folder: "Folder", empty: "This folder is empty",
  emptyDescription: "Choose another folder or add files here.", noResults: "No matching files",
  clearSearch: "Clear search", loading: "Loading files", unavailable: "Folder is unavailable",
  unavailableDescription: "It may have been moved, removed, or access may have changed.",
  preview: "File preview", close: "Close", options: "Options", newName: "New name", dropFiles: "Drop files to add them to this folder",
  type: "Type", allTypes: "All",
  familyNames: { document: "Documents", code: "Code", data: "Data", sheet: "Sheets", image: "Images", audio: "Audio", video: "Video", archive: "Archives", file: "Other" } as Record<FileFamily, string>,
  noneOfTypes: "Nothing here is of the chosen types", showAllTypes: "Show every type",
  removed: "Removed",
  itemCount: (count: number): string => (count === 1 ? "1 item" : `${count} items`),
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

/** Where the workspace is, for a host that draws the way there itself — a page breadcrumb, a title. */
export interface FileWorkspaceLocation {
  /** The folders from the top down to the one shown; empty at the root. */
  trail: FileWorkspaceEntry[]
  /** The file in front, when one is. */
  activeFile?: FileWorkspaceEntry
  /** What the listing shows once filtered, and what the folder holds. */
  shown: number
  total: number
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
  /**
   * How the workspace sits on its page.
   *
   * - `window` (the default): a framed tool of its own, with its path above the panes and its counts below them.
   * - `page`: the workspace IS the page — no frame, no path bar, no status bar. The folders are the page's left column,
   *   the tab strip is its header line, and the host draws the way here in its own breadcrumb from
   *   {@link FileWorkspaceProperties.onLocationChange}. Give it the height of the page; the reader is the one scroll.
   */
  presentation?: "window" | "page"
  /** Where the workspace is, each time that changes — for a host that draws the breadcrumb itself. */
  onLocationChange?(location: FileWorkspaceLocation): void
  /** At the end of the tab strip — in page presentation, the page's own controls. */
  tabsEnd?: ReactNode
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
  /**
   * The file families the listing is narrowed to; empty or absent shows every file. Given with
   * {@link FileWorkspaceProperties.onFamiliesChange}, the choice is the host's — kept in its address, usually.
   * Folders are never filtered away: they are the way to the files.
   */
  families?: FileFamily[]
  onFamiliesChange?(families: FileFamily[]): void
  /** Keys pressed anywhere inside — where a host binds F2 or Delete to the selection. */
  onKeyDown?(event: KeyboardEvent<HTMLElement>): void
  className?: string
}

/** The narrow layout stacks the folders above the listing; there they start hidden, so the listing is what is seen. */
const NARROW = "(max-width: 640px)"

function startsNarrow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches
}

function familyOf(entry: FileWorkspaceEntry): FileFamily {
  return entry.glyphKind !== undefined && entry.glyphKind !== "folder" ? entry.glyphKind : fileFamilyOf(entry.name, entry.mediaType)
}

/**
 * A file manager composed from the kit's workspace parts — framed as a tool of its own, or as the page itself.
 * The product owns location, data and capabilities. Tabs, selection and presentation are local UI state unless the
 * host takes them. Entries form an acyclic tree, with stable unique IDs and folders as parents; null names the root.
 */
export function FileWorkspace({ entries, directoryId, onDirectoryChange, renderFile, presentation = "window", onLocationChange, tabsEnd, actions, entryActions, loading, error, unavailable, labels, formatSize = readableFileSize, defaultView = "tiles", storageKey, selectedId: hostSelectedId, onSelectedChange, renaming, onDropFiles, notice, openFileIds: hostOpenFileIds, activeFileId: hostActiveFileId, onOpenFilesChange, families: hostFamilies, onFamiliesChange, onKeyDown, className }: FileWorkspaceProperties) {
  const text = { ...defaultLabels, ...labels }
  const page = presentation === "page"
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
  const [ownFamilies, setOwnFamilies] = useState<FileFamily[]>([])
  const familiesControlled = onFamiliesChange !== undefined
  const chosenFamilies = familiesControlled ? (hostFamilies ?? []) : ownFamilies
  function chooseFamilies(next: FileFamily[]) {
    if (familiesControlled) {
      onFamiliesChange(next)
    } else {
      setOwnFamilies(next)
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
  const [treeVisible, setTreeVisible] = useState(() => !startsNarrow())
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
  const metadata = (entry: FileWorkspaceEntry) => entry.size === undefined ? (entry.kind === "folder" ? text.folder : "—") : formatSize(entry.size)
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

  const directoryEntries = childrenByParent.get(directoryId) ?? []
  const directoryFiles = directoryEntries.filter((entry) => entry.kind === "file")
  const familyCounts = new Map<FileFamily, number>()
  for (const file of directoryFiles) {
    const family = familyOf(file)
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1)
  }
  // A family chosen elsewhere stays on the strip at zero, so the reader sees why this folder shows less.
  const offeredFamilies = FAMILY_ORDER.filter((family) => familyCounts.has(family) || chosenFamilies.includes(family))
  const typeFilterShown = offeredFamilies.length > 1 || chosenFamilies.length > 0
  const ofChosenType = (entry: FileWorkspaceEntry) => entry.kind === "folder" || chosenFamilies.length === 0 || chosenFamilies.includes(familyOf(entry))
  const rows = directoryEntries.filter(ofChosenType).filter((entry) => entry.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((first, second) => {
    if (first.kind !== second.kind) {
      return first.kind === "folder" ? -1 : 1
    }
    const comparison = sort.key === "size" ? (first.size ?? 0) - (second.size ?? 0) : first.name.localeCompare(second.name, undefined, { numeric: true })
    return sort.direction === "descending" ? -comparison : comparison
  })

  // ⚠️ Told only when something the host would draw has changed: the effect is keyed on that, not on a fresh object
  // each render — a host that stores the location would otherwise render, be told again, and never stop.
  const locationKey = [...ancestors.map((entry) => `${entry.id}\u0000${entry.name}`), showingFile ? activeFile.id : "", rows.length, directoryEntries.length].join("\u0001")
  const location: FileWorkspaceLocation = { trail: ancestors, activeFile: showingFile ? activeFile : undefined, shown: rows.length, total: directoryEntries.length }
  const latestLocation = useRef(location)
  latestLocation.current = location
  useEffect(() => {
    onLocationChange?.(latestLocation.current)
  }, [locationKey]) // eslint-disable-line react-hooks/exhaustive-deps -- the key is the location's identity

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
    if (id === browserId) {
      return
    }
    const remaining = openIds.filter((openId) => openId !== id)
    setOpenFiles(remaining, activeFileId === id ? remaining.at(-1) : activeFileId)
  }
  function toggleFamily(family: FileFamily) {
    chooseFamilies(chosenFamilies.includes(family) ? chosenFamilies.filter((chosen) => chosen !== family) : [...chosenFamilies, family])
  }
  // A tab names its folder only when another open tab carries the same name; otherwise the folder is noise.
  const sharedName = (entry: FileWorkspaceEntry) => openedFiles.some((other) => other.id !== entry.id && other.name === entry.name)
  const folderNameOf = (entry: FileWorkspaceEntry) => entry.parentId ? byId.get(entry.parentId)?.name : text.root
  const tabs: OpenFile[] = [
    { id: browserId, name: directory?.name ?? text.root, icon: "folder", pinned: true },
    ...openedFiles.map((entry) => ({ id: entry.id, name: entry.name, glyph: glyph(entry), hint: sharedName(entry) ? folderNameOf(entry) : undefined })),
  ]
  const entryName = (entry: FileWorkspaceEntry) => <span className="kit-file-name" data-removed={entry.removed ? "" : undefined}>
    {glyph(entry)}
    {renaming?.id === entry.id ? <FileNameField entry={entry} rename={renaming} label={text.newName} /> : <span title={entry.name}>{entry.name}</span>}
    {entry.removed ? <span className="kit-file-mark">{text.removed}</span> : null}
  </span>
  const columns: TableColumn<FileWorkspaceEntry>[] = [
    { key: "name", header: text.name, sortable: true, truncate: true, cell: entryName },
    { key: "size", header: text.size, sortable: true, align: "end", technical: true, shrink: true, cell: metadata },
    { key: "modified", header: text.modified, technical: true, shrink: true, cell: (entry) => entry.modified ?? "—" },
    ...(entryActions ? [{ key: "actions", header: "", headerLabel: text.options, shrink: true, cell: menu } satisfies TableColumn<FileWorkspaceEntry>] : []),
  ]

  const filteredAway = chosenFamilies.length > 0 && directoryFiles.length > 0 && !directoryFiles.some(ofChosenType)
  const listing = error ? <Notice tone="danger">{error}</Notice>
    : loading ? <Waiting label={text.loading} />
      : !directoryAvailable ? <EmptyState flush icon="folder" title={text.unavailable} description={text.unavailableDescription} actions={<Button onClick={() => navigate(null)}>{text.root}</Button>} />
        : rows.length === 0 && query ? <EmptyState flush icon="search" title={text.noResults} actions={<Button onClick={() => setSearch({ directoryId, value: "" })}>{text.clearSearch}</Button>} />
          : rows.length === 0 && filteredAway ? <EmptyState flush icon="filter" title={text.noneOfTypes} actions={<Button onClick={() => chooseFamilies([])}>{text.showAllTypes}</Button>} />
            : rows.length === 0 ? <EmptyState flush icon="folder" title={text.empty} description={text.emptyDescription} />
              : view === "list" ? <Table label={text.files} columns={columns} rows={rows} rowKey={(entry) => entry.id} sort={sort} onSortChange={setSort} selectedKey={rows.some((entry) => entry.id === selectedId) ? selectedId : undefined} onRowSelect={(entry) => setSelection({ directoryId, id: entry.id })} onRowActivate={open} />
                : <TileGrid>
                  {rows.map((entry) => <Tile key={entry.id} className={entry.removed ? "kit-file-tile-removed" : undefined} name={entry.name} glyph={glyph(entry, "large")} meta={entry.removed ? text.removed : metadata(entry)} active={selectedId === entry.id} onOpen={() => setSelection({ directoryId, id: entry.id })} onActivate={() => open(entry)} actions={menu(entry)} editor={renaming?.id === entry.id ? <FileNameField entry={entry} rename={renaming} label={text.newName} /> : undefined} />)}
                </TileGrid>

  const browser = <div className="kit-file-browser">
    <Toolbar label={text.files}>
      {page ? <>
        <IconButton icon="sidebar" size="small" label={treeVisible ? text.hideFolders : text.showFolders} aria-expanded={treeVisible} onClick={() => setTreeVisible(!treeVisible)} />
        <IconButton icon="arrow-up" size="small" label={text.up} disabled={!parentKnown} onClick={() => {
          if (directory !== undefined) {
            navigate(directory.parentId)
          }
        }} />
      </> : null}
      <SearchField label={text.search} placeholder={text.search} size="small" value={query} onValueChange={(value) => setSearch({ directoryId, value })} />
      <ToolbarPush />
      {/* The list sorts by its column heads; only the tiles, which have none, need the menu. */}
      {view === "tiles" ? <Select aria-label={text.sort} size="small" value={sort.direction} onChange={(event) => setSort({ key: "name", direction: event.target.value as TableSort["direction"] })} options={[{ value: "ascending", label: text.ascending }, { value: "descending", label: text.descending }]} /> : null}
      <Segmented<"tiles" | "list"> label={text.view} size="small" value={view} onValueChange={setView} options={[{ value: "tiles", label: text.tiles }, { value: "list", label: text.list }]} />
      {actions}
    </Toolbar>
    {typeFilterShown ? <div className="kit-file-facets" role="group" aria-label={text.type}>
      <span className="kit-micro-label" aria-hidden="true">{text.type}</span>
      <Chip pressed={chosenFamilies.length === 0} count={directoryFiles.length} onClick={() => chooseFamilies([])}>{text.allTypes}</Chip>
      {offeredFamilies.map((family) => <Chip key={family} pressed={chosenFamilies.includes(family)} count={familyCounts.get(family) ?? 0} onClick={() => toggleFamily(family)}>
        <span className="kit-file-family" style={{ "--kit-file-family-color": `var(--kit-file-${family}, var(--kit-muted))` } as CSSProperties} aria-hidden="true" />
        {text.familyNames[family]}
      </Chip>)}
    </div> : null}
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
      {listing}
    </div>
  </div>

  return <section className={joinClassNames("kit-file-workspace", className)} aria-label={text.files} data-presentation={presentation} data-tree-visible={treeVisible ? "" : undefined} onKeyDown={onKeyDown}>
    {page ? null : <div className="kit-file-location">
      <IconButton icon="folder" size="small" label={treeVisible ? text.hideFolders : text.showFolders} aria-expanded={treeVisible} onClick={() => setTreeVisible(!treeVisible)} />
      <IconButton icon="arrow-up" size="small" label={text.up} disabled={!parentKnown} onClick={() => {
        if (directory !== undefined) {
          navigate(directory.parentId)
        }
      }} />
      <Crumbs label={text.path} items={[{ label: text.root, onNavigate: () => navigate(null) }, ...ancestors.map((entry) => ({ label: entry.name, onNavigate: () => navigate(entry.id) }))]} renderLink={(crumb, className) => <button className={className} type="button" onClick={crumb.onNavigate}>{crumb.label}</button>} />
    </div>}
    {notice ? <div className="kit-file-notice">{notice}</div> : null}
    <div className="kit-file-panes">
      <Split label={text.folders} defaultSize={page ? 240 : 260} minimum={180} maximum={480} collapsed={!treeVisible} storageKey={storageKey}>
        <ToolWindow title={text.folders} onHide={() => setTreeVisible(false)} hideLabel={text.hideFolders}>
          <Tree label={text.folders} nodes={treeNodes(null)} selectedId={directoryId ?? undefined} expandedIds={expandedIds} onExpandedChange={setExpandedIds} onSelect={navigate} />
        </ToolWindow>
        <Editor tabs={<EditorTabs label={text.files} files={tabs} activeId={showingFile ? activeFile.id : browserId} onActivate={(id) => setOpenFiles(openIds, id === browserId ? undefined : id)} onClose={close} closeLabel={text.close} end={tabsEnd} />}>
          {showingFile ? <section className="kit-file-preview" aria-label={`${text.preview}: ${activeFile.name}`}>{renderFile(activeFile)}</section> : browser}
        </Editor>
      </Split>
    </div>
    {page ? null : <StatusBar start={<StatusItem>{showingFile ? activeFile.name : directory?.name ?? text.root}</StatusItem>} end={<StatusItem>{loading ? text.loading : text.itemCount(rows.length)}</StatusItem>} />}
  </section>
}

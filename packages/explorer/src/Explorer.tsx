import { readableFileSize, reasonOf, saveBlob } from "@jmouse/file-handling"
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  FileWorkspace,
  IconButton,
  Input,
  Notice,
  Tree,
  type FileWorkspaceEntry,
  type FileWorkspaceLabels,
  type IconSource,
  type MenuEntry,
  type TreeNode,
} from "@jmouse/ui-kit"
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { entryActions, permits, placeActions } from "./actions"
import type { ExplorerAction, ExplorerAdapter, ExplorerEntry } from "./adapter"
import { ExplorerViewer, type ExplorerViewerLabels } from "./ExplorerViewer"
import { useExplorerCatalogue } from "./useExplorerCatalogue"

/** A sentence, then the server's reason in brackets when it gave one — the English default's way of placing it. */
function withReason(sentence: string, reason: string): string {
  return reason === "" ? `${sentence}.` : `${sentence} (${reason}).`
}

/**
 * Every word the explorer says.
 *
 * ⚠️ **A sentence with a name or a reason in it is a FUNCTION, never fragments glued together.** "could not be
 * uploaded" appended to a file name fixes English word order into every translation; a function hands the whole
 * sentence to whoever translates it.
 */
const explorerLabels = {
  upload: "Upload",
  newFolder: "New folder",
  folderName: "Folder name",
  createFolder: "Create folder",
  renameTitle: "Rename",
  newName: "New name",
  saveName: "Rename",
  cancel: "Cancel",
  open: "Open",
  download: "Download",
  copyLink: "Copy link",
  rename: "Rename",
  move: "Move to…",
  moveTitle: (name: string) => `Move “${name}”`,
  moveDescription: "Choose the folder it goes into.",
  moveHere: "Move here",
  remove: "Delete",
  removeTitle: (name: string) => `Delete “${name}”`,
  removeFileDescription: "The file is deleted. This cannot be undone.",
  removeFolderDescription: "The folder is deleted. A folder that still holds something is refused rather than emptied.",
  nameRequired: "A name is required.",
  nameInvalid: "A name cannot contain / or \\.",
  nameTaken: "Something in this folder already has that name.",
  uploading: (done: number, total: number) => `Uploading ${done} of ${total}`,
  dismiss: "Dismiss",
  unreadable: (reason: string) => withReason("The folder could not be read", reason),
  shapeUnreadable: (reason: string) => withReason("The folder tree could not be read", reason),
  createFailed: (name: string, reason: string) => withReason(`The folder “${name}” could not be created`, reason),
  renameFailed: (name: string, reason: string) => withReason(`“${name}” could not be renamed`, reason),
  moveFailed: (name: string, reason: string) => withReason(`“${name}” could not be moved`, reason),
  removeFailed: (name: string, reason: string) => withReason(`“${name}” could not be deleted`, reason),
  uploadFailed: (name: string, reason: string) => withReason(`“${name}” could not be uploaded`, reason),
  downloadFailed: (name: string, reason: string) => withReason(`“${name}” could not be downloaded`, reason),
  copyFailed: (name: string, reason: string) => withReason(`The link to “${name}” could not be copied`, reason),
  reading: "Reading the file",
  readFailed: (name: string, reason: string) => withReason(`“${name}” could not be read`, reason),
  notShowable: "This file cannot be shown here",
  notShowableDescription: "Download it to open it with an application.",
  needsConverting: "This document needs converting before it can be shown.",
  noBytes: "This place does not offer the file's contents.",
  notOpenable: "This file cannot be opened here",
}

export type ExplorerLabels = typeof explorerLabels & FileWorkspaceLabels

export interface ExplorerProperties {
  adapter: ExplorerAdapter
  /** The folder shown, when the host keeps it — in the address, usually. Left out, the explorer keeps its own. */
  folderId?: string | null
  onFolderChange?(folderId: string | null): void
  /** Where an uncontrolled explorer starts. */
  defaultFolderId?: string | null
  /** The files open as tabs, when the host keeps them — so a link reopens a document. Left out, the explorer keeps its own. */
  openFileIds?: string[]
  activeFileId?: string
  onOpenFilesChange?(openFileIds: string[], activeFileId: string | undefined): void
  /** A richer viewer than the default — rendered Markdown, a code editor, a product's own reader. */
  renderFile?(file: ExplorerEntry): ReactNode
  /** The product's own entries, listed after the standard ones in every "⋯" menu. */
  extraActions?(entry: ExplorerEntry): MenuEntry[]
  labels?: Partial<ExplorerLabels>
  formatDate?(iso: string): string
  formatSize?(bytes: number): string
  defaultView?: "tiles" | "list"
  /** Namespaces what the explorer remembers between visits — the folder pane's width. */
  storageKey?: string
  className?: string
}

/** An act on its way to a dialog. */
type Pending =
  | { act: "createFolder" }
  | { act: "rename"; entry: ExplorerEntry }
  | { act: "move"; entry: ExplorerEntry }
  | { act: "remove"; entry: ExplorerEntry }

/** What the descriptors call to carry an act out — the component's own handlers. */
interface ActHandlers {
  download(entry: ExplorerEntry): void
  copyLink(entry: ExplorerEntry): void
  startRename(entry: ExplorerEntry): void
  ask(pending: Pending): void
  chooseUploads(): void
}

/** How an act is presented and carried out. Whether it is on offer is `actions.ts`'s answer, not this table's. */
interface ActionPresentation {
  icon: IconSource
  label(text: ExplorerLabels): string
  /** The key that does the same, shown beside the menu entry. */
  key?: string
  danger?: boolean
  /** What it does to an entry; absent where the kit itself carries the act out (opening) or it is about a place. */
  perform?(handlers: ActHandlers, entry: ExplorerEntry): void
}

const ACTIONS: Record<ExplorerAction, ActionPresentation> = {
  open: { icon: "file", label: (text) => text.open },
  download: { icon: "download", label: (text) => text.download, perform: (handlers, entry) => handlers.download(entry) },
  copyLink: { icon: "link", label: (text) => text.copyLink, perform: (handlers, entry) => handlers.copyLink(entry) },
  rename: { icon: "edit", label: (text) => text.rename, key: "F2", perform: (handlers, entry) => handlers.startRename(entry) },
  move: { icon: "folder", label: (text) => text.move, perform: (handlers, entry) => handlers.ask({ act: "move", entry }) },
  remove: { icon: "trash", label: (text) => text.remove, key: "Delete", danger: true, perform: (handlers, entry) => handlers.ask({ act: "remove", entry }) },
  createFolder: { icon: "plus", label: (text) => text.newFolder },
  upload: { icon: "upload", label: (text) => text.upload },
}

function formatIsoDate(iso: string): string {
  const date = new Date(iso)

  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function isTyping(event: KeyboardEvent<HTMLElement>): boolean {
  const target = event.target as HTMLElement

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

/** Why a name cannot be used here, or undefined when it can. The dialog and the in-place field both ask this. */
function nameProblem(name: string, siblings: ExplorerEntry[], text: ExplorerLabels): string | undefined {
  const clean = name.trim()

  if (!clean) {
    return text.nameRequired
  }

  if (/[/\\]/.test(clean)) {
    return text.nameInvalid
  }

  if (siblings.some((sibling) => sibling.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
    return text.nameTaken
  }

  return undefined
}

/**
 * The file manager a product embeds: the kit's workspace, fed by the product's adapter.
 *
 * ⚠️ **What may be done follows from the adapter, never from which product this is.** The "⋯" menus, the toolbar and
 * the keys (F2, Delete, Alt+↑) all ask `actions.ts`, so an act the adapter cannot do is absent everywhere at once.
 *
 * ⚠️ **A failed act leaves the listing usable.** It is said in a band above the panes, in the server's own words, and
 * the band can be dismissed — a failure that replaced the listing would punish a refused rename with a lost place.
 */
export function Explorer({ adapter, folderId: hostFolderId, onFolderChange, defaultFolderId = null, openFileIds, activeFileId, onOpenFilesChange, renderFile, extraActions, labels, formatDate = formatIsoDate, formatSize = readableFileSize, defaultView, storageKey, className }: ExplorerProperties) {
  const text = { ...explorerLabels, ...labels } as ExplorerLabels
  const [ownFolderId, setOwnFolderId] = useState<string | null>(defaultFolderId)
  const folderId = hostFolderId === undefined ? ownFolderId : hostFolderId
  const catalogue = useExplorerCatalogue(adapter, folderId, openFileIds)
  const [selectedId, setSelectedId] = useState<string>()
  const [renamingId, setRenamingId] = useState<string>()
  const [pending, setPending] = useState<Pending>()
  const [problem, setProblem] = useState<string>()
  const [uploads, setUploads] = useState<{ done: number; total: number }>()
  const uploadInput = useRef<HTMLInputElement>(null)
  // ⚠️ One upload run at a time. Files dropped while one is running join its queue — two loops over one counter
  // would report "3 of 2" and race each other's refusals.
  const uploadQueue = useRef<File[] | undefined>(undefined)

  const byId = useMemo(() => new Map(catalogue.entries.map((entry) => [entry.id, entry])), [catalogue.entries])
  const folder = folderId === null ? undefined : byId.get(folderId)
  const selected = selectedId === undefined ? undefined : byId.get(selectedId)
  const childrenOf = (parentId: string | null) => catalogue.entries.filter((entry) => entry.parentId === parentId)
  const listingFailed = catalogue.folder.failure !== undefined
  const offered = listingFailed ? [] : placeActions(adapter, folderId, folder)

  const workspaceEntries = useMemo<FileWorkspaceEntry[]>(() => catalogue.entries.map((entry) => ({
    id: entry.id,
    parentId: entry.parentId,
    name: entry.name,
    kind: entry.kind,
    mediaType: entry.mediaType,
    size: entry.size,
    modified: entry.modified === undefined ? undefined : formatDate(entry.modified),
  })), [catalogue.entries, formatDate])

  function changeFolder(next: string | null) {
    setSelectedId(undefined)
    setRenamingId(undefined)

    if (hostFolderId === undefined) {
      setOwnFolderId(next)
    }

    onFolderChange?.(next)
  }

  /** Runs one act; a refusal becomes the band, in a whole sentence that names what was refused. */
  async function attempt(describeFailure: (reason: string) => string, act: () => Promise<void>) {
    try {
      setProblem(undefined)
      await act()
    } catch (failure) {
      setProblem(describeFailure(reasonOf(failure)))
    }
  }

  function startRename(entry: ExplorerEntry) {
    if (entry.parentId === folderId) {
      setSelectedId(entry.id)
      setRenamingId(entry.id)
    } else {
      setPending({ act: "rename", entry })
    }
  }

  function rename(entry: ExplorerEntry, name: string) {
    setRenamingId(undefined)
    setPending(undefined)

    return attempt((reason) => text.renameFailed(entry.name, reason), async () => {
      catalogue.record(await adapter.rename!(entry, name))
    })
  }

  function createFolder(name: string) {
    setPending(undefined)

    return attempt((reason) => text.createFailed(name, reason), async () => {
      const created = await adapter.createFolder!(folderId, name)

      catalogue.record(created)
      setSelectedId(created.id)
    })
  }

  function move(entry: ExplorerEntry, target: string | null) {
    setPending(undefined)

    return attempt((reason) => text.moveFailed(entry.name, reason), async () => {
      catalogue.record(await adapter.move!(entry, target))
      setSelectedId(undefined)
    })
  }

  /** ⚠️ The confirmation closes either way — a refusal is said in the band, where it stays readable. */
  async function remove(entry: ExplorerEntry) {
    await attempt((reason) => text.removeFailed(entry.name, reason), async () => {
      await adapter.remove!(entry)
      catalogue.forget(entry.id)
      setSelectedId(undefined)
    })
    setPending(undefined)
  }

  function download(entry: ExplorerEntry) {
    return attempt((reason) => text.downloadFailed(entry.name, reason), async () => {
      saveBlob(await adapter.read!(entry), entry.name)
    })
  }

  function copyLink(entry: ExplorerEntry) {
    return attempt((reason) => text.copyFailed(entry.name, reason), async () => {
      await navigator.clipboard.writeText(adapter.shareUrl!(entry) ?? "")
    })
  }

  /**
   * ⚠️ **One at a time, and every one attempted.** A refused file is named and the rest still go — stopping at the
   * first refusal would leave somebody guessing which of forty files arrived.
   */
  async function upload(files: File[]) {
    if (files.length === 0 || !offered.includes("upload")) {
      return
    }

    if (uploadQueue.current !== undefined) {
      uploadQueue.current.push(...files)
      setUploads((current) => current === undefined ? current : { ...current, total: current.total + files.length })

      return
    }

    const queue = [...files]
    const refused: string[] = []
    const destination = folderId
    let done = 0

    uploadQueue.current = queue
    setProblem(undefined)
    setUploads({ done, total: queue.length })

    while (queue.length > 0) {
      const file = queue.shift()!

      try {
        catalogue.record(await adapter.upload!(destination, file))
      } catch (failure) {
        refused.push(text.uploadFailed(file.name, reasonOf(failure)))
      }

      done += 1
      setUploads((current) => ({ done, total: current?.total ?? done }))
    }

    uploadQueue.current = undefined
    setUploads(undefined)

    if (refused.length > 0) {
      setProblem(refused.join(" "))
    }
  }

  const handlers: ActHandlers = {
    download: (entry) => void download(entry),
    copyLink: (entry) => void copyLink(entry),
    startRename,
    ask: setPending,
    chooseUploads: () => uploadInput.current?.click(),
  }

  function menuFor(workspaceEntry: FileWorkspaceEntry): MenuEntry[] {
    const entry = byId.get(workspaceEntry.id)

    if (!entry) {
      return []
    }

    const standard = entryActions(adapter, entry).map((action): MenuEntry => {
      const presentation = ACTIONS[action]

      return {
        label: presentation.label(text),
        icon: presentation.icon,
        onSelect: () => presentation.perform?.(handlers, entry),
        danger: presentation.danger,
        separated: presentation.danger,
        hint: presentation.key,
      }
    })
    const extra = extraActions?.(entry) ?? []

    return extra.length === 0 ? standard : [...standard, { ...extra[0], separated: true }, ...extra.slice(1)]
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (isTyping(event)) {
      return
    }

    // ⚠️ Up only to a parent the explorer actually knows. Opened deep without `ancestors`, the parent has no name
    // yet, and jumping to the root instead would be a silent lie about where "up" is.
    if (event.key === "ArrowUp" && event.altKey) {
      if (folder !== undefined) {
        event.preventDefault()
        changeFolder(folder.parentId)
      }

      return
    }

    if (!selected) {
      return
    }

    const keyed = entryActions(adapter, selected).find((action) => ACTIONS[action].key === event.key)

    if (keyed !== undefined) {
      event.preventDefault()
      ACTIONS[keyed].perform?.(handlers, selected)
    }
  }

  // ⚠️ The selection's acts are on the toolbar too, as the same descriptors the menu and the keys read — a keyboard-
  // less reader on a touch screen otherwise has only the "⋯" menu, and a toolbar that offered less than the menu would
  // be a second answer to "what may be done".
  const selectionActions = selected === undefined ? [] : entryActions(adapter, selected)

  const toolbar = <>
    {selected !== undefined ? selectionActions.map((action) => <IconButton key={action} size="small" icon={ACTIONS[action].icon}
      label={`${ACTIONS[action].label(text)}: ${selected.name}`} onClick={() => ACTIONS[action].perform?.(handlers, selected)} />) : null}
    {offered.includes("createFolder") ? <Button size="small" icon={ACTIONS.createFolder.icon} onClick={() => setPending({ act: "createFolder" })}>{ACTIONS.createFolder.label(text)}</Button> : null}
    {offered.includes("upload") ? <>
      <Button size="small" variant="primary" icon={ACTIONS.upload.icon} busy={uploads !== undefined} onClick={handlers.chooseUploads}>{ACTIONS.upload.label(text)}</Button>
      <input ref={uploadInput} type="file" multiple hidden tabIndex={-1} aria-hidden="true" onChange={(event) => {
        const files = Array.from(event.target.files ?? [])

        event.target.value = ""
        void upload(files)
      }} />
    </> : null}
  </>

  const shapeProblem = catalogue.shapeFailure === undefined ? undefined : text.shapeUnreadable(catalogue.shapeFailure.reason)

  const notice = uploads !== undefined
    ? <Notice tone="accent" icon="upload" aria-live="polite">{text.uploading(uploads.done, uploads.total)}</Notice>
    : problem !== undefined
      ? <Notice tone="danger" actions={<IconButton icon="close" size="small" label={text.dismiss} onClick={() => setProblem(undefined)} />}>{problem}</Notice>
      : shapeProblem !== undefined
        ? <Notice tone="danger" actions={<IconButton icon="close" size="small" label={text.dismiss} onClick={catalogue.dismissShapeFailure} />}>{shapeProblem}</Notice>
        : undefined

  const renamingEntry = renamingId === undefined ? undefined : byId.get(renamingId)
  const listingFailure = catalogue.folder.failure

  return <>
    <FileWorkspace
      className={className}
      entries={workspaceEntries}
      directoryId={folderId}
      onDirectoryChange={changeFolder}
      selectedId={selectedId}
      onSelectedChange={(entry) => setSelectedId(entry?.id)}
      renaming={renamingEntry ? {
        id: renamingEntry.id,
        onCommit: (name) => void rename(renamingEntry, name),
        onCancel: () => setRenamingId(undefined),
        problemWith: (name) => nameProblem(name, childrenOf(renamingEntry.parentId).filter((entry) => entry.id !== renamingEntry.id), text),
      } : undefined}
      onDropFiles={offered.includes("upload") ? (files) => void upload(files) : undefined}
      openFileIds={openFileIds}
      activeFileId={activeFileId}
      onOpenFilesChange={onOpenFilesChange}
      onKeyDown={onKeyDown}
      notice={notice}
      actions={toolbar}
      entryActions={menuFor}
      loading={catalogue.folder.loading && childrenOf(folderId).length === 0}
      unavailable={listingFailure?.gone}
      error={listingFailure !== undefined && !listingFailure.gone ? text.unreadable(listingFailure.reason) : undefined}
      labels={text}
      formatSize={formatSize}
      defaultView={defaultView}
      storageKey={storageKey}
      renderFile={(workspaceEntry) => {
        const file = byId.get(workspaceEntry.id)

        if (!file) {
          return null
        }

        if (!permits(adapter, "open", { entry: file })) {
          return <EmptyState flush icon="file" title={text.notOpenable} />
        }

        if (renderFile) {
          return renderFile(file)
        }

        return <ExplorerViewer file={file} adapter={adapter} labels={viewerLabels(text)} onDownload={permits(adapter, "download", { entry: file }) ? () => void download(file) : undefined} />
      }}
    />
    {pending?.act === "createFolder" ? <NameDialog title={text.newFolder} fieldLabel={text.folderName} confirmLabel={text.createFolder} initial="" siblings={childrenOf(folderId)} text={text} onConfirm={createFolder} onClose={() => setPending(undefined)} /> : null}
    {pending?.act === "rename" ? <NameDialog title={text.renameTitle} fieldLabel={text.newName} confirmLabel={text.saveName} initial={pending.entry.name} siblings={childrenOf(pending.entry.parentId).filter((entry) => entry.id !== pending.entry.id)} text={text} onConfirm={(name) => rename(pending.entry, name)} onClose={() => setPending(undefined)} /> : null}
    {pending?.act === "move" ? <MoveDialog entry={pending.entry} folders={catalogue.entries.filter((entry) => entry.kind === "folder")} text={text} onConfirm={(target) => move(pending.entry, target)} onClose={() => setPending(undefined)} /> : null}
    <ConfirmDialog
      open={pending?.act === "remove"}
      title={pending?.act === "remove" ? text.removeTitle(pending.entry.name) : text.remove}
      description={pending?.act === "remove" && pending.entry.kind === "folder" ? text.removeFolderDescription : text.removeFileDescription}
      confirmLabel={text.remove}
      cancelLabel={text.cancel}
      tone="danger"
      onConfirm={() => (pending?.act === "remove" ? remove(pending.entry) : undefined)}
      onClose={() => setPending(undefined)}
    />
  </>
}

function viewerLabels(text: ExplorerLabels): ExplorerViewerLabels {
  return {
    reading: text.reading,
    readFailed: text.readFailed,
    notShowable: text.notShowable,
    notShowableDescription: text.notShowableDescription,
    needsConverting: text.needsConverting,
    noBytes: text.noBytes,
    download: text.download,
  }
}

interface NameDialogProperties {
  title: string
  fieldLabel: string
  confirmLabel: string
  initial: string
  siblings: ExplorerEntry[]
  text: ExplorerLabels
  onConfirm(name: string): void
  onClose(): void
}

/**
 * A name, asked for in a dialog — a new folder, or a rename of something not in the listing.
 *
 * ⚠️ **The error appears once somebody has typed**, not on an empty field that has just opened: a dialog that greets
 * its reader with "A name is required" reads as a scolding.
 */
function NameDialog({ title, fieldLabel, confirmLabel, initial, siblings, text, onConfirm, onClose }: NameDialogProperties) {
  const [name, setName] = useState(initial)
  const [touched, setTouched] = useState(false)
  const problem = nameProblem(name, siblings, text)
  const unchanged = name.trim() === initial

  function confirm() {
    if (problem === undefined && !unchanged) {
      onConfirm(name.trim())
    }
  }

  return <Dialog open onClose={onClose} title={title} size="small"
    footer={<>
      <Button onClick={onClose}>{text.cancel}</Button>
      <Button variant="primary" disabled={problem !== undefined || unchanged} onClick={confirm}>{confirmLabel}</Button>
    </>}>
    <Field label={fieldLabel} error={touched ? problem : undefined}>
      <Input autoFocus value={name} onChange={(event) => {
        setTouched(true)
        setName(event.target.value)
      }} onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          confirm()
        }
      }} />
    </Field>
  </Dialog>
}

/**
 * Where a move goes: a folder, or the root.
 *
 * ⚠️ **The root is a choice of its own, not an ID.** The tree only speaks in string IDs, so the root's node gets one
 * — and that string is translated at the tree's edge and nowhere else, so no adapter ID can ever be mistaken for it.
 */
type MoveTarget = { root: true } | { root: false; folderId: string }

const ROOT_TREE_ID = "\u0000explorer-root"

function treeIdOf(target: MoveTarget): string {
  return target.root ? ROOT_TREE_ID : target.folderId
}

function moveTargetOf(treeId: string): MoveTarget {
  return treeId === ROOT_TREE_ID ? { root: true } : { root: false, folderId: treeId }
}

function folderIdOf(target: MoveTarget): string | null {
  return target.root ? null : target.folderId
}

interface MoveDialogProperties {
  entry: ExplorerEntry
  folders: ExplorerEntry[]
  text: ExplorerLabels
  onConfirm(folderId: string | null): void
  onClose(): void
}

/**
 * Where something goes, chosen from the folders the explorer knows.
 *
 * ⚠️ **A folder cannot go into itself or anything under it**, so that branch is left out of the choice rather than
 * offered and refused.
 */
function MoveDialog({ entry, folders, text, onConfirm, onClose }: MoveDialogProperties) {
  const [target, setTarget] = useState<MoveTarget>(entry.parentId === null ? { root: true } : { root: false, folderId: entry.parentId })

  const nodes = useMemo(() => {
    const foldersByParent = new Map<string | null, ExplorerEntry[]>()

    for (const folder of folders) {
      const siblings = foldersByParent.get(folder.parentId) ?? []

      siblings.push(folder)
      foldersByParent.set(folder.parentId, siblings)
    }

    function build(parentId: string | null): TreeNode[] {
      return (foldersByParent.get(parentId) ?? [])
        .filter((folder) => folder.id !== entry.id)
        .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }))
        .map((folder) => ({ id: folder.id, name: folder.name, icon: "folder", expandedIcon: "folder-open", children: build(folder.id) }))
    }

    return [{ id: ROOT_TREE_ID, name: text.root, icon: "home", children: build(null) } satisfies TreeNode]
  }, [folders, entry.id, text.root])

  const everyId = useMemo(() => [ROOT_TREE_ID, ...folders.map((folder) => folder.id)], [folders])
  const unchanged = folderIdOf(target) === entry.parentId

  return <Dialog open onClose={onClose} title={text.moveTitle(entry.name)} description={text.moveDescription}
    footer={<>
      <Button onClick={onClose}>{text.cancel}</Button>
      <Button variant="primary" disabled={unchanged} onClick={() => onConfirm(folderIdOf(target))}>{text.moveHere}</Button>
    </>}>
    <Tree label={text.folders} nodes={nodes} selectedId={treeIdOf(target)} defaultExpandedIds={everyId}
      onSelect={(id) => setTarget(moveTargetOf(id))} />
  </Dialog>
}

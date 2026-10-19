import {
  Button,
  ConfirmDialog,
  Dialog,
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
import { because } from "./headless/failures"
import { readableFileSize } from "./headless/fileKinds"
import { saveBlob } from "./headless/saveBlob"
import { useExplorerCatalogue } from "./useExplorerCatalogue"

const explorerLabels = {
  upload: "Upload",
  newFolder: "New folder",
  folderName: "Folder name",
  createFolder: "Create folder",
  renameTitle: "Rename",
  newName: "New name",
  saveName: "Rename",
  cancel: "Cancel",
  download: "Download",
  copyLink: "Copy link",
  rename: "Rename",
  move: "Move to…",
  moveTitle: "Move",
  moveDescription: "Choose the folder it goes into.",
  moveHere: "Move here",
  remove: "Delete",
  removeTitle: "Delete",
  removeFileDescription: "The file is deleted. This cannot be undone.",
  removeFolderDescription: "The folder is deleted. A folder that still holds something is refused rather than emptied.",
  nameRequired: "A name is required.",
  nameInvalid: "A name cannot contain / or \\.",
  nameTaken: "Something in this folder already has that name.",
  uploading: "Uploading",
  of: "of",
  dismiss: "Dismiss",
  unreadable: "The folder could not be read",
  createFailed: "The folder could not be created",
  renameFailed: "The name could not be changed",
  moveFailed: "It could not be moved",
  removeFailed: "It could not be deleted",
  uploadFailed: "could not be uploaded",
  downloadFailed: "The file could not be downloaded",
  copyFailed: "The link could not be copied",
  reading: "Reading the file",
  readFailed: "The file could not be read",
  notShowable: "This file cannot be shown here",
  notShowableDescription: "Download it to open it with an application.",
  needsConverting: "This document needs converting before it can be shown.",
  noBytes: "This place does not offer the file's contents.",
}

export type ExplorerLabels = typeof explorerLabels & FileWorkspaceLabels

export interface ExplorerProperties {
  adapter: ExplorerAdapter
  /** The folder shown, when the host keeps it — in the address, usually. Left out, the explorer keeps its own. */
  folderId?: string | null
  onFolderChange?(folderId: string | null): void
  /** Where an uncontrolled explorer starts. */
  defaultFolderId?: string | null
  /** A richer viewer than the default — rendered Markdown, a code editor. */
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

const ACTION_ICONS: Record<ExplorerAction, IconSource> = {
  download: "download",
  copyLink: "link",
  rename: "edit",
  move: "folder",
  remove: "trash",
  createFolder: "plus",
  upload: "upload",
}

const ROOT_NODE = "\u0000root"

function formatIsoDate(iso: string): string {
  const date = new Date(iso)

  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function isTyping(event: KeyboardEvent<HTMLElement>): boolean {
  const target = event.target as HTMLElement

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
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
export function Explorer({ adapter, folderId: hostFolderId, onFolderChange, defaultFolderId = null, renderFile, extraActions, labels, formatDate = formatIsoDate, formatSize = readableFileSize, defaultView, storageKey, className }: ExplorerProperties) {
  const text = { ...explorerLabels, ...labels } as ExplorerLabels
  const [ownFolderId, setOwnFolderId] = useState<string | null>(defaultFolderId)
  const folderId = hostFolderId === undefined ? ownFolderId : hostFolderId
  const catalogue = useExplorerCatalogue(adapter, folderId, text.unreadable)
  const [selectedId, setSelectedId] = useState<string>()
  const [renamingId, setRenamingId] = useState<string>()
  const [pending, setPending] = useState<Pending>()
  const [problem, setProblem] = useState<string>()
  const [uploads, setUploads] = useState<{ done: number; total: number }>()
  const uploadInput = useRef<HTMLInputElement>(null)

  const byId = useMemo(() => new Map(catalogue.entries.map((entry) => [entry.id, entry])), [catalogue.entries])
  const folder = folderId === null ? null : byId.get(folderId)
  const selected = selectedId === undefined ? undefined : byId.get(selectedId)
  const offered = folder === undefined ? [] : placeActions(adapter, folder)

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

  /** Runs one act; a refusal becomes the band, in the server's words. */
  async function attempt(failureLabel: string, act: () => Promise<void>) {
    try {
      setProblem(undefined)
      await act()
    } catch (failure) {
      setProblem(`${failureLabel}${because(failure)}`)
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

    return attempt(text.renameFailed, async () => {
      catalogue.record(await adapter.rename!(entry, name))
    })
  }

  function createFolder(name: string) {
    setPending(undefined)

    return attempt(text.createFailed, async () => {
      const created = await adapter.createFolder!(folderId, name)

      catalogue.record(created)
      setSelectedId(created.id)
    })
  }

  function move(entry: ExplorerEntry, target: string | null) {
    setPending(undefined)

    return attempt(text.moveFailed, async () => {
      catalogue.record(await adapter.move!(entry, target))
      setSelectedId(undefined)
    })
  }

  /** ⚠️ The confirmation closes either way — a refusal is said in the band, where it stays readable. */
  async function remove(entry: ExplorerEntry) {
    await attempt(text.removeFailed, async () => {
      await adapter.remove!(entry)
      catalogue.forget(entry.id)
      setSelectedId(undefined)
    })
    setPending(undefined)
  }

  function download(entry: ExplorerEntry) {
    return attempt(text.downloadFailed, async () => {
      saveBlob(await adapter.read!(entry), entry.name)
    })
  }

  function copyLink(entry: ExplorerEntry) {
    return attempt(text.copyFailed, async () => {
      await navigator.clipboard.writeText(adapter.shareUrl!(entry) ?? "")
    })
  }

  /**
   * ⚠️ **One at a time, and every one attempted.** A refused file is named and the rest still go — stopping at the
   * first refusal would leave somebody guessing which of forty files arrived.
   */
  async function upload(files: File[]) {
    if (files.length === 0 || !permits(adapter, "upload", folder ?? null)) {
      return
    }

    const refused: string[] = []

    setProblem(undefined)
    setUploads({ done: 0, total: files.length })

    for (const [index, file] of files.entries()) {
      try {
        catalogue.record(await adapter.upload!(folderId, file))
      } catch (failure) {
        refused.push(`${file.name} ${text.uploadFailed}${because(failure)}`)
      }

      setUploads({ done: index + 1, total: files.length })
    }

    setUploads(undefined)

    if (refused.length > 0) {
      setProblem(refused.join("; "))
    }
  }

  function perform(action: ExplorerAction, entry: ExplorerEntry) {
    if (action === "download") {
      void download(entry)
    } else if (action === "copyLink") {
      void copyLink(entry)
    } else if (action === "rename") {
      startRename(entry)
    } else if (action === "move") {
      setPending({ act: "move", entry })
    } else if (action === "remove") {
      setPending({ act: "remove", entry })
    }
  }

  const ACTION_LABELS: Record<ExplorerAction, string> = {
    download: text.download,
    copyLink: text.copyLink,
    rename: text.rename,
    move: text.move,
    remove: text.remove,
    createFolder: text.newFolder,
    upload: text.upload,
  }

  function menuFor(workspaceEntry: FileWorkspaceEntry): MenuEntry[] {
    const entry = byId.get(workspaceEntry.id)

    if (!entry) {
      return []
    }

    const standard = entryActions(adapter, entry).map((action): MenuEntry => ({
      label: ACTION_LABELS[action],
      icon: ACTION_ICONS[action],
      onSelect: () => perform(action, entry),
      danger: action === "remove",
      separated: action === "remove",
      hint: action === "rename" ? "F2" : action === "remove" ? "Delete" : undefined,
    }))
    const extra = extraActions?.(entry) ?? []

    return extra.length === 0 ? standard : [...standard, { ...extra[0], separated: true }, ...extra.slice(1)]
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (isTyping(event)) {
      return
    }

    if (event.key === "ArrowUp" && event.altKey && folderId !== null) {
      event.preventDefault()
      changeFolder(folder?.parentId ?? null)

      return
    }

    if (!selected) {
      return
    }

    if (event.key === "F2" && permits(adapter, "rename", selected)) {
      event.preventDefault()
      startRename(selected)
    } else if (event.key === "Delete" && permits(adapter, "remove", selected)) {
      event.preventDefault()
      setPending({ act: "remove", entry: selected })
    }
  }

  const toolbar = <>
    {offered.includes("createFolder") ? <Button size="small" icon={ACTION_ICONS.createFolder} onClick={() => setPending({ act: "createFolder" })}>{text.newFolder}</Button> : null}
    {offered.includes("upload") ? <>
      <Button size="small" variant="primary" icon={ACTION_ICONS.upload} busy={uploads !== undefined} onClick={() => uploadInput.current?.click()}>{text.upload}</Button>
      <input ref={uploadInput} type="file" multiple hidden tabIndex={-1} aria-hidden="true" onChange={(event) => {
        const files = Array.from(event.target.files ?? [])

        event.target.value = ""
        void upload(files)
      }} />
    </> : null}
  </>

  const notice = uploads !== undefined
    ? <Notice tone="accent" icon="upload" aria-live="polite">{`${text.uploading} ${uploads.done} ${text.of} ${uploads.total}`}</Notice>
    : problem !== undefined
      ? <Notice tone="danger" actions={<IconButton icon="close" size="small" label={text.dismiss} onClick={() => setProblem(undefined)} />}>{problem}</Notice>
      : undefined

  const renamingEntry = renamingId === undefined ? undefined : byId.get(renamingId)

  return <>
    <FileWorkspace
      className={className}
      entries={workspaceEntries}
      directoryId={folderId}
      onDirectoryChange={changeFolder}
      selectedId={selectedId}
      onSelectedChange={(entry) => setSelectedId(entry?.id)}
      renaming={renamingEntry ? { id: renamingEntry.id, onCommit: (name) => void rename(renamingEntry, name), onCancel: () => setRenamingId(undefined) } : undefined}
      onDropFiles={offered.includes("upload") ? (files) => void upload(files) : undefined}
      onKeyDown={onKeyDown}
      notice={notice}
      actions={toolbar}
      entryActions={menuFor}
      loading={catalogue.folder.loading && !catalogue.entries.some((entry) => entry.parentId === folderId)}
      error={catalogue.folder.failure}
      labels={text}
      formatSize={formatSize}
      defaultView={defaultView}
      storageKey={storageKey}
      renderFile={(workspaceEntry) => {
        const file = byId.get(workspaceEntry.id)

        if (!file) {
          return null
        }

        if (renderFile) {
          return renderFile(file)
        }

        return <ExplorerViewer file={file} adapter={adapter} labels={viewerLabels(text)} onDownload={permits(adapter, "download", file) ? () => void download(file) : undefined} />
      }}
    />
    {pending?.act === "createFolder" ? <NameDialog title={text.newFolder} fieldLabel={text.folderName} confirmLabel={text.createFolder} initial="" siblings={catalogue.entries.filter((entry) => entry.parentId === folderId)} text={text} onConfirm={createFolder} onClose={() => setPending(undefined)} /> : null}
    {pending?.act === "rename" ? <NameDialog title={text.renameTitle} fieldLabel={text.newName} confirmLabel={text.saveName} initial={pending.entry.name} siblings={catalogue.entries.filter((entry) => entry.parentId === pending.entry.parentId && entry.id !== pending.entry.id)} text={text} onConfirm={(name) => rename(pending.entry, name)} onClose={() => setPending(undefined)} /> : null}
    {pending?.act === "move" ? <MoveDialog entry={pending.entry} folders={catalogue.entries.filter((entry) => entry.kind === "folder")} text={text} onConfirm={(target) => move(pending.entry, target)} onClose={() => setPending(undefined)} /> : null}
    <ConfirmDialog
      open={pending?.act === "remove"}
      title={pending?.act === "remove" ? `${text.removeTitle} “${pending.entry.name}”` : text.removeTitle}
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
    unreadable: text.readFailed,
    notShowable: text.notShowable,
    notShowableDescription: text.notShowableDescription,
    needsConverting: text.needsConverting,
    noBytes: text.noBytes,
    download: text.download,
  }
}

/** Why a name cannot be used here, or undefined when it can. */
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

interface MoveDialogProperties {
  entry: ExplorerEntry
  folders: ExplorerEntry[]
  text: ExplorerLabels
  onConfirm(target: string | null): void
  onClose(): void
}

/**
 * Where something goes, chosen from the folders the explorer knows.
 *
 * ⚠️ **A folder cannot go into itself or anything under it**, so that branch is left out of the choice rather than
 * offered and refused.
 */
function MoveDialog({ entry, folders, text, onConfirm, onClose }: MoveDialogProperties) {
  const [target, setTarget] = useState<string | null>(entry.parentId)

  const nodes = useMemo(() => {
    const childrenOf = new Map<string | null, ExplorerEntry[]>()

    for (const folder of folders) {
      const siblings = childrenOf.get(folder.parentId) ?? []

      siblings.push(folder)
      childrenOf.set(folder.parentId, siblings)
    }

    function build(parentId: string | null): TreeNode[] {
      return (childrenOf.get(parentId) ?? [])
        .filter((folder) => folder.id !== entry.id)
        .sort((first, second) => first.name.localeCompare(second.name, undefined, { numeric: true }))
        .map((folder) => ({ id: folder.id, name: folder.name, icon: "folder", expandedIcon: "folder-open", children: build(folder.id) }))
    }

    return [{ id: ROOT_NODE, name: text.root, icon: "home", children: build(null) } satisfies TreeNode]
  }, [folders, entry.id, text.root])

  const everyId = useMemo(() => [ROOT_NODE, ...folders.map((folder) => folder.id)], [folders])

  return <Dialog open onClose={onClose} title={`${text.moveTitle} “${entry.name}”`} description={text.moveDescription}
    footer={<>
      <Button onClick={onClose}>{text.cancel}</Button>
      <Button variant="primary" disabled={target === entry.parentId} onClick={() => onConfirm(target)}>{text.moveHere}</Button>
    </>}>
    <Tree label={text.folders} nodes={nodes} selectedId={target ?? ROOT_NODE} defaultExpandedIds={everyId}
      onSelect={(id) => setTarget(id === ROOT_NODE ? null : id)} />
  </Dialog>
}

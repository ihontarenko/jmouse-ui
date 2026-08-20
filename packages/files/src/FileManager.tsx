import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { FolderPlus, LayoutGrid, Link2, List, Upload } from "lucide-react"
import { Button, Input } from "@jmouse/ui"
import { DirectoryTree } from "./DirectoryTree"
import { FileList } from "./FileList"
import { FileViewerDialog } from "./FileViewerDialog"
import { useFileActions } from "./useFileActions"
import { useManagerLocation } from "./managerLocation"
import { directoryTrail, saveBlob } from "./fileDisplay"
import { because } from "./failures"
import type { Directory, FileLibraryPort, FileManagerNotice, FilesLayout, ManagedFile } from "./types"

/**
 * The file manager, whole — a tree, what is in the selected folder, and the things you do to it.
 *
 * <h2>⚠️ One screen for three products, and the parameters are where they actually differ</h2>
 *
 * <p>It was Innoventa's, and taking it out of Innoventa meant naming exactly three things it had assumed:
 *
 * <ul>
 *   <li><strong>the root</strong> — a prop, never discovered. Innoventa gives every account a tree and
 *       reads the id off the profile; Kiwi has one tree for the installation; Tessera will want one per
 *       project. There is no route that answers this for all three, which is also why {@code JMF-48} is
 *       not on this component's critical path — it never calls it;
 *   <li><strong>the fetching</strong> — a {@link FileLibraryPort}. Nothing here imports an HTTP client,
 *       so nothing here has an opinion about how a product authenticates, and the one product that is
 *       called cross-origin by two others is not a special case;
 *   <li><strong>reaching the bytes</strong> — also the port. A Sharing Center token and an authenticated
 *       fetch are genuinely different mechanisms, and the package draws a glyph when there is neither.
 * </ul>
 *
 * <h2>⚠️ Looking at a file is part of the MANAGER, not part of a product</h2>
 *
 * <p>Clicking a file opens {@link FileViewerDialog} here — pictures, PDFs, sound, video, Markdown and any
 * text or source file, with an honest refusal and a working Download for everything else. It is mounted
 * at this level on purpose: a viewer wired up per product is a product that previews `.md` while the next
 * one offers it as a download, which is the drift the package exists to stop.</p>
 *
 * <p>⚠️ <strong>Which leaves exactly one thing a product may still say about it</strong> — what its
 * Markdown means. {@link FileManagerProperties#renderMarkdown} is a setting, not a seam to reimplement
 * through: Tessera resolves `TES-42` into a live reference and Kiwi resolves page addresses, and a
 * renderer chosen inside the package would be the wrong one in both. Omit it and Markdown is shown as
 * its own source, which is honest rather than clever.</p>
 *
 * <h2>⚠️ It fetches through the port and keeps no cache</h2>
 *
 * <p>`react-query` stays in the products. Making it a peer dependency here would pin three interfaces to
 * one version of it for the sake of one screen — and a product that wants caching can memoise inside the
 * port it wrote, which is the layer that already knows its own client.
 *
 * <h2>⚠️ The layout choice is remembered, and the key is the caller's</h2>
 *
 * <p>Somebody who chose tiles expects tiles next time. The storage key is a prop because two products
 * writing `files.view` into the same origin would share a preference they never agreed to share.
 */
export interface FileManagerProperties {
  /** Where this tree starts. ⚠️ Never discovered — see the class note. */
  rootId: string | null
  port: FileLibraryPort
  onNotice?: FileManagerNotice
  /** What to call the top of the tree. A root's own name is a storage prefix, not a label. */
  rootLabel?: string
  /** Where the rows-or-tiles choice is remembered. Omit and it is not remembered. */
  layoutStorageKey?: string
  canWrite?: boolean
  emptyHint?: string
  /**
   * What this product's Markdown means, for a `.md` opened in the viewer.
   *
   * ⚠️ **A setting, and the only part of viewing a file that is a product's business.** Everything else
   * — which kinds can be drawn, the text ceiling, the `blob:` mechanics, the refusal that still offers a
   * download — belongs to the package and is the same everywhere.
   */
  renderMarkdown?: (markdown: string) => ReactNode
}

export function FileManager({
  rootId,
  port,
  onNotice,
  rootLabel,
  layoutStorageKey,
  canWrite = true,
  emptyHint = "Nothing is filed here yet.",
  renderMarkdown,
}: FileManagerProperties) {
  const [directories, setDirectories] = useState<Directory[]>([])
  const [files, setFiles] = useState<ManagedFile[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [layout, setLayout] = useState<FilesLayout>(() => readLayout(layoutStorageKey))

  const uploadField = useRef<HTMLInputElement>(null)

  // ⚠️ **The ADDRESS is where the manager is, and there is no second copy of it in state.** A folder in
  // a `useState` beside a folder in the URL is two answers to one question, and the day they disagree is
  // the day Back leaves the address changed and the screen where it was.
  const { location, goToFolder, settleOnFolder, openFile, closeFile } = useManagerLocation()

  const selectedId = location.folder ?? rootId ?? null

  const loadTree = useCallback(() => {
    if (!rootId) {
      return
    }

    setTreeLoading(true)
    port
      .subtree(rootId)
      .then(setDirectories)
      .catch((failure) => onNotice?.(`The folders could not be read.${because(failure)}`))
      .finally(() => setTreeLoading(false))
  }, [rootId, port, onNotice])

  const loadFiles = useCallback(() => {
    if (!selectedId) {
      setFiles([])

      return
    }

    setFilesLoading(true)
    port
      .filesIn(selectedId)
      .then(setFiles)
      .catch((failure) => {
        // ⚠️ **Emptied, not left alone.** Without this the folder that failed to load goes on showing
        // the LAST folder's files — the same picture appears in two places and the toast reads as a
        // glitch rather than as the reason the grid is stale.
        setFiles([])
        onNotice?.(`The files could not be read.${because(failure)}`)
      })
      .finally(() => setFilesLoading(false))
  }, [selectedId, port, onNotice])

  useEffect(loadTree, [loadTree])
  useEffect(loadFiles, [loadFiles])

  // ⚠️ An address may name a folder that is gone — deleted, or simply somebody else's. Falling back to
  // the root and CORRECTING the address is the whole of the handling: leaving it in place would refetch
  // the same 404 on every render, and pushing a correction would put a dead folder in the history.
  useEffect(() => {
    const named = location.folder

    if (!named || directories.length === 0) {
      return
    }

    if (!directories.some((directory) => directory.id === named)) {
      settleOnFolder(null)
    }
  }, [location.folder, directories, settleOnFolder])

  const refresh = useCallback(() => {
    loadTree()
    loadFiles()
  }, [loadTree, loadFiles])

  const actions = useFileActions({ port, onChanged: refresh, onNotice })

  function chooseLayout(next: FilesLayout) {
    setLayout(next)

    if (layoutStorageKey) {
      window.localStorage.setItem(layoutStorageKey, next)
    }
  }

  function createFolder(name: string) {
    if (!selectedId) {
      return
    }

    port
      .createDirectory(selectedId, name)
      .then(refresh)
      .catch((failure) => onNotice?.(`That folder was not created.${because(failure)}`))
  }

  // ⚠️ `globalThis.FileList` spelled out, because this module imports a COMPONENT called `FileList`.
  // It happens to compile either way — a function import has no meaning in type position, so the DOM
  // interface still wins — but a reader cannot tell that, and the day somebody exports a type of that
  // name from `./FileList` this silently becomes a different thing.
  function upload(chosen: globalThis.FileList | null) {
    if (!chosen || !selectedId) {
      return
    }

    // ⚠️ Sequential rather than `Promise.all`. Uploads are the one thing here that is measured in
    // megabytes, and firing ten at once is how a browser's connection pool becomes the bottleneck and
    // every one of them appears to hang.
    void [...chosen]
      .reduce(
        (queue, file) => queue.then(() => port.upload(selectedId, file).then(() => undefined)),
        Promise.resolve(),
      )
      .then(refresh)
      .catch((failure) => onNotice?.(`Something was not uploaded.${because(failure)}`))
  }

  function download(file: ManagedFile) {
    port
      .bytes(file)
      .then((blob) => saveBlob(blob, file.name))
      .catch((failure) => onNotice?.(`That file could not be downloaded.${because(failure)}`))
  }

  const trail = directoryTrail(directories, selectedId, rootLabel)

  // ⚠️ **Derived from the address, never held beside it.** The dialog is open because the URL says a
  // file is open — which is what makes Back close it, and what stops a stale object from surviving a
  // refetch that renamed or removed the very file it was showing.
  const viewing = files.find((file) => file.id === location.file) ?? null

  // ⚠️ The folders directly INSIDE the one being looked at, not the whole subtree. The aside already
  // shows the cabinet; the grid shows what is in front of you, and a grid that listed every descendant
  // would be a second tree drawn as squares.
  const childrenOfSelected = directories.filter((directory) => directory.parentId === selectedId)

  return (
    // ⚠️ **A toolbar bar the full width, and the tree's divider hangs off it.** The two columns used
    // to sit side by side with a bare `border-r` between them, which drew a short vertical line
    // starting an inch below the page header and stopping wherever the content happened to end — a
    // line joined to nothing at either end reads as a rendering fault rather than as a column divider.
    // With the bar above it the vertical meets a horizontal at a T, which is what makes it read as
    // structure. ⚠️ The package cannot reach the page header to close the gap above; making the join
    // ITSELF is the part that is this component's to get right.
    <div className="flex min-h-[22rem] flex-col">
      <header className="flex items-center justify-between gap-2 border-b pb-2">
        {/* ⚠️ Names, never the path — the path is the storage key and shows people slugs. */}
        <p className="min-w-0 truncate text-[13px] text-muted-foreground">{trail.join(" / ")}</p>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            title={layout === "rows" ? "Show as tiles" : "Show as a list"}
            onClick={() => chooseLayout(layout === "rows" ? "tiles" : "rows")}
          >
            {layout === "rows" ? <LayoutGrid /> : <List />}
          </Button>

          {/* ⚠️ Here as well as on a tree row, and the tree row is not enough on its own. It appears
              on hover, inside a 208px aside, on a row somebody has to find first — which in an empty
              cabinet means the one control that would put something in it is invisible until the
              pointer crosses the only folder there is. Making a folder is a thing you DO to the folder
              you are looking at, so it belongs beside Upload. */}
          {canWrite && (
            <InlinePrompt
              icon={<FolderPlus />}
              label="New folder"
              placeholder="Folder name"
              width="w-44"
              disabled={!selectedId}
              onSubmit={createFolder}
            />
          )}

          {/* ⚠️ Offered only where the product supplies the route — a field that always fails is worse
              than no field. It is the SERVER fetching an address on somebody's behalf, which is why it
              is collapsed rather than sitting open beside Upload as though the two were equals. */}
          {canWrite && port.importFrom && (
            <InlinePrompt
              icon={<Link2 />}
              label="From a link"
              placeholder="https://…"
              width="w-56"
              disabled={!selectedId}
              onSubmit={(url) =>
                port
                  .importFrom!(selectedId as string, url)
                  .then(refresh)
                  .catch((failure) => onNotice?.(`That address was refused or could not be fetched.${because(failure)}`))
              }
            />
          )}

          {canWrite && (
            <>
              <Button size="xs" disabled={!selectedId} onClick={() => uploadField.current?.click()}>
                <Upload />
                Upload
              </Button>
              <input
                ref={uploadField}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  upload(event.target.files)
                  // ⚠️ Cleared, so choosing the SAME file twice fires `change` the second time too.
                  event.target.value = ""
                }}
              />
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-52 shrink-0 border-r py-2 pr-2">
          {treeLoading && directories.length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-muted-foreground">Reading the folders…</p>
          ) : (
            <DirectoryTree
              directories={directories}
              port={port}
              selectedId={selectedId}
              onSelect={goToFolder}
              onChanged={refresh}
              onNotice={onNotice}
              rootLabel={rootLabel}
              canWrite={canWrite}
            />
          )}
        </aside>

        <div className="min-w-0 flex-1 py-2 pl-4">
          <FileList
            directories={childrenOfSelected}
            files={files}
            port={port}
            actions={actions}
            layout={layout}
            isLoading={filesLoading}
            emptyHint={emptyHint}
            onOpenDirectory={goToFolder}
            onOpenFile={(file) => openFile(file.id)}
            onChanged={refresh}
            rootLabel={rootLabel}
            canWrite={canWrite}
          />
        </div>
      </div>

      {/* ⚠️ Mounted by the MANAGER, so every product that lists files can look at one the same way. The
          bytes are the port's because the routes are authenticated; everything else is the package's. */}
      <FileViewerDialog
        file={viewing}
        bytes={() => port.bytes(viewing as ManagedFile)}
        renderMarkdown={renderMarkdown}
        onDownload={() => download(viewing as ManagedFile)}
        onOpenChange={closeFile}
      />
    </div>
  )
}

function readLayout(key: string | undefined): FilesLayout {
  if (!key) {
    return "rows"
  }

  return window.localStorage.getItem(key) === "tiles" ? "tiles" : "rows"
}

/**
 * A toolbar button that becomes the one field it needs, and goes back to being a button.
 *
 * ⚠️ **Collapsed until asked for, and shared by both of the things that ask.** Two permanently visible
 * text fields in a toolbar read as two equal ways in, and neither of these is the ordinary way in —
 * Upload is. It was written twice before it was written once; the second copy is how "From a link"
 * submitted on blur and "New folder" did not.
 */
function InlinePrompt({
  icon,
  label,
  placeholder,
  width,
  disabled,
  onSubmit,
}: {
  icon: ReactNode
  label: string
  placeholder: string
  /** How wide the field is once it is open — a folder name and a URL want different room. */
  width: string
  disabled: boolean
  onSubmit: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")

  if (!open) {
    return (
      <Button variant="ghost" size="xs" disabled={disabled} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
    )
  }

  function submit() {
    const value = draft.trim()

    setOpen(false)
    setDraft("")

    if (value) {
      onSubmit(value)
    }
  }

  return (
    <Input
      autoFocus
      className={`h-7 ${width} text-[13px]`}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={submit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          submit()
        }

        if (event.key === "Escape") {
          setOpen(false)
          setDraft("")
        }
      }}
    />
  )
}

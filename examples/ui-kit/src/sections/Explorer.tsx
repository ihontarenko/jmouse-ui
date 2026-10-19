import { Explorer, type ExplorerAction, type ExplorerAdapter, type ExplorerEntry, type ExplorerTarget } from "@jmouse/explorer"
import { readableFileSize } from "@jmouse/file-handling"
import { Button, Facts, Dialog, PageHeader } from "@jmouse/ui-kit"
import { useEffect, useMemo, useRef, useState } from "react"
import { Specimen } from "../Specimen"

/*
 * An in-memory adapter: what a product writes over its own routes, here over a Map with a little latency, so the
 * waiting states are seen and the refusals are real promises.
 */

interface StoredEntry extends ExplorerEntry {
  bytes?: Blob
}

const LATENCY = 260

const seed: StoredEntry[] = [
  { id: "documentation", parentId: null, name: "documentation", kind: "folder", modified: "2026-10-18T09:00:00Z" },
  { id: "source", parentId: null, name: "src", kind: "folder", modified: "2026-10-18T09:00:00Z" },
  { id: "releases", parentId: null, name: "Releases", kind: "folder", modified: "2026-10-12T09:00:00Z" },
  { id: "guides", parentId: "documentation", name: "Guides", kind: "folder", modified: "2026-10-17T09:00:00Z" },
  { id: "android", parentId: "releases", name: "Android TV", kind: "folder", modified: "2026-10-12T09:00:00Z" },
  ...["ACCESS", "CORE", "FILES", "HTTP", "JDBC", "WEB"].map((name): StoredEntry => textEntry(`doc-${name}`, "documentation", `JMOUSE_${name}.md`, `# jMouse ${name.toLowerCase()}\n\nReference documentation for the ${name.toLowerCase()} module.\n`)),
  textEntry("guide", "guides", "Getting started.md", "# Getting started\n\nChoose a folder, open a file, rename it with F2.\n"),
  textEntry("binder", "source", "BeanBinder.java", "package org.jmouse.core.bind;\n\npublic final class BeanBinder {\n}\n", "text/x-java"),
  textEntry("configuration", "source", "application.yaml", "application:\n  name: jmouse\n", "application/yaml"),
  { id: "manual", parentId: "documentation", name: "Datasheet.docx", kind: "file", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 48200, modified: "2026-10-11T09:00:00Z" },
  { id: "build", parentId: "android", name: "kitsu-tv-0.4.apk", kind: "file", mediaType: "application/vnd.android.package-archive", size: 18_400_000, modified: "2026-10-12T09:00:00Z" },
  textEntry("readme", null, "README.md", "# Explorer demo\n\nEverything here lives in memory and resets on reload.\n"),
]

function textEntry(id: string, parentId: string | null, name: string, body: string, mediaType = "text/markdown"): StoredEntry {
  const bytes = new Blob([body], { type: mediaType })

  return { id, parentId, name, kind: "file", mediaType, size: bytes.size, modified: "2026-10-18T09:00:00Z", bytes }
}

function afterLatency<T>(value: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      try {
        resolve(value())
      } catch (failure) {
        reject(failure)
      }
    }, LATENCY)
  })
}

/** A refusal shaped like the products' HTTP clients reject — `because` reads the status and the detail. */
function refusal(status: number, detail: string) {
  return Object.assign(new Error(detail), { response: { status, data: { detail } } })
}

function withoutBytes({ bytes: _bytes, ...entry }: StoredEntry): ExplorerEntry {
  return entry
}

function createMemoryAdapter(store: Map<string, StoredEntry>, readOnly: boolean, isFailing: () => boolean): ExplorerAdapter {
  const requireStored = (id: string) => {
    const found = store.get(id)

    if (!found) {
      throw refusal(404, "It is not there any more.")
    }

    return found
  }
  const refuseWhenFailing = () => {
    if (isFailing()) {
      throw refusal(503, "The storage service is unavailable.")
    }
  }
  const writes: Partial<ExplorerAdapter> = readOnly ? {} : {
    createFolder: (parentId, name) => afterLatency(() => {
      refuseWhenFailing()
      const folder: StoredEntry = { id: crypto.randomUUID(), parentId, name, kind: "folder", modified: new Date().toISOString() }

      store.set(folder.id, folder)

      return withoutBytes(folder)
    }),
    rename: (entry, name) => afterLatency(() => {
      refuseWhenFailing()
      const renamed = { ...requireStored(entry.id), name, modified: new Date().toISOString() }

      store.set(renamed.id, renamed)

      return withoutBytes(renamed)
    }),
    move: (entry, folderId) => afterLatency(() => {
      refuseWhenFailing()
      const moved = { ...requireStored(entry.id), parentId: folderId }

      store.set(moved.id, moved)

      return withoutBytes(moved)
    }),
    remove: (entry) => afterLatency(() => {
      refuseWhenFailing()

      if (Array.from(store.values()).some((candidate) => candidate.parentId === entry.id)) {
        throw refusal(409, "The folder still holds something.")
      }

      store.delete(entry.id)
    }),
    upload: (folderId, file) => afterLatency(() => {
      refuseWhenFailing()
      const uploaded: StoredEntry = { id: crypto.randomUUID(), parentId: folderId, name: file.name, kind: "file", mediaType: file.type || undefined, size: file.size, modified: new Date().toISOString(), bytes: file }

      store.set(uploaded.id, uploaded)

      return withoutBytes(uploaded)
    }),
  }

  return {
    list: (folderId) => afterLatency(() => {
      refuseWhenFailing()

      if (folderId !== null) {
        requireStored(folderId)
      }

      return Array.from(store.values()).filter((entry) => entry.parentId === folderId).map(withoutBytes)
    }),
    folders: () => afterLatency(() => Array.from(store.values()).filter((entry) => entry.kind === "folder").map(withoutBytes)),
    read: (file) => afterLatency(() => requireStored(file.id).bytes ?? new Blob([new Uint8Array(file.size ?? 0)], { type: file.mediaType })),
    shareUrl: (entry) => entry.kind === "file" ? `https://files.example.net/${entry.id}` : null,
    // ⚠️ The demo's own narrowing: the root folders are fixed, the way a product's cabinet roots usually are.
    permits: (action: ExplorerAction, target: ExplorerTarget) => !("entry" in target && target.entry.parentId === null && target.entry.kind === "folder" && (action === "rename" || action === "move" || action === "remove")),
    ...writes,
  }
}

export function ExplorerSection() {
  const store = useRef(new Map(seed.map((entry) => [entry.id, entry])))
  const [readOnly, setReadOnly] = useState(false)
  const [failing, setFailing] = useState(false)
  const [properties, setProperties] = useState<ExplorerEntry>()
  const failingNow = useRef(failing)

  useEffect(() => {
    failingNow.current = failing
  }, [failing])

  // ⚠️ A new adapter only when the CAPABILITIES change: the explorer reloads on a new adapter, and "fail the next
  // act" should leave the listing in place so the failure band is seen against it.
  const adapter = useMemo(() => createMemoryAdapter(store.current, readOnly, () => failingNow.current), [readOnly])

  return <div className="showcase-stack">
    <PageHeader title="Explorer" description="@jmouse/explorer: the kit's file workspace driven by a product adapter. What may be done follows from which adapter methods exist and what permits() answers — the menus, the toolbar and the keys all ask the same place." />
    <Specimen id="explorer" title="Explorer" summary="Select an entry, then F2 renames it in place and Delete asks before removing it; Alt+↑ goes to the parent. Drop files from the desktop on the listing to upload. Root folders are fixed by this adapter's permits(). Read-only removes every write method; the Fail switch makes the adapter refuse." flush layout="column"
      usage={`const adapter: ExplorerAdapter = {\n  list: (folderId) => api.get(\`/folders/\${folderId ?? "root"}/children\`),\n  read: (file) => api.blob(\`/files/\${file.id}\`),\n  rename: (entry, name) => api.patch(\`/entries/\${entry.id}\`, { name }),\n  // leave a method out and its act disappears everywhere\n}\n\n<Explorer adapter={adapter} folderId={folderId} onFolderChange={setFolderId} />`}>
      <div className="showcase-files">
        <Explorer adapter={adapter} defaultFolderId="documentation" defaultView="list" storageKey="jmouse-ui-kit.explorer.sidebar"
          extraActions={(entry) => [{ label: "Properties", icon: "information", onSelect: () => setProperties(entry) }]} />
      </div>
    </Specimen>
    <Specimen id="explorer-capabilities" title="Capabilities" summary="Switch what the adapter can do. Read-only is a different adapter with no write methods; Fail keeps the adapter and makes every call refuse with a 503.">
      <Button pressed={readOnly} onClick={() => setReadOnly(!readOnly)}>Read-only</Button>
      <Button pressed={failing} onClick={() => setFailing(!failing)}>Fail</Button>
    </Specimen>
    <Dialog open={properties !== undefined} onClose={() => setProperties(undefined)} title={properties?.name ?? "Properties"} size="small">
      {properties ? <Facts facts={[{ label: "Kind", value: properties.kind }, { label: "Media type", value: properties.mediaType ?? "—", technical: true }, { label: "Size", value: properties.size === undefined ? "—" : readableFileSize(properties.size), technical: true }, { label: "Identifier", value: properties.id, technical: true }]} /> : null}
    </Dialog>
  </div>
}

import { useState } from "react"
import { Button, Dialog, EmptyState, Facts, Field, FileGlyph, FileWorkspace, Input, PageHeader, type FileWorkspaceEntry } from "@jmouse/ui-kit"
import { CodeEditor } from "@jmouse/ui-kit/code"
import { Specimen } from "../Specimen"

const initialEntries: FileWorkspaceEntry[] = [
  { id: "documentation", parentId: null, name: "documentation", kind: "folder" },
  { id: "source", parentId: null, name: "src", kind: "folder" },
  { id: "releases", parentId: null, name: "Releases", kind: "folder" },
  { id: "jmx", parentId: "documentation", name: "jmx", kind: "folder" },
  { id: "guides", parentId: "documentation", name: "Guides", kind: "folder" },
  { id: "android", parentId: "releases", name: "Android TV", kind: "folder" },
  ...["ACCESS", "ACCESS_POLICY", "AI", "BEANS", "CORE", "FILES", "GIT", "HTTP", "JAVA_INDEX", "JDBC", "MAPPER", "WEB"].map((name, index) => ({ id: `doc-${name}`, parentId: "documentation", name: `JMOUSE_${name}.md`, kind: "file" as const, size: (index + 3) * 1700, modified: "18 Oct 2026" })),
  { id: "guide", parentId: "guides", name: "Getting started.md", kind: "file", size: 4300, modified: "17 Oct 2026" },
  { id: "jmx-reference", parentId: "jmx", name: "JMX reference.md", kind: "file", size: 14600 },
  { id: "binder", parentId: "source", name: "BeanBinder.java", kind: "file", size: 12600, modified: "18 Oct 2026" },
  { id: "policy", parentId: "source", name: "AccessPolicy.java", kind: "file", size: 8200, modified: "18 Oct 2026" },
  { id: "configuration", parentId: "source", name: "application.yaml", kind: "file", size: 640 },
  { id: "readme", parentId: null, name: "README.md", kind: "file", size: 5600 },
  { id: "manifest", parentId: null, name: "package.json", kind: "file", size: 1200 },
]

const sources: Record<string, string> = {
  binder: `package org.jmouse.core.bind;\n\nimport java.util.List;\n\n/** What one bind produced: the value, or the reasons it could not be produced. */\npublic record BindResult<T>(BindName name, T value, List<String> failures) {\n\n    public boolean isBound() {\n        return failures.isEmpty();\n    }\n}\n`,
  policy: `package org.jmouse.access.policy;\n\npublic record AccessPolicy(String name, String permission) {\n}\n`,
  configuration: "application:\n  name: jmouse\n  files:\n    preview: true\n",
  manifest: '{\n  "name": "jmouse",\n  "private": true\n}\n',
}

function documentSource(entry: FileWorkspaceEntry) {
  return sources[entry.id] ?? `# ${entry.name.replace(/\.md$/, "").replaceAll("_", " ")}\n\nReference documentation for the jMouse framework.\n\n## Overview\n\nModules expose focused contracts and keep implementation details local.\n\n## Usage\n\nChoose a folder in the tree, browse its files and open a document in a tab.\n\nThe same library components inherit each product's appearance tokens.\n`
}

export function FilesSection() {
  const [entries, setEntries] = useState(initialEntries)
  const [directoryId, setDirectoryId] = useState<string | null>("documentation")
  const [folderDialog, setFolderDialog] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [properties, setProperties] = useState<FileWorkspaceEntry>()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [empty, setEmpty] = useState(false)
  const cleanName = folderName.trim()
  const duplicateName = entries.some((entry) => entry.parentId === directoryId && entry.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())

  return <div className="showcase-stack">
    <PageHeader title="File workspace" description="A second file-manager presentation built from the kit: folder tree, resizable sidebar, folder browser and open-file tabs. Product data, actions and viewers enter through properties; the current theme supplies the appearance." />
    <Specimen id="file-workspace" title="FileWorkspace" summary="Select a tile; double-click or press Enter to open it. Use the tree, parent button or breadcrumbs to navigate. Open documents remain in tabs while browsing. Switch to List for sortable file metadata. Try a product theme from Appearance." flush layout="column" usage={`<FileWorkspace\n  entries={entries}\n  directoryId={directoryId}\n  onDirectoryChange={setDirectoryId}\n  renderFile={(file) => <ProductViewer file={file} />}\n  actions={<Button onClick={upload}>Upload</Button>}\n/>`}>
      <div className="showcase-files">
        <FileWorkspace entries={empty ? [] : entries} directoryId={empty ? null : directoryId} onDirectoryChange={setDirectoryId} storageKey="jmouse-ui-kit.files.sidebar" loading={loading} error={failed ? "The file service is unavailable. Turn off Error to return to the listing." : undefined}
          actions={<Button size="small" icon="plus" onClick={() => { setFolderName(""); setFolderDialog(true) }}>New folder</Button>}
          entryActions={(entry) => [{ label: "Properties", icon: "information", onSelect: () => setProperties(entry) }]}
          renderFile={(entry) => <CodeEditor key={entry.id} label={entry.name} value={drafts[entry.id] ?? documentSource(entry)} onChange={(value) => setDrafts((current) => ({ ...current, [entry.id]: value }))} />}
        />
      </div>
    </Specimen>
    <Specimen id="file-states" title="Data states" summary="Loading, error and empty states are supplied by the product. These switches exercise the same workspace above.">
      <Button pressed={loading} onClick={() => setLoading(!loading)}>Loading</Button>
      <Button pressed={failed} onClick={() => setFailed(!failed)}>Error</Button>
      <Button pressed={empty} onClick={() => setEmpty(!empty)}>Empty</Button>
    </Specimen>
    <Specimen id="file-glyphs" title="FileGlyph" summary="One library glyph family for tiles, trees, tabs and rows. File extensions remain visible in the large document band. Products can override --kit-file-folder, --kit-file-document and the other kind tokens without changing markup." usage={'<FileGlyph name="JMOUSE_CORE.md" size="large" />\n<FileGlyph name="Releases" kind="folder" />'}>
      {["Folder", "README.md", "BeanBinder.java", "application.yaml", "cover.png", "audio.flac", "movie.mp4", "release.zip", "inventory.csv", "unknown.bin"].map((name) => <div className="showcase-file-glyph" key={name}><FileGlyph name={name} kind={name === "Folder" ? "folder" : undefined} size="large" /><span>{name}</span></div>)}
    </Specimen>
    <Dialog open={folderDialog} onClose={() => setFolderDialog(false)} title="New folder" footer={<><Button onClick={() => setFolderDialog(false)}>Cancel</Button><Button variant="primary" disabled={!cleanName || duplicateName || /[/\\]/.test(cleanName)} onClick={() => { setEntries((current) => [...current, { id: crypto.randomUUID(), parentId: directoryId, name: cleanName, kind: "folder" }]); setFolderDialog(false) }}>Create folder</Button></>}>
      <Field label="Folder name" error={duplicateName ? "A file or folder with this name already exists." : undefined}><Input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} /></Field>
    </Dialog>
    <Dialog open={Boolean(properties)} onClose={() => setProperties(undefined)} title={properties?.name ?? "Properties"}>
      {properties ? <Facts facts={[{ label: "Name", value: properties.name }, { label: "Kind", value: properties.kind }, { label: "Size", value: properties.size === undefined ? "—" : `${properties.size} B`, technical: true }]} /> : <EmptyState title="No file selected" />}
    </Dialog>
  </div>
}

import { useMemo, useState } from "react"
import {
  Badge,
  Editor,
  EmptyState,
  FindBar,
  IdeFrame,
  InlineCode,
  List,
  ListItem,
  TitleBar,
  TitleBarSeparator,
  ToolWindow,
  Widget,
  type FindOptions,
  type ToolWindowEntry,
  Button,
  Chip,
  EditorTabs,
  Facts,
  Figures,
  IconButton,
  Inspector,
  InspectorGroup,
  Kind,
  PageHeader,
  PathText,
  SearchField,
  Split,
  StatusBar,
  StatusItem,
  Table,
  Toolbar,
  ToolbarPush,
  Tree,
  type TableSort,
  type TreeNode,
} from "@jmouse/ui-kit"
import { CodeEditor } from "@jmouse/ui-kit/code"
import { initialOpenFiles, parts, projectTree, sourceOf } from "../fixtures"
import { Specimen } from "../Specimen"
import { partColumns, sortParts } from "./Data"
import { useOpenFiles } from "./Navigation"

function findNode(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    const inside = node.children && findNode(node.children, id)
    if (inside) {
      return inside
    }
  }
  return undefined
}

const toolWindows: ToolWindowEntry[] = [
  { id: "project", label: "Project", icon: "folder", placement: "start", shortcut: "Alt+1" },
  { id: "structure", label: "Structure", icon: "layers", placement: "start", shortcut: "Alt+7" },
  { id: "notifications", label: "Notifications", icon: "bell", placement: "end", count: 3 },
  { id: "database", label: "Database", icon: "database", placement: "end" },
  { id: "terminal", label: "Terminal", icon: "terminal", placement: "bottom", shortcut: "Alt+F12" },
  { id: "problems", label: "Problems", icon: "warning", placement: "bottom", count: 2, shortcut: "Alt+6" },
]

export function WorkspaceSection() {
  const openFiles = useOpenFiles(initialOpenFiles)
  const [selectedId, setSelectedId] = useState<string>("core/Binder.java")
  const [open, setOpen] = useState<Partial<Record<"start" | "end" | "bottom", string>>>({ start: "project", bottom: "problems" })
  const [finding, setFinding] = useState(true)
  const [query, setQuery] = useState("context")
  const [findOptions, setFindOptions] = useState<FindOptions>({ matchCase: false, wholeWord: false, regularExpression: false })
  const [match, setMatch] = useState(1)
  const source = openFiles.activeId ? sourceOf[openFiles.activeId] ?? "" : ""
  const total = query ? source.toLowerCase().split(query.toLowerCase()).length - 1 : 0

  function openNode(id: string, asPreview: boolean) {
    const node = findNode(projectTree, id)
    if (!node || node.children) {
      return
    }
    openFiles.open({ id: node.id, name: node.name, fileType: node.fileType, change: node.change, preview: asPreview })
  }

  function renderToolWindow(entry: ToolWindowEntry) {
    const hide = () => setOpen((current) => ({ ...current, [entry.placement]: undefined }))
    if (entry.id === "project") {
      return (
        <ToolWindow title="Project" onHide={hide} actions={<IconButton icon="refresh" label="Reload from disk" size="small" />}>
          <Tree label="Project" nodes={projectTree} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); openNode(id, true) }} onActivate={(id) => openNode(id, false)} defaultExpandedIds={["core", "core/src"]} />
        </ToolWindow>
      )
    }
    if (entry.id === "problems") {
      return (
        <ToolWindow title="Problems" onHide={hide}>
          <List density="compact">
            <ListItem value="12:9"><Badge tone="warn">Warning</Badge> Field <InlineCode>context</InlineCode> may be final</ListItem>
            <ListItem value="3:1"><Badge tone="danger">Error</Badge> Merge conflict in application.yaml</ListItem>
          </List>
        </ToolWindow>
      )
    }
    return (
      <ToolWindow title={entry.label} onHide={hide} padded>
        <EmptyState flush icon={entry.icon} title={`Nothing in ${entry.label} yet`} />
      </ToolWindow>
    )
  }

  return (
    <div className="showcase-stack">
      <PageHeader title="Workspace" description="Burin, assembled from the kit alone: title bar and widgets, tool-window stripes, resizable tool windows on three sides, the open files, find in file, the canvas and the status bar. The only lines of its own are the fixture and this page's state." />
      <Specimen id="workspace" title="IdeFrame · ToolWindow · EditorTabs · FindBar · StatusBar" summary="Press a stripe button to open or close a window; drag or focus a handle to resize; Enter and Shift+Enter in the find field step through matches; Escape closes it." flush layout="column">
        <div className="showcase-ide">
          <IdeFrame
            storagePrefix="jmouse-ui-kit.ide"
            entries={toolWindows}
            open={open}
            onToggle={(entry) => setOpen((current) => ({ ...current, [entry.placement]: current[entry.placement] === entry.id ? undefined : entry.id }))}
            renderToolWindow={renderToolWindow}
            titleBar={
              <TitleBar
                start={<><Widget badge="J" menu>jmouse</Widget><TitleBarSeparator /><Widget icon="branch" menu quiet="origin">master</Widget></>}
                end={<><Widget icon="play" menu>Application</Widget><IconButton icon="play" label="Run" size="small" tone="good" /><IconButton icon="search" label="Search everywhere" size="small" /><IconButton icon="settings" label="Settings" size="small" /></>}
              />
            }
            statusBar={<StatusBar start={<PathText path={openFiles.activeId ? `jmouse/${openFiles.activeId}` : "jmouse"} />} end={<><StatusItem icon="branch" onActivate={() => undefined}>master</StatusItem><StatusItem>12:4</StatusItem><StatusItem>UTF-8</StatusItem><StatusItem icon="warning">2</StatusItem></>} />}
          >
            <Editor
              tabs={<EditorTabs label="Open files" files={openFiles.files} activeId={openFiles.activeId} onActivate={openFiles.setActiveId} onClose={openFiles.close} onReorder={openFiles.reorder} end={<IconButton icon="search" label="Find in file" size="small" onClick={() => setFinding(true)} />} />}
              findBar={finding ? <FindBar query={query} onQueryChange={(value) => { setQuery(value); setMatch(1) }} options={findOptions} onOptionsChange={setFindOptions} current={Math.min(match, total)} total={total} onNext={() => setMatch((value) => (value % Math.max(total, 1)) + 1)} onPrevious={() => setMatch((value) => (value <= 1 ? total : value - 1))} onClose={() => setFinding(false)} /> : undefined}
            >
              {openFiles.activeId ? <CodeEditor label={openFiles.activeId} value={source} onChange={(next) => { if (openFiles.activeId) { sourceOf[openFiles.activeId] = next; openFiles.setFiles((files) => files.map((file) => (file.id === openFiles.activeId ? { ...file, unsaved: true, preview: false } : file))) } }} /> : <EmptyState flush icon="file-code" title="No file is open" description="Open one from the project tree." />}
            </Editor>
          </IdeFrame>
        </div>
      </Specimen>
    </div>
  )
}

export function CatalogueSection() {
  const [sort, setSort] = useState<TableSort>({ key: "designator", direction: "ascending" })
  const [selectedId, setSelectedId] = useState("p1")
  const [query, setQuery] = useState("")
  const [onlyLow, setOnlyLow] = useState(false)
  const rows = useMemo(() => {
    const filtered = parts.filter((part) => (!onlyLow || part.state !== "good") && `${part.designator} ${part.value} ${part.package}`.toLowerCase().includes(query.toLowerCase()))
    return sortParts(filtered, sort)
  }, [sort, query, onlyLow])
  const selected = parts.find((part) => part.id === selectedId)

  return (
    <div className="showcase-stack">
      <PageHeader
        title="Catalogue"
        description="Innoventa's and Raccoon's list-and-inspector page, from the kit: a toolbar with a search and a filter, the figures band, the table, the inspector beside it."
        actions={<Button variant="primary" icon="plus">Add part</Button>}
      />
      <Specimen id="catalogue" title="Toolbar · figures · table · inspector" summary="The table scrolls; the page does not. Under 760px the inspector would move below the list in a product's shell." flush layout="column">
        <div className="showcase-workspace">
          <Split label="Inspector width" sizedPane="end" defaultSize={320} minimum={260} maximum={480}>
            <div className="kit-panel-body showcase-catalogue">
              <Toolbar label="Parts">
                <SearchField label="Search parts" placeholder="Search parts" value={query} onValueChange={setQuery} size="small" />
                <Chip pressed={onlyLow} onClick={() => setOnlyLow(!onlyLow)}>Low or out</Chip>
                <ToolbarPush />
                <span className="showcase-caption kit-technical">{rows.length} of {parts.length}</span>
              </Toolbar>
              <Figures figures={[{ label: "Parts", value: parts.length }, { label: "Low", value: parts.filter((part) => part.state === "warn").length, tone: "warn" }, { label: "Out", value: parts.filter((part) => part.state === "danger").length, tone: "danger" }]} />
              <Table label="Parts" columns={partColumns} rows={rows} rowKey={(part) => part.id} sort={sort} onSortChange={setSort} selectedKey={selectedId} onRowSelect={(part) => setSelectedId(part.id)} empty="No parts match. Clear the search or the filter." />
            </div>
            {selected ? (
              <Inspector title={selected.value} subtitle={selected.path}>
                <InspectorGroup title="Part">
                  <Facts facts={[{ label: "Designator", value: selected.designator, technical: true }, { label: "Kind", value: <Kind>{selected.kind.toUpperCase()}</Kind> }, { label: "Package", value: selected.package, technical: true }]} />
                </InspectorGroup>
                <InspectorGroup title="Stock" actions={<Badge tone={selected.state}>{selected.stateLabel}</Badge>}>
                  <Facts facts={[{ label: "On hand", value: selected.stock.toLocaleString("en"), technical: true }]} />
                  <Button size="small" icon="plus">Receive stock</Button>
                </InspectorGroup>
              </Inspector>
            ) : (
              <div />
            )}
          </Split>
        </div>
      </Specimen>
    </div>
  )
}

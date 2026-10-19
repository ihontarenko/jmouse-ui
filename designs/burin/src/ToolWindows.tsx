import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  CommitLog,
  Console,
  ConsoleCursor,
  ConsoleText,
  Icon,
  IconButton,
  Kbd,
  List,
  ListItem,
  Progress,
  ToolNote,
  ToolNotification,
  ToolTabs,
  ToolWindow,
  Tree,
  type ConsoleTone,
  type ToolWindowEntry,
} from "@jmouse/ui-kit"
import { bookmarks, commits, databaseTree, mavenTree } from "./panels"
import { files, projectTree, type ProjectNode } from "./project"
import { KindGlyph, expandedIdsOf, fileName, indexNodes, structureOf, toTreeNode, treeIdOfFile } from "./projectView"

export interface RunState {
  status: "idle" | "running" | "stopped"
  lines: Array<[ConsoleTone, string]>
  progress: number
  finished?: boolean
}

export interface ToolWindowContentProperties {
  entry: ToolWindowEntry
  activePath: string | null
  onHide(): void
  onOpenFile(path: string, line?: number): void
  onCaret(line: number): void
  projectExpanded: string[]
  onProjectExpandedChange(ids: string[]): void
  run: RunState
  onClearRun(): void
  notify(message: string, tone?: "good"): void
}

const projectNodes = [toTreeNode(projectTree)]
const projectIndex = indexNodes(projectTree)
const mavenNodes = [toTreeNode(mavenTree)]
const mavenIndex = indexNodes(mavenTree)
const mavenExpanded = expandedIdsOf(mavenTree, new Set(["Lifecycle"]))
const databaseNodes = [toTreeNode(databaseTree)]
const databaseExpanded = expandedIdsOf(databaseTree, new Set(["jmouse", "tables", "bindings"]))
const runStatusLabels = { idle: "Idle", running: "Running", stopped: "Stopped" }
const problemIcons = { warn: "warning", weak: "information", danger: "error" } as const
const problemTones = { warn: "warn", weak: undefined, danger: "danger" } as const

function ProjectWindow({ activePath, onOpenFile, expanded, onExpandedChange, notify, onHide }: { activePath: string | null; onOpenFile(path: string): void; expanded: string[]; onExpandedChange(ids: string[]): void; notify(message: string): void; onHide(): void }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(() => (activePath ? treeIdOfFile(projectTree, activePath) : undefined))
  const activeTreeId = activePath ? treeIdOfFile(projectTree, activePath) : undefined
  return (
    <ToolWindow
      title="Project"
      onHide={onHide}
      hideLabel="Hide Project"
      actions={
        <>
          <IconButton icon="target" label="Select opened file" size="small" onClick={() => setSelectedId(activeTreeId)} />
          <IconButton icon="collapse" label="Collapse all" size="small" onClick={() => onExpandedChange([projectTree.name])} />
        </>
      }
    >
      <Tree
        label="Project files"
        nodes={projectNodes}
        selectedId={selectedId ?? activeTreeId}
        expandedIds={expanded}
        onExpandedChange={onExpandedChange}
        onSelect={(id) => {
          setSelectedId(id)
          const node = projectIndex.get(id)
          if (node?.file) {
            onOpenFile(node.file)
          }
        }}
        onActivate={(id) => {
          const node = projectIndex.get(id)
          if (!node?.file) {
            notify(`${node?.name ?? id} is not part of this fixture`)
          }
        }}
      />
    </ToolWindow>
  )
}

function StructureWindow({ activePath, onCaret, onHide }: { activePath: string | null; onCaret(line: number): void; onHide(): void }) {
  const structure: ProjectNode | undefined = useMemo(() => (activePath ? structureOf(activePath) : undefined), [activePath])
  const nodes = useMemo(() => (structure ? [toTreeNode({ ...structure, kind: "folder" })] : []), [structure])
  const index = useMemo(() => (structure ? indexNodes(structure) : new Map<string, ProjectNode>()), [structure])
  const goTo = (id: string) => {
    const line = Number(index.get(id)?.file?.slice(1))
    if (line) {
      onCaret(line)
    }
  }
  return (
    <ToolWindow title="Structure" onHide={onHide} hideLabel="Hide Structure" actions={<IconButton icon="tag" label="Show fields" size="small" pressed />}>
      {structure && <Tree key={activePath} label="File structure" nodes={nodes} defaultExpandedIds={[structure.name]} onSelect={goTo} onActivate={goTo} />}
    </ToolWindow>
  )
}

function ProblemsWindow({ onOpenFile, onHide }: { onOpenFile(path: string, line?: number): void; onHide(): void }) {
  const withProblems = Object.entries(files).filter(([, file]) => file.problems.length)
  const total = withProblems.reduce((sum, [, file]) => sum + file.problems.length, 0)
  return (
    <ToolWindow
      title="Problems"
      onHide={onHide}
      hideLabel="Hide Problems"
      tabs={<ToolTabs label="Problems" selectedId="project" items={[{ id: "project", label: "Project Errors", count: total }, { id: "server", label: "Server-Side Analysis" }]} />}
    >
      <List density="compact">
        {withProblems.map(([path, file]) => (
          <li key={path}>
            <ListItem value={`${file.problems.length} problem${file.problems.length > 1 ? "s" : ""}`} onClick={() => onOpenFile(path)}>
              <KindGlyph kind={file.type} />
              <span>{fileName(path)}</span>
            </ListItem>
            <List density="compact">
              {file.problems.map((problem) => (
                <li key={`${problem.line}-${problem.message}`}>
                  <ListItem value={`:${problem.line}`} onClick={() => onOpenFile(path, problem.line)}>
                    <Icon name={problemIcons[problem.severity]} data-tone={problemTones[problem.severity]} />
                    <span>{problem.message}</span>
                  </ListItem>
                </li>
              ))}
            </List>
          </li>
        ))}
      </List>
    </ToolWindow>
  )
}

function TerminalWindow({ onHide, notify }: { onHide(): void; notify(message: string): void }) {
  const [session, setSession] = useState("local")
  const prompt = (
    <>
      <ConsoleText tone="path">~/Git/jmouse</ConsoleText> <ConsoleText tone="branch">(feature/bean-binder-depth)</ConsoleText>
      {"\n"}
      <ConsoleText tone="prompt">❯</ConsoleText>
    </>
  )
  return (
    <ToolWindow
      title="Terminal"
      onHide={onHide}
      hideLabel="Hide Terminal"
      tabs={<ToolTabs label="Terminal sessions" selectedId={session} onSelect={setSession} items={[{ id: "local", label: "Local" }, { id: "docker", label: "docker" }]} />}
      actions={<IconButton icon="plus" label="New session" size="small" onClick={() => notify("A new terminal session is not part of the template")} />}
    >
      {session === "local" ? (
        <Console role="tabpanel">
          {prompt} git status --short{"\n"}
          {" M jmouse-core/src/main/java/org/jmouse/core/bind/BeanBinder.java\n"}
          {" M jmouse-core/src/main/resources/application.yaml\n"}
          {" M jmouse-core/src/test/java/org/jmouse/core/bind/BeanBinderTest.java\n"}
          {"A  jmouse-el/src/main/java/org/jmouse/el/ExpressionParser.java\n"}
          {prompt} mvn -q -pl jmouse-core test -Dtest=BeanBinderTest{"\n"}
          <ConsoleText tone="level-info">[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.212 s</ConsoleText>
          {"\n"}
          {prompt} <ConsoleCursor />
        </Console>
      ) : (
        <Console role="tabpanel">
          <ConsoleText tone="prompt">❯</ConsoleText> docker compose ps{"\n"}
          {"NAME              IMAGE         STATUS          PORTS\n"}
          {"jmouse-mysql      mysql:8.4     Up 3 hours      0.0.0.0:3306->3306/tcp\n"}
          {"jmouse-postgres   postgres:17   Up 3 hours      0.0.0.0:5432->5432/tcp\n"}
          <ConsoleText tone="prompt">❯</ConsoleText> <ConsoleCursor />
        </Console>
      )}
    </ToolWindow>
  )
}

function GitWindow({ onHide, notify }: { onHide(): void; notify(message: string): void }) {
  const [selectedHash, setSelectedHash] = useState(commits[0].hash)
  return (
    <ToolWindow
      title="Git"
      onHide={onHide}
      hideLabel="Hide Git"
      tabs={<ToolTabs label="Git" selectedId="log" onSelect={(id) => id === "changes" && notify("The commit screen is not part of this rebuild")} items={[{ id: "log", label: "Log" }, { id: "changes", label: "Changes" }]} />}
    >
      <CommitLog label="Commit history" commits={commits} selectedHash={selectedHash} onSelect={setSelectedHash} />
    </ToolWindow>
  )
}

/** The content of whichever tool window the frame asks for. */
export function ToolWindowContent({ entry, activePath, onHide, onOpenFile, onCaret, projectExpanded, onProjectExpandedChange, run, onClearRun, notify }: ToolWindowContentProperties) {
  switch (entry.id) {
    case "project":
      return <ProjectWindow activePath={activePath} onOpenFile={onOpenFile} expanded={projectExpanded} onExpandedChange={onProjectExpandedChange} notify={notify} onHide={onHide} />
    case "structure":
      return <StructureWindow activePath={activePath} onCaret={onCaret} onHide={onHide} />
    case "bookmarks":
      return (
        <ToolWindow title="Bookmarks" onHide={onHide} hideLabel="Hide Bookmarks">
          <List density="compact">
            {bookmarks.map((bookmark) => (
              <li key={`${bookmark.path}-${bookmark.line}`}>
                <ListItem value={bookmark.note} onClick={() => onOpenFile(bookmark.path, bookmark.line)}>
                  <Icon name="bookmark" />
                  {bookmark.name}
                </ListItem>
              </li>
            ))}
          </List>
          <ToolNote>Toggle a bookmark on the caret line with <Kbd>F11</Kbd>.</ToolNote>
        </ToolWindow>
      )
    case "notifications":
      return (
        <ToolWindow title="Notifications" onHide={onHide} hideLabel="Hide Notifications">
          <ToolNotification
            title="Maven projects need to be loaded"
            time={{ value: "2026-10-16T10:31", label: "10:31" }}
            actions={<><Button size="small" onClick={() => notify("Maven projects reloaded", "good")}>Load Maven Changes</Button><Button size="small" variant="quiet">Skip</Button></>}
          >
            jmouse-el/pom.xml changed since the last import.
          </ToolNotification>
          <ToolNotification
            icon="warning"
            tone="warn"
            title="Shared indexes"
            time={{ value: "2026-10-16T09:58", label: "09:58" }}
            actions={<><Button size="small" onClick={() => notify("Shared indexes downloaded")}>Download</Button><Button size="small" variant="quiet">Always</Button></>}
          >
            Download pre-built indexes for JDK 21 to cut indexing to a few seconds.
          </ToolNotification>
          <ToolNotification icon="check" tone="good" title="Pushed 3 commits" time={{ value: "2026-10-15T18:12", label: "yesterday" }} read>
            to origin/feature/bean-binder-depth
          </ToolNotification>
        </ToolWindow>
      )
    case "maven":
      return (
        <ToolWindow title="Maven" onHide={onHide} hideLabel="Hide Maven" actions={<IconButton icon="reset" label="Reload all Maven projects" size="small" onClick={() => notify("Maven projects reloaded", "good")} />}>
          <Tree
            label="Maven projects"
            nodes={mavenNodes}
            defaultExpandedIds={mavenExpanded}
            onActivate={(id) => {
              const node = mavenIndex.get(id)
              if (node?.goal) {
                notify(`mvn ${node.name} — BUILD SUCCESS`, "good")
              }
            }}
          />
        </ToolWindow>
      )
    case "database":
      return (
        <ToolWindow title="Database" onHide={onHide} hideLabel="Hide Database">
          <Tree label="Data sources" nodes={databaseNodes} defaultExpandedIds={databaseExpanded} />
        </ToolWindow>
      )
    case "run":
      return (
        <ToolWindow
          title="Run"
          onHide={onHide}
          hideLabel="Hide Run"
          tabs={<ToolTabs label="Run" selectedId="sandbox" items={[{ id: "sandbox", label: "jmouse-sandbox", icon: "package" }]} />}
          status={
            <>
              <Badge>{runStatusLabels[run.status]}</Badge>
              {run.status === "running" && !run.finished && <Progress value={run.progress} label="Start-up progress" />}
            </>
          }
          actions={<IconButton icon="trash" label="Clear output" size="small" onClick={onClearRun} />}
        >
          <Console aria-live="polite" follow>
            {run.status === "idle" && run.lines.length === 0 ? (
              <ConsoleText tone="information">Press <Kbd>Shift</Kbd> <Kbd>F10</Kbd> or ▶ in the title bar to run jmouse-sandbox.</ConsoleText>
            ) : (
              run.lines.map(([tone, text], index) => <ConsoleText key={index} tone={tone}>{`${text}\n`}</ConsoleText>)
            )}
          </Console>
        </ToolWindow>
      )
    case "terminal":
      return <TerminalWindow onHide={onHide} notify={notify} />
    case "problems":
      return <ProblemsWindow onOpenFile={onOpenFile} onHide={onHide} />
    case "git":
      return <GitWindow onHide={onHide} notify={notify} />
    default:
      return null
  }
}

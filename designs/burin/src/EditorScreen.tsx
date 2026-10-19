import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AppearancePanel,
  CodeBreadcrumbs,
  CodeView,
  CommandPalette,
  CompletionList,
  Dialog,
  Editor,
  EditorEmpty,
  EditorTabs,
  FindBar,
  Icon,
  IconButton,
  IdeFrame,
  Kbd,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  ProjectBadge,
  StatusBar,
  StatusItem,
  StatusMeter,
  TitleBar,
  TitleBarBrand,
  TitleBarGroup,
  TitleBarSeparator,
  Toaster,
  Widget,
  findInSource,
  splitSourceLines,
  toast,
  useAppearance,
  useCommandShortcut,
  type CaretPosition,
  type Command,
  type CompletionItem,
  type FindOptions,
  type ToolWindowEntry,
} from "@jmouse/ui-kit"
import { BurinMark } from "./BurinMark"
import { completionProposals, runCommandLine, runLog } from "./panels"
import { actions, branchName, files, projectName, projectTree } from "./project"
import { KindGlyph, ancestorIdsOf, enclosingMembers, expandedIdsOf, fileName, glyphOf, treeIdOfFile } from "./projectView"
import { ToolWindowContent, type RunState } from "./ToolWindows"

type Placement = "start" | "end" | "bottom"

const languageNames = { java: "Java", yaml: "YAML", xml: "XML", plain: "Text" }
const storageKey = (name: string) => `burin-ui.editor-${name}`

const defaultOpenFiles = [
  "jmouse-core/src/main/java/org/jmouse/core/bind/BeanBinder.java",
  "jmouse-core/src/main/java/org/jmouse/core/bind/Binder.java",
  "jmouse-el/src/main/java/org/jmouse/el/ExpressionParser.java",
  "jmouse-core/src/main/resources/application.yaml",
]

const allProblemCount = Object.values(files).reduce((sum, file) => sum + file.problems.length, 0)

const entries: ToolWindowEntry[] = [
  { id: "project", label: "Project", icon: "folder", placement: "start", shortcut: "Alt+1" },
  { id: "commit", label: "Commit", icon: "commit", placement: "start", shortcut: "Alt+0", count: 5 },
  { id: "structure", label: "Structure", icon: "structure", placement: "start", shortcut: "Alt+7" },
  { id: "bookmarks", label: "Bookmarks", icon: "bookmark", placement: "start", shortcut: "Alt+2" },
  { id: "run", label: "Run", icon: "play", placement: "bottom", shortcut: "Alt+4" },
  { id: "terminal", label: "Terminal", icon: "terminal", placement: "bottom", shortcut: "Alt+F12" },
  { id: "problems", label: "Problems", icon: "warning", placement: "bottom", shortcut: "Alt+6", count: allProblemCount },
  { id: "git", label: "Git", icon: "branch", placement: "bottom", shortcut: "Alt+9" },
  { id: "notifications", label: "Notifications", icon: "bell", placement: "end", count: 2 },
  { id: "maven", label: "Maven", icon: "package", placement: "end" },
  { id: "database", label: "Database", icon: "database", placement: "end" },
]

/** Alt+1 project, Alt+9 git, Alt+F12 terminal: the numbers JetBrains people already have in their hands. */
const altKeys: Record<string, string> = { "1": "project", "0": "commit", "7": "structure", "2": "bookmarks", "4": "run", F12: "terminal", "6": "problems", "9": "git" }

function readStored<T>(name: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(storageKey(name))
    return stored ? (JSON.parse(stored) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStored(name: string, value: unknown) {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(value))
  } catch {
    /* storage refused: the choice lasts for this visit */
  }
}

/** What the address names — `#file=<path>&line=<n>` — when it names a file of the project. */
function readAddress(): { path?: string; line?: number } {
  const parameters = new URLSearchParams(location.hash.slice(1))
  const path = parameters.get("file") ?? undefined
  if (!path || !files[path]) {
    return {}
  }
  return { path, line: Number(parameters.get("line")) || undefined }
}

function initialEditorState() {
  const stored = readStored<{ open: string[]; active: string | null } | null>("open", null)
  const open = (stored?.open?.length ? stored.open : defaultOpenFiles).filter((path) => files[path])
  const address = readAddress()
  const active = address.path ?? (stored?.active && files[stored.active] ? stored.active : open[0])
  if (active && !open.includes(active)) {
    open.push(active)
  }
  const line = address.line ?? (active === defaultOpenFiles[0] && !address.path ? 47 : undefined)
  return { open, active: active ?? null, line }
}

/**
 * Burin's editor (Html/Burin/editor.html), drawn with the kit alone: the title bar and its widgets, the stripes and the
 * tool windows, the open files, the code with its gutter, find, completion, the run, and the status bar.
 */
export function EditorScreen() {
  const appearance = useAppearance()
  const initial = useMemo(initialEditorState, [])
  const [openPaths, setOpenPaths] = useState<string[]>(initial.open)
  const [activePath, setActivePath] = useState<string | null>(initial.active)
  const [carets, setCarets] = useState<Record<string, CaretPosition>>(() => (initial.active ? { [initial.active]: { line: initial.line ?? 1, column: 1 } } : {}))
  const [revealSerial, setRevealSerial] = useState(initial.line ? 1 : 0)
  const [breakpoints, setBreakpoints] = useState<Record<string, number[]>>(() => Object.fromEntries(Object.entries(files).map(([path, file]) => [path, file.breakpoints])))
  const [open, setOpen] = useState<Partial<Record<Placement, string>>>(() => readStored("tools", { start: "project" }))

  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findOptions, setFindOptions] = useState<FindOptions>({ matchCase: false, wholeWord: false, regularExpression: false })
  const [matchIndex, setMatchIndex] = useState(-1)

  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionIndex, setCompletionIndex] = useState(0)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)

  const [runState, setRunState] = useState<RunState>({ status: "idle", lines: [], progress: 0 })
  const runTimer = useRef<number | null>(null)

  const [projectExpanded, setProjectExpanded] = useState<string[]>(() =>
    expandedIdsOf(projectTree, new Set(["jmouse-core", "src", "main", "java", "org.jmouse.core.bind", "resources", "jmouse-el", "src/main/java", "org.jmouse.el"])),
  )

  const activeFile = activePath ? files[activePath] : undefined
  const caret = (activePath && carets[activePath]) || { line: 1, column: 1 }

  /* ---------- open files ---------- */
  const openFile = useCallback((path: string, line?: number) => {
    if (!files[path]) {
      return
    }
    setOpenPaths((current) => (current.includes(path) ? current : [...current, path]))
    setActivePath(path)
    if (line) {
      setCarets((current) => ({ ...current, [path]: { line, column: 1 } }))
      setRevealSerial((serial) => serial + 1)
    }
    const treeId = treeIdOfFile(projectTree, path)
    if (treeId) {
      setProjectExpanded((current) => Array.from(new Set([...current, ...ancestorIdsOf(treeId)])))
    }
  }, [])

  function closeFile(path: string) {
    const index = openPaths.indexOf(path)
    const remaining = openPaths.filter((candidate) => candidate !== path)
    setOpenPaths(remaining)
    if (activePath === path) {
      setActivePath(remaining[Math.min(index, remaining.length - 1)] ?? null)
    }
  }

  useEffect(() => {
    writeStored("open", { open: openPaths, active: activePath })
    if (activePath) {
      const line = carets[activePath]?.line
      history.replaceState(null, "", `#file=${encodeURIComponent(activePath)}${line && line > 1 ? `&line=${line}` : ""}`)
      document.title = `${fileName(activePath)} — ${projectName} — Burin`
    } else {
      document.title = `${projectName} — Burin`
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPaths, activePath])

  /* A link inside the page to #file=…&line=… (a bookmark, a problem) opens it in place. */
  useEffect(() => {
    function onHashChange() {
      const address = readAddress()
      if (address.path) {
        openFile(address.path, address.line)
      }
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [openFile])

  function setCaret(position: CaretPosition, reveal = false) {
    if (!activePath) {
      return
    }
    setCarets((current) => ({ ...current, [activePath]: position }))
    if (reveal) {
      setRevealSerial((serial) => serial + 1)
    }
  }

  function toggleBreakpoint(line: number) {
    if (!activePath) {
      return
    }
    setBreakpoints((current) => {
      const own = current[activePath] ?? []
      return { ...current, [activePath]: own.includes(line) ? own.filter((candidate) => candidate !== line) : [...own, line] }
    })
  }

  const breakpointCount = Object.values(breakpoints).reduce((sum, lines) => sum + lines.length, 0)

  /* ---------- tool windows: one per side at a time, as JetBrains does; kept per page ---------- */
  const showTool = useCallback((id: string, visible: boolean) => {
    const entry = entries.find((candidate) => candidate.id === id)
    if (!entry) {
      return
    }
    if (entry.id === "commit") {
      toast("The commit screen is not part of this rebuild")
      return
    }
    setOpen((current) => {
      const next = { ...current, [entry.placement]: visible ? entry.id : undefined }
      writeStored("tools", next)
      return next
    })
  }, [])

  const toggleTool = useCallback((id: string) => {
    const entry = entries.find((candidate) => candidate.id === id)
    if (entry) {
      showTool(id, open[entry.placement] !== id)
    }
  }, [open, showTool])

  /* ---------- find in file ---------- */
  const found = useMemo(() => (findOpen && activeFile ? findInSource(activeFile.source, findQuery, findOptions) : { matches: [], invalid: false }), [findOpen, activeFile, findQuery, findOptions])

  function goToMatch(index: number) {
    const total = found.matches.length
    if (!total) {
      return
    }
    const next = (index + total) % total
    setMatchIndex(next)
    setCaret({ line: found.matches[next].line, column: found.matches[next].start + 1 })
  }

  useEffect(() => {
    setMatchIndex(found.matches.length ? 0 : -1)
    if (found.matches.length) {
      setCaret({ line: found.matches[0].line, column: found.matches[0].start + 1 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found])

  function openFind() {
    const selected = window.getSelection()?.toString() ?? ""
    if (selected && !selected.includes("\n")) {
      setFindQuery(selected)
    }
    setFindOpen(true)
  }

  /* ---------- completion ---------- */
  const completionItems: CompletionItem[] = completionProposals.map((proposal) => ({
    id: proposal.name,
    glyph: <KindGlyph kind={proposal.glyph} />,
    name: proposal.name,
    matchedLength: 1,
    signature: proposal.signature,
    returns: proposal.returns,
  }))

  function insertCompletion(item: CompletionItem) {
    toast(`Inserted ${item.name}${item.signature ? "()" : ""}`)
    setCompletionOpen(false)
  }

  /* ---------- run: the configuration streams its log into the Run tool window ---------- */
  function startRun() {
    if (runTimer.current !== null) {
      return
    }
    showTool("run", true)
    setRunState({ status: "running", lines: [["information", runCommandLine]], progress: 0 })
    let index = 0
    runTimer.current = window.setInterval(() => {
      if (index >= runLog.length) {
        window.clearInterval(runTimer.current!)
        runTimer.current = -1
        setRunState((current) => ({ ...current, progress: 1, finished: true }))
        return
      }
      const line = runLog[index]
      index += 1
      setRunState((current) => ({ ...current, lines: [...current.lines, line], progress: index / runLog.length }))
    }, 160)
  }

  function stopRun() {
    if (runTimer.current === null) {
      return
    }
    if (runTimer.current > 0) {
      window.clearInterval(runTimer.current)
    }
    runTimer.current = null
    setRunState((current) => ({ status: "stopped", lines: [...current.lines, ["exit", "\nProcess finished with exit code 130 (interrupted by signal 2: SIGINT)"]], progress: 0 }))
  }

  useEffect(() => () => {
    if (runTimer.current && runTimer.current > 0) {
      window.clearInterval(runTimer.current)
    }
  }, [])

  /* ---------- the keys that work from anywhere ---------- */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (completionOpen) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault()
          event.stopPropagation()
          setCompletionIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + completionItems.length) % completionItems.length)
          return
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault()
          event.stopPropagation()
          insertCompletion(completionItems[completionIndex])
          return
        }
        if (event.key === "Escape") {
          event.preventDefault()
          setCompletionOpen(false)
          return
        }
      }
      if (event.ctrlKey && event.code === "Space") {
        event.preventDefault()
        setCompletionIndex(0)
        setCompletionOpen(true)
        return
      }
      if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault()
        openFind()
        return
      }
      if (event.shiftKey && !event.ctrlKey && event.key === "F10") {
        event.preventDefault()
        startRun()
        return
      }
      if (event.ctrlKey && event.key === "F2") {
        event.preventDefault()
        stopRun()
        return
      }
      if (event.altKey && !event.ctrlKey && !event.shiftKey && altKeys[event.key]) {
        event.preventDefault()
        toggleTool(altKeys[event.key])
      }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  })

  useEffect(() => {
    if (!completionOpen) {
      return
    }
    const close = () => setCompletionOpen(false)
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [completionOpen])

  useCommandShortcut(() => setPaletteOpen(true), { key: "n", doubleShift: true })

  /* ---------- search everywhere ---------- */
  function runAction(name: string) {
    if (name.startsWith("Run")) {
      startRun()
    } else if (name === "Find in Files…") {
      openFind()
    } else if (name === "Toggle Theme") {
      appearance.change("mode", appearance.mode === "dark" ? "light" : "dark")
    } else if (name === "Show Appearance") {
      setAppearanceOpen(true)
    } else {
      toast(`${name} is not part of this rebuild`)
    }
  }

  const commands: Command[] = [
    ...Object.keys(files).map((path) => ({
      id: path,
      label: fileName(path),
      hint: path.replace(/\/[^/]+$/, ""),
      group: "Files",
      icon: "file-code" as const,
      run: () => openFile(path),
    })),
    ...actions.map((action) => ({
      id: `action:${action.name}`,
      label: action.name,
      hint: action.where,
      group: "Actions",
      shortcut: action.keys.length ? action.keys.join("+") : undefined,
      run: () => runAction(action.name),
    })),
  ]

  /* ---------- breadcrumbs ---------- */
  const editorCrumbs = activePath
    ? (() => {
        const members = enclosingMembers(activePath, caret.line)
        if (!members.length) {
          return [{ id: "file", label: fileName(activePath), leading: <KindGlyph kind={files[activePath].type} />, onSelect: () => setCaret({ line: 1, column: 1 }, true) }]
        }
        return members.map((member) => ({ id: `${member.name}-${member.line}`, label: member.name, leading: <KindGlyph kind={member.kind} />, onSelect: () => setCaret({ line: member.line, column: 1 }, true) }))
      })()
    : []

  const statusCrumbs = activePath
    ? [
        { id: "project", label: projectName },
        { id: "module", label: activePath.split("/")[0] },
        { id: "file", label: fileName(activePath) },
      ]
    : [{ id: "project", label: projectName }]

  const notify = (message: string, tone?: "good") => (tone === "good" ? toast.success(message) : toast(message))

  /* ---------- the title bar ---------- */
  const titleBar = (
    <TitleBar
      start={
        <>
          <TitleBarBrand mark={<BurinMark />} name="Burin" label="Burin — welcome screen" compact />
          <Menu label="Project" trigger={(trigger) => <Widget badge="JM" menu {...trigger}>{projectName}</Widget>}>
            <MenuItem icon="folder-open" onSelect={() => notify("The welcome screen is not part of this rebuild")}>Open…</MenuItem>
            <MenuItem icon="plus" onSelect={() => notify("New project wizard is not part of the template")}>New Project…</MenuItem>
            <MenuSeparator />
            <MenuLabel>Recent projects</MenuLabel>
            <MenuItem current leading={<ProjectBadge letters="JM" />} detail="~/Git/jmouse">jmouse</MenuItem>
            <MenuItem leading={<ProjectBadge letters="PX" tone="good" />} detail="~/Git/jMouseProjects/Parallax" onSelect={() => notify("Opening Parallax in a new window")}>Parallax</MenuItem>
            <MenuItem leading={<ProjectBadge letters="TS" tone="warn" />} detail="~/Git/jMouseProjects/Tessera" onSelect={() => notify("Opening Tessera in a new window")}>Tessera</MenuItem>
          </Menu>
          <Menu label="Branch" trigger={(trigger) => <Widget icon="branch" menu {...trigger}>{branchName}</Widget>}>
            <MenuItem icon="pull" shortcut="Ctrl+T" onSelect={() => notify("Fetched from origin — nothing new")}>Update Project…</MenuItem>
            <MenuItem icon="commit" shortcut="Ctrl+K" onSelect={() => notify("The commit screen is not part of this rebuild")}>Commit…</MenuItem>
            <MenuItem icon="push" shortcut="Ctrl+⇧+K" onSelect={() => notify("Pushed 2 commits to origin/feature/bean-binder-depth", "good")}>Push…</MenuItem>
            <MenuSeparator />
            <MenuLabel>Local</MenuLabel>
            <MenuItem icon="branch" current detail="↑2">feature/bean-binder-depth</MenuItem>
            <MenuItem icon="branch" onSelect={() => notify("Checked out master")}>master</MenuItem>
            <MenuItem icon="branch" detail="↓1" onSelect={() => notify("Checked out feature/jme-pratt")}>feature/jme-pratt</MenuItem>
            <MenuLabel>Remote</MenuLabel>
            <MenuItem icon="branch" onSelect={() => notify("Checked out origin/master as a new local branch")}>origin/master</MenuItem>
          </Menu>
        </>
      }
      end={
        <>
          <Menu label="Run configuration" trigger={(trigger) => <Widget icon="package" menu {...trigger}>jmouse-sandbox</Widget>}>
            <MenuItem radio checked icon="package">jmouse-sandbox</MenuItem>
            <MenuItem radio checked={false} icon="check">BeanBinderTest</MenuItem>
            <MenuItem radio checked={false} icon="hammer">mvn install</MenuItem>
            <MenuSeparator />
            <MenuItem icon="settings" onSelect={() => notify("Run configurations editor is not part of the template")}>Edit Configurations…</MenuItem>
          </Menu>
          <TitleBarGroup label="Run">
            <IconButton icon="hammer" label="Build project" size="small" onClick={() => notify("Build finished in 2.4 s — 1 warning", "good")} />
            {runState.status === "running" ? (
              <IconButton icon="stop" label="Stop jmouse-sandbox (Ctrl+F2)" size="small" tone="danger" onClick={stopRun} />
            ) : (
              <IconButton icon="play" label="Run jmouse-sandbox (Shift+F10)" size="small" tone="good" onClick={startRun} />
            )}
            <IconButton icon="bug" label="Debug jmouse-sandbox" size="small" onClick={() => notify("Debugger attached on port 5005")} />
          </TitleBarGroup>
          <TitleBarSeparator />
          <IconButton icon="search" label="Search everywhere (double Shift)" size="small" onClick={() => setPaletteOpen(true)} />
          <IconButton icon={appearance.mode === "dark" ? "sun" : "moon"} label="Toggle theme" size="small" onClick={() => appearance.change("mode", appearance.mode === "dark" ? "light" : "dark")} />
          <IconButton icon="appearance" label="Appearance" size="small" onClick={() => setAppearanceOpen(true)} />
          <IconButton icon="settings" label="Settings (Ctrl+Alt+S)" size="small" onClick={() => notify("Settings are not part of this rebuild")} />
        </>
      }
    />
  )

  /* ---------- the status bar ---------- */
  const statusBar = (
    <StatusBar
      start={<CodeBreadcrumbs label="File path" placement="status" crumbs={statusCrumbs} />}
      end={
        <>
          <StatusItem title="Breakpoints" aria-label={`${breakpointCount} breakpoints`}>
            <Icon name="record" data-tone="breakpoint" />
            {breakpointCount}
          </StatusItem>
          <StatusItem aria-label="Caret position, line and column" onActivate={() => setRevealSerial((serial) => serial + 1)}>{`${caret.line}:${caret.column}`}</StatusItem>
          <StatusItem onActivate={() => undefined}>LF</StatusItem>
          <StatusItem onActivate={() => undefined}>UTF-8</StatusItem>
          <StatusItem onActivate={() => undefined}>4 spaces</StatusItem>
          <StatusItem onActivate={() => undefined}>{activeFile ? languageNames[activeFile.language] : "Text"}</StatusItem>
          <StatusItem icon="branch" aria-label="Git log" aria-pressed={open.bottom === "git"} onActivate={() => toggleTool("git")}>bean-binder-depth</StatusItem>
          <StatusMeter used={942} maximum={2048} label="Memory used">942 of 2048M</StatusMeter>
        </>
      }
    />
  )

  /* ---------- the editor ---------- */
  const tabs = (
    <EditorTabs
      label="Open files"
      files={openPaths.map((path) => {
        const file = files[path]
        const glyph = glyphOf(file.type)
        return {
          id: path,
          name: fileName(path),
          fileType: { letter: glyph.letter, color: glyph.color },
          change: file.vcs.added === "all" ? "added" : file.vcs.modified || file.vcs.added ? "modified" : undefined,
        }
      })}
      activeId={activePath ?? undefined}
      onActivate={(path) => openFile(path)}
      onClose={closeFile}
      end={
        <>
          <IconButton icon="split" label="Split right" size="small" onClick={() => notify("Split editor is not part of the template")} />
          <IconButton icon="search" label="Find in file (Ctrl+F)" size="small" onClick={openFind} />
          <IconButton icon="spark" label="Complete code (Ctrl+Space)" size="small" onClick={(event) => {
            event.stopPropagation()
            setCompletionIndex(0)
            setCompletionOpen(true)
          }} />
        </>
      }
    />
  )

  const findBar = findOpen && activeFile ? (
    <FindBar
      query={findQuery}
      onQueryChange={setFindQuery}
      options={findOptions}
      onOptionsChange={setFindOptions}
      current={matchIndex + 1}
      total={found.matches.length}
      invalid={found.invalid}
      onNext={() => goToMatch(matchIndex + 1)}
      onPrevious={() => goToMatch(matchIndex - 1)}
      onClose={() => setFindOpen(false)}
    />
  ) : undefined

  return (
    <>
      <IdeFrame
        titleBar={titleBar}
        statusBar={statusBar}
        entries={entries}
        open={open}
        onToggle={(entry) => toggleTool(entry.id)}
        storagePrefix="burin-ui.editor"
        viewport
        defaultSizes={{ start: 288, end: 288, bottom: Math.round(window.innerHeight * 0.32) }}
        renderToolWindow={(entry) => (
          <ToolWindowContent
            entry={entry}
            activePath={activePath}
            onHide={() => showTool(entry.id, false)}
            onOpenFile={openFile}
            onCaret={(line) => setCaret({ line, column: 1 }, true)}
            projectExpanded={projectExpanded}
            onProjectExpandedChange={setProjectExpanded}
            run={runState}
            onClearRun={() => setRunState((current) => ({ ...current, lines: [] }))}
            notify={notify}
          />
        )}
      >
        <Editor tabs={tabs} findBar={findBar} footer={activePath ? <CodeBreadcrumbs label="Code breadcrumbs" crumbs={editorCrumbs} /> : undefined}>
          {activePath && activeFile ? (
              <CodeView
                key={activePath}
                source={activeFile.source}
                language={activeFile.language}
                label={`${fileName(activePath)}, ${splitSourceLines(activeFile.source).length} lines`}
                changes={activeFile.vcs}
                breakpoints={breakpoints[activePath]}
                onBreakpointToggle={toggleBreakpoint}
                folds={activeFile.folds}
                vision={activeFile.vision}
                problems={activeFile.problems}
                onInspectionActivate={() => showTool("problems", true)}
                caret={caret}
                onCaretChange={(position) => setCaret(position)}
                revealSerial={revealSerial}
                matches={found.matches}
                currentMatch={matchIndex}
                popup={completionOpen ? (
                  <CompletionList
                    label="Completion"
                    items={completionItems}
                    activeIndex={completionIndex}
                    onPick={insertCompletion}
                    footer={<><span><Kbd>Enter</Kbd> insert · <Kbd>Tab</Kbd> replace</span><span>Property · org.jmouse.core.reflection</span></>}
                  />
                ) : undefined}
              />
          ) : (
            <EditorEmpty
              title="No files are open"
              shortcuts={[
                { label: "Search everywhere", keys: "Shift Shift" },
                { label: "Go to file", keys: "Ctrl Shift N" },
                { label: "Project view", keys: "Alt 1" },
              ]}
            />
          )}
        </Editor>
      </IdeFrame>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} label="Search everywhere" placeholder="Type a class, a file or an action" />
      <Dialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} title="Appearance">
        <AppearancePanel />
      </Dialog>
      <Toaster />
    </>
  )
}

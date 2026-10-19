import { useState } from "react"
import {
  Button,
  Crumbs,
  EditorTabs,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  PageHeader,
  Pagination,
  SearchField,
  TabPanel,
  Tabs,
  Toolbar,
  ToolbarPush,
  ToolbarSeparator,
  useToast,
  type OpenFile,
} from "@jmouse/ui-kit"
import { initialOpenFiles, sourceOf } from "../fixtures"
import { Specimen } from "../Specimen"

export function useOpenFiles(initial: OpenFile[]) {
  const [files, setFiles] = useState(initial)
  const [activeId, setActiveId] = useState<string | undefined>(initial[1]?.id)

  function open(file: OpenFile) {
    setFiles((current) => {
      if (current.some((candidate) => candidate.id === file.id)) {
        return current
      }
      // A preview tab is replaced by the next file opened, as in an IDE.
      const withoutPreview = current.filter((candidate) => !candidate.preview)
      return [...withoutPreview, file]
    })
    setActiveId(file.id)
  }

  function close(id: string) {
    const index = files.findIndex((file) => file.id === id)
    const next = files.filter((file) => file.id !== id)
    setFiles(next)
    if (id === activeId) {
      // The neighbour on the right takes over, as in an IDE; the left one when the last tab closes.
      setActiveId((next[index] ?? next[index - 1])?.id)
    }
  }

  function reorder(id: string, targetIndex: number) {
    setFiles((current) => {
      const moved = current.find((file) => file.id === id)
      if (!moved) {
        return current
      }
      const rest = current.filter((file) => file.id !== id)
      rest.splice(targetIndex, 0, moved)
      return rest
    })
  }

  return { files, activeId, setActiveId, open, close, reorder, setFiles }
}

export function NavigationSection({ onOpenCommands }: { onOpenCommands(): void }) {
  const toast = useToast()
  const [tab, setTab] = useState("overview")
  const [benchTab, setBenchTab] = useState("schematic")
  const [page, setPage] = useState(3)
  const [query, setQuery] = useState("")
  const [wrap, setWrap] = useState(true)
  const openFiles = useOpenFiles(initialOpenFiles)

  return (
    <div className="showcase-stack">
      <PageHeader title="Navigation" description="Where a page sits, how its content switches, the files that are open, and the actions behind a button." />

      <Specimen id="crumbs" title="Crumbs" summary="Each ancestor a link, the page itself current. A product passes renderLink to draw its router's link." usage={`<Crumbs items={[{ label: "Library", href: "/library" }, { label: "Timers", href: "/library/timers" }, { label: "NE555" }]} />`}>
        <Crumbs items={[{ label: "Library", href: "#/navigation" }, { label: "Timers", href: "#/navigation" }, { label: "NE555" }]} />
      </Specimen>

      <Specimen
        id="tabs"
        title="Tabs"
        summary="Content inside one page. Line tabs are a page's sections; strip tabs are a compact switch inside a toolbar or a bench. Arrow keys move and select; one tab stop. Tabs that change the address are links, not these."
        layout="column"
        usage={`
<Tabs id="part" label="Part" value={tab} onValueChange={setTab} items={[{ value: "overview", label: "Overview" }, …]} />
<TabPanel tabsId="part" value="overview" selected={tab}>…</TabPanel>`}
      >
        <Tabs
          id="showcase-part"
          label="Part"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "overview", label: "Overview" },
            { value: "pins", label: "Pins", count: 8 },
            { value: "revisions", label: "Revisions", count: 14 },
            { value: "relations", label: "Relations" },
            { value: "archived", label: "Archived", disabled: true },
          ]}
        />
        <TabPanel tabsId="showcase-part" value="overview" selected={tab}><p className="kit-secondary">The NE555 timer in its DIP-8 package.</p></TabPanel>
        <TabPanel tabsId="showcase-part" value="pins" selected={tab}><p className="kit-secondary">Eight pins: GND, TRIG, OUT, RESET, CTRL, THR, DIS, VCC.</p></TabPanel>
        <TabPanel tabsId="showcase-part" value="revisions" selected={tab}><p className="kit-secondary">Fourteen revisions, the last one today.</p></TabPanel>
        <TabPanel tabsId="showcase-part" value="relations" selected={tab}><p className="kit-secondary">Used by three circuits.</p></TabPanel>
        <Tabs
          id="showcase-bench"
          label="Bench"
          variant="strip"
          value={benchTab}
          onValueChange={setBenchTab}
          items={[
            { value: "schematic", label: "Schematic" },
            { value: "emulator", label: "Emulator" },
            { value: "editor", label: "Editor" },
          ]}
        />
      </Specimen>

      <Specimen
        id="editor-tabs"
        title="Editor tabs — the files that are open"
        summary="One strip for every product that opens documents: Burin's sources, Raccoon's documents, Kitsu's viewer. Unsaved shows a dot that turns into the cross under the pointer; the name is coloured by what changed; a pinned tab stays; a preview tab is italic and replaced by the next file. Arrow keys move, Delete closes, the middle button closes, drag to reorder. Try the canvas axis in the appearance dialog."
        layout="column"
        flush
        usage={`
<EditorTabs
  label="Open files"
  files={files}                 // { id, name, hint?, fileType?, change?, unsaved?, pinned?, preview? }
  activeId={activeId}
  onActivate={setActiveId}
  onClose={close}
  onReorder={reorder}
  end={<IconButton icon="more" label="All open files" size="small" />}
/>`}
      >
        <div className="showcase-editor" data-height="short">
          <EditorTabs
            label="Open files"
            files={openFiles.files}
            activeId={openFiles.activeId}
            onActivate={openFiles.setActiveId}
            onClose={openFiles.close}
            onReorder={openFiles.reorder}
            onContextMenu={(id) => toast.show({ title: "Context menu", description: `The product opens its own menu for ${id}.` })}
            end={
              <>
                <IconButton icon="split" label="Split right" size="small" />
                <Menu
                  label="Open files"
                  alignment="end"
                  trigger={(triggerProperties) => <IconButton icon="more" label="All open files" size="small" {...triggerProperties} />}
                >
                  {openFiles.files.map((file) => (
                    <MenuItem key={file.id} icon="file" onSelect={() => openFiles.setActiveId(file.id)}>{file.name}</MenuItem>
                  ))}
                  <MenuSeparator />
                  <MenuItem icon="refresh" onSelect={() => openFiles.setFiles(initialOpenFiles)}>Reopen the fixture</MenuItem>
                </Menu>
              </>
            }
          />
          <pre>{openFiles.activeId ? sourceOf[openFiles.activeId] ?? "" : "No file is open."}</pre>
        </div>
      </Specimen>

      <Specimen
        id="menu"
        title="Menu"
        summary="Actions behind a button, on the Popover API: the top layer, Escape and a click outside close it, focus returns to the trigger. Arrow keys, Home and End move. Items carry an icon, a shortcut, a check, or the danger tone."
        usage={`
<Menu label="Part" trigger={(triggerProperties) => <Button trailingIcon="chevron-down" {...triggerProperties}>Actions</Button>}>
  <MenuItem icon="edit" shortcut="F2" onSelect={rename}>Rename</MenuItem>
  <MenuItem checked={wrap} onSelect={toggleWrap}>Wrap lines</MenuItem>
  <MenuSeparator />
  <MenuItem icon="trash" tone="danger" onSelect={remove}>Delete</MenuItem>
</Menu>`}
      >
        <Menu label="Part actions" trigger={(triggerProperties) => <Button trailingIcon="chevron-down" {...triggerProperties}>Actions</Button>}>
          <MenuLabel>Part</MenuLabel>
          <MenuItem icon="edit" shortcut="F2" onSelect={() => toast.show({ title: "Rename" })}>Rename</MenuItem>
          <MenuItem icon="copy" shortcut="Ctrl+D" onSelect={() => toast.show({ title: "Duplicated", tone: "good" })}>Duplicate</MenuItem>
          <MenuItem icon="download" disabled>Export datasheet</MenuItem>
          <MenuSeparator />
          <MenuItem checked={wrap} onSelect={() => setWrap(!wrap)}>Wrap lines</MenuItem>
          <MenuSeparator />
          <MenuItem icon="trash" tone="danger" onSelect={() => toast.show({ title: "Deleted", tone: "danger", action: { label: "Undo", run: () => undefined } })}>Delete</MenuItem>
        </Menu>
        <Menu label="More" alignment="end" trigger={(triggerProperties) => <IconButton icon="more-vertical" label="More" variant="default" {...triggerProperties} />}>
          <MenuItem icon="settings">Settings</MenuItem>
          <MenuItem icon="logout">Sign out</MenuItem>
        </Menu>
      </Specimen>

      <Specimen id="toolbar" title="Toolbar" summary="Controls over the thing they act on; a separator groups them, a push sends the rest to the end.">
        <Toolbar label="Parts" className="showcase-toolbar-full">
          <SearchField label="Filter parts" placeholder="Filter" value={query} onValueChange={setQuery} size="small" />
          <ToolbarSeparator />
          <Button size="small" icon="filter">Filters</Button>
          <Button size="small" icon="sort">Sort</Button>
          <ToolbarPush />
          <IconButton icon="download" label="Export" size="small" />
          <Button size="small" variant="primary" icon="plus">Add part</Button>
        </Toolbar>
      </Specimen>

      <Specimen id="pagination" title="Pagination" summary="A list's foot: what it holds, and the way through. The first, the last and the neighbours of the current page; a gap stands for the rest.">
        <Pagination page={page} pageCount={24} onPageChange={setPage} summary={`${(page - 1) * 50 + 1}–${page * 50} of 1 204 parts`} />
      </Specimen>

      <Specimen id="command-palette" title="Command palette" summary="Search everywhere: Ctrl+K (or ⌘K) from any page. Letters match in order — try “opset”. Grouped, highlighted, run with Enter." usage={`useCommandShortcut(() => setOpen(true))\n<CommandPalette open={open} onClose={() => setOpen(false)} commands={commands} />`}>
        <Button icon="command" shortcut="Ctrl+K" onClick={onOpenCommands}>Search everywhere</Button>
      </Specimen>
    </div>
  )
}

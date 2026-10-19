import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AppearancePanel,
  AppShell,
  Button,
  CommandPalette,
  Crumbs,
  Dialog,
  IconButton,
  NavItem,
  Rail,
  RailGroup,
  StatusBar,
  StatusItem,
  Topbar,
  useAppearance,
  useCommandShortcut,
  type Command,
  type IconName,
} from "@jmouse/ui-kit"
import { CatalogueSection, WorkspaceSection } from "./sections/Compositions"
import { ContainersSection } from "./sections/Containers"
import { ControlsSection } from "./sections/Controls"
import { DataSection } from "./sections/Data"
import { FeedbackSection } from "./sections/Feedback"
import { OverviewSection, ThemesSection } from "./sections/Foundations"
import { ThemeGeneratorSection } from "./sections/ThemeGenerator"
import { FilesSection } from "./sections/Files"
import { MediaSection } from "./sections/Media"
import { NavigationSection } from "./sections/Navigation"

interface Route {
  path: string
  label: string
  icon: IconName
  group: "Foundations" | "Components" | "Compositions"
  /** The specimens on the page, for the command palette. */
  anchors: Array<[string, string]>
}

const routes: Route[] = [
  { path: "overview", label: "Overview", icon: "home", group: "Foundations", anchors: [["install", "Wiring a product"], ["rules", "Rules"]] },
  { path: "themes", label: "Themes and tokens", icon: "appearance", group: "Foundations", anchors: [["themes", "Themes"], ["colour", "Colour roles"], ["type", "Type"], ["icons", "Icons"]] },
  { path: "generator", label: "Theme generator", icon: "edit", group: "Foundations", anchors: [] },
  { path: "controls", label: "Controls", icon: "settings", group: "Components", anchors: [["buttons", "Button"], ["fields", "Field"], ["form", "Form from a definition"], ["search", "Search field"], ["choices", "Checkbox, switch, radio"], ["segmented", "Segmented, stepper, parameter"], ["labels", "Badge, tag, chip"]] },
  { path: "navigation", label: "Navigation", icon: "layers", group: "Components", anchors: [["crumbs", "Crumbs"], ["tabs", "Tabs"], ["editor-tabs", "Editor tabs"], ["menu", "Menu"], ["toolbar", "Toolbar"], ["pagination", "Pagination"], ["command-palette", "Command palette"]] },
  { path: "containers", label: "Containers", icon: "grid", group: "Components", anchors: [["panel", "Panel and section"], ["inspector", "Inspector"], ["disclosure", "Disclosure"], ["dialog", "Dialog and drawer"], ["split", "Split"], ["cards", "Card"]] },
  { path: "data", label: "Data", icon: "database", group: "Components", anchors: [["table", "Table"], ["tree", "Tree"], ["list", "List"], ["facts", "Facts and figures"], ["collections", "Filter rail, date range, popover, activity, steps"], ["values", "Path, code, progress"]] },
  { path: "feedback", label: "Feedback", icon: "bell", group: "Components", anchors: [["notice", "Notice"], ["toast", "Toast"], ["states", "Empty and problem"], ["error-page", "Error page"], ["waiting", "Skeleton and spinner"]] },
  { path: "media", label: "Media", icon: "image", group: "Components", anchors: [["shelf", "Shelf and media tile"], ["transport", "Transport"]] },
  { path: "workspace", label: "Workspace", icon: "file-code", group: "Compositions", anchors: [["workspace", "IDE frame"]] },
  { path: "files", label: "File workspace", icon: "folder", group: "Compositions", anchors: [["file-workspace", "File workspace"], ["file-glyphs", "File glyphs"]] },
  { path: "catalogue", label: "Catalogue", icon: "list", group: "Compositions", anchors: [["catalogue", "List and inspector"]] },
]

function readRoute(): { path: string; anchor?: string } {
  const [path, anchor] = window.location.hash.replace(/^#\/?/, "").split("/")
  return { path: routes.some((route) => route.path === path) ? path : "overview", anchor }
}

function useHashRoute() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const follow = () => setRoute(readRoute())
    window.addEventListener("hashchange", follow)
    return () => window.removeEventListener("hashchange", follow)
  }, [])
  useEffect(() => {
    const main = document.getElementById("kit-main")
    if (route.anchor) {
      document.getElementById(route.anchor)?.scrollIntoView({ block: "start" })
    } else {
      main?.scrollTo({ top: 0 })
    }
  }, [route])
  return route
}

function BrandMark() {
  // A lozenge with a ruled core: the kit's own mark, never a product's.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12z" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  )
}

export function KitApp() {
  const route = useHashRoute()
  const { choice, theme, mode, themes, change } = useAppearance()
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [commandsOpen, setCommandsOpen] = useState(false)
  const openCommands = useCallback(() => setCommandsOpen(true), [])
  useCommandShortcut(openCommands)

  const current = routes.find((candidate) => candidate.path === route.path) ?? routes[0]

  const commands = useMemo<Command[]>(
    () => [
      ...routes.map((candidate) => ({ id: `go-${candidate.path}`, label: candidate.label, group: "Go to", icon: candidate.icon, run: () => (window.location.hash = `#/${candidate.path}`) })),
      ...routes.flatMap((candidate) =>
        candidate.anchors.map(([anchor, label]) => ({ id: `anchor-${candidate.path}-${anchor}`, label, hint: candidate.label, group: "Components", icon: "arrow-right" as IconName, run: () => (window.location.hash = `#/${candidate.path}/${anchor}`) })),
      ),
      ...themes.map((candidate) => ({ id: `theme-${candidate.name}`, label: `Theme: ${candidate.label}`, group: "Appearance", icon: "appearance" as IconName, run: () => change("theme", candidate.name) })),
      { id: "mode-light", label: "Mode: light", group: "Appearance", icon: "sun" as IconName, run: () => change("mode", "light") },
      { id: "mode-dark", label: "Mode: dark", group: "Appearance", icon: "moon" as IconName, run: () => change("mode", "dark") },
      { id: "mode-system", label: "Mode: follow the system", group: "Appearance", icon: "settings" as IconName, run: () => change("mode", "system") },
      { id: "open-settings", label: "Open appearance settings", group: "Appearance", icon: "appearance", shortcut: "Ctrl+,", run: () => setAppearanceOpen(true) },
    ],
    [themes, change],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault()
        setAppearanceOpen(true)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const pages: Record<string, ReactNode> = {
    overview: <OverviewSection />,
    themes: <ThemesSection />,
    generator: <ThemeGeneratorSection />,
    controls: <ControlsSection />,
    navigation: <NavigationSection onOpenCommands={openCommands} />,
    containers: <ContainersSection />,
    data: <DataSection />,
    feedback: <FeedbackSection />,
    media: <MediaSection />,
    workspace: <WorkspaceSection />,
    catalogue: <CatalogueSection />,
    files: <FilesSection />,
  }

  const groups = ["Foundations", "Components", "Compositions"] as const
  const dark = mode === "dark"

  return (
    <AppShell
      storagePrefix="jmouse-ui-kit"
      rail={
        <Rail
          brand={{ mark: <BrandMark />, name: "jMouse UI-kit", href: "#/overview" }}
          label="Kit sections"
          footer={<NavItem icon="appearance" label="Appearance" href="#" onClick={(event) => { event.preventDefault(); setAppearanceOpen(true) }} />}
        >
          {groups.map((group) => (
            <RailGroup key={group} label={group}>
              {routes
                .filter((candidate) => candidate.group === group)
                .map((candidate) => (
                  <NavItem key={candidate.path} icon={candidate.icon} label={candidate.label} href={`#/${candidate.path}`} current={candidate.path === current.path} count={candidate.group === "Components" ? candidate.anchors.length : undefined} />
                ))}
            </RailGroup>
          ))}
        </Rail>
      }
      topbar={
        <Topbar
          start={<Crumbs items={[{ label: "UI-kit", href: "#/overview" }, { label: current.group, href: `#/${current.path}` }, { label: current.label }]} />}
          end={
            <>
              <Button variant="quiet" size="small" icon="search" shortcut="Ctrl+K" onClick={openCommands}>Search</Button>
              <IconButton icon={dark ? "sun" : "moon"} label={dark ? "Light mode" : "Dark mode"} onClick={() => change("mode", dark ? "light" : "dark")} />
              <IconButton icon="appearance" label="Appearance" onClick={() => setAppearanceOpen(true)} />
            </>
          }
        />
      }
      statusBar={
        <StatusBar
          start={<StatusItem icon="layers">@jmouse/ui-kit 0.1.0</StatusItem>}
          end={
            <>
              <StatusItem icon={dark ? "moon" : "sun"} onActivate={() => setAppearanceOpen(true)}>{theme.label} · {mode}{choice.mode === "system" ? " (system)" : ""}</StatusItem>
              <StatusItem>{choice.palette}</StatusItem>
              <StatusItem>{Math.round(Number(choice.scale) * 100)}%</StatusItem>
              <StatusItem>{choice.density}</StatusItem>
            </>
          }
        />
      }
    >
      <div className="kit-page">{pages[current.path]}</div>
      <Dialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} title="Appearance" description="Every axis applies at once and is kept in this browser." size="wide">
        <AppearancePanel />
      </Dialog>
      <CommandPalette open={commandsOpen} onClose={() => setCommandsOpen(false)} commands={commands} />
    </AppShell>
  )
}

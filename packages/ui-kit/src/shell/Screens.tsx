import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react"
import { useOptionalAppearance } from "../appearance/AppearanceProvider"
import { Button, IconButton } from "../controls/Button"
import { Avatar } from "../controls/Labels"
import { Dialog } from "../containers/Dialog"
import { PageHeader } from "../containers/Panel"
import { RailPresentationContext } from "../data/FacetRail"
import { StatsBand, type StatCell } from "../data/StatsBand"
import { EmptyState, TableSkeleton, type EmptyStateProperties } from "../feedback/Feedback"
import { Icon, type IconSource } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"
import { KitLink, useKitLocation } from "../lib/links"
import { Tabs, type TabDefinition } from "../navigation/Tabs"

/*
 * The screens Innoventa is built from — its `shells/` and `InspectorSlot.tsx`, with the same names and properties. A
 * page contributes data and copy; the arrangement is decided here, which is what makes page forty look like page one.
 */

/* ===================== the inspector slot ===================== */

interface InspectorContent {
  title?: string
  body: ReactNode
}

// The inspector's content lives outside React's tree: the screen that knows it and the shell that draws it are
// siblings, and lifting it through context would re-render the whole application on every row the reader moves to.
const inspectorContent = {
  current: undefined as InspectorContent | undefined,
  listeners: new Set<() => void>(),
  set(next: InspectorContent | undefined) {
    inspectorContent.current = next
    for (const listener of inspectorContent.listeners) {
      listener()
    }
  },
  subscribe(listener: () => void) {
    inspectorContent.listeners.add(listener)
    return () => {
      inspectorContent.listeners.delete(listener)
    }
  },
  read() {
    return inspectorContent.current
  },
}

interface InspectorSlotValue {
  present: boolean
  setPresent(present: boolean): void
}

const InspectorSlotContext = createContext<InspectorSlotValue | undefined>(undefined)

/** Whether the current screen wants an inspector column. Mount once around the shell. */
export function InspectorSlotProvider({ children }: { children: ReactNode }) {
  const [present, setPresent] = useState(false)
  const value = useMemo(() => ({ present, setPresent }), [present])
  return <InspectorSlotContext.Provider value={value}>{children}</InspectorSlotContext.Provider>
}

export function useInspectorSlot(): InspectorSlotValue {
  const value = useContext(InspectorSlotContext)
  if (value === undefined) {
    throw new Error("useInspectorSlot used outside InspectorSlotProvider")
  }
  return value
}

/** What the inspector shows now — read by the shell. */
export function useInspectorContent(): InspectorContent | undefined {
  return useSyncExternalStore(inspectorContent.subscribe, inspectorContent.read, inspectorContent.read)
}

/** A screen says what its inspector shows; it is cleared when the screen leaves. */
export function useInspector(content: InspectorContent | undefined): void {
  useEffect(() => {
    inspectorContent.set(content)
  })
  useEffect(() => {
    return () => inspectorContent.set(undefined)
  }, [])
}

/** A screen says whether it has an inspector at all. */
export function useInspectorPresence(present = true): void {
  const slot = useContext(InspectorSlotContext)
  useEffect(() => {
    slot?.setPresent(present)
    return () => slot?.setPresent(false)
  }, [slot, present])
}

/* ===================== the application frame ===================== */

/** Sidebar · (topbar over the page) · inspector. The page does not scroll — the panel inside it does (below 1024px it does). */
export function ApplicationShell({ sidebar, topbar, inspector, children }: { sidebar: ReactNode; topbar: ReactNode; inspector?: ReactNode; children: ReactNode }) {
  return (
    <div className="kit-application-shell">
      {sidebar}
      <div className="kit-application-column">
        {topbar}
        <main id="main" className="kit-application-main" tabIndex={-1}>{children}</main>
      </div>
      {inspector}
    </div>
  )
}

/** A screen's content box: its padding, its gap, and whether it fills the height or scrolls. */
export function ContentArea({ variant = "fill", className, children }: { variant?: "fill" | "scroll"; className?: string; children: ReactNode }) {
  return <div className={joinClassNames("kit-content-area", className)} data-variant={variant}>{children}</div>
}

export function SkipLink({ label = "Skip to content", target = "#main" }: { label?: string; target?: string }) {
  return <a href={target} className="kit-skip-link">{label}</a>
}

/* ===================== the sidebar ===================== */

export interface NavigationEntry {
  key: string
  label: string
  to: string
  icon: IconSource
  /** The `g` sequence that jumps here, printed at the end (hidden on touch). */
  keys?: string
  count?: number
  /** Whether the account may open it; refused entries stay visible and say why. */
  standing?: "PERMITTED" | "NO_PERMISSION" | "NOT_IN_PLAN"
  /** Why it is refused, as the tooltip. */
  words?: string
}

export interface NavigationGroup {
  title: string
  entries: NavigationEntry[]
}

export interface SidebarProperties {
  groups: NavigationGroup[]
  /** The product's lockup — its emblem and name. The product's identity, so it is handed in. */
  brand?: ReactNode
  /** The contextual mark beside the workspace name — where you are, before anything is read. */
  mark?: ReactNode
  /** Where the lockup goes: the signed-in home, never the public landing. */
  homeTo?: string
  workspaceName: string
  userName: string
  /** The account's face; the initials are drawn without it. */
  userFace?: ReactNode
  onSignOut?(): void
  signingOut?: boolean
  navigationOpen?: boolean
  onNavigationOpenChange?(open: boolean): void
  /** "dark": the chassis stays dark whatever the mode (Innoventa) · "follow": it follows the mode. */
  chassis?: "dark" | "follow"
  labels?: Partial<Record<"sections" | "navigation" | "signOut" | "plan", string>>
}

/** The chassis: brand and workspace, the sections, the account. Beside the page from 1024px, a drawer below it. */
export function Sidebar({ navigationOpen = false, onNavigationOpenChange, chassis = "dark", ...properties }: SidebarProperties) {
  const appearance = useOptionalAppearance()
  const chassisAttributes = chassis === "dark" ? { "data-theme": appearance?.theme.name ?? "parallax", "data-mode": "dark" } : {}
  return (
    <>
      <aside className="kit-sidebar" {...chassisAttributes}>
        <Chassis {...properties} />
      </aside>
      {onNavigationOpenChange === undefined ? null : (
        <Dialog open={navigationOpen} onOpenChange={onNavigationOpenChange} title={properties.labels?.navigation ?? "Navigation"} placement="start" flush className="kit-sidebar-drawer">
          <div className="kit-sidebar kit-sidebar-in-drawer" {...chassisAttributes}>
            <Chassis {...properties} onNavigate={() => onNavigationOpenChange(false)} />
          </div>
        </Dialog>
      )}
    </>
  )
}

function Chassis({ groups, brand, mark, homeTo = "/", workspaceName, userName, userFace, onSignOut, signingOut = false, labels = {}, onNavigate }: Omit<SidebarProperties, "navigationOpen" | "onNavigationOpenChange" | "chassis"> & { onNavigate?(): void }) {
  const location = useKitLocation()
  return (
    <>
      <div className="kit-sidebar-head">
        <KitLink to={homeTo} onClick={onNavigate} className="kit-sidebar-brand">
          {brand}
          <span className="kit-sidebar-workspace">
            {mark}
            <span className="kit-micro-label">{workspaceName}</span>
          </span>
        </KitLink>
      </div>
      <nav aria-label={labels.sections ?? "Sections"} className="kit-sidebar-nav">
        {groups.map((group) => (
          <div key={group.title} className="kit-sidebar-group">
            <div className="kit-micro-label kit-sidebar-group-title">{group.title}</div>
            {group.entries.map((entry) => {
              const refused = entry.standing !== undefined && entry.standing !== "PERMITTED"
              if (refused) {
                return (
                  <span key={entry.key} title={entry.words} aria-disabled="true" className="kit-sidebar-entry" data-refused="">
                    <Icon name={entry.icon} />
                    <span className="kit-sidebar-entry-label">{entry.label}</span>
                    <span className="kit-sidebar-entry-end">{entry.standing === "NOT_IN_PLAN" ? (labels.plan ?? "plan") : "—"}</span>
                  </span>
                )
              }
              const active = location.pathname === entry.to || location.pathname.startsWith(`${entry.to}/`)
              return (
                <KitLink key={entry.key} to={entry.to} onClick={onNavigate} className="kit-sidebar-entry" aria-current={active ? "page" : undefined}>
                  <Icon name={entry.icon} />
                  <span className="kit-sidebar-entry-label">{entry.label}</span>
                  {entry.count === undefined ? (entry.keys === undefined ? null : <kbd className="kit-sidebar-entry-keys" aria-hidden="true">{entry.keys}</kbd>) : <span className="kit-sidebar-entry-end">{entry.count}</span>}
                </KitLink>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="kit-sidebar-account">
        {userFace ?? <Avatar name={userName} size="small" />}
        <b>{userName}</b>
        {onSignOut === undefined ? null : <IconButton icon="logout" label={labels.signOut ?? "Sign out"} size="small" disabled={signingOut} onClick={onSignOut} />}
      </div>
    </>
  )
}

/* ===================== list and document screens ===================== */

export interface ListScreenProperties {
  title: string
  titleExtra?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** The facet rail; on a narrow screen it opens in a sheet behind a "Browse" button. */
  rail?: ReactNode
  toolbar?: ReactNode
  stats?: StatCell[]
  statsExpansion?: ReactNode
  /** The list could not be loaded — said instead of the list, never as an empty one. */
  failure?: EmptyStateProperties
  loading?: boolean
  empty?: EmptyStateProperties
  isEmpty?: boolean
  /** A filter or a search is on: the list keeps its table and says what it found, it is never "nothing yet". */
  narrowed?: boolean
  children: ReactNode
  /** Dialogs and sheets the screen owns. */
  surfaces?: ReactNode
  footnote?: ReactNode
  inspector?: boolean
  scrolling?: boolean
  browseLabel?: string
}

/** A listing: header, rail, toolbar, stats band, the table — and its loading, empty and failed states. */
export function ListScreen({ title, titleExtra, subtitle, actions, rail, toolbar, stats, statsExpansion, failure, loading = false, empty, isEmpty = false, narrowed = false, children, surfaces, footnote, inspector = true, scrolling = false, browseLabel = "Browse" }: ListScreenProperties) {
  useInspectorPresence(inspector)
  const location = useKitLocation()
  const [railOpen, setRailOpen] = useState(false)
  useEffect(() => {
    setRailOpen(false)
  }, [location.pathname, location.search])

  const railControl = rail === undefined ? null : <Button className="kit-list-screen-browse" icon="list" onClick={() => setRailOpen(true)}>{browseLabel}</Button>
  const counted = stats !== undefined && stats.length > 0
  const nothingYet = isEmpty && empty !== undefined && !narrowed
  const showStats = counted && failure === undefined && !nothingYet
  const shownStats: StatCell[] = !counted ? [] : loading ? stats.map((cell) => ({ label: cell.label, value: "—" })) : stats

  const body = (() => {
    if (failure !== undefined) {
      return (
        <div className="kit-bordered">
          <EmptyState tone="danger" flush {...failure} />
        </div>
      )
    }
    if (loading) {
      return <TableSkeleton />
    }
    if (nothingYet) {
      return (
        <div className="kit-bordered">
          <EmptyState flush {...empty} />
        </div>
      )
    }
    return children
  })()

  return (
    <ContentArea className="kit-list-screen">
      <PageHeader title={title} titleExtra={titleExtra} subtitle={subtitle} actions={railControl === null ? actions : <>{railControl}{actions}</>} />
      <div className="kit-list-screen-body">
        {rail}
        <section className="kit-list-screen-main">
          {toolbar}
          {showStats ? <StatsBand cells={shownStats} expansion={statsExpansion} /> : null}
          {scrolling ? <div className="kit-list-screen-scroll">{body}</div> : body}
          {footnote === undefined ? null : <p className="kit-micro-label">{footnote}</p>}
        </section>
      </div>
      {surfaces}
      {rail === undefined ? null : (
        <Dialog open={railOpen} onOpenChange={setRailOpen} title={browseLabel} flush>
          <RailPresentationContext.Provider value="sheet">{rail}</RailPresentationContext.Provider>
        </Dialog>
      )}
    </ContentArea>
  )
}

export interface DocumentScreenProperties {
  title: string
  titleExtra?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  stats?: StatCell[]
  tabs?: TabDefinition[]
  failure?: EmptyStateProperties
  loading?: boolean
  /** reading: 1100px · record: 1440px — dropped when an inspector or `fills` takes the width. */
  measure?: "reading" | "record"
  inspector?: boolean
  /** The body is one thing that takes the height — an editor, a canvas. */
  fills?: boolean
  children: ReactNode
}

/** A record or a document: header, stats, route tabs, the body — with its loading and failed states. */
export function DocumentScreen({ title, titleExtra, subtitle, actions, stats, tabs, failure, loading = false, measure = "reading", inspector = false, fills = false, children }: DocumentScreenProperties) {
  useInspectorPresence(inspector)
  const readable = failure === undefined
  return (
    <ContentArea variant={fills ? "fill" : "scroll"} className="kit-document-screen" >
      <div className="kit-document-screen-measure" data-measure={inspector || fills ? undefined : measure} data-fills={fills ? "" : undefined}>
        <PageHeader title={title} titleExtra={titleExtra} subtitle={subtitle} actions={actions} />
        {!readable || stats === undefined || stats.length === 0 ? null : <StatsBand cells={stats} />}
        {!readable || tabs === undefined || tabs.length === 0 ? null : <Tabs tabs={tabs} />}
        {failure !== undefined ? (
          <div className="kit-bordered">
            <EmptyState tone="danger" flush {...failure} />
          </div>
        ) : loading ? (
          <TableSkeleton rows={5} />
        ) : (
          <div className="kit-document-screen-body" data-fills={fills ? "" : undefined}>{children}</div>
        )}
      </div>
    </ContentArea>
  )
}

/* ===================== the station: a phone held in one hand ===================== */

export interface StationShellProperties {
  title: string
  leading?: ReactNode
  trailing?: ReactNode
  status?: ReactNode
  footer?: ReactNode
  tabs?: ReactNode
  /** An offer to install the station as an application — the product's own control (`@jmouse/pwa`). */
  install?: ReactNode
  children: ReactNode
}

/**
 * A station: the dark chassis bar at the top (it never turns white — it is what the installed application is known by),
 * the list scrolling without handing its overscroll to pull-to-refresh, an action footer and tabs in thumb reach, the
 * safe-area insets on whichever bar is last.
 */
export function StationShell({ title, leading, trailing, status, footer, tabs, install, children }: StationShellProperties) {
  const appearance = useOptionalAppearance()
  useEffect(() => {
    document.documentElement.dataset.surface = "station"
    return () => {
      delete document.documentElement.dataset.surface
    }
  }, [])
  return (
    <div className="kit-station">
      <header className="kit-station-bar" data-theme={appearance?.theme.name ?? "parallax"} data-mode="dark">
        <div className="kit-station-bar-row">
          {leading}
          <p>{title}</p>
          {trailing}
        </div>
        {status === undefined ? null : <div className="kit-station-status">{status}</div>}
      </header>
      {install}
      <main className="kit-station-main">{children}</main>
      {footer === undefined ? null : <div className="kit-station-footer" data-last={tabs === undefined ? "" : undefined}>{footer}</div>}
      {tabs === undefined ? null : <div className="kit-station-tabs">{tabs}</div>}
    </div>
  )
}

/** A station's row: the name and the controls are SEPARATE targets, each at least 44px — counting a drawer while walking. */
export function StationRow({ onOpen, to, children, trailing, className }: { onOpen?(): void; to?: string; children: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <li className={joinClassNames("kit-station-row", className)}>
      {to === undefined ? (
        <button type="button" onClick={onOpen} disabled={onOpen === undefined}>{children}</button>
      ) : (
        <KitLink to={to}>{children}</KitLink>
      )}
      {trailing === undefined ? null : <div className="kit-station-row-trailing">{trailing}</div>}
    </li>
  )
}

export function StationList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={joinClassNames("kit-station-list", className)}>{children}</ul>
}

export function StationSection({ label, hint, children }: { label?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="kit-station-section">
      {label === undefined ? null : (
        <div className="kit-station-section-head">
          <span className="kit-micro-label">{label}</span>
          {hint === undefined ? null : <span>{hint}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

export function StationNotice({ children }: { children: ReactNode }) {
  return <p className="kit-station-notice">{children}</p>
}

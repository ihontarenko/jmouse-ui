import { createContext, useContext, useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes, type HTMLAttributes, type ReactNode } from "react"
import { IconButton } from "../controls/Button"
import { AppearanceMenu } from "../appearance/AppearanceMenu"
import { useOptionalAppearance } from "../appearance/AppearanceProvider"
import { KitLink } from "../lib/links"
import { useShortcuts } from "../lib/shortcuts"
import { Breadcrumbs, type Crumb } from "../navigation/Crumbs"
import { Icon } from "../icons/Icon"
import type { IconSource } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"

interface ShellContextValue {
  railMode: "expanded" | "folded"
  toggleRailFold(): void
  railOpen: boolean
  setRailOpen(open: boolean): void
}

const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext)
  if (!context) {
    throw new Error("useShell() needs an <AppShell> above it.")
  }
  return context
}

export interface AppShellProperties {
  rail?: ReactNode
  topbar: ReactNode
  /** The column that explains the selection; under 1100px it moves below the page. */
  inspector?: ReactNode
  statusBar?: ReactNode
  /** Kept across visits under `<storagePrefix>.rail`. */
  storagePrefix?: string
  skipLinkLabel?: string
  children: ReactNode
}

function readRailMode(storagePrefix: string | undefined): "expanded" | "folded" {
  if (!storagePrefix) {
    return "expanded"
  }
  try {
    return window.localStorage.getItem(`${storagePrefix}.rail`) === "folded" ? "folded" : "expanded"
  } catch {
    return "expanded"
  }
}

/**
 * The application frame: rail · topbar · page · inspector · status bar. The page scrolls, never the document. Under
 * 760px the rail is a drawer opened from the topbar, closed by Escape, by the scrim, or by choosing a destination.
 */
export function AppShell({ rail, topbar, inspector, statusBar, storagePrefix, skipLinkLabel = "Skip to content", children }: AppShellProperties) {
  const [railMode, setRailMode] = useState(() => readRailMode(storagePrefix))
  const [railOpen, setRailOpen] = useState(false)

  useEffect(() => {
    if (!railOpen) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRailOpen(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [railOpen])

  const value = useMemo<ShellContextValue>(
    () => ({
      railMode,
      railOpen,
      setRailOpen,
      toggleRailFold() {
        setRailMode((current) => {
          const next = current === "expanded" ? "folded" : "expanded"
          if (storagePrefix) {
            try {
              window.localStorage.setItem(`${storagePrefix}.rail`, next)
            } catch {
              // Storage refused: the fold still holds for this page.
            }
          }
          return next
        })
      },
    }),
    [railMode, railOpen, storagePrefix],
  )

  return (
    <ShellContext.Provider value={value}>
      <a className="kit-skip-link" href="#kit-main">{skipLinkLabel}</a>
      <div
        className="kit-shell"
        data-rail={rail ? (railMode === "folded" ? "folded" : undefined) : "none"}
        data-rail-open={railOpen ? "" : undefined}
        onClick={(event) => {
          // The scrim is the shell's own ::after; a click that lands on the shell itself is a click on it.
          if (railOpen && event.target === event.currentTarget) {
            setRailOpen(false)
          }
        }}
      >
        {rail}
        <div className="kit-shell-column">
          {topbar}
          <div className="kit-shell-body">
            <main id="kit-main" className="kit-shell-main" tabIndex={-1}>{children}</main>
            {inspector && <div className="kit-shell-inspector">{inspector}</div>}
          </div>
          {statusBar}
        </div>
      </div>
    </ShellContext.Provider>
  )
}

export interface RailProperties {
  /** The product's mark and name; the brand links home. */
  brand: { mark: ReactNode; name: string; href?: string }
  label?: string
  /** At the rail's foot: the account, the settings. */
  footer?: ReactNode
  /**
   * A theme the rail always wears, whatever the page's — a dark chassis that never inverts. Any theme's name; the rail
   * derives its own accent inside it.
   */
  theme?: string
  children: ReactNode
}

export function Rail({ brand, label = "Main", footer, theme, children }: RailProperties) {
  return (
    <div className="kit-rail" data-theme={theme}>
      <a className="kit-rail-brand" href={brand.href ?? "/"} aria-label={brand.name}>
        <span className="kit-rail-mark" aria-hidden="true">{brand.mark}</span>
        <span className="kit-rail-wordmark">{brand.name}</span>
      </a>
      <nav className="kit-rail-navigation" aria-label={label}>{children}</nav>
      {footer && <div className="kit-rail-foot">{footer}</div>}
    </div>
  )
}

export function RailGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="kit-rail-group">
      {label && <span className="kit-rail-group-label kit-micro-label">{label}</span>}
      <ul>{children}</ul>
    </div>
  )
}

export interface NavItemProperties extends AnchorHTMLAttributes<HTMLAnchorElement> {
  icon: IconSource
  label: string
  count?: number
  current?: boolean
  /**
   * Renders the link — the product's router link — with the class, the current state and the content it must carry.
   * Without it a plain anchor is drawn.
   */
  renderLink?(link: { className: string; "aria-current": "page" | undefined; title: string; children: ReactNode; onClick(): void }): ReactNode
}

/** A destination in the rail. Choosing one closes the rail's drawer on a phone. */
export function NavItem({ icon, label, count, current, renderLink, className, onClick, ...rest }: NavItemProperties) {
  const shell = useContext(ShellContext)
  const content = (
    <>
      <Icon name={icon} />
      <span className="kit-navigation-item-label">{label}</span>
      {count !== undefined && <span className="kit-navigation-item-count">{count}</span>}
    </>
  )
  const closeDrawer = () => shell?.setRailOpen(false)
  const classNames = joinClassNames("kit-navigation-item", className)
  return (
    <li>
      {renderLink ? (
        renderLink({ className: classNames, "aria-current": current ? "page" : undefined, title: label, children: content, onClick: closeDrawer })
      ) : (
        <a
          className={classNames}
          aria-current={current ? "page" : undefined}
          title={label}
          onClick={(event) => {
            closeDrawer()
            onClick?.(event)
          }}
          {...rest}
        >
          {content}
        </a>
      )}
    </li>
  )
}

export interface TopbarProperties {
  /** The page's place — crumbs, a title. */
  start?: ReactNode
  /** Search, notifications, appearance, the account. */
  end?: ReactNode
  openNavigationLabel?: string
  foldNavigationLabel?: string
  /* ---- Innoventa's shape: given `crumbs`, the bar draws its own layout ---- */
  crumbs?: Crumb[]
  onOpenNavigation?(): void
  onOpenSearch?(): void
  onOpenHelp?(): void
  /** What needs the reader: a count and where it is listed. */
  attention?: { count: number; to: string }
  /** The product's own buttons, before the appearance menu — a scanner, a bug report. */
  actions?: ReactNode
  searchPlaceholder?: string
}

/**
 * The bar over the page. With `crumbs` (Innoventa's shape): the drawer button, the crumbs, the search — a field on a
 * desktop, a button on a phone — the attention count, the product's actions, the appearance menu and the keyboard
 * help, with their keys bound: `/` and Ctrl+K search, `?` help, Shift+T the mode, Shift+D the row height.
 */
export function Topbar(properties: TopbarProperties) {
  if (properties.crumbs !== undefined) {
    return <InnoventaTopbar {...properties} crumbs={properties.crumbs} />
  }
  return <KitTopbar {...properties} />
}

function InnoventaTopbar({ crumbs, onOpenNavigation, onOpenSearch, onOpenHelp, attention, actions, searchPlaceholder = "Item, part, location, project…", openNavigationLabel = "Open menu" }: TopbarProperties & { crumbs: Crumb[] }) {
  const appearance = useOptionalAppearance()
  const searchReference = useRef<HTMLButtonElement>(null)
  const openSearch = () => (onOpenSearch === undefined ? searchReference.current?.click() : onOpenSearch())
  useShortcuts([
    { key: "/", run: openSearch },
    { key: "k", control: true, whileTyping: true, run: openSearch },
    { key: "?", run: () => onOpenHelp?.() },
    { key: "t", shift: true, run: () => appearance?.change("mode", appearance.mode === "dark" ? "light" : "dark") },
    { key: "d", shift: true, run: () => appearance?.change("density", appearance.choice.density === "compact" ? "regular" : "compact") },
  ])
  return (
    <header className="kit-topbar">
      <IconButton className="kit-topbar-navigation" icon="menu" label={openNavigationLabel} onClick={onOpenNavigation} />
      <Breadcrumbs crumbs={crumbs} />
      <button ref={searchReference} type="button" className="kit-topbar-search" onClick={onOpenSearch} aria-label="Search">
        <Icon name="search" />
        <span>{searchPlaceholder}</span>
        <kbd>/</kbd>
      </button>
      <div className="kit-topbar-end">
        {actions}
        {attention === undefined ? null : (
          <KitLink to={attention.to} title="What needs you" className="kit-topbar-attention">
            <Icon name="warning" />
            <span>{attention.count}</span>
          </KitLink>
        )}
        {appearance && <AppearanceMenu />}
        {onOpenHelp && <IconButton className="kit-topbar-help" icon="command" label="Keyboard shortcuts" title="Keyboard (?)" onClick={onOpenHelp} />}
      </div>
    </header>
  )
}

function KitTopbar({ start, end, openNavigationLabel = "Open navigation", foldNavigationLabel = "Fold navigation" }: TopbarProperties) {
  const shell = useContext(ShellContext)
  return (
    <header className="kit-topbar">
      <div className="kit-topbar-start">
        {shell && (
          <>
            <IconButton className="kit-topbar-menu" icon="menu" label={openNavigationLabel} onClick={() => shell.setRailOpen(true)} />
            <IconButton className="kit-topbar-fold" icon="sidebar" label={foldNavigationLabel} pressed={shell.railMode === "folded"} onClick={shell.toggleRailFold} />
          </>
        )}
        {start}
      </div>
      {end && <div className="kit-topbar-end">{end}</div>}
    </header>
  )
}

export function StatusBar({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <footer className="kit-status-bar">
      <div className="kit-status-bar-start">{start}</div>
      <div className="kit-status-bar-end">{end}</div>
    </footer>
  )
}

export interface StatusItemProperties extends HTMLAttributes<HTMLElement> {
  icon?: IconSource
  /** Given, the item is a button. */
  onActivate?(): void
}

export function StatusItem({ icon, onActivate, className, children, ...rest }: StatusItemProperties) {
  const content = (
    <>
      {icon && <Icon name={icon} />}
      {children}
    </>
  )
  if (onActivate) {
    return (
      <button type="button" className={joinClassNames("kit-status-item", className)} onClick={onActivate} {...rest}>
        {content}
      </button>
    )
  }
  return (
    <span className={joinClassNames("kit-status-item", className)} {...rest}>
      {content}
    </span>
  )
}

export interface PageProperties extends HTMLAttributes<HTMLDivElement> {
  /** document: a readable column · workbench: fills the height, a table or a canvas scrolls inside · narrow: a form. */
  layout?: "document" | "workbench" | "narrow"
}

export function Page({ layout = "document", className, ...rest }: PageProperties) {
  return <div className={joinClassNames("kit-page", className)} data-layout={layout === "document" ? undefined : layout} {...rest} />
}

/** Inside a workbench page: the part that takes the remaining height. */
export function PageFill({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClassNames("kit-page-fill", className)} {...rest} />
}

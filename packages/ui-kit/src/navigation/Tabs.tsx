import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react"
import { Icon, type IconSource } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"
import { KitLink, useKitLocation } from "../lib/links"

export interface TabItem<Value extends string = string> {
  value: Value
  label: ReactNode
  count?: number
  disabled?: boolean
}

/** A tab that is an address — Innoventa's shape: the open one is the one whose address the reader is at. */
export interface TabDefinition {
  key: string
  label: string
  to: string
  icon?: IconSource
  /** Shown when above zero; a nought is an absence, and the tab's own empty state says it better than a digit. */
  count?: number
}

export interface SwitchingTabsProperties<Value extends string> {
  /** Shared with the {@link TabPanel}s: a tab's panel is found by it. */
  id: string
  label: string
  items: TabItem<Value>[]
  value: Value
  onValueChange(value: Value): void
  /** line: a page's sections, underlined · strip: a compact switch inside a toolbar or a bench. */
  variant?: "line" | "strip"
  className?: string
  tabs?: undefined
}

export interface RouteTabsProperties {
  tabs: TabDefinition[]
  label?: string
  className?: string
  items?: undefined
}

export type TabsProperties<Value extends string> = SwitchingTabsProperties<Value> | RouteTabsProperties

function tabIdOf(id: string, value: string) {
  return `${id}-tab-${value}`
}

function panelIdOf(id: string, value: string) {
  return `${id}-panel-${value}`
}

/**
 * Tabs, in two kinds:
 *
 * - `items` — content switching inside one page: the WAI-ARIA tabs pattern with automatic activation, arrow keys move
 *   and select, Home and End jump, one tab stop. Pair each with a {@link TabPanel}.
 * - `tabs` — Innoventa's addresses: a nav of links through the product's router, the open one found from the location
 *   (path and query both, so `?view=list` and `?view=tiles` are two tabs).
 */
export function Tabs<Value extends string>(properties: TabsProperties<Value>) {
  if (properties.tabs) {
    return <RouteTabs {...properties} />
  }
  return <SwitchingTabs {...properties} />
}

function RouteTabs({ tabs, label = "Tabs", className }: RouteTabsProperties) {
  const location = useKitLocation()
  const matches = (candidate: string) => {
    const [path, query = ""] = candidate.split("?")
    return path === location.pathname && `?${query}` === (location.search || "?")
  }
  const activeKey = tabs.find((tab) => matches(tab.to))?.key ?? tabs.find((tab) => !tab.to.includes("?") && tab.to === location.pathname)?.key
  return (
    <nav aria-label={label} className={joinClassNames("kit-tabs", className)}>
      {tabs.map((tab) => {
        const open = tab.key === activeKey
        return (
          <KitLink key={tab.key} to={tab.to} className="kit-tab" aria-current={open ? "page" : undefined}>
            {tab.icon && <Icon name={tab.icon} size="small" />}
            {tab.label}
            {tab.count === undefined || tab.count === 0 ? null : <span className="kit-tab-count" data-chip="">{tab.count}</span>}
          </KitLink>
        )
      })}
    </nav>
  )
}

function SwitchingTabs<Value extends string>({ id, label, items, value, onValueChange, variant = "line", className }: SwitchingTabsProperties<Value>) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.filter((item) => !item.disabled)
    const index = enabled.findIndex((item) => item.value === value)
    let next: TabItem<Value> | undefined
    if (event.key === "ArrowRight") {
      next = enabled[(index + 1) % enabled.length]
    } else if (event.key === "ArrowLeft") {
      next = enabled[(index - 1 + enabled.length) % enabled.length]
    } else if (event.key === "Home") {
      next = enabled[0]
    } else if (event.key === "End") {
      next = enabled[enabled.length - 1]
    }
    if (next) {
      event.preventDefault()
      onValueChange(next.value)
      document.getElementById(tabIdOf(id, next.value))?.focus()
    }
  }

  return (
    <div role="tablist" aria-label={label} className={joinClassNames("kit-tabs", className)} data-variant={variant === "line" ? undefined : variant} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            id={tabIdOf(id, item.value)}
            type="button"
            role="tab"
            className="kit-tab"
            aria-selected={selected}
            aria-controls={panelIdOf(id, item.value)}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
            {item.count !== undefined && <span className="kit-tab-count">{item.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export interface TabPanelProperties extends HTMLAttributes<HTMLDivElement> {
  /** The id given to the {@link Tabs}. */
  tabsId: string
  value: string
  /** The tabs' current value; the panel renders only when it is its own. */
  selected: string
}

export function TabPanel({ tabsId, value, selected, className, children, ...rest }: TabPanelProperties) {
  if (value !== selected) {
    return null
  }
  return (
    <div role="tabpanel" id={panelIdOf(tabsId, value)} aria-labelledby={tabIdOf(tabsId, value)} tabIndex={0} className={joinClassNames("kit-tab-panel", className)} {...rest}>
      {children}
    </div>
  )
}

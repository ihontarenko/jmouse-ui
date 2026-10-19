import { createContext, useContext, type ReactNode } from "react"
import { Count } from "../controls/Text"
import { Icon, type IconSource } from "../icons/Icon"
import { KitLink } from "../lib/links"
import { typeHueStyle } from "../lib/typeHue"

/*
 * The rail beside a listing, whose rows are LINKS that narrow it — Innoventa's `FacetRail.tsx`, same names and
 * properties. Each facet is an address, so a narrowed listing can be bookmarked, shared and gone back to.
 */

export interface FacetLink {
  label: string
  to: string
  /** Undefined is "not counted"; zero is "none" — only a KNOWN zero dims the row. */
  count?: number
  /** Words in place of a count. */
  note?: string
  icon?: IconSource
  active?: boolean
  /** A kind's identifier: the row's dot wears its hue. */
  kind?: string
  /** The "everything" row — never dimmed. */
  all?: boolean
  /** Indented one step — a child of the row above. */
  depth?: number
}

export interface FacetGroupProperties {
  label?: string
  total?: number
  links: FacetLink[]
  /** The group takes the rail's remaining height and scrolls inside it. */
  scrolls?: boolean
  /** A filter over the group's own rows, for a long list of kinds. */
  search?: { value: string; onChange(value: string): void; label: string; placeholder?: string }
  nothingFound?: string
}

/** One titled group of facet links; the title stays overhead while the group scrolls. */
export function FacetGroup({ label, total, links, scrolls = false, search, nothingFound = "Nothing matches that." }: FacetGroupProperties) {
  return (
    <div className="kit-facet-group" data-scrolls={scrolls ? "" : undefined}>
      <div>
        {label === undefined ? null : (
          <div className="kit-facet-group-head">
            <span className="kit-micro-label">{label}</span>
            {total === undefined ? null : <Count>{total}</Count>}
          </div>
        )}
        {search === undefined ? null : (
          <div className="kit-facet-group-search">
            <input type="search" className="kit-input" data-size="small" aria-label={search.label} placeholder={search.placeholder ?? "Filter the filters…"} value={search.value} onChange={(event) => search.onChange(event.target.value)} />
          </div>
        )}
      </div>
      <div className="kit-facet-group-links">
        {links.length === 0 && search !== undefined && search.value.trim() !== "" ? <p className="kit-facet-nothing">{nothingFound}</p> : null}
        {links.map((link) => (
          <KitLink
            key={link.to + link.label}
            to={link.to}
            className="kit-facet-link"
            aria-current={link.active ? "true" : undefined}
            data-empty={!link.all && link.count === 0 ? "" : undefined}
            data-depth={link.depth ? "" : undefined}
            style={link.kind === undefined ? undefined : typeHueStyle(link.kind)}
          >
            {link.icon === undefined ? <span className="kit-facet-dot" data-kind={link.kind === undefined ? undefined : ""} aria-hidden="true" /> : <Icon name={link.icon} size="small" />}
            <span className="kit-facet-link-label">{link.label}</span>
            <Count>{link.count ?? link.note ?? ""}</Count>
          </KitLink>
        ))}
      </div>
    </div>
  )
}

export function FacetDivider() {
  return <hr className="kit-facet-divider" />
}

/** Where the rail is drawn: beside the listing, or inside a sheet on a narrow screen (the listing screen decides). */
export const RailPresentationContext = createContext<"aside" | "sheet">("aside")

/** The rail itself: a bordered column beside the listing, or the content of a sheet under 1024px. */
export function FacetRail({ children, wide = false, split = false, label = "Facets" }: { children: ReactNode; wide?: boolean; split?: boolean; label?: string }) {
  const presentation = useContext(RailPresentationContext)
  return (
    <aside aria-label={label} className="kit-facet-rail" data-presentation={presentation} data-wide={wide ? "" : undefined} data-split={split ? "" : undefined}>
      {children}
    </aside>
  )
}

export interface FilterRailItem {
  key: string
  /** A character before the label — a unit's symbol, a status mark. */
  glyph?: string
  label: string
  count?: number
  to: string
  active?: boolean
  /** Starts a group with this heading (hidden while searching). */
  dividerLabel?: string
}

export interface FilterRailProperties {
  items: FilterRailItem[]
  all: { label: string; to: string; count: number; active: boolean }
  search?: string
  onSearch?(value: string): void
  searchPlaceholder?: string
  searchLabel?: string
  nothingFound?: string
}

/** A flat rail of filters with an "all" row first and optional headings between groups, searchable. */
export function FilterRail({ items, all, search, onSearch, searchPlaceholder = "Filter the filters…", searchLabel = "Filter the filters", nothingFound = "No filter answers to that." }: FilterRailProperties) {
  const needle = (search ?? "").trim().toLowerCase()
  const shown = needle === "" ? items : items.filter((item) => item.label.toLowerCase().includes(needle))
  return (
    <div className="kit-filter-rail-links">
      {onSearch === undefined ? null : (
        <div className="kit-facet-group-search" data-ruled="">
          <input type="search" className="kit-input" data-size="small" aria-label={searchLabel} placeholder={searchPlaceholder} value={search ?? ""} onChange={(event) => onSearch(event.target.value)} />
        </div>
      )}
      <FilterRailRow glyph="▣" label={all.label} count={all.count} to={all.to} active={all.active} emphasised />
      {shown.map((item, index) => (
        <div key={item.key} className="kit-filter-rail-entry">
          {needle === "" && item.dividerLabel !== undefined && index > 0 ? <hr className="kit-facet-divider" /> : null}
          {needle === "" && item.dividerLabel !== undefined ? <span className="kit-facet-heading kit-micro-label">{item.dividerLabel}</span> : null}
          <FilterRailRow glyph={item.glyph} label={item.label} count={item.count} to={item.to} active={item.active} />
        </div>
      ))}
      {shown.length === 0 ? <p className="kit-facet-nothing">{nothingFound}</p> : null}
    </div>
  )
}

function FilterRailRow({ glyph, label, count, to, active = false, emphasised = false }: { glyph?: string; label: string; count?: number; to: string; active?: boolean; emphasised?: boolean }) {
  return (
    <KitLink to={to} className="kit-facet-link" data-glyph="" aria-current={active ? "true" : undefined} data-empty={!emphasised && count === 0 ? "" : undefined}>
      <span className="kit-facet-glyph" aria-hidden="true">{glyph ?? "·"}</span>
      <span className="kit-facet-link-label">{label}</span>
      <Count>{count ?? ""}</Count>
    </KitLink>
  )
}


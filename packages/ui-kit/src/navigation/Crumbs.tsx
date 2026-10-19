import type { ReactNode } from "react"
import { KitLink } from "../lib/links"
import { RowMenu } from "./Menu"

export interface Crumb {
  label: ReactNode
  /** A route through the product's router (`LinkProvider`) — Innoventa's shape. */
  to?: string
  /** An address; a plain link. */
  href?: string
  onNavigate?(): void
}

export interface CrumbsProperties {
  items: Crumb[]
  label?: string
  /**
   * Renders a crumb's link — when a crumb needs more than `to` gives. Receives the crumb and the class it must wear.
   */
  renderLink?(crumb: Crumb, className: string): ReactNode
  /** The phone's "go up" menu's name. */
  upLabel?: string
}

function CrumbLink({ crumb, renderLink }: { crumb: Crumb; renderLink?: CrumbsProperties["renderLink"] }) {
  if (renderLink) {
    return <>{renderLink(crumb, "kit-crumb")}</>
  }
  if (crumb.to !== undefined) {
    return <KitLink to={crumb.to} className="kit-crumb">{crumb.label}</KitLink>
  }
  return (
    <a
      className="kit-crumb"
      href={crumb.href}
      onClick={crumb.onNavigate ? (event) => {
        event.preventDefault()
        crumb.onNavigate?.()
      } : undefined}
    >
      {crumb.label}
    </a>
  )
}

/**
 * Where the page sits: each ancestor a link, the page itself marked as current. ⚠️ On a phone only the last crumb is
 * drawn — three crumbs sharing eighty pixels truncate each other to nothing — and the way back up is a menu before it.
 */
export function Crumbs({ items, label = "Breadcrumb", renderLink, upLabel = "Go up — where this screen sits" }: CrumbsProperties) {
  const ancestors = items.slice(0, -1).filter((crumb) => crumb.to !== undefined)
  return (
    <nav className="kit-crumbs" aria-label={label}>
      {ancestors.length > 0 && (
        <span className="kit-crumbs-up">
          <RowMenu label={upLabel} items={ancestors.map((crumb) => ({ label: String(crumb.label), to: crumb.to, icon: "chevron-up" }))} />
        </span>
      )}
      <ol>
        {items.map((crumb, index) => {
          const last = index === items.length - 1
          return (
            <li key={index} data-last={last ? "" : undefined}>
              {last ? <span aria-current="page">{crumb.label}</span> : <CrumbLink crumb={crumb} renderLink={renderLink} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Innoventa's name and shape: `crumbs` with `to`. */
export function Breadcrumbs({ crumbs, label }: { crumbs: Crumb[]; label?: string }) {
  return <Crumbs items={crumbs} label={label} />
}

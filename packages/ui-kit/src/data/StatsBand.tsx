import type { ReactNode } from "react"
import { joinClassNames } from "../lib/classNames"
import { KitLink } from "../lib/links"
import { Meter } from "./Meter"

export interface StatCell {
  label: string
  value?: string | number
  /** Under the figure: why it is what it is — two lines at most, wrapping rather than truncating. */
  caption?: string
  /** A proportion instead of a figure. */
  meter?: { value: number; total: number; caption: string; tone?: "ok" | "good" | "warn" | "danger" | "accent" }
  tone?: "neutral" | "ok" | "good" | "warn" | "danger" | "accent"
  /** The cell is a link to the listing it counts. */
  to?: string
  /** The cell opens something under the band — `expansion`. */
  onPress?(): void
  pressed?: boolean
}

export interface StatsBandProperties {
  cells: StatCell[]
  /** What a pressed cell opened, drawn under the band. */
  expansion?: ReactNode
  className?: string
}

/**
 * A page's key figures as ONE bordered band — never floating metric cards (Innoventa's `StatsBand`). A row on a wide
 * screen, three columns under 860px, two under 560px; the dividers are the gap, so every arrangement draws the same
 * lines. A figure is never truncated: it is the one thing the band exists to show.
 */
export function StatsBand({ cells, expansion, className }: StatsBandProperties) {
  return (
    <div className={joinClassNames("kit-stats-band", className)}>
      <div className="kit-stats-band-cells" data-count={cells.length}>
        {cells.map((cell) => {
          if (cell.meter !== undefined) {
            return (
              <div key={cell.label} className="kit-stat" data-meter="">
                <Meter value={cell.meter.value} total={cell.meter.total} tone={cell.meter.tone} caption={{ label: cell.label, value: cell.meter.caption }} />
              </div>
            )
          }
          const inner = (
            <>
              <b className="kit-stat-value" data-tone={cell.tone === "ok" ? "good" : cell.tone}>{cell.value}</b>
              <span className="kit-micro-label">{cell.label}</span>
              {cell.caption === undefined ? null : <span className="kit-stat-caption" title={cell.caption}>{cell.caption}</span>}
            </>
          )
          if (cell.to !== undefined) {
            return <KitLink key={cell.label} to={cell.to} className="kit-stat" data-interactive="" aria-pressed={cell.pressed}>{inner}</KitLink>
          }
          if (cell.onPress !== undefined) {
            return <button key={cell.label} type="button" className="kit-stat" data-interactive="" aria-expanded={cell.pressed} onClick={cell.onPress}>{inner}</button>
          }
          return <div key={cell.label} className="kit-stat">{inner}</div>
        })}
      </div>
      {expansion === undefined || expansion === null ? null : <div className="kit-stats-band-expansion">{expansion}</div>}
    </div>
  )
}

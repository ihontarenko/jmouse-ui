import type { ReactNode } from "react"
import { Count } from "../controls/Text"
import { joinClassNames } from "../lib/classNames"

/*
 * A bench: a rail of things on the left, the chosen one worked on at the right, inside one bordered box of fixed height
 * — Innoventa's `Workbench.tsx`, same names and properties. Under 1024px the rail sits over the viewport.
 */

export function Workbench({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={joinClassNames("kit-workbench", className)}>{children}</div>
}

/** The rail: a fixed head row (its height never depends on what it is given) and a list that scrolls. */
export function WorkbenchRail({ label, head, children }: { label: string; head?: ReactNode; children: ReactNode }) {
  return (
    <nav aria-label={label} className="kit-workbench-rail">
      {head === undefined ? null : <div className="kit-workbench-rail-head">{head}</div>}
      <div className="kit-workbench-rail-list">{children}</div>
    </nav>
  )
}

export function WorkbenchGroup({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="kit-workbench-group">
      <h3 className="kit-micro-label">
        {title}
        {count === undefined ? null : <Count>{count}</Count>}
      </h3>
      {children}
    </section>
  )
}

export interface WorkbenchItemProperties {
  selected?: boolean
  onSelect(): void
  lead?: ReactNode
  title: string
  note?: ReactNode
  side?: ReactNode
}

export function WorkbenchItem({ selected = false, onSelect, lead, title, note, side }: WorkbenchItemProperties) {
  return (
    <button type="button" className="kit-workbench-item" onClick={onSelect} aria-current={selected ? "true" : undefined} title={title}>
      {lead === undefined ? null : <span className="kit-workbench-item-lead">{lead}</span>}
      <span className="kit-workbench-item-text">
        <span className="kit-workbench-item-title">{title}</span>
        {note === undefined ? null : <span className="kit-workbench-item-note">{note}</span>}
      </span>
      {side === undefined ? null : <span className="kit-workbench-item-side">{side}</span>}
    </button>
  )
}

export interface WorkbenchViewportProperties {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  /** The body scrolls; otherwise it clips — a canvas, a viewer, an editor that manages its own scroll. */
  scroll?: boolean
  children: ReactNode
}

export function WorkbenchViewport({ title, meta, actions, scroll = false, children }: WorkbenchViewportProperties) {
  return (
    <div className="kit-workbench-viewport">
      <header>
        <span className="kit-workbench-viewport-title">
          <span>{title}</span>
          {meta === undefined ? null : <span className="kit-workbench-viewport-meta">{meta}</span>}
        </span>
        {actions === undefined ? null : <span className="kit-panel-actions">{actions}</span>}
      </header>
      <div className="kit-workbench-viewport-body" data-scroll={scroll ? "" : undefined}>{children}</div>
    </div>
  )
}

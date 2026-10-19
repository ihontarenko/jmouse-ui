import type { DragEvent, ReactNode } from "react"
import { Count } from "../controls/Text"
import { joinClassNames } from "../lib/classNames"
import { KitLink } from "../lib/links"

/*
 * A record's page, a grid of tiles, a list of settings — Innoventa's `RecordColumns.tsx`, `TileGrid.tsx` and
 * `SettingList.tsx`, with the same names and properties.
 */

/* ===================== a record's page: the record, and what it is attached to ===================== */

/** The record on the left, what it is attached to in a 340px column on the right; one column under 1280px. */
export function RecordColumns({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={joinClassNames("kit-record-columns", className)}>{children}</div>
}

/** The record itself: one bordered surface with its sections inside. */
export function RecordMain({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={joinClassNames("kit-record-main", className)}>{children}</div>
}

/** What the record is attached to: a column of {@link AsideBlock}s. */
export function RecordAside({ children, className, label = "What this record is attached to" }: { children: ReactNode; className?: string; label?: string }) {
  return <aside aria-label={label} className={joinClassNames("kit-record-aside", className)}>{children}</aside>
}

/** One attachment: its title, a count or a link to the tab that lists it all, and a few lines of it. */
export function AsideBlock({ title, count, to, linkLabel = "Open", children }: { title: string; count?: number; to?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="kit-aside-block">
      <header>
        <span className="kit-micro-label">{title}</span>
        {to !== undefined ? (
          <KitLink to={to} className="kit-aside-block-link">
            {linkLabel}
            {count === undefined ? "" : ` · ${count}`}
          </KitLink>
        ) : count === undefined ? null : (
          <Count>{count}</Count>
        )}
      </header>
      <div className="kit-aside-block-body">{children}</div>
    </section>
  )
}

/** A section's head inside a record: a micro-label title and what goes beside it. */
export function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="kit-section-head-micro">
      <h2 className="kit-micro-label">{title}</h2>
      {children}
    </div>
  )
}

/** A small empty place inside a record — dashed, quiet, a title and a sentence. */
export function QuietEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="kit-quiet-empty">
      <b>{title}</b>
      {children}
    </div>
  )
}

/** One line of an attachment: a name, and a figure at the end. */
export function PairRow({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <div className="kit-pair-row">
      <span className="kit-pair-name">{children}</span>
      {side === undefined ? null : <span className="kit-pair-side">{side}</span>}
    </div>
  )
}

/* ===================== tiles: files and folders as a grid ===================== */

/** The grid tiles sit in: as many columns as fit, each at least 142px. */
export function TileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={joinClassNames("kit-tile-grid", className)}>{children}</div>
}

function suffixOf(name: string): string {
  return /\.[A-Za-z0-9_]{1,12}$/.exec(name)?.[0] ?? ""
}

function stemOf(name: string): string {
  return name.slice(0, name.length - suffixOf(name).length)
}

export interface TileProperties {
  /** The drawing — a folder, a thumbnail — in a band of fixed height, so every name sits on one baseline. */
  glyph: ReactNode
  name: string
  meta?: ReactNode
  /** A click: choose it. */
  onOpen(): void
  /** A double click or Enter: open it. */
  onActivate?(): void
  active?: boolean
  /** Floated over the drawing, shown on hover and focus — and always on a touch screen. */
  actions?: ReactNode
  /** Something is being dragged over it and would land here. */
  targeted?: boolean
  onDragOver?(event: DragEvent): void
  onDragLeave?(): void
  onDrop?(event: DragEvent): void
  onDragStart?(event: DragEvent): void
  draggable?: boolean
  className?: string
}

/**
 * One file or folder as a tile. The name takes two lines then an ellipsis, and its SUFFIX never comes apart — the stem
 * may break anywhere, `.step` travels whole.
 */
export function Tile({ glyph, name, meta, onOpen, onActivate, active = false, actions, targeted = false, onDragOver, onDragLeave, onDrop, onDragStart, draggable = false, className }: TileProperties) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={joinClassNames("kit-tile", className)}
      data-active={active ? "" : undefined}
      data-targeted={targeted ? "" : undefined}
    >
      <button
        type="button"
        title={name}
        onClick={onOpen}
        onDoubleClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onActivate !== undefined) {
            event.preventDefault()
            onActivate()
          }
        }}
      >
        <span className="kit-tile-glyph">{glyph}</span>
        <span className="kit-tile-name">
          {stemOf(name)}
          <span className="kit-tile-suffix">{suffixOf(name)}</span>
        </span>
        {meta === undefined ? null : <span className="kit-tile-meta">{meta}</span>}
      </button>
      {actions === undefined ? null : <div className="kit-tile-actions">{actions}</div>}
    </div>
  )
}

/** The drag type a tile's file carries, so a drop target can tell a moved file from a dropped one. */
export const FILE_DRAG_TYPE = "application/x-jmui-file-id"

/* ===================== settings: rows of one setting each ===================== */

/** A bordered list of settings, one {@link SettingRow} each. */
export function SettingList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={joinClassNames("kit-setting-list", className)}>{children}</div>
}

export interface SettingRowProperties {
  title: ReactNode
  hint?: ReactNode
  /** Before the words: an icon, a mark. */
  leading?: ReactNode
  /** After them: the control. */
  trailing?: ReactNode
  /** The setting does not apply now. */
  muted?: boolean
  className?: string
}

/** One setting: what it is, what it does, and its control at the end. */
export function SettingRow({ title, hint, leading, trailing, muted = false, className }: SettingRowProperties) {
  return (
    <div className={joinClassNames("kit-setting-row", className)} data-muted={muted ? "" : undefined}>
      {leading === undefined ? null : <span className="kit-setting-leading">{leading}</span>}
      <span className="kit-setting-text">
        <span className="kit-setting-title">{title}</span>
        {hint === undefined ? null : <span className="kit-setting-hint">{hint}</span>}
      </span>
      {trailing === undefined ? null : <span className="kit-setting-trailing">{trailing}</span>}
    </div>
  )
}

/** A labelled group of setting lists, with a tally at its end. */
export function SettingGroup({ label, hint, tally, children }: { label: string; hint?: ReactNode; tally?: ReactNode; children: ReactNode }) {
  return (
    <div className="kit-setting-group">
      <div className="kit-setting-group-head">
        <span className="kit-micro-label">{label}</span>
        {hint === undefined ? null : <span className="kit-setting-group-hint">{hint}</span>}
        {tally === undefined ? null : <span className="kit-setting-group-tally">{tally}</span>}
      </div>
      {children}
    </div>
  )
}

import type { KeyboardEvent, ReactNode } from "react"
import { Icon } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"

export type SortDirection = "ascending" | "descending"

export interface TableSort {
  key: string
  direction: SortDirection
}

export interface TableColumn<Row> {
  key: string
  header: ReactNode
  cell(row: Row): ReactNode
  align?: "start" | "center" | "end"
  /** The data face with tabular figures — numbers, identifiers, dates. */
  technical?: boolean
  /** As narrow as its content: a status, an action. */
  shrink?: boolean
  /** One line with an ellipsis; the column takes the room that is left. */
  truncate?: boolean
  sortable?: boolean
  /** The header's words for assistive technology when the visible header is an icon or empty. */
  headerLabel?: string
}

export interface TableProperties<Row> {
  label: string
  columns: TableColumn<Row>[]
  rows: Row[]
  rowKey(row: Row): string
  sort?: TableSort
  onSortChange?(sort: TableSort): void
  /** Given, rows are selectable: a click, Enter or Space selects; the arrow keys move between rows. */
  onRowSelect?(row: Row): void
  /** Double click or Enter opens a selected record; Space continues to select. */
  onRowActivate?(row: Row): void
  selectedKey?: string
  density?: "regular" | "compact"
  /** Shown in place of the rows when there are none — say why, and what to do. */
  empty?: ReactNode
  className?: string
}

function nextSort(current: TableSort | undefined, key: string): TableSort {
  if (current?.key === key) {
    return { key, direction: current.direction === "ascending" ? "descending" : "ascending" }
  }
  return { key, direction: "ascending" }
}

/**
 * A dense data table: a sticky head in the data face, fixed row heights, sortable columns that announce their order,
 * and a selected row marked by the band inside it. The table scrolls inside its own box; put it where the page gives
 * it the height.
 */
export function Table<Row>({ label, columns, rows, rowKey, sort, onSortChange, onRowSelect, onRowActivate, selectedKey, density = "regular", empty, className }: TableProperties<Row>) {
  const selectable = Boolean(onRowSelect)

  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: Row) {
    if (event.target !== event.currentTarget) {
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (event.key === "Enter" && onRowActivate) {
        onRowActivate(row)
      } else {
        onRowSelect?.(row)
      }
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const sibling = event.key === "ArrowDown" ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling
      ;(sibling as HTMLElement | null)?.focus()
    }
  }

  return (
    <div className={joinClassNames("kit-table-scroll", className)}>
      <table className="kit-table" aria-label={label} role={selectable ? "grid" : undefined} data-density={density === "regular" ? undefined : density}>
        <thead>
          <tr>
            {columns.map((column) => {
              const sorted = sort?.key === column.key ? sort.direction : column.sortable ? "none" : undefined
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sorted}
                  aria-label={column.headerLabel}
                  data-align={column.align === "start" ? undefined : column.align}
                  data-shrink={column.shrink ? "" : undefined}
                >
                  {column.sortable && onSortChange ? (
                    <button type="button" className="kit-table-sort" onClick={() => onSortChange(nextSort(sort, column.key))}>
                      {column.header}
                      <Icon name="arrow-up" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr className="kit-table-empty">
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const key = rowKey(row)
              const selected = key === selectedKey
              return (
                <tr
                  key={key}
                  aria-selected={selectable ? selected : undefined}
                  tabIndex={selectable ? (selected || (!selectedKey && index === 0) ? 0 : -1) : undefined}
                  data-interactive={selectable ? "" : undefined}
                  onClick={selectable ? () => onRowSelect?.(row) : undefined}
                  onDoubleClick={onRowActivate ? () => onRowActivate(row) : undefined}
                  onKeyDown={selectable ? (event) => onRowKeyDown(event, row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      data-align={column.align === "start" ? undefined : column.align}
                      data-technical={column.technical ? "" : undefined}
                      data-shrink={column.shrink ? "" : undefined}
                      data-truncate={column.truncate ? "" : undefined}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export interface IdentityProperties {
  name: ReactNode
  sub?: ReactNode
  /**
   * Which line is in the data face. The two lines are always in different faces, so they are told apart before either
   * is read: "name" for a part number or a path, "sub" for a person or a place whose identifier sits under it.
   */
  technical?: "name" | "sub"
}

/** A row's identity: its name, and the line under it. */
export function Identity({ name, sub, technical = "name" }: IdentityProperties) {
  return (
    <span className="kit-identity" data-technical={technical}>
      <span className="kit-identity-name">{name}</span>
      {sub && <span className="kit-identity-sub">{sub}</span>}
    </span>
  )
}

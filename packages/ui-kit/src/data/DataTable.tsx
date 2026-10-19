import { Fragment, useCallback, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Checkbox } from "../controls/Choices"
import { EmptyState, type EmptyStateProperties } from "../feedback/Feedback"
import { joinClassNames } from "../lib/classNames"
import { useKitNavigate } from "../lib/links"
import { Menu } from "../navigation/Menu"

/*
 * Innoventa's listing table (`DataTable.tsx`), same names and properties: the table a listing screen is. The kit's
 * own `Table` is the controlled primitive; this one owns its sort, its keyboard walk, its ticks and its phone form.
 */

export interface Column<Row> {
  key: string
  label: string
  render?(row: Row): ReactNode
  /** What the column sorts by when the cell is not a plain value. */
  sortValue?(row: Row): string | number | null | undefined
  /** "number" right-aligns it in the data face. */
  align?: "text" | "number"
  /** Left out, the column sorts. */
  sortable?: boolean
  width?: string
  /** Drawn only on a wide screen (≥1024px); still orderable. */
  optional?: boolean
  /** The heading is for assistive technology only — a column of row menus. */
  labelHidden?: boolean
}

export interface DataTableProperties<Row> {
  rows: Row[]
  columns: Column<Row>[]
  rowId(row: Row): string
  /** Where Enter and a double click take a row. */
  rowHref?(row: Row): string | undefined
  rowClassName?(row: Row): string | undefined
  ariaLabel: string
  /** A row became the active one (Space, a click, the arrow keys) — the inspector follows it. */
  onSelect?(row: Row | undefined): void
  /** Tick boxes, and the bulk bar once something is ticked. */
  selectable?: boolean
  bulkActions?(selectedIds: string[]): ReactNode
  initialSort?: { key: string; direction: "asc" | "desc" }
  /** Rows answering true are kept on top whatever the sort — a stable partition. */
  sortsFirst?(row: Row): boolean
  /** Rows grouped under headings; a row with no group goes last, under "—". */
  groupBy?(row: Row): string | null
  empty?: EmptyStateProperties
  className?: string
  labels?: Partial<Record<"selected" | "clearSelection" | "selectAll" | "selectRow" | "sortedBy" | "nothing" | "record" | "records" | "move" | "open" | "tick", string>>
}

const UNGROUPED = "—"

function groupOf(value: string | null): string {
  return value === null || value.trim() === "" ? UNGROUPED : value.trim()
}

export function DataTable<Row>({ rows, columns, rowId, rowHref, rowClassName, ariaLabel, onSelect, selectable = false, bulkActions, initialSort, sortsFirst, groupBy, empty, className, labels = {} }: DataTableProperties<Row>) {
  const text = { selected: "selected", clearSelection: "Clear selection", selectAll: "Select all visible", selectRow: "Select row", sortedBy: "Sorted by", nothing: "Nothing", record: "record", records: "records", move: "↑↓ move", open: "Enter open", tick: "X tick", ...labels }
  const navigate = useKitNavigate()
  const bodyReference = useRef<HTMLTableSectionElement>(null)
  const [sort, setSort] = useState(initialSort)
  const [activeId, setActiveId] = useState<string | undefined>(undefined)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // The column that carries the row's name: the first text column with no fixed width.
  const primaryColumnKey = columns.find((column) => column.align !== "number" && column.width === undefined)?.key

  const sortedRows = useMemo(() => {
    const column = sort === undefined ? undefined : columns.find((candidate) => candidate.key === sort.key)
    if (column === undefined && sortsFirst === undefined && groupBy === undefined) {
      return rows
    }
    const compareWithin =
      column === undefined || sort === undefined
        ? () => 0
        : (left: Row, right: Row) => {
            const valueOf = column.sortValue ?? ((row: Row) => (row as Record<string, never>)[column.key])
            const direction = sort.direction === "asc" ? 1 : -1
            const leftValue = valueOf(left) ?? ""
            const rightValue = valueOf(right) ?? ""
            if (typeof leftValue === "number" && typeof rightValue === "number") {
              return (leftValue - rightValue) * direction
            }
            return String(leftValue).localeCompare(String(rightValue)) * direction
          }
    // ⚠️ Array sort is stable, so with no column chosen `sortsFirst` is a partition, not a shuffle.
    return [...rows].sort((left, right) => {
      if (sortsFirst !== undefined) {
        const byGroup = Number(sortsFirst(right)) - Number(sortsFirst(left))
        if (byGroup !== 0) {
          return byGroup
        }
      }
      if (groupBy !== undefined) {
        const leftGroup = groupOf(groupBy(left))
        const rightGroup = groupOf(groupBy(right))
        if (leftGroup !== rightGroup) {
          if (leftGroup === UNGROUPED) {
            return 1
          }
          if (rightGroup === UNGROUPED) {
            return -1
          }
          return leftGroup.localeCompare(rightGroup)
        }
      }
      return compareWithin(left, right)
    })
  }, [rows, columns, sort, sortsFirst, groupBy])

  const select = useCallback(
    (id: string, { focus = false }: { focus?: boolean } = {}) => {
      setActiveId(id)
      onSelect?.(sortedRows.find((row) => rowId(row) === id))
      if (focus) {
        const element = bodyReference.current?.querySelector<HTMLTableRowElement>(`tr[data-id="${CSS.escape(id)}"]`)
        element?.focus({ preventScroll: true })
        element?.scrollIntoView({ block: "nearest" })
      }
    },
    [onSelect, rowId, sortedRows],
  )

  const move = (fromId: string, step: number) => {
    const index = sortedRows.findIndex((row) => rowId(row) === fromId)
    const next = sortedRows[Math.min(sortedRows.length - 1, Math.max(0, index + step))]
    if (next !== undefined) {
      select(rowId(next), { focus: true })
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    const id = rowId(row)
    const destination = rowHref?.(row)
    switch (event.key) {
      case "ArrowDown":
      case "j":
        event.preventDefault()
        move(id, 1)
        break
      case "ArrowUp":
      case "k":
        event.preventDefault()
        move(id, -1)
        break
      case "Enter":
        if (destination !== undefined) {
          event.preventDefault()
          navigate(destination)
        }
        break
      case " ":
        event.preventDefault()
        select(id)
        break
      case "x":
        if (selectable) {
          event.preventDefault()
          toggleSelection(id)
        }
        break
      case "Home":
        event.preventDefault()
        if (sortedRows[0] !== undefined) {
          select(rowId(sortedRows[0]), { focus: true })
        }
        break
      case "End":
        event.preventDefault()
        if (sortedRows.at(-1) !== undefined) {
          select(rowId(sortedRows.at(-1)!), { focus: true })
        }
        break
      default:
        break
    }
  }

  const toggleSort = (column: Column<Row>) => {
    setSort((current) => (current?.key === column.key && current.direction === "asc" ? { key: column.key, direction: "desc" } : { key: column.key, direction: "asc" }))
  }

  const allVisibleSelected = sortedRows.length > 0 && sortedRows.every((row) => selectedIds.has(rowId(row)))
  const sortableColumns = columns.filter((column) => column.sortable !== false)
  const sortedColumn = sort === undefined ? undefined : columns.find((column) => column.key === sort.key)

  if (sortedRows.length === 0) {
    return (
      <div className={joinClassNames("kit-data-table", className)}>
        <EmptyState flush {...(empty ?? { title: "Nothing found", text: "Try a different filter or search." })} />
      </div>
    )
  }

  return (
    <div className={joinClassNames("kit-data-table", className)}>
      {selectable && selectedIds.size > 0 ? (
        <div className="kit-data-table-bulk">
          <b>{selectedIds.size}</b>
          <span>{text.selected}</span>
          {bulkActions?.([...selectedIds])}
          <button type="button" className="kit-data-table-clear" onClick={() => setSelectedIds(new Set())}>{text.clearSelection}</button>
        </div>
      ) : null}
      {sortableColumns.length === 0 ? null : (
        <div className="kit-data-table-phone-sort">
          <span className="kit-micro-label">{text.sortedBy}</span>
          <Menu
            label={sortedColumn?.label ?? text.nothing}
            className="kit-data-table-sort-menu"
            items={sortableColumns.map((column) => ({ label: column.label, onSelect: () => toggleSort(column), hint: sort?.key === column.key ? (sort.direction === "asc" ? "▲" : "▼") : undefined }))}
          />
        </div>
      )}
      <div className="kit-data-table-scroll">
        <table aria-label={ariaLabel} className="kit-data-table-grid">
          <thead>
            <tr>
              {selectable ? (
                <th scope="col" data-tick="">
                  <Checkbox checked={allVisibleSelected} onChange={(event) => setSelectedIds(event.target.checked ? new Set(sortedRows.map(rowId)) : new Set())} aria-label={text.selectAll} />
                </th>
              ) : null}
              {columns.map((column) => {
                const sorted = sort?.key === column.key
                const sortable = column.sortable !== false
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width === undefined ? undefined : { width: column.width }}
                    aria-sort={sorted ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                    data-number={column.align === "number" ? "" : undefined}
                    data-optional={column.optional ? "" : undefined}
                    data-primary={column.key === primaryColumnKey ? "" : undefined}
                  >
                    {column.labelHidden ? (
                      <span className="kit-visually-hidden">{column.label}</span>
                    ) : sortable ? (
                      <button type="button" className="kit-data-table-sort" data-sorted={sorted ? "" : undefined} onClick={() => toggleSort(column)}>
                        {column.label}
                        <span aria-hidden="true">{sort?.direction === "asc" ? "▲" : "▼"}</span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody ref={bodyReference}>
            {sortedRows.map((row, index) => {
              const id = rowId(row)
              const destination = rowHref?.(row)
              const group = groupBy === undefined ? undefined : groupOf(groupBy(row))
              const opensGroup = group !== undefined && (index === 0 || group !== groupOf(groupBy!(sortedRows[index - 1]!)))
              return (
                <Fragment key={id}>
                  {!opensGroup ? null : (
                    // A heading row nobody can land on: no data-id, no tab stop, no click.
                    <tr aria-hidden="true" className="kit-data-table-group">
                      <th scope="colgroup" colSpan={columns.length + (selectable ? 1 : 0)}>{group}</th>
                    </tr>
                  )}
                  <tr
                    data-id={id}
                    tabIndex={0}
                    aria-selected={id === activeId}
                    className={rowClassName?.(row)}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a, button, input, label")) {
                        return
                      }
                      select(id)
                    }}
                    onDoubleClick={() => {
                      if (destination !== undefined) {
                        navigate(destination)
                      }
                    }}
                    onKeyDown={(event) => handleRowKeyDown(event, row)}
                  >
                    {selectable ? (
                      <td data-tick="">
                        <Checkbox checked={selectedIds.has(id)} onChange={() => toggleSelection(id)} aria-label={text.selectRow} />
                      </td>
                    ) : null}
                    {columns.map((column) => {
                      const primary = column.key === primaryColumnKey
                      return (
                        <td key={column.key} data-number={column.align === "number" ? "" : undefined} data-optional={column.optional ? "" : undefined} data-primary={primary ? "" : undefined}>
                          {primary || column.labelHidden ? null : <span className="kit-data-table-cell-label kit-micro-label">{column.label}</span>}
                          <span className="kit-data-table-cell-value">{column.render?.(row) ?? String((row as Record<string, never>)[column.key] ?? "")}</span>
                        </td>
                      )
                    })}
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="kit-data-table-foot">
        <span className="kit-micro-label">{sortedRows.length} {sortedRows.length === 1 ? text.record : text.records}</span>
        <span className="kit-micro-label kit-data-table-keys">
          {text.move}
          {rowHref === undefined ? "" : ` · ${text.open}`}
          {selectable ? ` · ${text.tick}` : ""}
        </span>
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"

import { cn } from "../lib/helpers"
import { TableHead } from "./table"

/**
 * A column heading that sorts, and says which way.
 *
 * <p>⚠️ **`aria-sort` rather than an arrow alone.** The arrow tells somebody looking at the screen what
 * the order is; on a table of two hundred rows that state is the difference between reading the top of
 * a list and reading the top of a *different* list, and a person not looking at the screen needs it
 * just as much.
 *
 * <p>⚠️ **A `<button>` inside the `<th>`, not a click handler on it.** A cell that reacts to a click is
 * unreachable by keyboard and announces nothing; the button is what makes the column sortable with
 * `Tab` and `Enter` for free.
 */

export type SortDirection = "asc" | "desc"

export interface TableSortState<Key extends string = string> {
  key: Key | null
  direction: SortDirection
  /** Sort by this column — the same column again flips the direction. */
  sortBy: (key: Key) => void
}

/**
 * Sort state for a table.
 *
 * @param initialKey the column a fresh screen is ordered by
 */
export function useTableSort<Key extends string = string>(
  initialKey: Key | null = null,
  initialDirection: SortDirection = "asc",
): TableSortState<Key> {
  const [key, setKey] = React.useState<Key | null>(initialKey)
  const [direction, setDirection] = React.useState<SortDirection>(initialDirection)

  const sortBy = React.useCallback(
    (next: Key) => {
      setDirection((held) => (next === key && held === "asc" ? "desc" : "asc"))
      setKey(next)
    },
    [key],
  )

  return { key, direction, sortBy }
}

export function TableSortHead<Key extends string = string>({
  sortKey,
  state,
  className,
  children,
  ...properties
}: Omit<React.ComponentProps<typeof TableHead>, "onClick"> & {
  sortKey: Key
  state: TableSortState<Key>
}) {
  const sorted = state.key === sortKey
  const Glyph = !sorted ? ChevronsUpDown : state.direction === "asc" ? ChevronUp : ChevronDown

  return (
    <TableHead
      aria-sort={sorted ? (state.direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("p-0", sorted && "text-foreground", className)}
      {...properties}
    >
      <button
        type="button"
        onClick={() => state.sortBy(sortKey)}
        className={cn(
          "flex w-full items-center gap-1 px-2.5 py-1.5 text-left",
          "hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          "transition-colors duration-[120ms]",
        )}
      >
        <span className="truncate">{children}</span>
        {/* ⚠️ Dimmed rather than absent while unsorted. An arrow that only appears on the sorted column
            leaves the other columns looking like plain text, and nobody discovers they can be sorted. */}
        <Glyph className={cn("size-3 shrink-0", sorted ? "opacity-100" : "opacity-30")} aria-hidden="true" />
      </button>
    </TableHead>
  )
}

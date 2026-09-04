"use client"

import * as React from "react"

import { physicalKeyOf } from "./use-keyboard-shortcuts"

/**
 * Row navigation, selection and marking for a list — as a hook over whatever markup the list already
 * has, never as a component of its own.
 *
 * <h2>⚠️ A layer, not a component, and that is the whole design</h2>
 *
 * <p>Every product here already builds its lists out of `Table` / `TableRow` with its own columns, its
 * own cells and its own empty state. A `DataTable` that owned the markup would be a thirteenth
 * duplicate of something three interfaces have already written differently — and the first screen with
 * a column it could not express would fork it. So this owns the *behaviour* and hands back properties
 * to spread; the markup stays where it is.
 *
 * <h2>⚠️ And "row" does not mean `&lt;tr&gt;`</h2>
 *
 * <p>This was typed to `HTMLTableRowElement` for exactly as long as it took to reach the second screen
 * that wanted it: of the lists in one module, one is a table, one is a grid of cards, one is a tree and
 * one is a stack of rows. Moving between things with `j`/`k` is a fact about a **list**, not about a
 * tag — so the element type is `HTMLElement` and the properties spread onto a card as readily as onto
 * a table row.
 *
 * <h2>⚠️ Active is not selected</h2>
 *
 * <p>Three states are easy to collapse into one and mean different things. **Active** is where the
 * keyboard is — one row, moved by `j`/`k`, and losing it means losing your place. **Marked** is the
 * set an action will run over, toggled with `x`. **Open** is a row whose details are showing. A list
 * that reuses one for another produces a bulk action over the row you happened to be looking at.
 *
 * <h2>⚠️ Keys are matched by position</h2>
 *
 * <p>Through {@link physicalKeyOf}, so `j`/`k` work on a Ukrainian layout, where they produce `о` and
 * `л`. This is the same reason the global registry exists and is not repeated per screen.
 */

export interface ListKeyboardOptions<Row> {
  rows: Row[]
  /** A row's identity — stable across a re-fetch, or the active row jumps on every poll. */
  identify: (row: Row) => string
  /** What `Enter` does. Omit where a row does not open. */
  onOpen?: (row: Row) => void
  /** What `Space` does — normally showing the details panel. */
  onShowDetails?: (row: Row) => void
  /** Called whenever the active row changes, however it changed. */
  onActiveChange?: (row: Row | null) => void
  /** Enable `x` marking. Omit for a list nothing is done in bulk to. */
  markable?: boolean
  onMarkedChange?: (marked: string[]) => void
}

export interface ListKeyboard<Row> {
  activeId: string | null
  activeRow: Row | null
  marked: string[]
  isMarked: (id: string) => boolean
  setActive: (id: string | null) => void
  move: (step: number) => void
  toggleMark: (id: string) => void
  markAll: (marked: boolean) => void
  clearMarks: () => void
  /** Spread onto each `TableRow`. Carries focus, the key handler and the active flag. */
  rowProperties: (row: Row) => {
    "data-active"?: "" | undefined
    "aria-selected": boolean
    tabIndex: number
    ref: (element: HTMLElement | null) => void
    onClick: (event: React.MouseEvent) => void
    onKeyDown: (event: React.KeyboardEvent) => void
  }
}

export function useListKeyboard<Row>({
  rows,
  identify,
  onOpen,
  onShowDetails,
  onActiveChange,
  markable = false,
  onMarkedChange,
}: ListKeyboardOptions<Row>): ListKeyboard<Row> {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [marked, setMarked] = React.useState<string[]>([])
  const elements = React.useRef(new Map<string, HTMLElement>())

  const identifiers = React.useMemo(() => rows.map(identify), [rows, identify])
  const activeRow = React.useMemo(
    () => rows.find((row) => identify(row) === activeId) ?? null,
    [rows, identify, activeId],
  )

  /**
   * ⚠️ **A row that is gone stops being active, and a mark on it goes with it.** Without this, a
   * filtered or re-fetched list keeps an active id matching nothing: `j` then has no place to move
   * from and starts at the top, which reads as the keyboard being broken rather than as the row having
   * left.
   */
  React.useEffect(() => {
    if (activeId !== null && !identifiers.includes(activeId)) {
      setActiveId(null)
      onActiveChange?.(null)
    }
    setMarked((held) => {
      const surviving = held.filter((id) => identifiers.includes(id))

      return surviving.length === held.length ? held : surviving
    })
    // `onActiveChange` is the caller's, and depending on it would re-run this whenever they re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifiers, activeId])

  const announceMarks = React.useCallback(
    (next: string[]) => {
      setMarked(next)
      onMarkedChange?.(next)
    },
    [onMarkedChange],
  )

  const setActive = React.useCallback(
    (id: string | null) => {
      setActiveId(id)
      onActiveChange?.(id === null ? null : (rows.find((row) => identify(row) === id) ?? null))

      if (id !== null) {
        const element = elements.current.get(id)

        element?.focus({ preventScroll: true })
        element?.scrollIntoView({ block: "nearest" })
      }
    },
    [rows, identify, onActiveChange],
  )

  const move = React.useCallback(
    (step: number) => {
      if (!identifiers.length) {
        return
      }
      const index = activeId === null ? -1 : identifiers.indexOf(activeId)
      // ⚠️ Clamped rather than wrapped. A list that jumps from its last row to its first on one more
      // `j` loses the person's place at exactly the moment they were looking for the end of it.
      const next = index < 0 ? 0 : Math.min(identifiers.length - 1, Math.max(0, index + step))

      setActive(identifiers[next])
    },
    [identifiers, activeId, setActive],
  )

  const toggleMark = React.useCallback(
    (id: string) => {
      announceMarks(marked.includes(id) ? marked.filter((held) => held !== id) : [...marked, id])
    },
    [marked, announceMarks],
  )

  const markAll = React.useCallback(
    (all: boolean) => {
      announceMarks(all ? [...identifiers] : [])
    },
    [identifiers, announceMarks],
  )

  const rowProperties = React.useCallback(
    (row: Row) => {
      const id = identify(row)

      return {
        "data-active": activeId === id ? ("" as const) : undefined,
        "aria-selected": activeId === id,
        // ⚠️ One row in the tab order, not every row. Tabbing through two hundred rows to reach what is
        // after the table is not keyboard support, it is a trap.
        tabIndex: activeId === id || (activeId === null && identifiers[0] === id) ? 0 : -1,
        ref: (element: HTMLElement | null) => {
          if (element) {
            elements.current.set(id, element)
          } else {
            elements.current.delete(id)
          }
        },
        onClick: (event: React.MouseEvent) => {
          // A click on something that does its own thing is not a click on the row.
          if ((event.target as HTMLElement).closest("a, button, input, select, textarea, [role=checkbox]")) {
            return
          }
          setActive(id)
        },
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.ctrlKey || event.metaKey || event.altKey) {
            return
          }
          if ((event.target as HTMLElement).matches("input, select, textarea")) {
            return
          }

          const key = physicalKeyOf(event.nativeEvent)
          const handlers: Record<string, (() => void) | undefined> = {
            j: () => move(1),
            ArrowDown: () => move(1),
            k: () => move(-1),
            ArrowUp: () => move(-1),
            Home: () => setActive(identifiers[0] ?? null),
            End: () => setActive(identifiers.at(-1) ?? null),
            Enter: onOpen && (() => onOpen(row)),
            " ": onShowDetails && (() => onShowDetails(row)),
            x: markable ? () => toggleMark(id) : undefined,
          }
          const handler = handlers[key]

          if (handler) {
            event.preventDefault()
            /**
             * ⚠️ **Stopped as well as prevented, and this is not belt-and-braces.** A screen normally
             * registers `j`/`k` globally too, so that they start navigating when nothing has focus yet.
             * React's handler runs at the root container and the registry listens on `window`, so
             * without this the row moves one and the registry moves another: every press steps **two**
             * rows. It reads as the list skipping, and no compiler can see it — the two handlers are in
             * different files and neither is wrong on its own.
             */
            event.stopPropagation()
            handler()
          }
        },
      }
    },
    [identify, activeId, identifiers, move, setActive, onOpen, onShowDetails, markable, toggleMark],
  )

  return {
    activeId,
    activeRow,
    marked,
    isMarked: (id: string) => marked.includes(id),
    setActive,
    move,
    toggleMark,
    markAll,
    clearMarks: () => announceMarks([]),
    rowProperties,
  }
}

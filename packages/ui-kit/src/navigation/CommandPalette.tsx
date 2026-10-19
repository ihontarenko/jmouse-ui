import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { KeyChord } from "../controls/Labels"
import { Icon } from "../icons/Icon"
import type { IconSource } from "../icons/Icon"

export interface Command {
  id: string
  label: string
  /** Muted words after the label — where the thing lives, what kind it is. */
  hint?: string
  /** Words that find the command without appearing in it. */
  keywords?: string[]
  group?: string
  icon?: IconSource
  shortcut?: string
  run(): void
}

export interface CommandPaletteProperties {
  open: boolean
  onClose(): void
  commands: Command[]
  label?: string
  placeholder?: string
  emptyText?: string
  /** The keys printed in the foot. */
  footer?: ReactNode
  /**
   * Hears every change of the query, the empty one on opening included. For destinations that come from a search the
   * page cannot hold whole — a project's types — answer it by passing new `commands`; they are still filtered here.
   */
  onQueryChange?(query: string): void
}

/** Where the letters of `query` occur in order inside `text`, or undefined when they do not all occur. */
export function matchSubsequence(text: string, query: string): number[] | undefined {
  const positions: number[] = []
  const lowerText = text.toLowerCase()
  let from = 0
  for (const character of query.toLowerCase()) {
    if (character === " ") {
      continue
    }
    const found = lowerText.indexOf(character, from)
    if (found === -1) {
      return undefined
    }
    positions.push(found)
    from = found + 1
  }
  return positions
}

/** Fewer, earlier and more contiguous matches rank higher; a match at the very start ranks highest. */
function scoreOf(positions: number[]): number {
  let gaps = 0
  for (let index = 1; index < positions.length; index++) {
    gaps += positions[index] - positions[index - 1] - 1
  }
  return (positions[0] ?? 0) + gaps * 2
}

function Highlighted({ text, positions }: { text: string; positions: number[] }) {
  const marked = new Set(positions)
  return (
    <span>
      {Array.from(text).map((character, index) => (marked.has(index) ? <mark key={index}>{character}</mark> : character))}
    </span>
  )
}

/**
 * Search everywhere: one field over every command and destination the product registers. Typed letters match in
 * order (`opset` finds "Open settings"), Up and Down move, Enter runs, Escape closes. A combobox over a listbox, inside
 * a modal dialog — the browser keeps focus inside it and returns focus on close.
 */
export function CommandPalette({ open, onClose, commands, label = "Search everywhere", placeholder = "Type a command or a name…", emptyText = "Nothing matches", footer, onQueryChange }: CommandPaletteProperties) {
  const dialogReference = useRef<HTMLDialogElement>(null)
  const listId = useId()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const dialog = dialogReference.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      setQuery("")
      onQueryChange?.("")
      setActiveIndex(0)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const matches = useMemo(() => {
    if (!query.trim()) {
      return commands.map((command) => ({ command, positions: [] as number[], score: 0 }))
    }
    return commands
      .map((command) => {
        const positions = matchSubsequence(command.label, query)
        if (positions) {
          return { command, positions, score: scoreOf(positions) }
        }
        const keywordHit = command.keywords?.some((keyword) => matchSubsequence(keyword, query))
        return keywordHit ? { command, positions: [] as number[], score: 1000 } : undefined
      })
      .filter((match): match is NonNullable<typeof match> => match !== undefined)
      .sort((first, second) => first.score - second.score)
  }, [commands, query])

  const groups = useMemo(() => {
    const ordered = new Map<string, typeof matches>()
    for (const match of matches) {
      const group = match.command.group ?? ""
      ordered.set(group, [...(ordered.get(group) ?? []), match])
    }
    return Array.from(ordered.entries())
  }, [matches])

  const flat = groups.flatMap(([, entries]) => entries)
  const active = flat[Math.min(activeIndex, flat.length - 1)]

  function run(command: Command) {
    onClose()
    command.run()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => (flat.length === 0 ? 0 : (index + 1) % flat.length))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => (flat.length === 0 ? 0 : (index - 1 + flat.length) % flat.length))
    } else if (event.key === "Enter" && active) {
      event.preventDefault()
      run(active.command)
    }
  }

  useEffect(() => {
    if (active) {
      document.getElementById(`${listId}-${active.command.id}`)?.scrollIntoView({ block: "nearest" })
    }
  }, [active, listId])

  return (
    <dialog
      ref={dialogReference}
      className="kit-dialog kit-command-palette"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      {open && (
        <>
          <div className="kit-command-input">
            <Icon name="search" />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={active ? `${listId}-${active.command.id}` : undefined}
              aria-label={label}
              placeholder={placeholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                onQueryChange?.(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          <div className="kit-dialog-body">
            <div className="kit-command-list" id={listId} role="listbox" aria-label={label}>
              {flat.length === 0 && <p className="kit-command-empty">{emptyText}</p>}
              {groups.map(([group, entries]) => (
                <div key={group} className="kit-command-group" role="group" aria-label={group || undefined}>
                  {group && <div className="kit-command-group-label kit-micro-label" aria-hidden="true">{group}</div>}
                  {entries.map((match) => (
                    <div
                      key={match.command.id}
                      id={`${listId}-${match.command.id}`}
                      role="option"
                      aria-selected={match === active}
                      className="kit-menu-item kit-command-item"
                      onPointerMove={() => setActiveIndex(flat.indexOf(match))}
                      onClick={() => run(match.command)}
                    >
                      {match.command.icon && <Icon name={match.command.icon} />}
                      <Highlighted text={match.command.label} positions={match.positions} />
                      {match.command.hint && <span className="kit-command-item-hint">{match.command.hint}</span>}
                      {match.command.shortcut && <KeyChord keys={match.command.shortcut} />}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="kit-command-footer">
            {footer ?? (
              <>
                <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
                <span><kbd>Enter</kbd> run</span>
                <span><kbd>Esc</kbd> close</span>
              </>
            )}
          </div>
        </>
      )}
    </dialog>
  )
}

/**
 * Opens something on a key chord from anywhere on the page — Ctrl+K and ⌘K by default, or Shift pressed twice as an IDE
 * does. Ignored while typing in a field, except for the chord itself.
 */
export function useCommandShortcut(onTrigger: () => void, options: { key?: string; doubleShift?: boolean } = {}) {
  const { key = "k", doubleShift = false } = options
  useEffect(() => {
    let lastShift = 0
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === key) {
        event.preventDefault()
        onTrigger()
        return
      }
      if (doubleShift && event.key === "Shift" && !event.repeat) {
        const now = performance.now()
        if (now - lastShift < 350) {
          onTrigger()
          lastShift = 0
        } else {
          lastShift = now
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onTrigger, key, doubleShift])
}

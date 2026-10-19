import { useEffect } from "react"

/*
 * Keyboard shortcuts — Innoventa's `useShortcuts.ts`, same names. A shortcut that is not written down does not exist:
 * every one bound here should also be printed beside the thing it does (a button's `hint`, a menu entry's `hint`).
 */

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return Boolean(element?.closest("input, textarea, select, [contenteditable=true]"))
}

export interface Shortcut {
  /** The key as `letterOf` names it: a lower-case letter, "/", "?", or the key's own name. */
  key: string
  shift?: boolean
  /** Control on Windows and Linux, command on a Mac. */
  control?: boolean
  run(): void
  /** Fires inside a field too — Ctrl+S, Ctrl+K. A bare letter never should. */
  whileTyping?: boolean
}

/**
 * Binds shortcuts while the component is mounted. Modifiers are matched in BOTH directions — a bare `n` never fires on
 * Ctrl+N, the browser's new window — and Alt is refused outright: it opens a menu bar on Windows and composes a
 * character on a Mac.
 */
export function useShortcuts(shortcuts: Shortcut[], enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const handle = (event: KeyboardEvent) => {
      if (event.altKey) {
        return
      }
      const held = event.ctrlKey || event.metaKey
      const typing = isTyping(event.target)
      const pressed = letterOf(event)
      for (const shortcut of shortcuts) {
        if (shortcut.key !== pressed) {
          continue
        }
        if ((shortcut.control ?? false) !== held) {
          continue
        }
        if ((shortcut.shift ?? false) !== event.shiftKey) {
          continue
        }
        if (typing && !shortcut.whileTyping) {
          continue
        }
        event.preventDefault()
        shortcut.run()
        return
      }
    }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [shortcuts, enabled])
}

/** The key as a shortcut names it — by its position for letters, so a Cyrillic layout still answers to `n`. */
export function letterOf(event: KeyboardEvent): string {
  if (event.code.startsWith("Key")) {
    return event.code.slice(3).toLowerCase()
  }
  if (event.code === "Slash") {
    return event.shiftKey ? "?" : "/"
  }
  return event.key
}

/** `g` then a letter jumps to a destination — `g i` for inventory. The second key must follow within 1.5 s. */
export function useGoTo(destinations: Record<string, string>, navigate: (to: string) => void): void {
  useEffect(() => {
    let armed = false
    let timer = 0
    const handle = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) {
        return
      }
      const pressed = letterOf(event)
      if (armed) {
        armed = false
        window.clearTimeout(timer)
        const destination = destinations[pressed]
        if (destination !== undefined) {
          event.preventDefault()
          navigate(destination)
        }
        return
      }
      if (pressed === "g") {
        armed = true
        timer = window.setTimeout(() => {
          armed = false
        }, 1500)
      }
    }
    window.addEventListener("keydown", handle)
    return () => {
      window.removeEventListener("keydown", handle)
      window.clearTimeout(timer)
    }
  }, [destinations, navigate])
}

/** A record's two keys: `e` edits, Ctrl+S saves (even from inside a field). */
export function useRecordShortcuts({ onEdit, onSave }: { onEdit?(): void; onSave?(): void }): void {
  useShortcuts(
    [...(onEdit === undefined ? [] : [{ key: "e", run: onEdit }]), ...(onSave === undefined ? [] : [{ key: "s", control: true, whileTyping: true, run: onSave }])],
    onEdit !== undefined || onSave !== undefined,
  )
}

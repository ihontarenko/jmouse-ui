"use client"

import * as React from "react"

/**
 * Keyboard shortcuts, registered on the **physical key** rather than on the character it produces.
 *
 * <h2>⚠️ The physical key is the whole point, not a localisation nicety</h2>
 *
 * <p>On a Ukrainian layout `j` is `о`, `k` is `л` and `n` is `т`. A registry keyed on `event.key`
 * therefore works for whoever wrote it — who was on a Latin layout at the time — and silently does
 * nothing for a person who was not. There is no error, no warning and nothing in a console: the
 * shortcut simply never fires, which is indistinguishable from it not existing. `event.code` names the
 * key by its position, so `KeyJ` is the same key under every layout there is.
 *
 * <h2>⚠️ Typing is not shortcutting</h2>
 *
 * <p>Every handler is suppressed while a field has focus, while a dialog is open, and while a modifier
 * is held. Without the first, `j` cannot be typed into a search box; without the second, a list behind
 * a dialog moves under it; without the third, `ctrl+n` opens a browser window *and* whatever `n` does
 * here.
 *
 * <p>⚠️ `Escape` is the deliberate exception: it is delivered while typing, because blurring a field is
 * exactly what it is for there.
 *
 * <h2>⚠️ The help is generated from the registry</h2>
 *
 * <p>{@link useShortcutHelp} reads the registry that is actually in force, so a shortcut cannot exist
 * without appearing in the help and the help cannot list one that was renamed. A hand-written list
 * beside a registry is two statements of one fact, and the second is wrong within a month.
 */

/**
 * Keys that are not letters, named the way a shortcut is written down.
 *
 * ⚠️ **Digits are deliberately absent.** `Digit1` and `Numpad1` are different physical keys producing
 * one character, and a shortcut on a number wants both — so numbers are matched on the character,
 * which is safe for them precisely because a digit is a digit under every layout.
 */
const NAMED_CODES: Record<string, string> = {
  Slash: "/",
  Period: ".",
  Comma: ",",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Space: " ",
  Enter: "Enter",
  Escape: "Escape",
  Backspace: "Backspace",
  Tab: "Tab",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
}

/**
 * What key was pressed, by position rather than by the character it produced.
 *
 * <p>Exported because a component with its own key handling — a table row, a tree, a canvas — has the
 * same layout problem and must not solve it a second way.
 */
export function physicalKeyOf(event: Pick<KeyboardEvent, "code" | "key">): string {
  if (event.code?.startsWith("Key")) {
    return event.code.slice(3).toLowerCase()
  }
  if (event.code?.startsWith("Digit")) {
    return event.code.slice(5)
  }
  return NAMED_CODES[event.code] ?? event.key
}

/** Whether the event came from somewhere a person is entering text. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null

  if (!element?.closest) {
    return false
  }
  return Boolean(element.closest("input, textarea, select, [contenteditable=''], [contenteditable=true]"))
}

export interface Shortcut {
  /**
   * The key, as it is written down: a letter (`"j"`), a named key (`"/"`, `"Enter"`), or a sequence
   * written with a space (`"g p"` — press `g`, then `p`).
   *
   * ⚠️ Letters are matched case-insensitively on the physical key; to mean *shift and this key*, set
   * {@link shift} rather than writing a capital.
   */
  keys: string
  /** What it does, in the words the help should print. Omit to keep it out of the help. */
  describes?: string
  /** The heading it is filed under in the help — "Navigation", "This list". */
  group?: string
  /** Whether `shift` must be held. Anything else held always suppresses the shortcut. */
  shift?: boolean
  /** Skip this one for now, without taking it out of the registry — it stays in the help, dimmed. */
  disabled?: boolean
  run: (event: KeyboardEvent) => void
}

export interface KeyboardShortcutsOptions {
  /** Stop handling everything, without unregistering — a screen that has handed control away. */
  paused?: boolean
  /**
   * How long a started sequence waits for its second key, in milliseconds.
   *
   * <p>⚠️ It has to expire. A `g` that waits forever turns the next keystroke — minutes later, in a
   * different frame of mind — into a navigation the person did not ask for.
   */
  sequenceTimeout?: number
}

/** One registration, so several screens can contribute shortcuts to one page. */
interface Registration {
  shortcuts: Shortcut[]
}

const registrations = new Set<Registration>()
const listeners = new Set<() => void>()

/**
 * The shortcuts currently in force, in registration order.
 *
 * ⚠️ A module-level set rather than a context, because the help lives in the application shell while
 * the shortcuts are declared by whatever screen is mounted inside it. Threading a provider through
 * would make every screen that wants a shortcut also a provider.
 *
 * ⚠️ **The snapshot is cached and only rebuilt when a registration changes.** `useSyncExternalStore`
 * compares snapshots with `Object.is`, so a reader that flattens the set on every call hands React a
 * new array each time and re-renders forever — a loop with no error message and no obvious cause.
 */
let snapshot: Shortcut[] = []

function announceChange() {
  snapshot = [...registrations].flatMap((registration) => registration.shortcuts)
  for (const listener of listeners) {
    listener()
  }
}

function shortcutsInForce(): Shortcut[] {
  return snapshot
}

/**
 * Register shortcuts for as long as the calling component is mounted.
 *
 * <p>⚠️ The array is read through a ref, so a caller may build it inline without memoising: a
 * shortcut list that re-registered on every render would tear down and rebuild the listener between
 * the key going down and the sequence's second key arriving.
 */
export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  { paused = false, sequenceTimeout = 1500 }: KeyboardShortcutsOptions = {},
): void {
  const latest = React.useRef(shortcuts)

  latest.current = shortcuts

  /**
   * ⚠️ **Re-registered on what the help would PRINT, not on the array's identity.** A caller is meant
   * to build this list inline, so its identity changes every render and depending on it would announce
   * a change to every reader sixty times a second. Depending on nothing instead freezes the help at
   * whatever was registered first, so a shortcut that becomes enabled never appears. The signature is
   * the middle: it changes exactly when the printed help would.
   */
  const signature = shortcuts
    .map((shortcut) =>
      [shortcut.keys, shortcut.describes ?? "", shortcut.group ?? "", shortcut.disabled ? 1 : 0, shortcut.shift ? 1 : 0].join("|"),
    )
    .join("\n")

  React.useEffect(() => {
    const registration: Registration = { shortcuts: latest.current }

    registrations.add(registration)
    announceChange()

    return () => {
      registrations.delete(registration)
      announceChange()
    }
  }, [signature])

  React.useEffect(() => {
    if (paused) {
      return
    }

    let started: string | null = null
    let expiry: ReturnType<typeof setTimeout> | undefined

    const forget = () => {
      started = null
      clearTimeout(expiry)
    }

    const handle = (event: KeyboardEvent) => {
      const key = physicalKeyOf(event)
      const typing = isTypingTarget(event.target)

      // ⚠️ Escape reaches a field on purpose — leaving one is what it means there.
      if (key === "Escape") {
        forget()
        if (typing) {
          ;(event.target as HTMLElement).blur()
          return
        }
      } else if (typing || document.querySelector("[role=dialog][data-state=open], dialog[open]")) {
        forget()
        return
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        forget()
        return
      }

      const wanted = started ? `${started} ${key}` : key
      const match = latest.current.find(
        (shortcut) => !shortcut.disabled && shortcut.keys === wanted && Boolean(shortcut.shift) === event.shiftKey,
      )

      if (match) {
        forget()
        event.preventDefault()
        match.run(event)
        return
      }

      if (started) {
        // A sequence was started and this key finished nothing. Forgetting rather than re-opening on
        // the stray key is what stops `g` `x` `p` navigating.
        forget()
        return
      }

      const opensSequence = latest.current.some(
        (shortcut) =>
          !shortcut.disabled
          && shortcut.keys.startsWith(`${key} `)
          && Boolean(shortcut.shift) === event.shiftKey,
      )

      if (opensSequence) {
        event.preventDefault()
        started = key
        expiry = setTimeout(forget, sequenceTimeout)
      }
    }

    window.addEventListener("keydown", handle)

    return () => {
      window.removeEventListener("keydown", handle)
      clearTimeout(expiry)
    }
  }, [paused, sequenceTimeout])
}

export interface ShortcutHelpGroup {
  group: string
  shortcuts: Shortcut[]
}

/**
 * Every described shortcut currently in force, grouped for a help screen.
 *
 * ⚠️ Read from the same registry the handler uses, so the help cannot drift from what actually works.
 */
export function useShortcutHelp(): ShortcutHelpGroup[] {
  const read = React.useCallback(() => shortcutsInForce(), [])
  const subscribe = React.useCallback((listener: () => void) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }, [])
  const all = React.useSyncExternalStore(subscribe, read, read)

  return React.useMemo(() => {
    const grouped = new Map<string, Shortcut[]>()

    for (const shortcut of all) {
      if (!shortcut.describes) {
        continue
      }
      const group = shortcut.group ?? "Other"

      grouped.set(group, [...(grouped.get(group) ?? []), shortcut])
    }

    return [...grouped].map(([group, shortcuts]) => ({ group, shortcuts }))
  }, [all])
}

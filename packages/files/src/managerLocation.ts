import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Where the manager is, kept in the ADDRESS — so a folder can be linked to and Back means what it says.
 *
 * <h2>⚠️ The hash, and not the path, because this package must not know about a router</h2>
 *
 * <p>Three products mount this screen and all three route differently; a component that owned a path
 * segment would need `react-router` as a peer dependency and would pin three interfaces to one version
 * of it for the sake of one screen. The hash is the one part of a URL that belongs to the page rather
 * than to the route — writing it moves nobody's router, and reading it needs nothing.</p>
 *
 * <h2>⚠️ Identifiers, not paths, and the reason is renaming</h2>
 *
 * <p>A directory's `path` is built from slugs, so a folder somebody renames gets a new one — and every
 * link anybody had kept to it becomes a link to nothing. The id survives renaming and moving both. It
 * reads worse and it is right; a readable address that quietly breaks is the worse trade.</p>
 *
 * <h2>⚠️ Both `popstate` and `hashchange`, and neither is redundant</h2>
 *
 * <p>`history.pushState` fires <em>neither</em> — which is why every write here also sets the state
 * itself rather than waiting to be told. Going back or forward fires `popstate`; a hash typed into the
 * bar or arrived at from a link fires `hashchange`. Both handlers do the same idempotent thing, so the
 * overlap costs a re-read of one string.</p>
 */
export interface ManagerLocation {
  /** The directory being looked at, or `null` for wherever the manager starts. */
  folder: string | null
  /** The file open in the viewer, or `null`. */
  file: string | null
}

const EMPTY: ManagerLocation = { folder: null, file: null }

/**
 * ⚠️ **`URLSearchParams` over the hash, rather than a format of our own.** A page that also uses the
 * hash for an anchor (`#installing`) parses here as a key with no value and answers `null` for both
 * fields — which is exactly the right answer, and is what a hand-rolled `#/folder/id` parser would have
 * had to be taught.
 */
function readHash(): ManagerLocation {
  const parameters = new URLSearchParams(window.location.hash.replace(/^#/, ""))

  return { folder: parameters.get("folder"), file: parameters.get("file") }
}

/**
 * ⚠️ **`window.history.state` is carried across untouched.** React Router keeps its own index in there,
 * and a `pushState` that dropped it would leave the router's idea of how far back it can go one entry
 * out of step with the browser's.
 */
function writeHash(next: ManagerLocation, mode: "push" | "replace"): void {
  const parameters = new URLSearchParams()

  if (next.folder) {
    parameters.set("folder", next.folder)
  }

  if (next.file) {
    parameters.set("file", next.file)
  }

  const hash = parameters.toString()
  const address = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ""}`

  if (mode === "replace") {
    window.history.replaceState(window.history.state, "", address)

    return
  }

  window.history.pushState(window.history.state, "", address)
}

/**
 * The address, as something a component can read and move.
 *
 * ⚠️ **Opening a file PUSHES and closing it goes BACK**, which is the pairing people already have in
 * their hands: a viewer opened from a folder closes on the Back gesture, on the phone as well as on the
 * keyboard. ⚠️ Unless the file was in the address when the page loaded — somebody who followed a link
 * straight to a file has nothing of ours behind them, and `back()` there leaves the application
 * altogether. That case replaces instead, which is why the push is remembered rather than assumed.
 */
export function useManagerLocation() {
  const [location, setLocation] = useState<ManagerLocation>(readHash)
  const openedHere = useRef(false)

  useEffect(() => {
    function sync() {
      setLocation(readHash())
    }

    window.addEventListener("popstate", sync)
    window.addEventListener("hashchange", sync)

    return () => {
      window.removeEventListener("popstate", sync)
      window.removeEventListener("hashchange", sync)
    }
  }, [])

  const move = useCallback((next: ManagerLocation, mode: "push" | "replace") => {
    setLocation(next)
    writeHash(next, mode)
  }, [])

  const goToFolder = useCallback(
    (folder: string | null) => {
      openedHere.current = false
      move({ folder, file: null }, "push")
    },
    [move],
  )

  /** Put the manager somewhere without spending a history entry — for correcting an address, not for navigating. */
  const settleOnFolder = useCallback(
    (folder: string | null) => {
      openedHere.current = false
      move({ folder, file: null }, "replace")
    },
    [move],
  )

  const openFile = useCallback(
    (file: string) => {
      openedHere.current = true
      move({ folder: readHash().folder, file }, "push")
    },
    [move],
  )

  const closeFile = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false
      // ⚠️ `popstate` follows and the listener above reads the address back — the state is never set
      // here, or the two would disagree for a frame and the dialog would flicker shut and open.
      window.history.back()

      return
    }

    move({ folder: readHash().folder, file: null }, "replace")
  }, [move])

  return { location, goToFolder, settleOnFolder, openFile, closeFile }
}

export { EMPTY as EMPTY_MANAGER_LOCATION }

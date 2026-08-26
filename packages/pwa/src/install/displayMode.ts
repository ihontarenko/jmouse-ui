import { useEffect, useState } from "react"
import type { StationDefinition } from "../station.js"
import { supportsManualInstall } from "./prompt.js"

export type DisplayMode = "browser" | "standalone" | "minimal-ui"

const STANDALONE_QUERY = "(display-mode: standalone)"
const MINIMAL_QUERY = "(display-mode: minimal-ui)"

/**
 * iOS reports a launched application through `navigator.standalone` and NOT through the display-mode
 * media query, so both have to be asked. A product that checks only the query treats every installed
 * iPhone as a browser tab.
 */
function readDisplayMode(): DisplayMode {
  if (typeof window === "undefined") {
    return "browser"
  }

  if (supportsManualInstall() && (navigator as Navigator & { standalone?: boolean }).standalone === true) {
    return "standalone"
  }

  if (window.matchMedia(STANDALONE_QUERY).matches) {
    return "standalone"
  }

  if (window.matchMedia(MINIMAL_QUERY).matches) {
    return "minimal-ui"
  }

  return "browser"
}

/** How this window is being shown — a tab, or a launched application. */
export function useDisplayMode(): DisplayMode {
  const [mode, setMode] = useState<DisplayMode>(readDisplayMode)

  useEffect(() => {
    const standalone = window.matchMedia(STANDALONE_QUERY)
    const minimal = window.matchMedia(MINIMAL_QUERY)
    const update = () => setMode(readDisplayMode())

    standalone.addEventListener("change", update)
    minimal.addEventListener("change", update)

    return () => {
      standalone.removeEventListener("change", update)
      minimal.removeEventListener("change", update)
    }
  }, [])

  return mode
}

export function useIsInstalled(): boolean {
  return useDisplayMode() !== "browser"
}

/**
 * Which station this window was launched as, or `null` in an ordinary tab.
 *
 * ⚠️ **Read from the address, never from storage.** Web storage is per ORIGIN, and every station on
 * this origin shares one — so a station that recorded "I am the one that is installed" would be read
 * back by all the others as though it were about them. The address is the only thing that differs.
 *
 * ⚠️ **Longest match wins.** `/station/stocktake-review` must not resolve to `/station/stocktake`, and
 * an unsorted `find` picks whichever was declared first.
 */
export function launchedStation<T extends StationDefinition>(
  stations: readonly T[],
  pathname: string,
): T | null {
  const candidates = stations
    .filter((station) => pathname === station.startPath || pathname.startsWith(`${station.startPath}/`))
    .sort((first, second) => second.startPath.length - first.startPath.length)

  return candidates[0] ?? null
}

/**
 * The station this window is a launched copy of — `null` in a browser tab, even one sitting on a
 * station's own address.
 *
 * The display mode is half the answer on purpose: somebody reading a station's screen in a tab has not
 * installed it, and offering them the launched application's chrome would be wrong.
 */
export function useInstalledStation<T extends StationDefinition>(stations: readonly T[]): T | null {
  const installed = useIsInstalled()
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? "" : window.location.pathname,
  )

  useEffect(() => {
    const update = () => setPathname(window.location.pathname)

    window.addEventListener("popstate", update)

    return () => window.removeEventListener("popstate", update)
  }, [])

  if (!installed) {
    return null
  }

  return launchedStation(stations, pathname)
}

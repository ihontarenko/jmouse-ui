import type { ReactNode } from "react"

/**
 * What an account must hold before a station is offered to it — the whole of a gate, as data.
 *
 * ⚠️ **Declared here and evaluated by the product.** This package never reaches for a store, a token
 * or a permission name of its own: it takes a predicate and calls it. A library that knew how to
 * authorize would be a second answer to a question each product already answers once, and the day the
 * two answers differ is the day a tile is offered for a screen the backend then refuses.
 */
export interface StationRequirement {
  requiredPermission?: string
  /**
   * Held **somewhere** or held **everywhere**? An installation-wide station must ask the second
   * question: an ordinary account holds most permissions in the workspaces it belongs to, so gating on
   * the coarse set would offer the station to everybody.
   */
  requiredEverywhere?: boolean
}

/**
 * A station — one installable surface, set up for a single kind of work.
 *
 * ⚠️ **This half carries no React**, and that is what lets a build read it. The Vite plugin runs in
 * Node and cannot hold a rendered glyph, so the interface's station ({@link PwaStation}) is this plus
 * an icon rather than a second declaration. One list of stations, read by both halves; two lists drift
 * the moment either is edited, and the failure is a tile whose manifest names a different address.
 */
export interface StationDefinition extends StationRequirement {
  /**
   * Stable across renamings, and **the manifest's `id`** — so changing it un-installs the station from
   * every device that had it and installs a stranger beside it. Lowercase, digits and hyphens only;
   * it is also a directory name.
   */
  key: string
  /** The full name, as the home screen and the installation dialog show it. */
  name: string
  /** What fits under an icon — around twelve characters before a launcher truncates it. */
  shortName: string
  /** One line, on the shelf tile and in the installation dialog. */
  description: string
  /**
   * Where the station opens, absolute from the origin — `/station/components`. Also the manifest's
   * `start_url`.
   */
  startPath: string
  /**
   * The HTML entry this station is served from, relative to the Vite root — build-time only, and
   * derived from {@link startPath} when it is omitted (`/station/components` becomes
   * `station/components/index.html`).
   *
   * ⚠️ **A station needs an entry of its own and cannot share one.** A browser reads the manifest from
   * the document it loaded, so one document can offer exactly one installable identity.
   */
  entry?: string
}

/**
 * A station as the interface draws it — the definition plus the glyph it is painted with.
 *
 * The glyph is the product's, deliberately: the shelf, the tab mark and the home-screen icon are three
 * renderings of one mark, and a library that shipped its own would make every product's stations look
 * like the library.
 */
export interface PwaStation extends StationDefinition {
  icon: ReactNode
}

/**
 * A station key is a manifest `id` and a directory name at the same time, so it is narrower than a
 * slug: no uppercase (path comparison on a case-insensitive filesystem), no dots (they read as an
 * extension), no leading digit or hyphen.
 */
const STATION_KEY_PATTERN = /^[a-z][a-z0-9-]*$/

/**
 * Refuses a station list that would build something subtly wrong, before anything is emitted.
 *
 * ⚠️ **Every rule here exists because breaking it fails SILENTLY.** A duplicate `id` does not error —
 * the second station installs over the first, discovered weeks later on somebody's phone. A relative
 * `start_url` resolves against whatever page happened to be open. Both look like a working build.
 */
export function validateStations(stations: readonly StationDefinition[]): void {
  if (stations.length === 0) {
    throw new Error("@jmouse/pwa: no stations were declared, so there is nothing to make installable.")
  }

  const seenKeys = new Set<string>()
  const seenStartPaths = new Set<string>()

  for (const station of stations) {
    if (!STATION_KEY_PATTERN.test(station.key)) {
      throw new Error(
        `@jmouse/pwa: '${station.key}' is not a usable station key. It becomes the manifest id and a `
          + "directory name, so it must start with a letter and hold only lowercase letters, digits and hyphens.",
      )
    }

    if (seenKeys.has(station.key)) {
      throw new Error(
        `@jmouse/pwa: two stations are keyed '${station.key}'. The key becomes the manifest id, and two `
          + "manifests sharing an id do not install side by side — the second silently replaces the first.",
      )
    }

    if (!station.startPath.startsWith("/")) {
      throw new Error(
        `@jmouse/pwa: station '${station.key}' has a relative startPath ('${station.startPath}'). It `
          + "becomes start_url, which is resolved against the manifest's own address rather than the origin.",
      )
    }

    if (seenStartPaths.has(station.startPath)) {
      throw new Error(
        `@jmouse/pwa: two stations open at '${station.startPath}'. Each station needs an address of its `
          + "own, because the browser reads a manifest from the document it loaded.",
      )
    }

    seenKeys.add(station.key)
    seenStartPaths.add(station.startPath)
  }
}

/** The HTML entry a station is served from, relative to the Vite root. */
export function stationEntryPath(station: StationDefinition): string {
  if (station.entry !== undefined) {
    return station.entry.replace(/^\/+/, "")
  }

  return `${station.startPath.replace(/^\/+/, "").replace(/\/+$/, "")}/index.html`
}

/** Where a station's manifest is written — beside its entry, so the two move together. */
export function stationManifestPath(station: StationDefinition): string {
  const entry = stationEntryPath(station)
  const directory = entry.slice(0, entry.lastIndexOf("/") + 1)

  return `${directory}manifest.webmanifest`
}

/**
 * Leaves the page for a station's own address.
 *
 * ⚠️ **A real navigation, and it cannot be a router push.** The browser reads the manifest from the
 * document it loaded, and swapping `<link rel="manifest">` afterwards does not reliably re-arm the
 * installation prompt — so reaching a station has to fetch that station's own document. A client-side
 * route to the same path renders the right screen under the *wrong* manifest, which looks entirely
 * correct until somebody tries to install it.
 *
 * ⚠️ **It lives beside the entry and manifest paths rather than beside the shelf that calls it**, and
 * that move is what lets a product take it without taking a rendered tile grid — see `headless.ts`.
 */
export function openStation(station: Pick<StationDefinition, "startPath">): void {
  window.location.assign(station.startPath)
}

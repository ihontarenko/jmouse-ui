import type { StationDefinition } from "./station.js"

/**
 * ⚠️ **The snake_case below is the Web Application Manifest specification's, not ours.** `short_name`,
 * `start_url` and `theme_color` are the keys a browser reads; spelling them the way the rest of this
 * repository spells names would produce a manifest no browser understands.
 */

export interface ManifestIcon {
  src: string
  sizes: string
  type: string
  /**
   * `maskable` is the one an Android launcher crops to its own shape. An icon offered only as `any` is
   * drawn inside a white rounded square rather than filling the tile.
   */
  purpose?: "any" | "maskable" | "monochrome"
}

export interface StationManifest {
  id: string
  name: string
  short_name: string
  description: string
  start_url: string
  scope: string
  display: "standalone"
  theme_color: string
  background_color: string
  lang?: string
  icons?: ManifestIcon[]
}

export interface StationManifestOptions {
  /** The product's name, which prefixes every station's — `Innoventa` gives `Innoventa Components`. */
  applicationName: string
  /**
   * ⚠️ **The product's DEFAULT palette, and it cannot follow the live theme.** `theme_color` and
   * `background_color` are read at launch, out of a static file, before anything of the application
   * runs — so a person on a different palette gets a themed tab mark and a default-palette splash.
   * That is the trade, not a defect: the alternative is serving a manifest per person per theme.
   */
  themeColor: string
  backgroundColor: string
  /** The document language of the installed application — `en`, `uk`. */
  language?: string
  /**
   * The icon set for one station. Left out, the manifest carries no `icons` and **is not installable**
   * — which the build says out loud rather than emitting something that quietly cannot be installed.
   */
  icons?: (station: StationDefinition) => ManifestIcon[]
}

/**
 * The manifest one station is installed by.
 *
 * ⚠️ **`id` is set explicitly, always.** It is what an installed application is keyed on, and it
 * defaults to `start_url` — so a manifest copied from another station installs *over* it instead of
 * beside it, with no error anywhere. Two stations, one icon on the home screen, and nothing to read.
 *
 * <h2>⚠️ `scope` is the station's OWN path, and it was the origin root until 2026-09-04</h2>
 *
 * <p>The argument for `"/"` was that stations share one service worker, one precache and one update
 * cycle *because* they share a scope. <strong>That argument was simply wrong.</strong> A service
 * worker's scope is the one given at registration — `register(address, { scope: "/" })`, spelled out
 * in `serviceWorker/register.ts` and asserted there — and it has nothing to do with this field. The
 * worker, the precache and the update cycle are untouched by what is written here.</p>
 *
 * <p>⚠️ <strong>What this field actually decides is which navigations stay INSIDE the installed
 * window</strong>, and `"/"` meant every address on the origin did. An installed station was therefore
 * a browser-less window over the entire product — and every *Open in a new tab* opened another
 * chromeless application window instead of a tab, because the target was in scope. Ivan reported that
 * three times; the first two answers changed the wording of the label rather than the behaviour, which
 * is why it came back.</p>
 *
 * <p>⚠️ <strong>Narrowed to `startPath`, an out-of-scope address opens in the BROWSER</strong> — a tab
 * beside whatever window is open, which is what the control has always promised. A component's
 * photograph at `/_/file/{token}` is out of scope; every screen the station itself is made of lives
 * under `startPath` and is not.</p>
 *
 * <p>⚠️ <strong>An already-installed station keeps its old scope until Chrome re-reads the
 * manifest.</strong> It is picked up on an update check, and reinstalling is the certain way. Nothing
 * about a build can force it.</p>
 */
export function buildStationManifest(
  station: StationDefinition,
  options: StationManifestOptions,
): StationManifest {
  const icons = options.icons?.(station) ?? []

  const manifest: StationManifest = {
    id: station.key,
    name: `${options.applicationName} ${station.name}`,
    short_name: station.shortName,
    description: station.description,
    start_url: station.startPath,
    scope: station.startPath,
    display: "standalone",
    theme_color: options.themeColor,
    background_color: options.backgroundColor,
  }

  if (options.language !== undefined) {
    manifest.lang = options.language
  }

  if (icons.length > 0) {
    manifest.icons = icons
  }

  return manifest
}

/**
 * What is missing before a manifest can actually be installed, in words a build log can print.
 *
 * Separate from {@link validateStations} because these are not mistakes — an icon set that has not been
 * built yet is an ordinary state of a half-finished product, and refusing the build over it would stop
 * the work that produces the icons.
 */
export function describeInstallabilityGaps(manifest: StationManifest): string[] {
  const gaps: string[] = []
  const icons = manifest.icons ?? []

  if (icons.length === 0) {
    gaps.push("it declares no icons, and a manifest without one cannot be installed")

    return gaps
  }

  // A vector icon declares `sizes: "any"` and genuinely is every size, so it satisfies both of the
  // questions below rather than failing both of them.
  const covers = (size: string) =>
    icons.some((icon) => {
      const declared = icon.sizes.split(" ")

      return declared.includes(size) || declared.includes("any")
    })

  if (!covers("192x192")) {
    gaps.push("it declares no 192x192 icon, which is the one an installation dialog asks for")
  }

  if (!covers("512x512")) {
    gaps.push("it declares no 512x512 icon, which is the one a splash screen is drawn from")
  }

  if (!icons.some((icon) => icon.purpose === "maskable")) {
    gaps.push("it declares no maskable icon, so an Android launcher will letterbox it rather than fill the tile")
  }

  return gaps
}

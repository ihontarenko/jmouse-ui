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
 * ⚠️ **`scope` is the origin root for every station, and this is deliberate rather than lazy.** It is
 * *not* the station's own path, though narrowing it looks like the tidier choice. Stations share one
 * service worker, one precache and one update cycle precisely because they share a scope; a scope each
 * would multiply all three on a phone, to buy nothing.
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
    scope: "/",
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

import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from "vite"
import type { StationDefinition } from "../station.js"
import { stationEntryPath, stationManifestPath, validateStations } from "../station.js"
import type { StationManifestOptions } from "../manifest.js"
import { buildStationManifest, describeInstallabilityGaps } from "../manifest.js"
import { buildDevelopmentWorkerSource, buildWorkerSource } from "./workerSource.js"
import type { IconColours, StationGlyph } from "../icons.js"
import { buildMaskableIconSvg, buildStationIconSvg } from "../icons.js"

export interface PaintIconsOptions {
  /** The product's own mark — the same callback `@jmouse/ui`'s `themedFaviconPainter` takes. */
  draw: StationGlyph
  /**
   * ⚠️ **The product's DEFAULT palette, because a build has no computed styles to read.** The tab mark
   * follows the live theme and this cannot; see the note on `themeColor`.
   */
  colours: IconColours
  /**
   * A PNG for iOS, per station. ⚠️ **iOS ignores the manifest's `icons` entirely** and reads
   * `<link rel="apple-touch-icon">` — with no PNG it puts a screenshot of the page on the home screen.
   * Left out, the build says so; it cannot be generated here, because rasterising would mean carrying
   * an image toolchain in a package that otherwise has no dependencies.
   */
  appleTouchIcon?: (station: StationDefinition) => string
}

export interface ServiceWorkerOptions {
  /**
   * Addresses the worker passes straight through to the network — the API, and anything else whose
   * answer is never the same twice. `/api` is assumed; naming any replaces that rather than adding.
   */
  networkOnlyPrefixes?: readonly string[]
}

export interface JmousePwaOptions extends StationManifestOptions {
  stations: readonly StationDefinition[]
  /**
   * The shared worker. `false` turns it off — a product may want stations installable before it has
   * decided anything about offline. Everything else about a station works without it.
   */
  serviceWorker?: false | ServiceWorkerOptions
  /**
   * Paint each station's icons from the product's mark, instead of naming files it already has.
   *
   * ⚠️ Mutually exclusive with `icons`: two answers to "what does this station look like" is one more
   * than a manifest can carry, and passing both is refused rather than silently preferring one.
   */
  paintIcons?: PaintIconsOptions
}

const ICON_FILE_NAME = "icon.svg"
const MASKABLE_ICON_FILE_NAME = "icon-maskable.svg"

/** Where a station's generated icons are written — beside its manifest, so the three move together. */
function stationIconDirectory(station: StationDefinition): string {
  const manifest = stationManifestPath(station)

  return manifest.slice(0, manifest.lastIndexOf("/") + 1)
}

/** Where the generated worker is written. ⚠️ The origin ROOT, and it may not move — see the runtime. */
const WORKER_FILE_NAME = "service-worker.js"

const DEFAULT_NETWORK_ONLY_PREFIXES = ["/api"] as const

/**
 * A stable name for one build's cache, so a new build is a new cache rather than a merged one.
 *
 * The asset names are already content-hashed by the bundler, so hashing the list of them is enough:
 * the same output means the same cache and no eviction, and one changed byte anywhere means a new one.
 */
function cacheNameFor(precache: readonly string[]): string {
  let hash = 2166136261

  for (const name of [...precache].sort()) {
    for (let index = 0; index < name.length; index += 1) {
      hash ^= name.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
  }

  return `jmouse-pwa-${(hash >>> 0).toString(36)}`
}

/** `/station/components/index.html?html-proxy` and `station/components/index.html` are the same entry. */
function normalizeEntryPath(candidate: string): string {
  const withoutQuery = candidate.split("?")[0] ?? candidate

  return withoutQuery.replace(/\\/g, "/").replace(/^\/+/, "")
}

function findStation(
  stations: readonly StationDefinition[],
  path: string,
  filename: string,
): StationDefinition | undefined {
  const requested = normalizeEntryPath(path)
  const resolved = normalizeEntryPath(filename)

  return stations.find((station) => {
    const entry = stationEntryPath(station)

    // The address is matched by suffix on purpose: a build reports the entry relative to the Vite root
    // while the dev server reports it relative to the origin, and a project served from a sub-path
    // reports it relative to neither.
    return requested === entry || requested === `${entry}/` || resolved.endsWith(entry)
  })
}

/**
 * Emits one manifest per station and links each from its own HTML entry.
 *
 * ⚠️ **One entry per station, and it cannot be consolidated.** A browser reads the manifest from the
 * document it loaded; changing `<link rel="manifest">` after navigation does not reliably re-arm the
 * installation prompt. So a single-entry application can offer exactly one installable identity —
 * whichever manifest happened to be linked at load — and several stations need several documents.
 *
 * ⚠️ **This is the ticket most likely to be tidied away later**, because per-station entries look like
 * duplication. They are not: every entry shares one bundle graph, so the stations cost one service
 * worker and one precache between them. Consolidating the entries breaks installation and nothing
 * else, which means it fails quietly, months afterwards, on somebody's phone.
 *
 * The product's own `index.html` deliberately gets no manifest. The shell is where a person picks a
 * station; it is not itself one.
 */
export function jmousePwa(options: JmousePwaOptions): Plugin {
  const { stations, serviceWorker = {}, paintIcons, ...manifestOptions } = options

  if (paintIcons !== undefined && manifestOptions.icons !== undefined) {
    throw new Error(
      "@jmouse/pwa: both 'icons' and 'paintIcons' were given. A station has one set of icons — name the "
        + "files it already has, or paint them from the product's mark, but not both.",
    )
  }

  let isBuild = false
  let logger: ResolvedConfig["logger"] | undefined
  /** Read from the build rather than assumed: a product may write its hashed output somewhere else. */
  let hashedAssetPrefix = "/assets/"

  const iconSourcesOf = (station: StationDefinition): ReadonlyMap<string, string> => {
    if (paintIcons === undefined) {
      return new Map()
    }

    const directory = stationIconDirectory(station)

    return new Map([
      [`${directory}${ICON_FILE_NAME}`, buildStationIconSvg(station, paintIcons.colours, paintIcons.draw)],
      [
        `${directory}${MASKABLE_ICON_FILE_NAME}`,
        buildMaskableIconSvg(station, paintIcons.colours, paintIcons.draw),
      ],
    ])
  }

  const effectiveManifestOptions: StationManifestOptions =
    paintIcons === undefined
      ? manifestOptions
      : {
          ...manifestOptions,
          // ⚠️ `sizes: "any"` rather than a list, because these really are every size — the icon is a
          // vector. A raster set would have to enumerate 192 and 512 and would then be wrong at 384.
          icons: (station) => {
            const directory = stationIconDirectory(station)

            return [
              {
                src: `/${directory}${ICON_FILE_NAME}`,
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any",
              },
              {
                src: `/${directory}${MASKABLE_ICON_FILE_NAME}`,
                sizes: "any",
                type: "image/svg+xml",
                purpose: "maskable",
              },
            ]
          },
        }

  const manifestOf = (station: StationDefinition) => buildStationManifest(station, effectiveManifestOptions)

  return {
    name: "jmouse-pwa",

    configResolved(config) {
      isBuild = config.command === "build"
      logger = config.logger
      hashedAssetPrefix = `${config.base}${config.build.assetsDir}/`.replace(/\/{2,}/g, "/")

      validateStations(stations)

      // Not a refusal: an icon set that has not been built yet is an ordinary state of a half-finished
      // product, and failing the build over it would stop the work that produces the icons. But it is
      // said out loud, because a manifest that cannot be installed is otherwise indistinguishable from
      // one that can.
      for (const station of stations) {
        for (const gap of describeInstallabilityGaps(manifestOf(station))) {
          config.logger.warn(`[jmouse-pwa] station '${station.key}' cannot be installed yet — ${gap}.`)
        }

        // Said separately from the gaps above because it is not about installability: iOS installs
        // happily without it and puts a SCREENSHOT of the page on the home screen, which looks like a
        // rendering fault rather than a missing file.
        if (paintIcons !== undefined && paintIcons.appleTouchIcon?.(station) === undefined) {
          config.logger.warn(
            `[jmouse-pwa] station '${station.key}' has no apple-touch-icon. iOS ignores the manifest's `
              + "icons, so it will use a screenshot of the page instead. Supply a PNG.",
          )
        }
      }
    },

    buildStart() {
      if (!isBuild) {
        return
      }

      for (const station of stations) {
        this.emitFile({
          type: "asset",
          fileName: stationManifestPath(station),
          source: `${JSON.stringify(manifestOf(station), null, 2)}\n`,
        })

        for (const [fileName, source] of iconSourcesOf(station)) {
          this.emitFile({ type: "asset", fileName, source })
        }
      }
    },

    generateBundle(_outputOptions, bundle) {
      if (serviceWorker === false) {
        return
      }

      // ⚠️ **The HTML entries are deliberately absent from the precache.** A document answered from a
      // cache is a document that can no longer discover a new manifest or a new bundle, which is the
      // precise shape of "unupdatable". They are fetched network-first and kept only as the offline
      // fallback — never preferred while the network is reachable.
      const precache = Object.keys(bundle)
        .filter((fileName) => !fileName.endsWith(".html"))
        .map((fileName) => `/${fileName}`)
        .sort()

      const source = buildWorkerSource({
        cacheName: cacheNameFor(precache),
        precache,
        networkOnlyPrefixes: serviceWorker.networkOnlyPrefixes ?? DEFAULT_NETWORK_ONLY_PREFIXES,
        hashedAssetPrefix: hashedAssetPrefix,
      })

      this.emitFile({ type: "asset", fileName: WORKER_FILE_NAME, source })

      logger?.info(`[jmouse-pwa] one worker at /${WORKER_FILE_NAME} precaching ${precache.length} assets`)
    },

    // The dev server has no emitted assets, and a station whose manifest 404s in development is a
    // station nobody can test the installation of until it is deployed.
    configureServer(server) {
      const served = new Map<string, { contentType: string; body: string }>()

      for (const station of stations) {
        served.set(`/${stationManifestPath(station)}`, {
          contentType: "application/manifest+json",
          body: `${JSON.stringify(manifestOf(station), null, 2)}\n`,
        })

        for (const [fileName, source] of iconSourcesOf(station)) {
          served.set(`/${fileName}`, { contentType: "image/svg+xml", body: source })
        }
      }

      if (serviceWorker !== false) {
        served.set(`/${WORKER_FILE_NAME}`, {
          contentType: "text/javascript",
          body: buildDevelopmentWorkerSource(),
        })
      }

      server.middlewares.use((request, response, next) => {
        const answer = served.get(`/${normalizeEntryPath(request.url ?? "")}`)

        if (answer === undefined) {
          next()

          return
        }

        response.setHeader("Content-Type", answer.contentType)
        response.end(answer.body)
      })
    },

    transformIndexHtml: {
      order: "pre",
      handler(_html, context) {
        const station = findStation(stations, context.path, context.filename)

        if (station === undefined) {
          return []
        }

        const tags: HtmlTagDescriptor[] = [
          {
            tag: "link",
            attrs: { rel: "manifest", href: `/${stationManifestPath(station)}` },
            injectTo: "head",
          },
          {
            // The browser chrome's colour, and the one half of the palette that CAN follow the live
            // theme — a product may rewrite this tag at runtime. The manifest's `theme_color` cannot:
            // it is read at launch, out of a file, before anything of the application runs.
            tag: "meta",
            attrs: { name: "theme-color", content: manifestOptions.themeColor },
            injectTo: "head",
          },
        ]

        // ⚠️ iOS reads NONE of the manifest — not the icons, not the name, not `display`. These three
        // tags are the whole of what it does read, and without them an installed station is a
        // screenshot of the page under the site's title, in a browser window.
        tags.push({
          tag: "meta",
          attrs: { name: "apple-mobile-web-app-capable", content: "yes" },
          injectTo: "head",
        })
        tags.push({
          // Otherwise iOS offers the document title — "Innoventa Components" — or the site's name, and
          // a home screen has room for about twelve characters before it truncates.
          tag: "meta",
          attrs: { name: "apple-mobile-web-app-title", content: station.shortName },
          injectTo: "head",
        })

        const appleTouchIcon = paintIcons?.appleTouchIcon?.(station)

        if (appleTouchIcon !== undefined) {
          tags.push({
            tag: "link",
            attrs: { rel: "apple-touch-icon", href: appleTouchIcon },
            injectTo: "head",
          })
        }

        logger?.info(`[jmouse-pwa] linked station '${station.key}' to /${stationManifestPath(station)}`)

        return tags
      },
    },
  }
}

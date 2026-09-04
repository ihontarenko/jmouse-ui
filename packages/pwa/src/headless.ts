/**
 * `@jmouse/pwa/headless` — everything this package knows, minus everything it draws.
 *
 * ⚠️ **This entry exists because installability is BEHAVIOUR and a shelf is a LOOK.** The two painted
 * components in this package — `StationShelf` and `InstallButton` — are built from `@jmouse/ui`, which
 * is one product family's render layer rather than a universal one. A product outside that family
 * still needs the manifest, the worker, the install prompt and the display mode; taking them through
 * the root entry would pull those two components into its module graph, and with them a component
 * library it deliberately does not carry.
 *
 * ⚠️ **The root entry is unchanged and is still the one to reach for.** A product already drawing with
 * `@jmouse/ui` gets the shelf for free and should take it: this entry is a narrowing, not a
 * replacement, and duplicating a tile grid is only worth it for a product whose tiles genuinely look
 * different.
 *
 * ⚠️ **Nothing here is a second implementation.** Every symbol below is re-exported from the same
 * module the root entry exports it from — so the two entries cannot drift, and a fix lands in both.
 */

export {
  validateStations,
  openStation,
  stationEntryPath,
  stationManifestPath,
  type PwaStation,
  type StationDefinition,
  type StationRequirement,
} from "./station.js"

export {
  buildStationManifest,
  describeInstallabilityGaps,
  type ManifestIcon,
  type StationManifest,
  type StationManifestOptions,
} from "./manifest.js"

export {
  buildMaskableIconSvg,
  buildStationIconSvg,
  MASKABLE_SAFE_FRACTION,
  type IconColours,
  type StationGlyph,
} from "./icons.js"

export {
  applyWorkerUpdate,
  registerStationWorker,
  unregisterStationWorkers,
  watchForUpdate,
  APPLY_UPDATE_MESSAGE,
  STATION_WORKER_ADDRESS,
  type RegisterStationWorkerOptions,
} from "./serviceWorker/register.js"

export { useWorkerUpdate, type WorkerUpdate } from "./serviceWorker/useWorkerUpdate.js"

export {
  capturedInstallPrompt,
  installCapability,
  requestInstall,
  subscribeToInstallPrompt,
  supportsManualInstall,
  type BeforeInstallPromptEvent,
  type InstallCapability,
} from "./install/prompt.js"

export { useInstallPrompt, type InstallPrompt } from "./install/useInstallPrompt.js"

export {
  launchedStation,
  useDisplayMode,
  useInstalledStation,
  useIsInstalled,
  type DisplayMode,
} from "./install/displayMode.js"

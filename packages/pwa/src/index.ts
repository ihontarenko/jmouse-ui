/**
 * `@jmouse/pwa` — how a product becomes installable.
 *
 * A **station** is one installable Progressive Web App: a surface set up for a single kind of work,
 * with only what that work needs. A product declares its stations; this package turns each one into a
 * manifest, registers the single service worker they all share, offers them from a shelf, and paints
 * their icons from the product's own mark.
 *
 * ⚠️ **Nothing in here knows what a product does.** A station is a task, and which tasks exist is the
 * product's business; so is who may see one — this package takes a predicate and calls it.
 *
 * ⚠️ **The Vite plugin is a separate entry — `@jmouse/pwa/vite`.** It runs in Node at build time and
 * must not pull React in behind it.
 *
 * ⚠️ **Relative imports here carry a `.js` extension, and every sibling package's do not.** That is
 * not drift. The others are only ever consumed through a bundler, which resolves an extensionless
 * specifier; `vite.config.ts` imports this one and Vite hands that file to **Node**, which does not.
 * Without the extension the plugin entry throws `ERR_MODULE_NOT_FOUND` for its own sibling module —
 * at the moment a product first tries to configure its build, and nowhere earlier.
 */

export {
  validateStations,
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

export { InstallButton, type InstallButtonProperties } from "./install/InstallButton.js"

export {
  openStation,
  StationShelf,
  type StationShelfProperties,
  type StationTileState,
} from "./shelf/StationShelf.js"

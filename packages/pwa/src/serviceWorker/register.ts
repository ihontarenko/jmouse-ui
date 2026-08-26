/** Where the generated worker is served from. It is the origin ROOT, and that is the whole design. */
export const STATION_WORKER_ADDRESS = "/service-worker.js"

/** The message the page sends to let a waiting worker take over. Nothing else calls `skipWaiting`. */
export const APPLY_UPDATE_MESSAGE = "JMOUSE_PWA_APPLY_UPDATE"

export interface RegisterStationWorkerOptions {
  /** Overridable for a product served from a sub-path; it must still be the root of that origin. */
  address?: string
  /** Called once a new worker is installed and waiting — the product decides how to say so. */
  onUpdateReady?: (registration: ServiceWorkerRegistration) => void
}

function supportsWorkers(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator
}

/**
 * Registers the **one** worker every station on this origin shares.
 *
 * ⚠️ **One registration at the origin root, never one per station.** Stations differ by manifest and
 * by the address they open at — never by scope. A scope each would give every station its own
 * registration, its own cache, its own share of the storage quota and its own update cycle, and a
 * phone would carry N copies of one bundle. Sharing the scope is what makes several stations cheap.
 *
 * ⚠️ **A worker whose script sits below the root silently gets that path as its scope.** Nothing
 * warns, nothing errors, and the failure looks like "offline works on some pages" months later. So the
 * resulting scope is checked here and complained about loudly — the fix is to serve the script from
 * the root, or to send `Service-Worker-Allowed`.
 */
export async function registerStationWorker(
  options: RegisterStationWorkerOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  if (!supportsWorkers()) {
    return null
  }

  const address = options.address ?? STATION_WORKER_ADDRESS
  const registration = await navigator.serviceWorker.register(address, { scope: "/" })

  const expected = new URL("/", window.location.origin).href

  if (registration.scope !== expected) {
    console.error(
      `[jmouse-pwa] the service worker registered at '${registration.scope}' rather than '${expected}'. `
        + "A worker served from below the root is scoped to that path, so stations outside it get no "
        + "offline behaviour at all — and nothing else will report this.",
    )
  }

  if (options.onUpdateReady !== undefined) {
    watchForUpdate(registration, options.onUpdateReady)
  }

  return registration
}

/**
 * Raises the callback the moment a new worker is installed and waiting.
 *
 * A worker that is installed with no controller is a **first** installation, not an update — telling
 * somebody a new version is ready the first time they open a product is how the prompt gets ignored
 * forever afterwards.
 */
export function watchForUpdate(
  registration: ServiceWorkerRegistration,
  onUpdateReady: (registration: ServiceWorkerRegistration) => void,
): void {
  if (registration.waiting && navigator.serviceWorker.controller) {
    onUpdateReady(registration)

    return
  }

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing

    if (!installing) {
      return
    }

    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        onUpdateReady(registration)
      }
    })
  })
}

/**
 * Lets the waiting worker take over, then reloads into it.
 *
 * ⚠️ **`skipWaiting` is asked for from here and nowhere else.** A worker that calls it in its own
 * install handler swaps itself in under whatever the reader is doing — which, in a product full of
 * forms, means losing one.
 */
export function applyWorkerUpdate(registration: ServiceWorkerRegistration): void {
  const waiting = registration.waiting

  if (!waiting) {
    return
  }

  let reloaded = false

  // `controllerchange` can fire more than once; reloading twice is a visible flicker and a lost scroll
  // position, so the guard is not defensive padding.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) {
      return
    }

    reloaded = true
    window.location.reload()
  })

  waiting.postMessage({ type: APPLY_UPDATE_MESSAGE })
}

/**
 * Removes every worker on this origin and empties its caches — the escape hatch.
 *
 * ⚠️ **This ships from the first day, deliberately.** A service worker that cannot be removed without
 * devtools turns one bad deploy into a permanent one for whoever installed the product first, and they
 * are exactly the people who cannot be asked to open devtools.
 */
export async function unregisterStationWorkers(): Promise<void> {
  if (!supportsWorkers()) {
    return
  }

  const registrations = await navigator.serviceWorker.getRegistrations()

  await Promise.all(registrations.map((registration) => registration.unregister()))

  if (typeof caches !== "undefined") {
    const names = await caches.keys()

    await Promise.all(names.map((name) => caches.delete(name)))
  }
}

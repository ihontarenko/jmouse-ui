import { useCallback, useEffect, useState } from "react"
import type { RegisterStationWorkerOptions } from "./register.js"
import { applyWorkerUpdate, registerStationWorker } from "./register.js"

export interface WorkerUpdate {
  /** A new build is installed and waiting. Nothing happens until {@link applyUpdate} is called. */
  readonly updateAvailable: boolean
  /** Hand the page over to the new build and reload into it. */
  readonly applyUpdate: () => void
}

/**
 * Registers the shared worker and reports when a new build is waiting.
 *
 * ⚠️ **The library detects; the product renders the prompt.** What a "new version is ready" notice
 * looks like — a toast, a bar, a dialog — and what it says are the product's, and a library that drew
 * one would put its own voice in every product at once.
 *
 * ⚠️ **Call it once, at the top of the application.** Every call registers, and `registerStationWorker`
 * is idempotent in the browser but the update listeners are not — mounting this in three screens gives
 * three reloads on one update.
 */
export function useWorkerUpdate(options: RegisterStationWorkerOptions = {}): WorkerUpdate {
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(null)

  const { address, onUpdateReady } = options

  useEffect(() => {
    let cancelled = false

    void registerStationWorker({
      address,
      onUpdateReady: (registration) => {
        if (cancelled) {
          return
        }

        setWaiting(registration)
        onUpdateReady?.(registration)
      },
    })

    return () => {
      cancelled = true
    }
  }, [address, onUpdateReady])

  const applyUpdate = useCallback(() => {
    if (waiting) {
      applyWorkerUpdate(waiting)
    }
  }, [waiting])

  return { updateAvailable: waiting !== null, applyUpdate }
}

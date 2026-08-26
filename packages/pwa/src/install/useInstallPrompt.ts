import { useCallback, useSyncExternalStore } from "react"
import type { InstallCapability } from "./prompt.js"
import { installCapability, requestInstall, subscribeToInstallPrompt } from "./prompt.js"

export interface InstallPrompt {
  /** What this browser can do about installing — see {@link InstallCapability}. */
  readonly capability: InstallCapability
  /** Ask. Answers `null` where there was nothing to ask with. */
  readonly install: () => Promise<"accepted" | "dismissed" | null>
}

/**
 * The installation offer, as React state.
 *
 * ⚠️ **Subscribed rather than read once.** `beforeinstallprompt` arrives after first paint as often as
 * not, so a component that reads the capability in its own initial state renders `unsupported` on a
 * browser that will be able to install a moment later — and never re-renders to correct itself.
 */
export function useInstallPrompt(): InstallPrompt {
  const capability = useSyncExternalStore<InstallCapability>(
    subscribeToInstallPrompt,
    installCapability,
    // Rendered on a server there is no browser to ask, and claiming otherwise would hydrate into a
    // button that does nothing.
    () => "unsupported",
  )

  const install = useCallback(() => requestInstall(), [])

  return { capability, install }
}

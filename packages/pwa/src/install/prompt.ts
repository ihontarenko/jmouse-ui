/**
 * The installation prompt, caught before anything can lose it.
 *
 * ⚠️ **`beforeinstallprompt` fires once, early, and is gone if nobody was listening.** It arrives
 * around first paint — usually before React has mounted, always before a person has navigated to a
 * shelf. A listener installed inside a component is a listener installed too late, and the failure is
 * an install button that simply never becomes enabled, on a browser that supports installing perfectly
 * well. So this module attaches its listener **at import time** and holds what it caught.
 */

/** Not in the DOM library, because it is not in any specification — only Chromium fires it. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
  prompt: () => Promise<void>
}

/**
 * What this browser can actually do about installing.
 *
 * ⚠️ **Read from capability, never from the user agent string.** A browser that lies about its name is
 * common; one that lies about which events it fires is not.
 */
export type InstallCapability =
  /** A prompt was caught — a button can work. */
  | "prompt"
  /** iOS Safari: no prompt exists, and the only path is Share → Add to Home Screen, done by hand. */
  | "manual"
  /** Nothing here can install anything — an iOS browser that is not Safari, or a desktop one without support. */
  | "unsupported"

let captured: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function announce(): void {
  for (const listener of listeners) {
    listener()
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Without this the browser shows its own bar wherever it likes, and the shelf's own control becomes
    // the second place the same offer appears.
    event.preventDefault()
    captured = event as BeforeInstallPromptEvent
    announce()
  })

  // The prompt is spent once it is accepted, and the event never fires again for that installation.
  window.addEventListener("appinstalled", () => {
    captured = null
    announce()
  })
}

export function subscribeToInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function capturedInstallPrompt(): BeforeInstallPromptEvent | null {
  return captured
}

/**
 * Whether this browser supports Safari's home-screen flow.
 *
 * `navigator.standalone` is Safari's own, and no other iOS browser carries it — which is exactly the
 * distinction that matters, because installing on iOS is a Safari-only act.
 */
export function supportsManualInstall(): boolean {
  return typeof navigator !== "undefined" && "standalone" in navigator
}

export function installCapability(): InstallCapability {
  if (captured !== null) {
    return "prompt"
  }

  if (supportsManualInstall()) {
    return "manual"
  }

  return "unsupported"
}

/**
 * Ask to install, and answer what the person chose.
 *
 * `null` where there was nothing to ask with — which is every iOS browser and every desktop one that
 * does not implement the prompt.
 */
export async function requestInstall(): Promise<"accepted" | "dismissed" | null> {
  const event = captured

  if (event === null) {
    return null
  }

  await event.prompt()

  const choice = await event.userChoice

  // Spent either way: a dismissed prompt cannot be re-shown from the same event.
  captured = null
  announce()

  return choice.outcome
}

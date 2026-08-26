import { Button, cn } from "@jmouse/ui"
import type { StationDefinition } from "../station.js"
import { useInstallPrompt } from "./useInstallPrompt.js"

export interface InstallButtonProperties {
  station: StationDefinition
  className?: string
  /** Overridable so a product speaks its own language; the iOS wording is a separate one below. */
  label?: string
  onInstalled?: () => void
}

/** iOS's own share mark. Drawn here rather than borrowed from an icon set, because the instruction is
 *  "tap the button that looks like *this*" and a generic share glyph does not look like it. */
function ShareGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("inline-block size-4 align-text-bottom", className)}
    >
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M6 11v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

/**
 * The offer to install one station — a control where a control can work, and a sign where it cannot.
 *
 * ⚠️ **On iOS this renders instructions and no button, and that is not a fallback to tidy up later.**
 * Safari fires no `beforeinstallprompt` and exposes no API to ask; the only path is a person doing
 * Share → Add to Home Screen themselves. So a component built around a button would be a button that
 * cannot ever work on roughly half the phones this is meant for — which is why the shelf must not be
 * laid out around one either.
 *
 * ⚠️ **In an iOS browser that is not Safari, nothing can be installed at all**, and this says so.
 * Offering an action that will silently do nothing is worse than admitting the browser is the problem.
 */
export function InstallButton({ station, className, label, onInstalled }: InstallButtonProperties) {
  const { capability, install } = useInstallPrompt()

  if (capability === "prompt") {
    return (
      <Button
        className={className}
        onClick={() => {
          void install().then((outcome) => {
            if (outcome === "accepted") {
              onInstalled?.()
            }
          })
        }}
      >
        {label ?? `Install ${station.shortName}`}
      </Button>
    )
  }

  if (capability === "manual") {
    return (
      <p className={cn("text-muted-foreground text-[12.5px] leading-relaxed", className)}>
        To keep {station.shortName} on your home screen, tap <ShareGlyph /> and choose{" "}
        <span className="text-foreground font-medium">Add to Home Screen</span>.
      </p>
    )
  }

  return (
    <p className={cn("text-muted-foreground text-[12.5px] leading-relaxed", className)}>
      This browser cannot install {station.shortName}. On iPhone and iPad, open the page in Safari;
      elsewhere, try Chrome or Edge.
    </p>
  )
}

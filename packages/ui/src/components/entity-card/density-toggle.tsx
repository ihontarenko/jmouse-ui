import { Rows2, Rows4 } from "lucide-react"
import { cn } from "../../lib/helpers"
import type { EntityCardDensity } from "./surface"

const CHOICES: Array<{ density: EntityCardDensity; label: string; Glyph: typeof Rows2 }> = [
  { density: "comfortable", label: "Roomy cards", Glyph: Rows2 },
  { density: "compact", label: "One line each", Glyph: Rows4 },
]

/**
 * How much room the cards on this screen get.
 *
 * ⚠️ **Two states shown at once, not one button that toggles.** A single button has to draw the state
 * it is *going to*, which is the one thing nobody can check against the screen — and on a grid that is
 * already dense, "which of these am I looking at" is a question the control should answer rather than
 * pose.
 *
 * ⚠️ **The preference is the caller's to keep.** This is a control, not a store: whether a choice
 * survives a reload, and whether it is per screen or per account, is a product's decision and not one
 * this package can make for three of them.
 */
export function EntityCardDensityToggle({
  density,
  onChange,
  className,
}: {
  density: EntityCardDensity
  onChange: (density: EntityCardDensity) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Card density"
      className={cn("inline-flex items-center gap-0.5 rounded-md border p-0.5", className)}
    >
      {CHOICES.map(({ density: choice, label, Glyph }) => (
        <button
          key={choice}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={density === choice}
          onClick={() => onChange(choice)}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            density === choice && "bg-secondary text-secondary-foreground",
          )}
        >
          <Glyph className="size-3.5" />
        </button>
      ))}
    </div>
  )
}

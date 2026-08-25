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
      /*
        ⚠️ **30px and `rounded-md` — a `Button size="sm"`, because that is the row it lives in.**

        It was a 24px pair inside a `p-0.5` track, so the whole control stood 29px against the 30px
        field and button beside it, and the *chosen* square stood 24px against their 30px. One pixel
        out is worse than plainly smaller: plainly smaller reads as a hierarchy, one pixel out reads as
        a mistake — and this control shares a header with a search field, a segmented switcher and a
        primary button on every screen that draws cards.

        ⚠️ The padding is gone rather than reduced. With a track inset, the frame can be made to match
        while the paint inside it still does not, and the paint is what an eye compares.
      */
      className={cn("inline-flex h-[30px] items-center rounded-md border p-0", className)}
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
            "inline-flex h-full w-[30px] items-center justify-center rounded-md text-muted-foreground transition-colors",
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

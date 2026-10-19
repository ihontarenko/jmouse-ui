import { joinClassNames } from "../lib/classNames"
import { SwatchPicker } from "../controls/ChoiceCards"
import { standardAxes } from "./appearance"
import { useAppearance } from "./AppearanceProvider"

/*
 * Innoventa's two quick appearance controls, same names and properties (`className` alone), driving the kit's axes:
 * the accent is the PALETTE axis, the typeface the FONT axis. Each swatch wears the palette it selects and reads the
 * ordinary tokens, so no colour is written twice.
 */

/** The accent, as swatches — each one dressed in the palette it chooses. */
export function AccentTonePicker({ className, label = "Tone" }: { className?: string; label?: string }) {
  const { choice, palettes, change } = useAppearance()
  return (
    <SwatchPicker
      label={label}
      value={choice.palette}
      onChange={(value) => change("palette", value)}
      className={className}
      options={palettes.map((palette) => ({
        value: palette.name,
        description: palette.label,
        colours: [palette.swatch, `color-mix(in srgb, ${palette.swatch} 70%, black)`, `color-mix(in srgb, ${palette.swatch} 40%, white)`, `color-mix(in srgb, ${palette.swatch} 14%, white)`] as const,
      }))}
    />
  )
}

/** The interface typeface, as specimens — each button set in the face it chooses. */
export function TypefacePicker({ className, label = "Typeface" }: { className?: string; label?: string }) {
  const { choice, change } = useAppearance()
  const faces = standardAxes.find((axis) => axis.axis === "font")?.options ?? []
  return (
    <span role="group" aria-label={label} className={joinClassNames("kit-typeface-picker", className)}>
      {faces.map((face) => (
        <button key={face.value} type="button" aria-pressed={choice.font === face.value} title={face.label} data-face={face.value} onClick={() => change("font", face.value as typeof choice.font)}>
          <span aria-hidden="true">Agк1</span>
          <span className="kit-visually-hidden">{face.label}</span>
        </button>
      ))}
    </span>
  )
}

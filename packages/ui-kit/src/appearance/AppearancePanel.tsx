import { Badge } from "../controls/Labels"
import { Button } from "../controls/Button"
import { Segmented } from "../controls/Choices"
import { standardAxes, type AppearanceAxis, type AppearanceChoice, type AxisDefinition } from "./appearance"
import { useAppearance } from "./AppearanceProvider"

export interface AppearancePanelProperties {
  /** The axes to offer, in order; the theme, the mode and the palette always come first. Defaults to every standard axis. */
  axes?: AxisDefinition[]
  themeLegend?: string
  modeLegend?: string
  systemLabel?: string
  lightLabel?: string
  darkLabel?: string
  paletteLegend?: string
  resetLabel?: string
}

/**
 * Every appearance axis as a labelled strip, applied as it is chosen, with a specimen at the foot that shows the
 * accent, the status tones and the type at the chosen size. Place it in a dialog or on a settings page.
 */
export function AppearancePanel({ axes = standardAxes, themeLegend = "Theme", modeLegend = "Mode", systemLabel = "System", lightLabel = "Light", darkLabel = "Dark", paletteLegend = "Palette", resetLabel = "Reset to defaults" }: AppearancePanelProperties) {
  const { choice, themes, palettes, change, reset } = useAppearance()

  return (
    <div className="kit-appearance">
      <fieldset className="kit-appearance-axis" data-wide="">
        <legend className="kit-micro-label">{themeLegend}</legend>
        <Segmented
          label={themeLegend}
          value={choice.theme}
          onValueChange={(value) => change("theme", value)}
          options={themes.map((theme) => ({ value: theme.name, label: theme.label }))}
        />
      </fieldset>
      <fieldset className="kit-appearance-axis" data-wide="">
        <legend className="kit-micro-label">{modeLegend}</legend>
        <Segmented
          label={modeLegend}
          value={choice.mode}
          onValueChange={(value) => change("mode", value)}
          options={[{ value: "system", label: systemLabel }, { value: "light", label: lightLabel }, { value: "dark", label: darkLabel }]}
        />
      </fieldset>
      <fieldset className="kit-appearance-axis" data-wide="">
        <legend className="kit-micro-label">{paletteLegend}</legend>
        <Segmented
          label={paletteLegend}
          value={choice.palette}
          onValueChange={(value) => change("palette", value)}
          options={palettes.map((palette) => ({ value: palette.name, label: palette.label, swatch: palette.swatch }))}
        />
      </fieldset>
      {axes.map((definition) => (
        <fieldset key={definition.axis} className="kit-appearance-axis" data-wide={definition.wide ? "" : undefined}>
          <legend className="kit-micro-label">{definition.legend}</legend>
          <Segmented
            label={definition.legend}
            size="small"
            value={choice[definition.axis]}
            onValueChange={(value) => change(definition.axis as AppearanceAxis, value as AppearanceChoice[AppearanceAxis])}
            options={definition.options}
          />
        </fieldset>
      ))}
      <div className="kit-appearance-specimen">
        <Button variant="primary">Primary</Button>
        <Button>Default</Button>
        <Badge tone="good">Running</Badge>
        <Badge tone="warn">Limited</Badge>
        <Badge tone="danger">Failed</Badge>
        <span className="kit-technical">10 kΩ · 4.7 µF · 3.3 V</span>
        <span className="kit-toolbar-push" />
        <Button variant="quiet" size="small" icon="refresh" onClick={reset}>{resetLabel}</Button>
      </div>
    </div>
  )
}

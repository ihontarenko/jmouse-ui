import type { CSSProperties } from "react";
import type { CurrentColor, CurrentStyle, SimulatorAppearance, LeadMode } from "@jmouse/parallax";
import { Segmented } from "../controls/Segmented";
import { CURRENT_COLORS, CURRENT_STYLES, ELECTRON_LAYERS, electronDashes, lightDashes } from "@jmouse/parallax/circuit";
import { flowStyle } from "./useSimulatorAppearance";

/**
 * How the simulator draws current, as the reader chooses it: the flowing colour, the colour of a current too fast to be
 * shown moving, the brightness and the spacing of the lights — each shown on a wire as it will be drawn. Controlled: the
 * host keeps the choice (Parallax on the reader's account) and is told of every change; `continuous` marks a slider
 * still moving, so a host that saves can wait for it to rest.
 */
export function SimulatorAppearanceControls({ value: appearance, onChange }: {
  value: SimulatorAppearance;
  onChange: (next: SimulatorAppearance, change: { continuous: boolean }) => void;
}) {
  const change = (changes: Partial<SimulatorAppearance>, continuous = false) => onChange({ ...appearance, ...changes }, { continuous });
  const swatch = (token: string) => <i className="parallax-color-dot" style={{ "--parallax-swatch": token } as CSSProperties} />;
  const colourChoices = CURRENT_COLORS.map((choice) => ({ value: choice.value, label: <>{swatch(choice.token)}{choice.label}</> }));
  const colours = (label: string, value: CurrentColor, onChange: (color: CurrentColor) => void) => (
    <fieldset className="parallax-appearance-row">
      <legend>{label}</legend>
      <Segmented label={label} value={value} onChange={onChange} options={colourChoices} />
    </fieldset>
  );
  const slider = (id: string, label: string, shown: string, value: number, minimum: number, maximum: number, step: number,
                  onSlide: (value: number) => void, hint?: string) => (
    <div className="parallax-appearance-row">
      <label htmlFor={id}>{label}</label>
      <div className="parallax-appearance-slider">
        <input id={id} className="parallax-range" type="range" min={minimum} max={maximum} step={step} value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          style={{ "--parallax-fill": `${(value - minimum) / (maximum - minimum) * 100}%` } as CSSProperties}
          onChange={(event) => onSlide(Number(event.target.value))} />
        <output htmlFor={id}>{shown}</output>
      </div>
      {hint ? <p id={`${id}-hint`} className="parallax-hint">{hint}</p> : null}
    </div>
  );
  const style = appearance.currentStyle ?? "LIGHT";
  const dashes = lightDashes(appearance.lightSpacing);
  // The preview's wire carries a strong current: every layer of electrons lit, as the sheet lights them near the largest.
  const electrons = style === "ELECTRONS" ? Array.from({ length: ELECTRON_LAYERS }, (_, layer) => electronDashes("preview", layer, appearance.lightSpacing)) : [];
  const shown = Math.min(1, 0.8 * appearance.currentIntensity);
  // A settings sheet, as the product's own Appearance is: sections, and in each one row per setting — its name in a
  // fixed column, its control beside it — so every control starts on the same line.
  return (
    <div className="parallax-appearance-sheet">
      <svg className={`parallax-current-preview parallax-flow-${style.toLowerCase()}`} viewBox="0 0 320 70" role="img" aria-label="A wire carrying current and one carrying an alternation too fast to show, drawn as chosen" style={flowStyle(appearance)}>
        <path className="parallax-current-preview-wire" d="M10 22H310M10 50H310" />
        <path className="parallax-current-preview-tube" d="M10 22H310" style={{ opacity: (style === "ELECTRONS" ? 0.14 : 0.5) * shown }} />
        {style === "ELECTRONS" ? electrons.map((layer, index) => (
          <path key={index} className="parallax-current-preview-electrons" d="M10 22H310"
            style={{ strokeDasharray: layer.dashes, opacity: shown, "--parallax-scatter": `${layer.length}` } as CSSProperties} />
        )) : <>
          <path className="parallax-current-preview-glow" d="M10 22H310" style={{ strokeDasharray: dashes.glow, opacity: 0.75 * shown, "--parallax-period": `${appearance.lightSpacing}` } as CSSProperties} />
          <path className="parallax-current-preview-core" d="M10 22H310" style={{ strokeDasharray: dashes.core, opacity: shown, "--parallax-period": `${appearance.lightSpacing}` } as CSSProperties} />
        </>}
        <path className="parallax-current-preview-alternating parallax-forward" d="M10 50H310" style={{ opacity: 0.85 * shown }} />
        <path className="parallax-current-preview-alternating parallax-back" d="M10 50H310" style={{ opacity: shown }} />
      </svg>
      <section className="parallax-appearance-section" aria-label="Current">
        <h3>Current</h3>
        <fieldset className="parallax-appearance-row">
          <legend>Drawn as</legend>
          <Segmented label="How current is drawn" value={appearance.currentStyle ?? "LIGHT"} onChange={(currentStyle: CurrentStyle) => change({ currentStyle })}
            options={CURRENT_STYLES.map((style) => ({ value: style.value, label: style.label, title: style.title }))} />
        </fieldset>
        {colours("Flowing", appearance.currentColor, (currentColor) => change({ currentColor }))}
        {colours("Too fast to show", appearance.alternatingColor, (alternatingColor) => change({ alternatingColor }))}
        <fieldset className="parallax-appearance-row">
          <legend>Running back</legend>
          <Segmented label="Lights running back on it" value={appearance.alternatingReturnColor}
            onChange={(alternatingReturnColor: CurrentColor | "SAME") => change({ alternatingReturnColor })}
            options={[{ value: "SAME" as const, label: "Same" }, ...colourChoices]} />
        </fieldset>
        {slider("alternating-threshold", "Calm above", `${appearance.alternatingThreshold} Hz`, appearance.alternatingThreshold, 0.5, 10, 0.5,
          (alternatingThreshold) => change({ alternatingThreshold }, true),
          "A wire whose current turns back more often than this, in the seconds you watch, is drawn as two calm rows of lights.")}
        {slider("current-intensity", "Brightness", `${Math.round(appearance.currentIntensity * 100)} %`, appearance.currentIntensity, 0.25, 2, 0.05,
          (currentIntensity) => change({ currentIntensity }, true))}
        {slider("light-spacing", "Spacing of lights", String(appearance.lightSpacing), appearance.lightSpacing, 12, 48, 4,
          (lightSpacing) => change({ lightSpacing }, true))}
      </section>
      <section className="parallax-appearance-section" aria-label="Power">
        <h3>Power</h3>
        {colours("Taking power", appearance.takingColor, (takingColor) => change({ takingColor }))}
        {colours("Giving it back", appearance.givingColor, (givingColor) => change({ givingColor }))}
      </section>
      <section className="parallax-appearance-section" aria-label="Leads">
        <h3>Leads to instruments</h3>
        <fieldset className="parallax-appearance-row">
          <legend>How they lie</legend>
          <Segmented label="Leads to instruments" value={appearance.leadMode} onChange={(leadMode: LeadMode) => change({ leadMode })}
            options={[{ value: "HANGING", label: "Hanging" }, { value: "TABLE", label: "On the table" }]} />
        </fieldset>
        {slider("lead-sag", "Sag", `${Math.round(appearance.leadSag * 100)} %`, appearance.leadSag, 0, 2, 0.05,
          (leadSag) => change({ leadSag }, true))}
      </section>
      <section className="parallax-appearance-section" aria-label="Oscilloscope">
        <h3>Oscilloscope</h3>
        {slider("scope-trails", "Trails", `${appearance.scopeTrails} sweeps`, appearance.scopeTrails, 2, 32, 1,
          (scopeTrails) => change({ scopeTrails }, true),
          "With Trails on, the last sweeps stay under the live trace, each older one fainter and thinner — a trace that shakes reads as a soft band.")}
        {slider("scope-trail-intensity", "Trail brightness", `${Math.round(appearance.scopeTrailIntensity * 100)} %`, appearance.scopeTrailIntensity, 0.1, 1, 0.05,
          (scopeTrailIntensity) => change({ scopeTrailIntensity }, true))}
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { CircuitElement } from "@jmouse/parallax/circuit";
import { passiveDefaults, type BenchSetup, type Corner } from "@jmouse/parallax/bench";
import { Segments, Stepper } from "../controls/BenchControls";
import { ToolMenu, ToolMenuSection } from "../controls/ToolMenu";
import { useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";

/** The bench's range of temperatures, as the bench accepts them (`benchSetup`): an industrial part's −40 … 125 °C. */
const COLDEST = -40;
const HOTTEST = 125;

/** The temperatures a datasheet is written at: cold storage, freezing, the room, a hot box, a car's bonnet. */
const PRESETS = [-40, 0, 25, 85, 125];

const CORNERS: { value: string; label: string; title: string }[] = [
  { value: "-1", label: "Lower", title: "Every passive at the low end of its tolerance" },
  { value: "0", label: "Nominal", title: "Every passive at its written value" },
  { value: "1", label: "Upper", title: "Every passive at the high end of its tolerance" },
];

function cornerName(corner: Corner): string {
  return corner === 0 ? "nominal" : corner > 0 ? "upper corner" : "lower corner";
}

/**
 * The bench's environment, behind one button on the bench bar beside Ideal | Realistic — the conditions every part
 * runs in, together: the ambient temperature (every part feels it, a model through its own drifts), the tolerance
 * corner, and each passive's tolerance and temperature coefficient. The temperature is a slider over the whole range
 * with the datasheet temperatures one click away; it is applied when the slider is let go, so a drag restarts the run
 * once, not at every step of it.
 */
export function BenchEnvironment({ setup, onSetup }: {
  setup: BenchSetup;
  onSetup: (change: (setup: BenchSetup) => BenchSetup) => void;
}) {
  const library = useParallaxPartLibrary();
  const [draft, setDraft] = useState(setup.temperature);
  useEffect(() => setDraft(setup.temperature), [setup.temperature]);
  const apply = (temperature: number) => {
    const bounded = Math.min(HOTTEST, Math.max(COLDEST, Math.round(temperature)));
    setDraft(bounded);
    if (bounded !== setup.temperature) {
      onSetup((current) => ({ ...current, temperature: bounded }));
    }
  };
  const passives = setup.circuit.elements.filter((element) => element.type === "RESISTOR" || element.type === "CAPACITOR");
  const summary = `${setup.temperature} °C · ${cornerName(setup.corner)}`;
  return (
    <ToolMenu label={summary} icon="thermometer" part="bench-environment" align="start" wide
      title={`Environment: ${setup.temperature} °C ambient, ${cornerName(setup.corner)}${passives.length ? `, ${passives.length} passive${passives.length === 1 ? "" : "s"} with tolerances` : ""}`}>
      <ToolMenuSection title="Ambient temperature">
        <div className="parallax-environment-temperature">
          <output aria-live="polite" className={draft !== setup.temperature ? "parallax-pending" : undefined}>{draft} °C</output>
          <Stepper label="Ambient temperature" value={setup.temperature} unit="°C" step={1} minimum={COLDEST} maximum={HOTTEST}
            format={(value) => `${value} °C`} onChange={apply} />
        </div>
        <input type="range" className="parallax-environment-slider" aria-label="Ambient temperature, °C" min={COLDEST} max={HOTTEST} step={1} value={draft}
          onChange={(event) => setDraft(Number(event.target.value))}
          onPointerUp={() => apply(draft)} onKeyUp={() => apply(draft)} onBlur={() => apply(draft)} />
        <div className="parallax-environment-scale" aria-hidden="true"><span>{COLDEST} °C</span><span>{HOTTEST} °C</span></div>
        <Segments wide label="A datasheet temperature" value={String(setup.temperature)} onChange={(value) => apply(Number(value))}
          options={PRESETS.map((temperature) => ({ value: String(temperature), label: `${temperature}°`, title: `${temperature} °C` }))} />
      </ToolMenuSection>
      <ToolMenuSection title="Tolerance corner">
        <Segments wide label="Tolerance corner" value={String(setup.corner)} options={CORNERS}
          onChange={(corner) => onSetup((current) => ({ ...current, corner: Number(corner) as Corner }))} />
      </ToolMenuSection>
      {passives.length ? (
        <ToolMenuSection title="Passives">
          <table className="parallax-table parallax-dense parallax-environment-table">
            <thead><tr><th scope="col">Part</th><th scope="col" className="parallax-numeric">Tolerance, ±%</th><th scope="col" className="parallax-numeric">Drift, ppm/°C</th></tr></thead>
            <tbody>
              {passives.map((element) => <PassiveRow key={element.id} element={element} setup={setup} onSetup={onSetup}
                defaults={passiveDefaults(library, element)} />)}
            </tbody>
          </table>
        </ToolMenuSection>
      ) : null}
    </ToolMenu>
  );
}

function PassiveRow({ element, setup, onSetup, defaults }: {
  element: CircuitElement;
  setup: BenchSetup;
  onSetup: (change: (setup: BenchSetup) => BenchSetup) => void;
  defaults: { percent: number; coefficient: number };
}) {
  const setting = setup.tolerances[element.id] ?? defaults;
  const change = (changes: Partial<typeof setting>) => onSetup((current) => ({ ...current, tolerances: { ...current.tolerances, [element.id]: { ...setting, ...changes } } }));
  return (
    <tr>
      <td className="parallax-monospace">{element.id}</td>
      <td className="parallax-numeric"><input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" aria-label={`${element.id} tolerance, percent`} type="number" min="0" max="30" step="0.1" value={setting.percent}
        onChange={(event) => change({ percent: Number(event.target.value) })} /></td>
      <td className="parallax-numeric"><input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" aria-label={`${element.id} coefficient, ppm per degree`} type="number" min="-2000" max="2000" step="1" value={setting.coefficient}
        onChange={(event) => change({ coefficient: Number(event.target.value) })} /></td>
    </tr>
  );
}

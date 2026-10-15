import { useParallaxTransport, useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import type { CSSProperties } from "react";
import type { LiveControl } from "@jmouse/parallax";
import type { ParameterDefinition } from "@jmouse/parallax";
import { useAsync } from "../support/useAsync";
import { ParameterSlider } from "../viewers/ParameterSlider";
import { type CircuitDefinition, type CircuitElement, type SourceWaveform } from "@jmouse/parallax/circuit";
import { Segments, Tool } from "../controls/BenchControls";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { QuantityField } from "../controls/QuantityField";
import { PanelSection } from "../controls/PanelSection";
import { passiveDefaults, type BenchSetup, type Corner } from "@jmouse/parallax/bench";

const WAVEFORMS: { value: SourceWaveform; label: string; title: string }[] = [
  { value: "STEP", label: "Step", title: "A step at t = 0" },
  { value: "DC", label: "DC", title: "Constant" },
];

/**
 * The circuit's side of the bench (the template's emulator side column), in the order a reader reaches for it: the
 * values it was written with, the parts worked while it runs, the sources that drive it, the simulation window and —
 * folded — the environment and the models inside it.
 */
export function CircuitPanel({ parameters, values, onValue, onResetValues, controls, onControl, setup, onSetup, problem, onResetSetup, live, saved }: {
  parameters: readonly ParameterDefinition[];
  values: Record<string, number>;
  onValue: (name: string, value: number) => void;
  onResetValues: () => void;
  controls: readonly LiveControl[];
  onControl: (control: LiveControl, value: number) => void;
  setup: BenchSetup;
  onSetup: (change: (setup: BenchSetup) => BenchSetup) => void;
  problem: string | null;
  onResetSetup: () => void;
  /** A live run: it runs on, so the analyses' window does not apply. */
  live: boolean;
  /** The circuit as saved: a part's values are "changed" only where the bench differs from it. */
  saved: CircuitDefinition;
}) {
  const library = useParallaxPartLibrary();
  const elements = setup.circuit.elements;
  const sources = elements.filter((element) => element.type === "VOLTAGE_SOURCE" || element.type === "CURRENT_SOURCE");
  const passives = elements.filter((element) => element.type === "RESISTOR" || element.type === "CAPACITOR");
  const models = elements.filter((element) => element.type === "MODEL");
  const changeElement = (id: string, changes: Partial<CircuitElement>) => onSetup((current) => ({
    ...current, circuit: { ...current.circuit, elements: current.circuit.elements.map((element) => element.id === id ? { ...element, ...changes } : element) },
  }));

  return (
    <>
      <PanelSection storageKey="bench.values" title="Values" opened summary={parameters.length ? `${parameters.length}` : "none"}
        actions={parameters.length ? <Tool tone="quiet" onClick={onResetValues}>Reset</Tool> : null}>
        {parameters.length === 0 ? <p>Every value of this circuit is written into it.</p> : null}
        {parameters.map((parameter) => <ParameterSlider key={parameter.name} parameter={parameter} idPrefix="value" bounds={false} value={values[parameter.name] ?? parameter.defaultValue}
          onChange={(value) => onValue(parameter.name, value)} />)}
      </PanelSection>

      {controls.length ? (
        <PanelSection storageKey="bench.live-parts" title="Live parts" opened summary="work them while it runs">
          <LiveParts controls={controls} onSet={onControl} />
        </PanelSection>
      ) : null}

      {sources.map((source) => {
        const unit = source.type === "VOLTAGE_SOURCE" ? "V" : "A";
        return (
          <PanelSection key={source.id} storageKey={`bench.part.${source.id}`}
            title={`${source.id} · ${source.type === "VOLTAGE_SOURCE" ? "voltage source" : "current source"}`} summary={source.waveform ?? "DC"}>
            <div className="parallax-control-row">
              <span>Waveform</span>
              <Segments label={`${source.id} waveform`} value={source.waveform ?? "DC"} options={WAVEFORMS}
                onChange={(waveform) => changeElement(source.id, { waveform })} />
            </div>
            <SourceValue source={source} unit={unit} parameters={parameters} values={values}
              onChange={(value) => changeElement(source.id, { value })} />
            <div className="parallax-control-row">
              <label htmlFor={`${source.id}-offset`}>Offset, {unit}</label>
              <input id={`${source.id}-offset`} data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" value={setup.offsets[source.id] ?? ""} placeholder="0" spellCheck={false}
                onChange={(event) => onSetup((current) => ({ ...current, offsets: { ...current.offsets, [source.id]: event.target.value } }))} />
            </div>
          </PanelSection>
        );
      })}

      {live ? null : (
        <PanelSection storageKey="bench.simulation" title="Simulation" summary={`${setup.circuit.time.maximum} s`}>
          <QuantityField compact label="Window" unit="s" value={setup.circuit.time.maximum} minimum={1e-9} maximum={1e3}
            onChange={(maximum) => onSetup((current) => ({ ...current, circuit: { ...current.circuit, time: { ...current.circuit.time, maximum } } }))} />
          <p>How long an analysis runs.</p>
        </PanelSection>
      )}

      {/* Every part feels the temperature — a model through its own drifts —; the tolerances are the passives'. */}
      <PanelSection storageKey="bench.environment" title="Environment and tolerances"
          summary={`${setup.temperature} °C · ${setup.corner === 0 ? "nominal" : setup.corner > 0 ? "upper corner" : "lower corner"}`}>
            <QuantityField compact label="Temperature" unit="°C" value={setup.temperature} minimum={-40} maximum={125}
              onChange={(temperature) => onSetup((current) => ({ ...current, temperature }))} />
            <div className="parallax-control-row">
              <span>Corner</span>
              <Segments label="Tolerance corner" value={String(setup.corner)} wide
                onChange={(corner) => onSetup((current) => ({ ...current, corner: Number(corner) as Corner }))}
                options={[{ value: "-1", label: "−", title: "Lower corner" }, { value: "0", label: "Nominal" }, { value: "1", label: "+", title: "Upper corner" }]} />
            </div>
            {passives.length ? <table className="parallax-table parallax-dense">
              <thead><tr><th scope="col">Part</th><th scope="col" className="parallax-numeric">±%</th><th scope="col" className="parallax-numeric">ppm/°C</th></tr></thead>
              <tbody>
                {passives.map((element) => {
                  const setting = setup.tolerances[element.id] ?? passiveDefaults(library, element);
                  const change = (changes: Partial<typeof setting>) => onSetup((current) => ({ ...current, tolerances: { ...current.tolerances, [element.id]: { ...setting, ...changes } } }));
                  return (
                    <tr key={element.id}>
                      <td className="parallax-monospace">{element.id}</td>
                      <td className="parallax-numeric"><input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" aria-label={`${element.id} tolerance, percent`} type="number" min="0" max="30" step="0.1" value={setting.percent}
                        onChange={(event) => change({ percent: Number(event.target.value) })} /></td>
                      <td className="parallax-numeric"><input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" aria-label={`${element.id} coefficient, ppm per degree`} type="number" min="-2000" max="2000" step="1" value={setting.coefficient}
                        onChange={(event) => change({ coefficient: Number(event.target.value) })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table> : null}
        </PanelSection>

      {models.map((element) => <ModelOverrides key={element.id} element={element}
        written={saved.elements.find((candidate) => candidate.id === element.id)?.overrides ?? {}}
        onChange={(overrides) => changeElement(element.id, { overrides })} />)}

      <div className="parallax-side-note">
        {problem ? <span className="parallax-diagnostic parallax-danger" role="alert"><ParallaxIcon name="error" />{problem}</span> : <span>Every change runs at once; nothing here is saved to the circuit.</span>}
        <Tool onClick={onResetSetup}>Reset the bench</Tool>
      </div>
    </>
  );
}

/**
 * A source's value. Written as one of the circuit's values — `U` — it is that value's slider's, and is shown as what it
 * reads and whose it is: a field holding the bare letter looked like a control and did nothing a reader could see.
 * «Unbind» writes the number it reads now in its place, and the field is the reader's again.
 */
function SourceValue({ source, unit, parameters, values, onChange }: {
  source: CircuitElement;
  unit: string;
  parameters: readonly ParameterDefinition[];
  values: Record<string, number>;
  onChange: (value: string) => void;
}) {
  const id = `${source.id}-value`;
  const bound = parameters.find((parameter) => parameter.name === (source.value ?? "").trim());
  if (bound) {
    const reading = values[bound.name] ?? bound.defaultValue;
    return (
      <div className="parallax-control-row">
        <span>Value, {unit}</span>
        <output className="parallax-monospace" title={`Set by the «${bound.label || bound.name}» slider above`}>
          {Number(reading.toPrecision(4))} {unit} · {bound.label || bound.name}
        </output>
        <Tool tone="quiet" title="Write this number in its place: the field is yours, the slider no longer moves it" onClick={() => onChange(String(Number(reading.toPrecision(6))))}>Unbind</Tool>
      </div>
    );
  }
  return (
    <div className="parallax-control-row">
      <label htmlFor={id}>Value, {unit}</label>
      <input id={id} data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" value={source.value ?? ""} spellCheck={false}
        onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

/**
 * The parts a circuit lets the reader work while it runs, as the bench panel shows them: a part with several values is
 * one group under its name, each value named by its parameter, what it means on hover.
 */
export function LiveParts({ controls, onSet }: { controls: readonly LiveControl[]; onSet: (control: LiveControl, value: number) => void }) {
  const parts = [...new Set(controls.map((control) => control.part))];
  return <div className="parallax-stack-tight" role="group" aria-label="Live parts">
    {parts.map((part) => {
      const own = controls.filter((control) => control.part === part);
      const grouped = own.length > 1;
      return <div key={part} className={grouped ? "parallax-live-part-group" : undefined}>
        {grouped ? <h4 className="parallax-live-part-name">{part}</h4> : null}
        {own.map((control) => <LivePart key={`${control.part}-${control.parameter}`} control={control} grouped={grouped} onSet={(value) => onSet(control, value)} />)}
      </div>;
    })}
  </div>;
}

/** A parameter's name as a label: `V_positive` reads "V positive". */
function readableName(parameter: string): string {
  return parameter.replace(/_/g, " ");
}

/** A switch toggles, a button is closed while it is held, a wiper slides — each goes on from now (`.live-part`). */
function LivePart({ control, grouped, onSet }: { control: LiveControl; grouped: boolean; onSet: (value: number) => void }) {
  const name = control.kind !== "SLIDER" ? control.part : grouped ? readableName(control.parameter) : `${control.part} · ${readableName(control.parameter)}`;
  const id = `live-${control.part}-${control.parameter}`;
  if (control.kind === "TOGGLE") {
    const on = control.value >= 0.5;
    return (
      <div className="parallax-live-part">
        <label htmlFor={id}>{name} <span className="parallax-technical">{on ? "closed" : "open"}</span></label>
        <input id={id} className="parallax-switch" type="checkbox" checked={on} aria-label={`${control.part}: ${on ? "closed" : "open"}`}
          onChange={() => onSet(on ? control.minimum : control.maximum)} />
      </div>
    );
  }
  if (control.kind === "MOMENTARY") {
    const held = control.value >= 0.5;
    return (
      <div className="parallax-live-part">
        <span>{name} <span className="parallax-technical">{held ? "closed" : "open"}</span></span>
        <button type="button" data-parallax-part="button" className="parallax-button parallax-small" aria-pressed={held}
          onPointerDown={() => onSet(control.maximum)} onPointerUp={() => onSet(control.minimum)}
          onPointerLeave={() => held && onSet(control.minimum)}
          onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onSet(control.maximum); } }}
          onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { onSet(control.minimum); } }}>Hold</button>
      </div>
    );
  }
  const span = control.maximum - control.minimum;
  return (
    <div className="parallax-live-part" title={control.label}>
      <label htmlFor={id}>{name}</label>
      <output htmlFor={id}>{Number(control.value.toPrecision(3))}</output>
      <input id={id} className="parallax-range" type="range" min={control.minimum} max={control.maximum} step={control.step} value={control.value}
        style={{ "--parallax-fill": `${span > 0 ? (control.value - control.minimum) / span * 100 : 0}%` } as CSSProperties}
        onChange={(event) => onSet(Number(event.target.value))} />
    </div>
  );
}

function ModelOverrides({ element, written, onChange }: {
  element: CircuitElement;
  /** What the saved circuit sets on this part: where the bench starts, not a change. */
  written: Record<string, string>;
  onChange: (overrides: Record<string, string>) => void;
}) {
  const transport = useParallaxTransport();
  const reference = element.component ?? "";
  const model = useAsync((signal) => transport.components.model(reference, signal), [reference], !!reference);
  const now = element.overrides ?? {};
  const changed = [...new Set([...Object.keys(now), ...Object.keys(written)])].filter((name) => now[name] !== written[name]).length;
  return (
    <PanelSection storageKey={`bench.part.${element.id}`} title={`${element.id} · ${model.data?.name ?? reference}`}
      summary={changed ? `${changed} changed` : undefined}>
        {model.error ? <span className="parallax-diagnostic parallax-danger"><ParallaxIcon name="error" />{model.error.detail}</span> : null}
        {model.data?.parameters.map((parameter) => (
          <div key={parameter.name} className="parallax-control-row" title={parameter.description ?? ""}>
            <label htmlFor={`${element.id}-${parameter.name}`} className="parallax-monospace">{parameter.name}</label>
            <input id={`${element.id}-${parameter.name}`} data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" value={element.overrides?.[parameter.name] ?? ""} placeholder={String(parameter.value)}
              onChange={(event) => {
                const overrides = { ...element.overrides };
                if (event.target.value.trim()) {
                  overrides[parameter.name] = event.target.value;
                } else {
                  delete overrides[parameter.name];
                }
                onChange(overrides);
              }} />
          </div>
        ))}
        {model.data ? <p className="parallax-hint">Blank keeps the component's own value; the saved component does not change.</p> : null}
    </PanelSection>
  );
}

import { useEffect, useState } from "react";
import { DEFAULT_MATH, channelName, windowOf, type MathChannel, type SampleMemory, type ScopeSettings } from "@jmouse/parallax/oscilloscope";
import { formatQuantity } from "@jmouse/parallax/quantities";
import { MATH_OPERATIONS, mathName, mathReading, mathUnit, mathUnitsOf, type ReadoutRow } from "@jmouse/parallax/scope";
import { Segments, Stepper } from "../controls/BenchControls";
import { TraceColor } from "./TraceColor";

/**
 * The math channel on the front panel: on or off, how it combines, which two channels, its scale and its zero — the
 * same rows a channel has, so it reads as a channel of its own.
 */
export function MathSection({ settings, onChange }: { settings: ScopeSettings; onChange: (math: MathChannel) => void }) {
  const math = settings.math ?? DEFAULT_MATH;
  const change = (changes: Partial<MathChannel>) => onChange({ ...math, ...changes });
  const unit = mathUnit(math, mathUnitsOf(math, settings));
  return (
    <section data-parallax-part="channel" aria-label="Math channel"
      className={`parallax-channel parallax-probe-channel parallax-probe-${math.color}${math.enabled ? "" : " parallax-off"}`}>
      <header>
        <div className="parallax-channel-heading">
          <TraceColor color={math.color} name="M" onChange={(color) => change({ color })} />
          <strong className="parallax-channel-name">M</strong>
          <span className="parallax-muted">{math.enabled ? `Math · ${mathName(math)}` : "Math"}</span>
        </div>
        <Segments label="Math channel on the screen" value={math.enabled ? "on" : "off"} onChange={(state) => change({ enabled: state === "on" })}
          options={[{ value: "off", label: "Off", title: "Not drawn" }, { value: "on", label: "On", title: "Two channels combined, drawn as a trace of its own" }]} />
      </header>
      {math.enabled ? (
        <>
          <div className="parallax-control-row">
            <span>Operation</span>
            <Segments label="How the math channel combines" value={math.operation} onChange={(operation) => change({ operation })}
              options={MATH_OPERATIONS.map((operation) => ({ value: operation.id, label: operation.label, title: operation.title }))} />
          </div>
          <div className="parallax-control-row">
            <label htmlFor="math-first">A</label>
            <select data-parallax-part="input" className="parallax-input parallax-small" id="math-first" value={math.first}
              onChange={(event) => change({ first: event.target.value as MathChannel["first"] })}>
              {settings.channels.map((channel) => <option key={channel.id} value={channel.id}>{channelName(channel)} · {channel.node}{channel.enabled ? "" : " (off)"}</option>)}
            </select>
          </div>
          <div className="parallax-control-row">
            <label htmlFor="math-second">B</label>
            <select data-parallax-part="input" className="parallax-input parallax-small" id="math-second" value={math.second}
              onChange={(event) => change({ second: event.target.value as MathChannel["second"] })}>
              {settings.channels.map((channel) => <option key={channel.id} value={channel.id}>{channelName(channel)} · {channel.node}{channel.enabled ? "" : " (off)"}</option>)}
            </select>
          </div>
          <div className="parallax-control-row">
            <span>Scale</span>
            <Stepper label="Math volts per division" value={math.voltsPerDivision} unit={unit} minimum={1e-4} maximum={1e6}
              format={(value) => `${formatQuantity(value, unit)}/div`} onChange={(voltsPerDivision) => change({ voltsPerDivision })} />
          </div>
          <div className="parallax-control-row">
            <span>Position</span>
            <Stepper label="Math position" value={math.position} unit="div" step={0.5} minimum={-4} maximum={4}
              format={(value) => `${value > 0 ? "+" : ""}${value} div`} onChange={(position) => change({ position })} />
          </div>
        </>
      ) : null}
    </section>
  );
}

/**
 * The math channel on the toolbar over the screen, as a bench oscilloscope has its Math key on the front: off or one of
 * the operations in one choice, and the two channels it combines beside it. Scale and zero stay in the panel's M section.
 */
export function MathTools({ settings, onChange }: { settings: ScopeSettings; onChange: (math: MathChannel) => void }) {
  const math = settings.math ?? DEFAULT_MATH;
  const operand = (which: "first" | "second") => (
    <select data-parallax-part="input" className="parallax-input parallax-small" aria-label={which === "first" ? "Math channel A" : "Math channel B"}
      value={math[which]} onChange={(event) => onChange({ ...math, [which]: event.target.value as MathChannel["first"] })}>
      {settings.channels.map((channel) => <option key={channel.id} value={channel.id}>{channelName(channel)}{channel.enabled ? "" : " (off)"}</option>)}
    </select>
  );
  return (
    <>
      {/* One list, not four keys: the toolbar's room is the screen's height on a laptop. */}
      <select data-parallax-part="input" className="parallax-input parallax-small" aria-label="Math operation"
        title="M: two channels combined sample by sample and drawn as a trace of its own — in YT, FFT and Phasors"
        value={math.enabled ? math.operation : "off"}
        onChange={(event) => onChange(event.target.value === "off" ? { ...math, enabled: false } : { ...math, enabled: true, operation: event.target.value as MathChannel["operation"] })}>
        <option value="off">M off</option>
        {MATH_OPERATIONS.map((operation) => <option key={operation.id} value={operation.id}>M = A {operation.symbol} B</option>)}
      </select>
      {math.enabled ? <>{operand("first")}{operand("second")}</> : null}
    </>
  );
}

/**
 * The math channel as the screen's readout lists it, read twice a second as the channels are: what it is, its scale, its
 * swing and mean over the window the screen shows. Null while the math channel is off.
 */
export function useMathReading(memory: SampleMemory, settings: ScopeSettings, back: number): ReadoutRow | null {
  const math = settings.math;
  const [reading, setReading] = useState<ReturnType<typeof mathReading>>(null);
  useEffect(() => {
    if (!math?.enabled) {
      return;
    }
    // Over the window the screen shows — the time base and the trigger choose it, as they do for the channels.
    const read = () => {
      const view = windowOf(memory, settings, back);
      setReading(mathReading(memory, math, view.start, view.span));
    };
    read();
    const timer = window.setInterval(read, 500);
    return () => window.clearInterval(timer);
  }, [memory, math, settings, back]);
  if (!math?.enabled) {
    return null;
  }
  const unit = mathUnit(math, mathUnitsOf(math, settings));
  return {
    key: "M", color: math.color,
    cells: [
      { text: "M", tone: "name" },
      { text: mathName(math), tone: "note" },
      { text: `${formatQuantity(math.voltsPerDivision, unit)}/div`, tone: "setting", numeric: true },
      { text: reading ? `${formatQuantity(reading.maximum - reading.minimum, unit)} pp` : "—", tone: "reading", numeric: true },
      { text: reading ? `${formatQuantity(reading.mean, unit)} avg` : "", tone: "reading", numeric: true },
    ],
  };
}

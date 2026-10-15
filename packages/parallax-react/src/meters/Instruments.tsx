import { useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ComponentReferenceView } from "@jmouse/parallax";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { Segments, Tool } from "../controls/BenchControls";
import type { PlaybackClock, SampleMemory } from "@jmouse/parallax/oscilloscope";
import { formatQuantity } from "@jmouse/parallax/quantities";
import { usePartLibrary } from "../providers/usePartLibrary";
import type { CircuitElement, DrawingItem, MeterShow } from "@jmouse/parallax/circuit";
import { MeterTrend } from "./MeterTrend";
import { METER_GATE_SECONDS, METER_HISTORY_READINGS, meterText, metersOf, readMeter, shownReading, type Meter, type MeterHistoryPoint, type MeterMode, type MeterReading } from "@jmouse/parallax/meters";
import { MeterGauge } from "./MeterGauge";

/** The bench's meters — its instrument parts — and how each display is read. */
export interface Instruments {
  meters: readonly Meter[];
  modeOf: (id: string) => MeterMode;
  setMode: (id: string, mode: MeterMode) => void;
  /** Whether a display shows its figure or its reading over time. */
  viewOf: (id: string) => MeterView;
  setView: (id: string, view: MeterView) => void;
}

/** What a meter's display shows: the figure now, a needle on a dial, or a graph of its readings over the last half minute. */
export type MeterView = "figure" | "gauge" | "graph";

/**
 * The meters among the parts on the sheet, and how each display reads: DC and a figure until the reader chooses
 * otherwise — a choice kept in the part's layout line (`shows rms graph`), so it is saved with the circuit.
 */
export function useInstruments(elements: readonly CircuitElement[], items: readonly DrawingItem[],
                               onShows: (part: string, shows: MeterShow[]) => void): Instruments {
  const library = useParallaxPartLibrary();
  // Whether a part is an instrument is its component's to say: known once its model has arrived.
  const libraryRevision = usePartLibrary(elements.map((element) => element.component ?? "").filter(Boolean));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `libraryRevision` is the moment the models arrived
  const meters = useMemo(() => metersOf(library, elements), [elements, libraryRevision]);
  const showsOf = useCallback((id: string): MeterShow[] => {
    const part = meters.find((meter) => meter.id === id)?.part;
    return items.find((item) => item.id === part)?.shows ?? [];
  }, [meters, items]);
  // A figure the instrument worked out — a frequency, a duty — is read as it is: only a signal has an AC or an RMS.
  const modeOf = useCallback((id: string): MeterMode => {
    if (meters.find((meter) => meter.id === id)?.signal === false) {
      return "DC";
    }
    const shows = showsOf(id);
    return shows.includes("rms") ? "RMS" : shows.includes("ac") ? "AC" : "DC";
  }, [meters, showsOf]);
  const viewOf = useCallback((id: string): MeterView => {
    const shows = showsOf(id);
    return shows.includes("graph") ? "graph" : shows.includes("gauge") ? "gauge" : "figure";
  }, [showsOf]);
  // DC and a figure are what a display shows unless told otherwise, so only a departure from them is written.
  const show = useCallback((id: string, mode: MeterMode, view: MeterView) => {
    const part = meters.find((meter) => meter.id === id)?.part;
    if (part) {
      onShows(part, [...(mode === "DC" ? [] : [mode.toLowerCase() as MeterShow]), ...(view === "figure" ? [] : [view])]);
    }
  }, [meters, onShows]);
  const setMode = useCallback((id: string, mode: MeterMode) => show(id, mode, viewOf(id)), [show, viewOf]);
  const setView = useCallback((id: string, view: MeterView) => show(id, modeOf(id), view), [show, modeOf]);
  return useMemo(() => ({ meters, modeOf, setMode, viewOf, setView }), [meters, modeOf, setMode, viewOf, setView]);
}

/**
 * Every meter's reading, taken a few times a second over the gate that ends where the screen plays — so a meter, the
 * sheet and the trace show one moment — and reaches back the gate's wall time at the speed it plays.
 */
export function useMeterReadings(memory: SampleMemory, meters: readonly Meter[], clock: PlaybackClock, speed: number): MeterReadings {
  const [readings, setReadings] = useState<MeterReadings>({ now: {}, history: {} });
  useEffect(() => {
    if (!meters.length) {
      setReadings({ now: {}, history: {} });
      return;
    }
    // Each meter's last readings, for its graph: one a gate while the run's time moves on, the oldest let go.
    const history = new Map<string, MeterHistoryPoint[]>();
    // A paused run reads the same every gate: the bench is not re-rendered for readings that did not move.
    let readAt: { end: number; samples: number } | null = null;
    const read = () => {
      const shown = clock.shownTime(performance.now());
      const end = Number.isFinite(shown) ? shown : memory.lastTime();
      if (readAt && Object.is(readAt.end, end) && readAt.samples === memory.length) {
        return;
      }
      readAt = { end, samples: memory.length };
      const now = Object.fromEntries(meters.map((meter) => [meter.id, readMeter(memory, meter.id, end, METER_GATE_SECONDS * speed)]));
      for (const meter of meters) {
        const reading = now[meter.id];
        const points = history.get(meter.id) ?? [];
        if (reading && Number.isFinite(end) && (!points.length || end > points[points.length - 1].time)) {
          points.push({ time: end, reading });
          points.splice(0, Math.max(0, points.length - METER_HISTORY_READINGS));
        } else if (points.length && end < points[points.length - 1].time) {
          // The run started again: its history did too.
          points.length = 0;
        }
        history.set(meter.id, points);
      }
      setReadings({ now, history: Object.fromEntries([...history].map(([id, points]) => [id, [...points]])) });
    };
    read();
    const timer = window.setInterval(read, METER_GATE_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [memory, meters, clock, speed]);
  return readings;
}

/** Every meter's reading now, and its readings over the last half minute of the run — what its graph draws. */
export interface MeterReadings {
  now: Record<string, MeterReading | null>;
  history: Record<string, MeterHistoryPoint[]>;
}

const VIEWS: { value: MeterView; label: string; title: string }[] = [
  { value: "figure", label: "Figure", title: "The reading now" },
  { value: "gauge", label: "Dial", title: "A needle on a scale, as an analog meter shows it" },
  { value: "graph", label: "Graph", title: "The reading over the last half minute of the run" },
];

const MODES: { value: MeterMode; label: string; title: string }[] = [
  { value: "DC", label: "DC", title: "The mean over the gate" },
  { value: "AC", label: "AC", title: "The RMS of what swings around the mean" },
  { value: "RMS", label: "RMS", title: "True RMS of the whole, AC + DC" },
];

/**
 * One compact choice that puts an instrument in hand, for the frame under the sheet where a row of buttons would take
 * the meters' room: a click on the sheet places it — on a wire, into its break.
 */
function PlaceInstrumentChoice({ components, placing, onPlace }: {
  components: readonly ComponentReferenceView[];
  placing: string | null;
  onPlace: (reference: string) => void;
}) {
  if (!components.length) {
    return null;
  }
  return <select data-parallax-part="input" className="parallax-input parallax-small" aria-label="Place an instrument on the sheet" value={placing ?? ""}
    onChange={(event) => event.target.value && onPlace(event.target.value)}>
    <option value="">Place an instrument…</option>
    {components.map((component) => <option key={component.reference} value={component.reference}>{component.name}</option>)}
  </select>;
}

/** Buttons that put an instrument in hand: a click on the sheet places it, and it is wired like any part. */
function PlaceInstrument({ components, placing, onPlace }: {
  components: readonly ComponentReferenceView[];
  placing: string | null;
  onPlace: (reference: string) => void;
}) {
  return <>
    {components.map((component) => (
      <Tool key={component.reference} aria-pressed={placing === component.reference} onClick={() => onPlace(component.reference)}
        label={`Place a ${component.name.toLowerCase()} on the sheet, then wire it: across what it reads, or in the break of a wire`}>
        <ParallaxIcon name="plus" />{component.name}
      </Tool>
    ))}
  </>;
}

function MeterDisplay({ meter, instruments, reading, history, onRemove, compact }: {
  meter: Meter; instruments: Instruments; reading: MeterReading | null | undefined; history: readonly MeterHistoryPoint[];
  onRemove?: (part: string) => void; compact?: boolean;
}) {
  const mode = instruments.modeOf(meter.id);
  const view = instruments.viewOf(meter.id);
  return (
    <article data-parallax-part={compact ? "meter-card" : "meter"} className={compact ? "parallax-meter-card" : "parallax-channel parallax-bench-meter"} aria-label={`${meter.title} ${meter.id}`}>
      <header>
        <span className="parallax-meter-kind" aria-hidden="true">{meter.unit}</span>
        {compact ? <strong>{meter.id}</strong> : <h3>{meter.id} · {meter.title}</h3>}
        {compact ? <span className="parallax-monospace">{meter.title}</span> : null}
        {onRemove ? <Tool tone="quiet" icon label={`Take ${meter.part} off the sheet`} onClick={() => onRemove(meter.part)}><ParallaxIcon name="close" /></Tool> : null}
      </header>
      {view === "figure" ? <output data-parallax-part="meter-display" className="parallax-meter-display" aria-live="off">{meterText(meter, mode, reading)}</output> : <>
        <output data-parallax-part="meter-display" className="parallax-meter-display parallax-small" aria-live="off">{meterText(meter, mode, reading)}</output>
        {view === "gauge"
          ? <MeterGauge meter={meter} value={reading ? shownReading(mode, reading) : null} label={`${meter.title} ${meter.id}: ${meterText(meter, mode, reading)}`} />
          : <MeterTrend meter={meter} mode={mode} history={history} />}
      </>}
      {!compact && reading ? <p className="parallax-meter-range">{formatQuantity(reading.minimum, meter.unit)} … {formatQuantity(reading.maximum, meter.unit)}</p> : null}
      <div className={compact ? undefined : "parallax-control-row"}>
        {compact ? null : <span>Shows</span>}
        {meter.signal ? <Segments label={`${meter.id} shows`} value={mode} onChange={(next) => instruments.setMode(meter.id, next)} options={MODES} /> : null}
        <Segments label={`${meter.id} as`} value={view} onChange={(next) => instruments.setView(meter.id, next)} options={VIEWS} />
      </div>
    </article>
  );
}

/**
 * The meters as a bench shows them beside or instead of its screen: one display each, large, and the instruments that
 * can be put on the sheet.
 */
export function MeterStrip({ instruments, readings, leading, components, placing, onPlace, onRemove }: {
  instruments: Instruments;
  readings: MeterReadings;
  leading?: ReactNode;
  components: readonly ComponentReferenceView[];
  placing: string | null;
  onPlace: (reference: string) => void;
  onRemove?: (part: string) => void;
}) {
  return (
    <section data-parallax-part="meter-strip" className="parallax-meter-strip" aria-label="Meters">
      <div data-parallax-part="scope-toolbar" className="parallax-scope-toolbar">
        {leading}
        <span className="parallax-push" />
        <PlaceInstrumentChoice components={components} placing={placing} onPlace={onPlace} />
      </div>
      {instruments.meters.length ? (
        <div data-parallax-part="meter-displays" className="parallax-meter-displays">
          {instruments.meters.map((meter) => (
            <MeterDisplay key={meter.id} meter={meter} instruments={instruments} reading={readings.now[meter.id]} history={readings.history[meter.id] ?? []} onRemove={onRemove} compact />
          ))}
        </div>
      ) : (
        <p className="parallax-side-note">No meter on the sheet. Choose one above and click where it goes, then wire it as on a bench: a voltmeter
          across what it reads, an ammeter in the break of a wire.</p>
      )}
    </section>
  );
}

/** The instruments panel: each meter's display and its range, and the instruments that can be put on the sheet. */
export function InstrumentsPanel({ instruments, readings, components, placing, onPlace, onRemove }: {
  instruments: Instruments;
  readings: MeterReadings;
  components: readonly ComponentReferenceView[];
  placing: string | null;
  onPlace: (reference: string) => void;
  onRemove?: (part: string) => void;
}) {
  return (
    <>
      {instruments.meters.map((meter) => (
        <MeterDisplay key={meter.id} meter={meter} instruments={instruments} reading={readings.now[meter.id]} history={readings.history[meter.id] ?? []} onRemove={onRemove} />
      ))}
      <div className="parallax-meter-add" role="group" aria-label="Put an instrument on the sheet">
        <PlaceInstrument components={components} placing={placing} onPlace={onPlace} />
      </div>
      {instruments.meters.length === 0 ? (
        <p className="parallax-side-note">An instrument is a part: placed on the sheet and wired as on a bench. What it reads is written in its own
          component — averaged here over {METER_GATE_SECONDS * 1000} ms of the run, as a bench multimeter does.</p>
      ) : null}
    </>
  );
}

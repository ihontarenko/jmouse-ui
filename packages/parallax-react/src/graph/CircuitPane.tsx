import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "../support/useAsync";
import { ComputationProgress } from "../viewers/ComputationProgress";
import {
  type CircuitDefinition, drawingOfCircuit, type FlowFeed, levelsOf, loadsOf, readingsAt, SeriesFlow, unitsOf, withShownValues,
} from "@jmouse/parallax/circuit";
import { Schematic } from "../circuit/Schematic";
import { useComputation } from "../viewers/useComputation";
import { evaluateDuration, type GraphPaneDocument, PART_CURRENTS } from "@jmouse/parallax/graph";

/** The graph's clock as a circuit pane follows it: its name, its value now and its range. */
export interface PaneClock {
  name: string;
  value: number;
  minimum: number;
  maximum: number;
  subscribe: ((listener: (value: number) => void) => () => void) | null;
  /** Every screen frame while it plays, the value between two frames of its grid: for what moves smoothly. */
  subscribeFrame?: ((listener: (value: number) => void) => () => void) | null;
  /** How long one pass over its range takes, in seconds. */
  secondsPerLoop?: number;
}

/** How far the busiest terminal's light travels over the whole transient, in sheet units: about one wire a second at speed 1. */
const LIGHT_TRAVEL_PER_RUN = 1600;

/**
 * A circuit played on the graph's clock: its transient is computed once, as on its own page, and the sheet shows the
 * moment the clock is at — every wire coloured by its node's voltage. A parameter of the circuit that a slider of the
 * graph also names takes the slider's value, so the circuit and the curves drawn of it stay one object.
 */
export function CircuitPane({ pane, clock, values }: { pane: GraphPaneDocument; clock: PaneClock | null; values: Record<string, number> }) {
  const transport = useParallaxTransport();
  const slug = pane.uses ?? "";
  const detail = useAsync((signal) => transport.catalogue.object(slug, signal), [slug], slug.length > 0);
  const circuit = detail.data?.definition.kind === "CIRCUIT" ? (detail.data.definition as unknown as CircuitDefinition) : null;
  const parameters = detail.data?.parameters ?? [];
  const shared = Object.fromEntries(parameters.filter((parameter) => parameter.name in values).map((parameter) => [parameter.name, values[parameter.name]]));
  // `parts`: every part's current as well, so the sheet moves current along the wires and lights what conducts.
  const computation = useComputation(circuit ? slug : null, "TRANSIENT_RESPONSE", shared, circuit !== null, PART_CURRENTS);
  const series = computation.ready?.dataset.format === "TIME_SERIES" ? computation.ready.dataset : null;

  const [clockValue, setClockValue] = useState<number | null>(clock?.value ?? null);
  useEffect(() => setClockValue(clock?.value ?? null), [clock?.value]);
  useEffect(() => (clock?.subscribe ? clock.subscribe(setClockValue) : undefined), [clock?.subscribe]);

  const time = circuitTime(pane, clock, clockValue);
  const moment = useMemo(() => (series && time !== null ? readingsAt(series, time) : null), [series, time]);
  const units = useMemo(() => (series ? unitsOf(series) : {}), [series]);
  const levels = useMemo(() => (moment ? levelsOf(moment, units) : undefined), [moment, units]);
  const loads = useMemo(() => (moment && circuit ? loadsOf(moment, units) : undefined), [moment, units, circuit]);
  // The light on every wire stands where the charge that has passed puts it: ∫ I dt of the engine's own currents, read
  // at the clock's value between frames, so it moves as far as the clock moved — and back when the current reverses.
  const played = useMemo(() => (series ? new SeriesFlow(series, LIGHT_TRAVEL_PER_RUN) : null), [series]);
  const timeNow = useRef(time);
  timeNow.current = time;
  const flow = useMemo<FlowFeed | undefined>(() => {
    if (!played) {
      return undefined;
    }
    return (listener) => {
      const push = (at: number | null) => {
        const moment = at !== null ? played.momentAt(at) : null;
        if (moment) {
          listener(moment);
        }
      };
      push(timeNow.current);
      return clock?.subscribeFrame ? clock.subscribeFrame((value) => push(circuitTime(pane, clock, value))) : () => {};
    };
  }, [played, clock?.subscribeFrame, clock?.subscribeFrame ? null : time]);
  const slowedBy = slowMotion(pane, clock);
  const elements = useMemo(() => (circuit ? withShownValues(circuit.elements, parameters, { ...Object.fromEntries(parameters.map((parameter) => [parameter.name, parameter.defaultValue])), ...shared }) : []),
    [circuit, parameters, JSON.stringify(shared)]);

  if (detail.error) {
    return <p className="parallax-graph-pane-later parallax-muted">The circuit “{slug}” could not be opened: {detail.error.detail}</p>;
  }
  if (detail.data && !circuit) {
    return <p className="parallax-graph-pane-later parallax-muted">“{slug}” is not a circuit, so it cannot play here.</p>;
  }
  return (
    <div className="parallax-graph-circuit">
      {circuit ? <Schematic elements={elements} drawing={drawingOfCircuit(circuit)} levels={levels} loads={loads} flow={flow} readings={false} /> : null}
      <ComputationProgress job={computation.job} computing={computation.computing} />
      {time !== null ? <p className="parallax-graph-circuit-time parallax-technical">t = <span className="parallax-steady parallax-width-7">{formatTime(time)}</span>{slowedBy ? <span className="parallax-muted"> · {slowedBy}</span> : null}</p> : null}
    </div>
  );
}

/** The circuit's time for the clock's value: the clock's range laid onto `over`, else the clock's value in seconds. */
function circuitTime(pane: GraphPaneDocument, clock: PaneClock | null, value: number | null): number | null {
  const over = pane.over ? pane.over.map(evaluateDuration) : null;
  if (over && over[0] !== null && over[1] !== null) {
    if (!clock || value === null || clock.maximum <= clock.minimum) {
      return over[0];
    }
    return over[0] + ((value - clock.minimum) / (clock.maximum - clock.minimum)) * (over[1] - over[0]);
  }
  return value;
}


/**
 * How much slower than life the pane plays: `over` stretched onto one pass of the clock. 40 ms over a 32 s loop is
 * 800× slower, so 50 Hz is seen as one cycle in 16 s.
 */
function slowMotion(pane: GraphPaneDocument, clock: PaneClock | null): string | null {
  const over = pane.over ? pane.over.map(evaluateDuration) : null;
  if (!over || over[0] === null || over[1] === null || !clock?.secondsPerLoop || over[1] <= over[0]) {
    return null;
  }
  const factor = clock.secondsPerLoop / (over[1] - over[0]);
  return factor >= 1 ? `${Number(factor.toPrecision(3))}× slower than life` : `${Number((1 / factor).toPrecision(3))}× faster than life`;
}

function formatTime(seconds: number): string {
  const magnitude = Math.abs(seconds);
  if (magnitude >= 1 || magnitude === 0) {
    return `${seconds.toFixed(3)} s`;
  }
  if (magnitude >= 1e-3) {
    return `${(seconds * 1e3).toFixed(3)} ms`;
  }
  return `${(seconds * 1e6).toFixed(2)} µs`;
}

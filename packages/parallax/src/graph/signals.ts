import type { Dataset } from "../visual";
import { evaluateDuration, type GraphPaneDocument } from "./graphDocument";

/**
 * A line that draws a circuit's signal — `p from sheet` (a node's voltage), `a - b from sheet` (the voltage between two
 * nodes), `RL from sheet` (a two-terminal part's current), `D1.anode from sheet` (the current into a pin): the circuit's
 * own names over the transient the circuit pane plays; what each one is, the engine's unit for it says. The engine
 * computed every point; here its time is only laid onto the graph's clock, the way the pane plays it, so `until t` cuts
 * the trace where the circuit is.
 */

/** What the circuit pane asks the transient for; the same request, so the backend answers both from one computation. */
export const PART_CURRENTS = { parts: true };

/** The graph's clock value for a circuit time: the inverse of how a circuit pane plays its transient. */
export function clockOfTime(pane: GraphPaneDocument, clock: { minimum: number; maximum: number } | null, time: number): number {
  const over = pane.over ? pane.over.map(evaluateDuration) : null;
  if (over && over[0] !== null && over[1] !== null && clock && over[1] > over[0]) {
    return clock.minimum + ((time - over[0]) / (over[1] - over[0])) * (clock.maximum - clock.minimum);
  }
  return time;
}

/**
 * A signal's samples: one column of the transient by its name, or `a - b` — the voltage between two nodes, as an
 * oscilloscope's two probes read it across a floating source. Ground (`0`, `ground`) reads zero.
 */
export function probeSamples(series: { axisValues: number[]; columns: string[]; values: number[][]; units?: string[] }, signal: string): number[] | null {
  const grounded = (name: string) => name === "0" || name === "ground";
  const column = (name: string): number[] | null => (grounded(name)
    ? series.axisValues.map(() => 0) : series.values[series.columns.indexOf(name)] ?? null);
  const unitOf = (name: string) => (grounded(name) ? "V" : series.units?.[series.columns.indexOf(name)] ?? "");
  const difference = /^(\S+)\s+-\s+(\S+)$/.exec(signal);
  if (difference) {
    const [, high, low] = difference;
    // Only voltages subtract into a reading: a node less a node.
    if (unitOf(high) !== "V" || unitOf(low) !== "V") {
      return null;
    }
    const highSamples = column(high);
    const lowSamples = column(low);
    return highSamples && lowSamples ? highSamples.map((value, index) => value - lowSamples[index]) : null;
  }
  return column(signal);
}

/** A signal's samples as a line on the graph: each laid at the clock value its circuit time is played at. */
export function signalDataset(series: { axisValues: number[] }, samples: number[], pane: GraphPaneDocument,
  clock: { minimum: number; maximum: number } | null, column: string): Dataset {
  const points: number[] = [];
  let low = Infinity;
  let high = -Infinity;
  series.axisValues.forEach((time, index) => {
    const x = clockOfTime(pane, clock, time);
    points.push(x, samples[index]);
    low = Math.min(low, samples[index]);
    high = Math.max(high, samples[index]);
  });
  const first = points[0];
  const last = points[points.length - 2];
  return { format: "POLYLINES", shape: "LINES", canvas: "PLANE", dimension: 2, lines: [{ points, closed: false, label: column }],
    minimum: [first, low], maximum: [last, high] } as Dataset;
}

import type { MathChannel, MathOperation, SampleMemory, ScopeSettings } from "../oscilloscope";

/*
 * The math channel, as a bench oscilloscope has it: two channels combined sample by sample — their sum, their difference,
 * their product — and drawn as a trace of its own. It is the samples on the screen read another way, like the spectrum
 * and the measurements: nothing is computed on the server for it.
 *
 * A sample stands for its interval with its lowest and highest reading, so the combination does too, by interval
 * arithmetic: A + B lies between the lows' sum and the highs' sum, A − B between A's low less B's high and A's high less
 * B's low, A × B between the least and the greatest of the corners' products. The band a fast signal fills on A and B
 * is then the band it fills on M — never narrower than it can be.
 */

/** What a trace is drawn from: a memory's channels, or the math channel over them. */
export interface TraceSource {
  readonly length: number;
  time(index: number): number;
  indexAt(time: number): number;
  reading(channel: string, index: number): number;
  low(channel: string, index: number): number;
  high(channel: string, index: number): number;
  /** Whether the i-th sample goes on from the one before it, unbroken: whether a line may join them. */
  continues(index: number): boolean;
}

export const MATH_OPERATIONS: readonly { id: MathOperation; label: string; symbol: string; title: string }[] = [
  { id: "sum", label: "A + B", symbol: "+", title: "The two channels added: two signals that share a node and a ground, as one" },
  { id: "difference", label: "A − B", symbol: "−", title: "The first less the second: the voltage across a part, measured between two probes" },
  { id: "product", label: "A × B", symbol: "×", title: "The two multiplied: a voltage times a current is the power, sample by sample" },
];

/** What the math channel shows, written as the channels are named: «CH1 − CH2». */
export function mathName(math: MathChannel): string {
  const operation = MATH_OPERATIONS.find((candidate) => candidate.id === math.operation) ?? MATH_OPERATIONS[0];
  return `${math.first} ${operation.symbol} ${math.second}`;
}

/**
 * The unit the math channel reads in, from its operands' units: a sum or a difference keeps the first's; a product of a
 * voltage and a current is a power, W — the instantaneous power of a part, probed across and through —; of two alike, V² or A².
 */
export function mathUnit(math: MathChannel, units?: { first: string; second: string }): string {
  const first = units?.first ?? "V";
  const second = units?.second ?? "V";
  if (math.operation !== "product") {
    return first;
  }
  if (first !== second) {
    return "W";
  }
  return `${first}²`;
}

/** The math channel's operands' units, as the channels they name read. */
export function mathUnitsOf(math: MathChannel, settings: ScopeSettings): { first: string; second: string } {
  const unitOf = (id: string) => (settings.channels.find((channel) => channel.id === id)?.quantity === "current" ? "A" : "V");
  return { first: unitOf(math.first), second: unitOf(math.second) };
}

/** The math channel as a trace source over the memory: its one channel is the combination, whatever it is asked for. */
export function mathSource(memory: SampleMemory, math: MathChannel): TraceSource {
  const combine = (a: number, b: number) => math.operation === "sum" ? a + b : math.operation === "difference" ? a - b : a * b;
  const bounds = (index: number): [number, number] => {
    const aLow = memory.low(math.first, index);
    const aHigh = memory.high(math.first, index);
    const bLow = memory.low(math.second, index);
    const bHigh = memory.high(math.second, index);
    if (math.operation === "sum") {
      return [aLow + bLow, aHigh + bHigh];
    }
    if (math.operation === "difference") {
      return [aLow - bHigh, aHigh - bLow];
    }
    const corners = [aLow * bLow, aLow * bHigh, aHigh * bLow, aHigh * bHigh];
    return [Math.min(...corners), Math.max(...corners)];
  };
  return {
    get length() {
      return memory.length;
    },
    time: (index) => memory.time(index),
    indexAt: (time) => memory.indexAt(time),
    continues: (index) => memory.continues(index),
    reading: (_channel, index) => combine(memory.reading(math.first, index), memory.reading(math.second, index)),
    low: (_channel, index) => bounds(index)[0],
    high: (_channel, index) => bounds(index)[1],
  };
}

/** What the math channel read over a window: its extremes from the peaks and its mean, as a channel's are read. */
export function mathReading(memory: SampleMemory, math: MathChannel, start: number, span: number): { minimum: number; maximum: number; mean: number } | null {
  const source = mathSource(memory, math);
  const first = Math.max(0, source.indexAt(start));
  const last = Math.min(source.length, source.indexAt(start + span));
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let count = 0;
  for (let index = first; index < last; index++) {
    const value = source.reading("M", index);
    if (!Number.isFinite(value)) {
      continue;
    }
    minimum = Math.min(minimum, source.low("M", index));
    maximum = Math.max(maximum, source.high("M", index));
    sum += value;
    count++;
  }
  return count ? { minimum, maximum, mean: sum / count } : null;
}

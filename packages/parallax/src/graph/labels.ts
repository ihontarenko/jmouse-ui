import type { ParallaxTransport } from "../transport/transport";
import type { Interpretation, ParallaxOwner } from "../transport/wire";
import { computationRequest } from "../computation/computationRunner";

/**
 * A label on a graph: a text whose `{…}` parts are read live — `"V(C) = {v(s)} V" at (s, v(s)) in voltage`. Every part
 * and both coordinates are VALUE computations on the backend, as any line is; one that reads the clock is computed
 * ahead over the clock's frames, so a playing label is only looked up, never asked for.
 */

/** A part's value now, and its value at each of the clock's frames while the clock plays a value it reads. */
export interface LabelValue {
  now: number | null;
  frames: (number | null)[] | null;
}

/** What a pane draws for a label: the text in pieces, its place, and the values the pieces and the place read. */
export interface LabelSource {
  id: string;
  pane: string;
  colorIndex: number;
  /** Text as it is, or the index of the value shown in its place. */
  parts: (string | number)[];
  /** Indices of the values that are its x and y; null puts it in the pane's corner. */
  at: [number, number] | null;
  values: LabelValue[];
  /** The clock's frames the values were computed at, when they were. */
  grid: readonly number[] | null;
  /** Set when the line is a bar of a values pane: one value, `parts` = [0], shown under its line's name. */
  bar?: { name: string };
}

/** Whether a line is a label: a text in quotes. */
export function isLabelSource(source: string): boolean {
  return /^\s*".*"\s*$/s.test(source);
}

/** `"V = {abs(v(t))} V"` → its text pieces and the expressions between braces, in order. */
export function parseLabel(source: string): { parts: (string | number)[]; expressions: string[] } {
  const text = source.trim().replace(/^"|"$/g, "");
  const parts: (string | number)[] = [];
  const expressions: string[] = [];
  let rest = text;
  for (let open = rest.indexOf("{"); open >= 0; open = rest.indexOf("{")) {
    const close = rest.indexOf("}", open);
    if (close < 0) {
      break;
    }
    if (open > 0) {
      parts.push(rest.slice(0, open));
    }
    parts.push(expressions.length);
    expressions.push(rest.slice(open + 1, close).trim());
    rest = rest.slice(close + 1);
  }
  if (rest) {
    parts.push(rest);
  }
  return { parts, expressions };
}

/** `(s, v(s))` → its two coordinates, split at the comma outside any parentheses; null for anything else. */
export function pointOf(at: string): [string, string] | null {
  const inner = /^\s*\((.*)\)\s*$/s.exec(at)?.[1];
  if (!inner) {
    return null;
  }
  let depth = 0;
  for (let index = 0; index < inner.length; index++) {
    const character = inner[index];
    if (character === "(") {
      depth++;
    } else if (character === ")") {
      depth--;
    } else if (character === "," && depth === 0) {
      return [inner.slice(0, index).trim(), inner.slice(index + 1).trim()];
    }
  }
  return null;
}

/** The label's text with every value in its place, four significant digits; `…` while a value is on its way. */
export function labelText(label: LabelSource, valueOf: (index: number) => number | null): string {
  return label.parts.map((part) => {
    if (typeof part === "string") {
      return part;
    }
    const value = valueOf(part);
    // A value that is zero but for rounding (a balanced sum, 1e-16) reads as 0.
    return value === null ? "…" : Math.abs(value) < 1e-9 ? "0" : Number(value.toPrecision(4)).toString().replace("-", "−");
  }).join("");
}

/** A value of a label at the clock's value: its frame nearest the clock while it has frames, else its value now. */
export function labelValueAt(label: LabelSource, index: number, clock: number | null): number | null {
  const value = label.values[index];
  if (!value) {
    return null;
  }
  if (value.frames && label.grid && clock !== null && label.grid.length > 0) {
    let nearest = 0;
    for (let position = 1; position < label.grid.length; position++) {
      if (Math.abs(label.grid[position] - clock) < Math.abs(label.grid[nearest] - clock)) {
        nearest = position;
      }
    }
    return value.frames[nearest] ?? value.now;
  }
  return value.now;
}

/** The sliders' values an interpreted expression reads: those of its parameters that a slider holds. */
export function parameterValuesOf(interpretation: Interpretation | null, values: Record<string, number>): Record<string, number> {
  return Object.fromEntries((interpretation?.parameters ?? [])
    .filter((parameter) => parameter.name in values).map((parameter) => [parameter.name, values[parameter.name]]));
}

/** An interpreted expression's value at the sliders' values; null when it is not a value or cannot be computed. */
export function labelValueNow(transport: ParallaxTransport, interpretation: Interpretation | null, values: Record<string, number>, owner: ParallaxOwner | undefined,
  signal: AbortSignal): Promise<number | null> {
  if (!interpretation?.definition) {
    return Promise.resolve(null);
  }
  return transport.computations.compute(computationRequest({ definition: interpretation.definition, parameters: interpretation.parameters }, "VALUE", parameterValuesOf(interpretation, values), {}, owner), signal)
    .then((answer) => ("dataset" in answer && answer.dataset.format === "MEASUREMENTS" ? answer.dataset.values.value : null))
    .catch(() => null);
}

/** An interpreted expression's value at every frame of the clock; null when it does not read the clock. */
export async function labelValueFrames(transport: ParallaxTransport, interpretation: Interpretation | null, values: Record<string, number>,
  animated: { parameter: string; grid: readonly number[] } | null, owner: ParallaxOwner | undefined, signal: AbortSignal): Promise<(number | null)[] | null> {
  if (!animated || !interpretation?.definition || !interpretation.parameters.some((parameter) => parameter.name === animated.parameter)) {
    return null;
  }
  const computation = computationRequest({ definition: interpretation.definition, parameters: interpretation.parameters }, "VALUE", parameterValuesOf(interpretation, values), {}, owner);
  const read: (number | null)[] = [];
  while (read.length < animated.grid.length) {
    const answer = await transport.computations.frames({ computation, parameter: animated.parameter, values: animated.grid.slice(read.length, read.length + 64) }, signal);
    if (answer.frames.length === 0) {
      break;
    }
    read.push(...answer.frames.map((frame) => (frame.ready.dataset.format === "MEASUREMENTS" ? frame.ready.dataset.values.value : null)));
  }
  return read;
}

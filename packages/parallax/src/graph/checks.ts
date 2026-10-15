import type { ParallaxOwner } from "../transport/wire";
import type { ParallaxTransport } from "../transport/transport";
import { computationRequest } from "../computation/computationRunner";
import { withLibrary } from "./expressions";

/**
 * What a graph claims — `expect "the total energy stays put" { measure p(t) + k(t);  near 1.7135 +- 0.5% }` — checked
 * at every frame of its clock. The engine computes the measure, as it computes a label; the page only compares it with
 * the bounds the criterion admits, so a graph that draws a law also says whether the law holds in what it draws.
 */

/** The most frames `POST /computations/frames` answers at once. */
const FRAMES_PER_REQUEST = 64;

export interface GraphCheck {
  title: string;
  measure: string;
  /** As written: `near 1.7135 +- 0.5%`. */
  criterion: string;
  minimum: number;
  maximum: number;
}

export interface CheckResult {
  check: GraphCheck;
  /** Null while it is being computed; a refusal comes as `problem`. */
  passed: boolean | null;
  /** The value furthest outside the bounds, or nearest to leaving them when all are inside; and where on the clock. */
  worst: { value: number; at: number | null } | null;
  problem: string | null;
}

/**
 * One check over the clock's frames, or at the sliders' values when the graph has no clock — or when its measure does
 * not read the clock.
 */
export async function evaluateGraphCheck(transport: ParallaxTransport, check: GraphCheck, library: string, values: Record<string, number>,
  clock: { parameter: string; grid: readonly number[] } | null, owner: ParallaxOwner | undefined, signal: AbortSignal): Promise<CheckResult> {
  const reading = await transport.formula.interpret(withLibrary(library, check.measure), signal);
  if (!reading.definition || reading.refusal) {
    return { check, passed: false, worst: null, problem: reading.refusal ?? "the measure is not a value" };
  }
  const own = Object.fromEntries(reading.parameters.filter((parameter) => parameter.name in values).map((parameter) => [parameter.name, values[parameter.name]]));
  const computation = computationRequest({ definition: reading.definition, parameters: reading.parameters }, "VALUE", own, {}, owner);
  const readsClock = clock !== null && reading.parameters.some((parameter) => parameter.name === clock.parameter);
  const samples: { value: number; at: number | null }[] = [];
  if (readsClock && clock) {
    while (samples.length < clock.grid.length) {
      const answer = await transport.computations.frames({ computation, parameter: clock.parameter, values: clock.grid.slice(samples.length, samples.length + FRAMES_PER_REQUEST) }, signal);
      if (answer.frames.length === 0) {
        break;
      }
      for (const frame of answer.frames) {
        samples.push({ value: frame.ready.dataset.format === "MEASUREMENTS" ? frame.ready.dataset.values.value : Number.NaN, at: frame.value });
      }
    }
  } else {
    const answer = await transport.computations.compute(computation, signal);
    samples.push({ value: "dataset" in answer && answer.dataset.format === "MEASUREMENTS" ? answer.dataset.values.value : Number.NaN, at: null });
  }
  // How far outside the bounds a value is; negative inside, the more negative the safer.
  const outside = (value: number) => (Number.isFinite(value) ? Math.max(check.minimum - value, value - check.maximum) : Infinity);
  const worst = samples.reduce<{ value: number; at: number | null } | null>((found, sample) => (!found || outside(sample.value) > outside(found.value) ? sample : found), null);
  return { check, passed: samples.length > 0 && samples.every((sample) => outside(sample.value) <= 0), worst, problem: null };
}

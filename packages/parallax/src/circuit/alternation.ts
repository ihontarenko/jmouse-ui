import type { PartLoad } from "../transport/live";
import type { RecentFlow } from "./circuitTrace";
import { wireCurrents } from "./currents";
import type { SchematicDocument } from "./SchematicDocument";

/*
 * A current that reverses faster than a light can be shown to: at 50 Hz a light would run back and forth a hundred
 * times a second, which a screen at sixty frames cannot draw — what it draws instead is a light that stands, or drifts
 * the wrong way. Such a wire is drawn as alternating rather than flowing, and says how much slower the run has to go
 * for its flow to be seen. A current that only switches on and off — a square wave into a load — never reverses, but at a
 * kilohertz its lights would flicker at the frame rate instead: it is drawn as pulsing, its lights carried by the charge
 * it moves and lit by its RMS, steady.
 */

/** Alternations a second of wall time a light still shows as running back and forth, when the reader chose nothing. */
export const DEFAULT_ALTERNATION_THRESHOLD = 2.5;
/**
 * A reversal counts once the current has crossed a tenth of the wire's largest in the window, and at least a fiftieth of
 * the largest anywhere in the circuit: noise near zero does not, nor a wire that is off ringing at a microampere.
 */
const HYSTERESIS = 0.1;
const CIRCUIT_FLOOR = 0.02;
/** On and off for a switching current, as shares of the wire's largest: a ripple that never drops this far is not switching. */
const SWITCHED_ON = 0.6;
const SWITCHED_OFF = 0.4;
/** A wire whose RMS is at least this much hidden from its means changes faster than its moments. */
const HIDDEN_SHARE = 0.5;
/** Faster than its moments, a current whose mean is less than this share of its RMS reverses rather than switches. */
const REVERSING_SHARE = 0.3;

export interface WireAlternation {
  /** Reversing, or switching on and off in one direction. */
  kind: "alternating" | "pulsing";
  /** Reversals per circuit second, halved: the alternation's frequency in Hz. */
  frequency: number;
  /** True when the trace is too sparse to count every reversal: the frequency is at least this. */
  atLeast: boolean;
  /** RMS of the wire's current over the window, in amperes. */
  rms: number;
}

/**
 * Every wire whose current reverses too fast to be shown as moving, with how fast it alternates: faster than
 * `threshold` alternations — two reversals each — a second of wall time.
 */
export function alternatingWires(document: SchematicDocument, recent: RecentFlow, threshold = DEFAULT_ALTERNATION_THRESHOLD): Map<string, WireAlternation> {
  const shownReversalsPerSecond = 2 * threshold;
  const found = new Map<string, WireAlternation>();
  if (recent.moments.length < 4 || !(recent.circuitSeconds > 0) || !(recent.wallSeconds > 0)) {
    return found;
  }
  const signed = signedWireCurrents(document, recent.moments);
  const strong = recent.strengths ? signedWireCurrents(document, recent.strengths) : signed;
  const circuitLargest = Math.max(0, ...[...strong.values()].map((values) => Math.max(...values.map(Math.abs))));
  signed.forEach((values, wire) => {
    const strengths = strong.get(wire) ?? values;
    const rms = Math.sqrt(strengths.reduce((sum, strength) => sum + strength * strength, 0) / strengths.length);
    const largest = Math.max(...values.map(Math.abs));
    const noiseFloor = Math.max(HYSTERESIS * largest, CIRCUIT_FLOOR * circuitLargest);
    const within = withinMoments(values, rms);
    if (within && rms > CIRCUIT_FLOOR * circuitLargest) {
      // Faster than the moments themselves: each is a mean its alternation all but cancelled, and only its RMS says it
      // flows. As fast as the moments are apart at least, and how much faster no moment can tell.
      const momentRate = (values.length - 1) / recent.circuitSeconds;
      found.set(wire, { kind: within, frequency: momentRate / 2, atLeast: true, rms });
      return;
    }
    if (!(largest > noiseFloor)) {
      return;
    }
    let reversals = 0;
    let side = 0;
    let switches = 0;
    let on: boolean | null = null;
    for (const value of values) {
      const now = value > noiseFloor ? 1 : value < -noiseFloor ? -1 : 0;
      if (now !== 0 && side !== 0 && now !== side) {
        reversals++;
      }
      if (now !== 0) {
        side = now;
      }
      const magnitude = Math.abs(value);
      const nowOn: boolean | null = magnitude > SWITCHED_ON * largest ? true : magnitude < SWITCHED_OFF * largest ? false : on;
      if (nowOn !== null && on !== null && nowOn !== on) {
        switches++;
      }
      on = nowOn;
    }
    if (reversals / recent.wallSeconds > shownReversalsPerSecond) {
      // A reversal on nearly every traced moment means the trace is too sparse to see them all.
      found.set(wire, { kind: "alternating", frequency: reversals / 2 / recent.circuitSeconds, atLeast: reversals >= 0.6 * (values.length - 1), rms });
    } else if (switches / recent.wallSeconds > shownReversalsPerSecond) {
      found.set(wire, { kind: "pulsing", frequency: switches / 2 / recent.circuitSeconds, atLeast: switches >= 0.6 * (values.length - 1), rms });
    }
  });
  return found;
}

/** How much slower than now the run has to play for an alternation this fast to be seen flowing. */
export function slowEnoughFor(alternation: WireAlternation, speed: number, threshold = DEFAULT_ALTERNATION_THRESHOLD): number {
  return speed * threshold / alternation.frequency;
}

/** Each wire's current at each moment, signed by the way the wire is drawn. */
function signedWireCurrents(document: SchematicDocument, moments: readonly Record<string, PartLoad>[]): Map<string, number[]> {
  const signed = new Map<string, number[]>();
  for (const moment of moments) {
    wireCurrents(document, moment).forEach((current, wire) => {
      const values = signed.get(wire) ?? [];
      values.push(current.forward ? current.amperes : -current.amperes);
      signed.set(wire, values);
    });
  }
  return signed;
}

/**
 * Whether a wire's current changes faster than its moments: when most of its RMS is not in its means, the means
 * averaged an alternation away. Reversing when what is left of the mean is small beside the RMS, switching otherwise;
 * null when the means carry it.
 */
function withinMoments(means: readonly number[], rms: number): WireAlternation["kind"] | null {
  if (!(rms > 0) || means.length < 2) {
    return null;
  }
  const meanSquare = means.reduce((sum, mean) => sum + mean * mean, 0) / means.length;
  const hidden = Math.sqrt(Math.max(0, rms * rms - meanSquare));
  if (hidden < HIDDEN_SHARE * rms) {
    return null;
  }
  const mean = Math.abs(means.reduce((sum, value) => sum + value, 0) / means.length);
  return mean < REVERSING_SHARE * rms ? "alternating" : "pulsing";
}

import { channelUnit, type MathChannel, type SampleMemory, type ScopeSettings, type Window } from "../oscilloscope";
import { mathSource, mathUnit, mathUnitsOf, type TraceSource } from "./mathChannel";
import { analysisRecord, spectrumOf, spectrumPeak } from "./spectrum";

/*
 * The screen as a vector voltmeter shows it: every channel at one frequency — the fundamental of the first channel on —
 * as a phasor, an arrow whose length is the sine's amplitude and whose angle is how far it leads the first channel. The
 * frequency comes from the spectrum (its peak, refined between bins); each channel is then resolved at exactly that
 * frequency over a whole number of its periods, the last ones the screen holds, so a period cut by the window's edge
 * does not turn the angle. Read from the samples the screen shows, like the spectrum and the measurements.
 */

export interface Phasor {
  /** The channel's id, or «M». */
  id: string;
  color: number;
  /** The sine's peak, in the channel's unit. */
  amplitude: number;
  /** V, A, W …: arrows of one unit share a scale, and each unit has its own. */
  unit: string;
  /** Radians, positive ahead of the reference. */
  angle: number;
}

export interface PhasorDiagram {
  frequency: number;
  /** How many whole periods each phasor was resolved over. */
  periods: number;
  phasors: Phasor[];
}

/** The phasors of every enabled channel and the math channel; null without a periodic first channel and a period on screen. */
export function phasorsOf(memory: SampleMemory, settings: ScopeSettings, view: Window): PhasorDiagram | null {
  const channels = settings.channels.filter((channel) => channel.enabled);
  const reference = channels[0];
  if (!reference) {
    return null;
  }
  const spectrum = spectrumOf(memory, reference.id, view);
  if (!spectrum) {
    return null;
  }
  const frequency = spectrumPeak(spectrum).frequency;
  // Whole periods of the record the spectrum was read from — sampled without a break: a gap between two blocks of a live
  // stream, bridged by the trapezoid, turned the angles.
  const record = analysisRecord(memory, view);
  const end = memory.time(record.last - 1);
  const periods = Math.floor((end - memory.time(record.first)) * frequency);
  if (!(frequency > 0) || periods < 1) {
    return null;
  }
  const start = end - periods / frequency;
  const sources: { id: string; color: number; unit: string; source: TraceSource; channel: string }[] = channels.map((channel) =>
    ({ id: channel.id, color: channel.color, unit: channelUnit(channel), source: memory, channel: channel.id }));
  const math: MathChannel | undefined = settings.math?.enabled ? settings.math : undefined;
  if (math) {
    sources.push({ id: "M", color: math.color, unit: mathUnit(math, mathUnitsOf(math, settings)), source: mathSource(memory, math), channel: "M" });
  }
  const resolved = sources.map((entry) => ({ ...entry, value: resolve(entry.source, entry.channel, frequency, start, end) }));
  const zero = resolved[0].value;
  if (!zero) {
    return null;
  }
  const referenceAngle = Math.atan2(zero.imaginary, zero.real);
  const phasors = resolved.filter((entry) => entry.value).map((entry) => {
    const value = entry.value!;
    let angle = Math.atan2(value.imaginary, value.real) - referenceAngle;
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    return { id: entry.id, color: entry.color, unit: entry.unit, amplitude: Math.hypot(value.real, value.imaginary), angle };
  });
  return { frequency, periods, phasors };
}

/**
 * One channel at one frequency over [start, end]: (2/T) ∫ x(t) e^{−jωt} dt by the trapezoid rule over the samples as
 * they lie — evenly or not —, taken as a sine's phasor (cos for the real part, so a sine at phase 0 points down the
 * imaginary axis and every channel turns with it alike).
 */
function resolve(source: TraceSource, channel: string, frequency: number, start: number, end: number): { real: number; imaginary: number } | null {
  const first = Math.max(0, source.indexAt(start));
  const last = Math.min(source.length, source.indexAt(end) + 1);
  if (last - first < 8) {
    return null;
  }
  const omega = 2 * Math.PI * frequency;
  let real = 0;
  let imaginary = 0;
  let previous: { time: number; value: number } | null = null;
  for (let index = first; index < last; index++) {
    const time = Math.min(end, Math.max(start, source.time(index)));
    const value = source.reading(channel, index);
    if (!Number.isFinite(value)) {
      previous = null;
      continue;
    }
    if (previous && time > previous.time) {
      const step = time - previous.time;
      real += 0.5 * step * (previous.value * Math.cos(omega * previous.time) + value * Math.cos(omega * time));
      imaginary -= 0.5 * step * (previous.value * Math.sin(omega * previous.time) + value * Math.sin(omega * time));
    }
    previous = { time, value };
  }
  const duration = end - start;
  return { real: (2 / duration) * real, imaginary: (2 / duration) * imaginary };
}

import type { ComponentReferenceView } from "../transport/wire";
import type { LiveProbe } from "../transport/live";
import { formatReadout } from "../quantities";
import type { SampleMemory } from "../oscilloscope";
import type { PartLibraryView } from "../schematic/partLibrary";
import type { CircuitElement } from "../circuit/circuit";

/*
 * The bench's meters are its instrument parts: a component that says what it reads — `measure { reading = plus - minus
 * unit V }` — placed on the sheet and wired like any other part, across what it reads or in the break of a wire. What a
 * voltmeter, an ammeter, a frequency meter reads is written in its jMX document; nothing here knows any of them. The
 * server reads each figure on every sample, and the bench shows it over a gate, as a bench multimeter does.
 */

/** What the display shows: the mean (DC), the RMS of what swings around it (AC), or the RMS of the whole (AC + DC). */
export type MeterMode = "DC" | "AC" | "RMS";

export interface Meter {
  /** The channel the server reads it on: the part's id, or `part.figure` for an instrument that reads more than one. */
  id: string;
  /** The instrument part on the sheet. */
  part: string;
  /** Which of its `measure` figures this is. */
  figure: string;
  unit: string;
  /** A signal — read as DC, AC or RMS over the gate —, or a figure the instrument worked out, read as it is. */
  signal: boolean;
  /** What the instrument is, as its component calls itself: "Voltmeter". */
  title: string;
}

/** How long a reading is gathered over, in wall seconds: a bench meter shows about three readings a second. */
export const METER_GATE_SECONDS = 0.3;

/** Every figure of every instrument part among `elements`, once their component models are known. */
export function metersOf(library: PartLibraryView, elements: readonly CircuitElement[]): Meter[] {
  return elements.flatMap((element) => {
    const model = element.type === "MODEL" && element.component ? library.componentModelOf(element.component) : undefined;
    const measures = model?.measures ?? [];
    return measures.map((measure): Meter => ({
      id: measures.length === 1 ? element.id : `${element.id}.${measure.name}`,
      part: element.id, figure: measure.name, unit: measure.unit, signal: measure.signal, title: model?.name ?? element.id,
    }));
  });
}

/** The probe the server reads a meter on: its part's figure. */
export function meterProbe(meter: Meter): LiveProbe {
  return { channel: meter.id, quantity: "READING", positive: "0", negative: "0", part: meter.part, terminal: meter.figure };
}

export interface MeterReading {
  mean: number;
  /** RMS of the whole, AC + DC. */
  rms: number;
  /** RMS of what swings around the mean. */
  alternating: number;
  minimum: number;
  maximum: number;
}

/**
 * A meter's reading over the gate that ends at `end` and reaches back `span` seconds of circuit time — or what the
 * memory still holds of it, at the least a single sample. Null while nothing has been read.
 */
export function readMeter(memory: SampleMemory, channel: string, end: number, span: number): MeterReading | null {
  if (memory.length === 0) {
    return null;
  }
  // The screen may play a moment the memory has already let go of — its buffer is as long as a short memory —: the
  // gate then ends at the oldest sample kept, not at nothing.
  const last = Math.max(0, Math.min(memory.length, memory.indexAt(end + 1e-15)) - 1);
  let total = 0;
  let squares = 0;
  let count = 0;
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let index = last; index >= 0 && (count === 0 || memory.time(index) > end - span); index--) {
    const reading = memory.reading(channel, index);
    if (!Number.isFinite(reading)) {
      continue;
    }
    total += reading;
    squares += reading * reading;
    count++;
    minimum = Math.min(minimum, reading);
    maximum = Math.max(maximum, reading);
  }
  if (count === 0) {
    return null;
  }
  const mean = total / count;
  const rms = Math.sqrt(squares / count);
  return { mean, rms, alternating: Math.sqrt(Math.max(0, squares / count - mean * mean)), minimum, maximum };
}

/** The figure a meter's display shows in a mode. */
export function shownReading(mode: MeterMode, reading: MeterReading): number {
  return mode === "DC" ? reading.mean : mode === "AC" ? reading.alternating : reading.rms;
}

/** A meter's figure as its display shows it, with its unit; a dash while it has none. */
export function meterText(meter: Meter, mode: MeterMode, reading: MeterReading | null | undefined): string {
  return reading ? formatReadout(shownReading(mode, reading), meter.unit) : "—";
}

/** The instrument components a bench can place: those whose own document calls them a meter (`type meter`). */
export function instrumentComponents(library: PartLibraryView, models: readonly ComponentReferenceView[]): ComponentReferenceView[] {
  return models.filter((model) => library.componentModelOf(model.reference)?.kind === "meter");
}

/** How many readings a meter's graph keeps: at three a second, the last half minute of the run. */
export const METER_HISTORY_READINGS = 100;

/** One reading of a meter's history: the run's time at the end of its gate, and what it read over it. */
export interface MeterHistoryPoint {
  time: number;
  reading: MeterReading;
}

/** An analog display's scale: from `minimum` to `maximum` in the meter's unit — 0 at the left, or in the middle for a figure that goes negative. */
export interface GaugeScale {
  minimum: number;
  maximum: number;
}

/** The full-scale values an analog meter's range switch steps through, in each decade: 1, 2, 5. */
const RANGE_STEPS = [1, 2, 5];
/** A range is changed down only once the reading has stayed under this share of it: a scale does not flick. */
const RANGE_DOWN_SHARE = 0.2;

/**
 * The scale an analog display shows a value on, as a meter with an automatic range switch picks it: the smallest full
 * scale of 1, 2 or 5 a decade that the value fits in with a tenth to spare; kept when the value still fits it and is
 * not far down in it, so the needle moves rather than the scale. A value below zero puts zero in the middle.
 */
export function gaugeScale(value: number, previous: GaugeScale | null): GaugeScale {
  const magnitude = Math.abs(value) * 1.1;
  const signed = value < 0 || (previous !== null && previous.minimum < 0 && Math.abs(value) > RANGE_DOWN_SHARE * previous.maximum);
  if (previous && magnitude <= previous.maximum && magnitude >= RANGE_DOWN_SHARE * previous.maximum && (previous.minimum < 0) === signed) {
    return previous;
  }
  const full = fullScaleFor(Math.max(magnitude, 1e-12));
  return { minimum: signed ? -full : 0, maximum: full };
}

function fullScaleFor(magnitude: number): number {
  const decade = Math.pow(10, Math.floor(Math.log10(magnitude)));
  for (const step of [...RANGE_STEPS, 10]) {
    if (step * decade >= magnitude) {
      return step * decade;
    }
  }
  return 10 * decade;
}

/**
 * The values an analog scale is marked at: five numbered divisions across it — four on a scale with zero in the
 * middle, so zero is one of them —, each split in five.
 */
export function gaugeMarks(scale: GaugeScale): { major: number[]; minor: number[] } {
  const span = scale.maximum - scale.minimum;
  const divisions = scale.minimum < 0 ? 4 : 5;
  const major = Array.from({ length: divisions + 1 }, (_, index) => scale.minimum + span * index / divisions);
  const minor = Array.from({ length: divisions * 5 + 1 }, (_, index) => scale.minimum + span * index / (divisions * 5))
    .filter((_, index) => index % 5 !== 0);
  return { major, minor };
}

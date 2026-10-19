import type { SampleMemory } from "./SampleMemory";

/*
 * A bench oscilloscope's front panel and what it reads off its memory: the window a screen shows — free running or
 * triggered on an edge — and the measurements of a channel over that window.
 */

/** The screen is ten divisions wide and eight high, as on every bench oscilloscope. */
export const HORIZONTAL_DIVISIONS = 10;
/** The screen's height in divisions. */
export const VERTICAL_DIVISIONS = 8;

/** The four channels a bench oscilloscope has. */
export const CHANNEL_IDS = ["CH1", "CH2", "CH3", "CH4"] as const;
/** One of the four channels. */
export type ChannelId = (typeof CHANNEL_IDS)[number];

/** How many probe colours there are to choose from: the screen's tokens `--parallax-probe-1` … `--parallax-probe-10`. */
export const PROBE_COLORS = 10;

/** One channel: where its probe is, how its trace is scaled, and the colour its probe, trace and legend share. */
export interface ScopeChannel {
  id: ChannelId;
  enabled: boolean;
  /** The node the probe tip touches, and the node its ground clip is on ("ground" for the circuit's 0). */
  node: string;
  reference: string;
  voltsPerDivision: number;
  /** The trace's zero, in divisions above the screen's centre. */
  position: number;
  coupling: "DC" | "AC";
  /** 1 … {@link PROBE_COLORS}. */
  color: number;
  /** What the reader calls it — "mains", "out" —; empty keeps the id. The id stays what the trigger and `probes` name. */
  name: string;
  /**
   * What the probe reads: a node's voltage, or — a current clamp — the current into a part's first terminal, `part`.
   * Absent in settings kept before it existed: a voltage.
   */
  quantity?: "voltage" | "current";
  part?: string;
  /**
   * Whether its trace is drawn. A channel hidden is still read — measured, triggered on, fed into the math channel —, so
   * M = CH1 − CH2 can stand on the screen alone. Absent in settings kept before it existed: drawn.
   */
  shown?: boolean;
  /**
   * What the reading is written over with, X being the probe's reading: `X * pi / 2`, `abs(X)`. Applied as the memory is
   * read, so the trace, the trigger, the measurements and the math channel all see it. Absent or empty: the reading.
   */
  expression?: string;
}

/** The farthest a trace's zero may stand from the screen's centre, in divisions: far enough to look at 1 V by the µV. */
export const POSITION_LIMIT = 1e6;

/**
 * A channel scaled one step of the 1–2–5 ladder, with the level at `anchor` — divisions above the screen's centre, where
 * the pointer is — staying where it stands: zooming in on a 1 V trace at the screen's middle keeps the trace there
 * instead of throwing it a thousand divisions off the top.
 */
export function zoomedChannel<Channel extends { voltsPerDivision: number; position: number }>(channel: Channel, voltsPerDivision: number, anchor: number): Channel {
  const level = (anchor - channel.position) * channel.voltsPerDivision;
  const position = anchor - level / voltsPerDivision;
  return { ...channel, voltsPerDivision, position: Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, Math.round(position * 100) / 100)) };
}

/** Whether a channel's trace is on the screen: read, and not hidden. */
export function channelDrawn(channel: ScopeChannel): boolean {
  return channel.enabled && channel.shown !== false;
}

/** The unit a channel reads in: A for a current clamp, V for a voltage probe. */
export function channelUnit(channel: ScopeChannel): string {
  return channel.quantity === "current" ? "A" : "V";
}

/** What a channel's probe is on, as its legend says it: `out`, `out − ref`, `R1 current`. */
export function channelSource(channel: ScopeChannel): string {
  if (channel.quantity === "current") {
    return `${channel.part ?? "?"} current`;
  }
  return channel.reference !== "ground" ? `${channel.node} − ${channel.reference}` : channel.node;
}

/** How the math channel combines its two channels. */
export type MathOperation = "sum" | "difference" | "product";

/**
 * The math channel: two channels combined sample by sample and drawn as a trace of its own, with its own scale, zero
 * and colour. Absent in settings kept before it existed: off.
 */
export interface MathChannel {
  enabled: boolean;
  operation: MathOperation;
  first: ChannelId;
  second: ChannelId;
  voltsPerDivision: number;
  position: number;
  /** 1 … {@link PROBE_COLORS}. */
  color: number;
}

/** The math channel as it starts: off, CH1 − CH2 — the voltage across whatever lies between two probes. */
export const DEFAULT_MATH: MathChannel = { enabled: false, operation: "difference", first: "CH1", second: "CH2", voltsPerDivision: 1, position: 0, color: 6 };

/** The name a channel is shown by: its own, or its id. */
export function channelName(channel: ScopeChannel): string {
  return channel.name.trim() || channel.id;
}

/**
 * Auto draws a trace without a trigger; normal waits for one; single stops after the first; free ignores the trigger
 * altogether — the screen runs with the newest sample at its right edge, so a slowed circuit is seen flowing.
 */
export type TriggerMode = "auto" | "normal" | "single" | "free";

/** Which way the source has to cross the level: up, down, or either. */
export type TriggerEdge = "rising" | "falling" | "either";

/** Everything the front panel sets: channels, time base, trigger, the wheel and the cursors. */
export interface ScopeSettings {
  channels: ScopeChannel[];
  secondsPerDivision: number;
  /** `position`: where across the screen the trigger moment stands, 0.1 … 0.9 — less shows more of what follows it. */
  trigger: { mode: TriggerMode; source: ChannelId; edge: TriggerEdge; level: number; position: number };
  /** What the mouse wheel scales: the time base, or the active channel's volts per division. */
  wheel: "time" | "volts";
  active: ChannelId;
  /**
   * Two cursors, A and B, as shares of the screen: across it on the time axis — `axis` "time", the default —, or down
   * it on the active channel's volts.
   */
  cursors: { enabled: boolean; axis?: "time" | "volts"; first: number; second: number };
  /** A phosphor screen: each trace glows, and stays a moment after it is drawn, fading. */
  phosphor: boolean;
  /**
   * Trails, as an electron-beam screen leaves them: the last sweeps under the live one, each older one fainter and
   * thinner. How many and how bright is the reader's appearance (`SimulatorAppearance.scopeTrails`), not the scope's.
   * Absent in settings kept before it existed: off.
   */
  trails?: boolean;
  /**
   * Infinite persistence: every trace drawn stays on the screen until it is cleared — a family of curves drawn by
   * stepping a knob, a jitter's whole extent. Absent in settings kept before it existed: off.
   */
  hold?: boolean;
  /**
   * How a live run is acquired: `gapless` — every sample read, the run slowed as far as that takes, so a deep time base
   * holds an unbroken record —, or `realtime` — real time first, one block a frame. Absent: gapless.
   */
  acquisition?: "gapless" | "realtime";
  /**
   * What the screen plots: each channel against time, or — `xy` — the first channel on, across, against the second, up:
   * two signals as one figure, a Lissajous figure for two sines; or — `fft` — each channel's spectrum over the window shown,
   * its amplitude in dBV against the frequency; or — `phasors` — every channel at the first one's fundamental as an arrow,
   * its length the amplitude and its angle the lead. Absent in settings kept before it existed: time.
   */
  display?: "time" | "xy" | "fft" | "phasors";
  /**
   * How much time the screen holds: `divisions` — the time base times ten, swept or rolled through the memory —, or
   * `record` — the whole record, from its first sample to now, the axis compressing as the run goes on, as a chart
   * recorder's paper would if it were folded to fit. No trigger in a record. Absent in settings kept before it existed:
   * divisions.
   */
  horizontal?: "divisions" | "record";
  /** The math channel; absent is off. */
  math?: MathChannel;
  /**
   * The FFT display's levels: the top of the screen in dB of the channel's unit and the dB a division holds. Absent in
   * settings kept before it existed: +20 dB at 10 dB a division.
   */
  spectrum?: { top: number; decibelsPerDivision: number };
}

/** Whether the screen holds the whole record rather than a time base's ten divisions. */
export function holdsWholeRecord(settings: ScopeSettings): boolean {
  return settings.horizontal === "record";
}

/** The stretch of time a screen shows. */
export interface Window {
  start: number;
  span: number;
  /** The time the trigger fired at, when it did. */
  triggered: number | null;
}

/**
 * Where the screen looks, as a digital oscilloscope looks into its acquisitions: the window is always a stretch that
 * was sampled whole, never one with a gap in it.
 *
 * <ul>
 *   <li>Triggered: the latest crossing of the level whose whole window — the trigger at its position, the screen before
 *   and after it — lies inside one acquisition and ends by "now". A window laid over the gap between two blocks of a
 *   live stream was a trace cut off, a different piece of it every frame.</li>
 *   <li>Auto with no such crossing: the last screenful of the latest acquisition that ended by "now" — not the gap after it.</li>
 *   <li>Free, looked back into (`back`), or the whole record: the stretch itself, gaps shown as gaps — a rolling screen
 *   is the stream as it comes.</li>
 * </ul>
 *
 * <p>A record shorter than the screen — the first moments of a run — is a sweep: the screen starts where the record
 * starts and the trace grows to the right, as a bench oscilloscope's beam writes it. Laid against "now" instead, the
 * screen was empty up to «memory starts» and the trace crept in from the right edge.</p>
 *
 * `shownTime`, a live screen's playback clock, is where "now" is when it is not the newest sample.
 */
export function windowOf(memory: SampleMemory, settings: ScopeSettings, back: number, shownTime = memory.lastTime()): Window {
  if (holdsWholeRecord(settings)) {
    const start = memory.recordStart();
    return { start, span: Math.max(shownTime - start, settings.secondsPerDivision * 1e-3), triggered: null };
  }
  const span = settings.secondsPerDivision * HORIZONTAL_DIVISIONS;
  const end = shownTime - back;
  if (back > 0 || memory.length < 2) {
    return { start: end - span, span, triggered: null };
  }
  if (settings.trigger.mode === "free") {
    return { start: Math.max(end - span, memory.firstTime()), span, triggered: null };
  }
  const position = Math.min(0.9, Math.max(0.1, settings.trigger.position));
  const crossing = latestWholeCrossing(memory, settings, span, position, end);
  if (crossing === null) {
    return { start: untriggeredStart(memory, end, span), span, triggered: null };
  }
  return { start: crossing - span * position, span, triggered: crossing };
}

/**
 * Where an untriggered screen starts: a screenful before the end of the latest acquisition that ended by `end` — not the
 * gap after it —, or that acquisition's own start while it is shorter than the screen: a sweep that grows to the right.
 */
function untriggeredStart(memory: SampleMemory, end: number, span: number): number {
  const last = lastSampleBy(memory, end);
  if (last < 0) {
    // "Now" is before the first sample — a playback clock that has not reached the record yet: the sweep starts with it.
    return memory.firstTime();
  }
  const acquisitionStart = memory.time(memory.acquisitionStart(last));
  const acquisitionEnd = Math.min(end, memory.time(memory.acquisitionEnd(last)));
  return Math.max(acquisitionEnd - span, acquisitionStart);
}

/** The last sample at or before `time`; −1 when there is none. */
function lastSampleBy(memory: SampleMemory, time: number): number {
  const next = memory.indexAt(time);
  if (next < memory.length && memory.time(next) === time) {
    return next;
  }
  return next - 1;
}

/**
 * The latest crossing of the trigger's level whose window lies whole inside the acquisition it is in and ends by `end`.
 * The search goes back three screens, and at least through the acquisition before the latest one — a live block can
 * end a moment before "now", and its crossings are the picture to show.
 */
function latestWholeCrossing(memory: SampleMemory, settings: ScopeSettings, span: number, position: number, end: number): number | null {
  const { source, edge, level } = settings.trigger;
  const before = span * position;
  const after = span - before;
  const latest = Math.min(memory.length - 1, memory.indexAt(end - after));
  if (latest < 1) {
    return null;
  }
  const own = memory.acquisitionStart(latest);
  const previous = own > 0 ? memory.acquisitionStart(own - 1) : 0;
  // Back three screens, through the acquisition before the latest — and at least the last TRIGGER_SEARCH_SAMPLES: at a
  // fine time base three screens are microseconds, and a 1 kHz edge was a millisecond back, never found.
  const stop = Math.max(1, Math.min(memory.indexAt(end - span * 3), previous, latest - TRIGGER_SEARCH_SAMPLES));
  let acquisition = { first: -1, last: -1, start: Number.NaN, end: Number.NaN };
  let longestAcquisition = 0;
  let partial: number | null = null;
  for (let index = latest; index >= stop; index--) {
    if (!memory.continues(index)) {
      continue;
    }
    const readingBefore = memory.reading(source, index - 1);
    const readingAfter = memory.reading(source, index);
    const up = readingBefore < level && readingAfter >= level;
    const down = readingBefore > level && readingAfter <= level;
    if (!(edge === "rising" ? up : edge === "falling" ? down : up || down)) {
      continue;
    }
    const timeBefore = memory.time(index - 1);
    const crossing = timeBefore + (memory.time(index) - timeBefore) * ((level - readingBefore) / (readingAfter - readingBefore || 1));
    if (crossing + after > end) {
      continue;
    }
    if (index < acquisition.first || index > acquisition.last) {
      const first = memory.acquisitionStart(index);
      const last = memory.acquisitionEnd(index);
      acquisition = { first, last, start: memory.time(first), end: memory.time(last) };
      longestAcquisition = Math.max(longestAcquisition, acquisition.end - acquisition.start);
    }
    if (crossing - before >= acquisition.start && crossing + after <= acquisition.end) {
      return crossing;
    }
    partial ??= crossing;
  }
  // A screen longer than every acquisition searched cannot hold one whole: the latest crossing is the trigger then, its
  // window crossing a gap. Without this, zooming the time base out past a live block's length lost the trigger for good.
  return longestAcquisition < span ? partial : null;
}

/** How many samples back the trigger always looks, whatever the time base: a frame's worth of a gapless run and more. */
const TRIGGER_SEARCH_SAMPLES = 50_000;

/** What a channel read over a window. */
export interface Measurement {
  minimum: number;
  maximum: number;
  mean: number;
  rms: number;
  frequency: number | null;
  /** The share of each whole period spent above the 50 % level, 0…1; null when the trace is not periodic on screen. */
  duty: number | null;
}

/**
 * What a channel read over the window: extremes, mean, RMS, and — as a bench oscilloscope measures them, at the 50 %
 * level between the extremes — the frequency from its rising crossings and the duty over the whole periods between the
 * first and the last of them, so a period cut by the screen's edge does not bias it. The extremes are the samples'
 * peaks, so a signal faster than the samples still reads its full swing.
 */
export function measure(memory: SampleMemory, channel: ChannelId, window: Window): Measurement | null {
  const first = memory.indexAt(window.start);
  const last = memory.indexAt(window.start + window.span);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let squares = 0;
  let count = 0;
  for (let index = first; index < last; index++) {
    const value = memory.reading(channel, index);
    if (!Number.isFinite(value)) {
      continue;
    }
    minimum = Math.min(minimum, memory.low(channel, index));
    maximum = Math.max(maximum, memory.high(channel, index));
    // The mean over each sample's interval: a mean of instants aliases — a 20 kHz square read five times a period
    // averaged 2 V for 1.5.
    sum += memory.mean(channel, index);
    squares += value * value;
    count++;
  }
  if (count === 0) {
    return null;
  }
  // A mean a millionth of the swing is the rounding of a sum, not a figure: a 10 V sine read -1.21 nV.
  const mean = Math.abs(sum / count) < (maximum - minimum) * 1e-6 ? 0 : sum / count;
  const level = (minimum + maximum) / 2;
  const hysteresis = (maximum - minimum) * 0.05;
  const crossings: number[] = [];
  let armed = false;
  for (let index = first; index < last; index++) {
    const value = memory.reading(channel, index);
    if (value < level - hysteresis) {
      armed = true;
    } else if (armed && value >= level) {
      crossings.push(index);
      armed = false;
    }
  }
  // A signal faster than its samples — most of them spanning half its swing within their own interval — has crossings
  // the samples cannot place: its frequency and duty are not known, rather than whatever the samples alias to.
  let spanning = 0;
  for (let index = first; index < last; index++) {
    if (memory.high(channel, index) - memory.low(channel, index) > (maximum - minimum) / 2) {
      spanning++;
    }
  }
  const periodic = crossings.length >= 2 && hysteresis > 0 && spanning < count / 4;
  const firstCrossing = crossings[0];
  const lastCrossing = crossings[crossings.length - 1];
  const frequency = periodic ? (crossings.length - 1) / (memory.time(lastCrossing) - memory.time(firstCrossing)) : null;
  let high = 0;
  if (periodic) {
    for (let index = firstCrossing; index < lastCrossing; index++) {
      if (memory.reading(channel, index) >= level) {
        high++;
      }
    }
  }
  const duty = periodic ? high / (lastCrossing - firstCrossing) : null;
  return { minimum, maximum, mean, rms: Math.sqrt(squares / count), frequency, duty };
}

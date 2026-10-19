import type { ReadingTransform } from "./readingExpression";

/**
 * An oscilloscope's acquisition memory: a ring of the last `capacity` samples, one column of times and one per
 * channel. Appending never allocates and never grows — the oldest sample is overwritten — so a circuit that has
 * run for an hour costs what one that ran for a second does. `version` moves on every change; a screen redraws
 * when it moved, without React being told about each frame.
 */
export class SampleMemory {
  private times: Float64Array;
  private columns = new Map<string, Float64Array>();
  /** Each channel's lowest and highest reading over a sample's interval, where the source measured them; NaN elsewhere. */
  private lows = new Map<string, Float64Array>();
  private highs = new Map<string, Float64Array>();
  private means = new Map<string, Float64Array>();
  private transforms: ReadonlyMap<string, ReadingTransform> = new Map();
  /**
   * Which acquisition each sample belongs to: an unbroken record, sampled without a sample missing. A batch appended is
   * one; it goes on the one before it when it starts a step after its last sample. A live run at a speed the server
   * cannot read whole keeps one block a frame and passes the rest, and the screen must know where those blocks end —
   * told, never guessed from the times: a guess drew lines across the gaps and broke a trace whose steps vary.
   */
  private acquisitions: Float64Array;
  private acquisition = 0;
  /** The time between the last two samples appended, for a batch of one sample to be judged by. */
  private step = Number.NaN;
  /** The slot the next sample goes into. */
  private head = 0;
  private filled = 0;
  version = 0;
  /** Moves on every clear: a new run, new probes, a new size — the moment a screen fits its traces again. */
  generation = 0;

  private size: number;
  /**
   * Keeping the whole record: a full memory does not drop its oldest sample but folds every two neighbours into one —
   * their extremes and their mean kept —, so it holds the run from its start at half the resolution, as a data logger
   * does. Off, it is a ring.
   */
  private whole = false;
  /**
   * Where the whole record begins: the first sample's time when it began. A folded sample stands for the interval
   * that ends at its time, so after k folds the first kept sample is 2^k intervals in — the record's start is not it.
   */
  private origin = Number.NaN;

  constructor(size: number) {
    this.size = size;
    this.times = new Float64Array(size);
    this.acquisitions = new Float64Array(size);
  }

  get capacity(): number {
    return this.size;
  }

  get length(): number {
    return this.filled;
  }

  get channels(): string[] {
    return [...this.columns.keys()];
  }

  /** A fresh memory of another size; what it held is dropped, as a real instrument drops it. */
  resize(capacity: number) {
    this.size = capacity;
    this.times = new Float64Array(capacity);
    this.acquisitions = new Float64Array(capacity);
    this.columns = new Map([...this.columns.keys()].map((name) => [name, new Float64Array(capacity).fill(Number.NaN)]));
    this.lows = new Map([...this.lows.keys()].map((name) => [name, new Float64Array(capacity).fill(Number.NaN)]));
    this.highs = new Map([...this.highs.keys()].map((name) => [name, new Float64Array(capacity).fill(Number.NaN)]));
    this.means = new Map([...this.means.keys()].map((name) => [name, new Float64Array(capacity).fill(Number.NaN)]));
    this.clear();
  }

  clear() {
    this.head = 0;
    this.filled = 0;
    this.origin = Number.NaN;
    this.step = Number.NaN;
    this.acquisition++;
    for (const column of this.columns.values()) {
      column.fill(Number.NaN);
    }
    for (const column of [...this.lows.values(), ...this.highs.values(), ...this.means.values()]) {
      column.fill(Number.NaN);
    }
    this.generation++;
    this.version++;
  }

  /**
   * A batch of samples: their times and, per channel, one reading each. A channel not in the batch reads NaN. `peaks`,
   * when the source measured them, are each channel's lowest and highest reading over every sample's interval.
   * `interval`, when the source says it, is the time between its samples — what tells whether this batch goes on the
   * last acquisition. Without it the step is read off the batch; a batch of one sample has none, and a slowed run sends
   * one sample a frame: told nothing, every one of them was an acquisition of its own and the trace fell to dots.
   */
  append(times: ArrayLike<number>, readings: Record<string, ArrayLike<number>>,
    peaks: Record<string, { lows: ArrayLike<number>; highs: ArrayLike<number>; means?: ArrayLike<number> }> = {}, interval?: number) {
    for (const name of Object.keys(readings)) {
      if (!this.columns.has(name)) {
        this.columns.set(name, new Float64Array(this.size).fill(Number.NaN));
      }
    }
    for (const name of Object.keys(peaks)) {
      if (!this.lows.has(name)) {
        this.lows.set(name, new Float64Array(this.size).fill(Number.NaN));
        this.highs.set(name, new Float64Array(this.size).fill(Number.NaN));
        this.means.set(name, new Float64Array(this.size).fill(Number.NaN));
      }
    }
    if (this.whole && !Number.isFinite(this.origin) && times.length) {
      this.origin = this.filled ? this.time(0) : times[0];
    }
    if (interval !== undefined && interval > 0) {
      this.step = interval;
    } else if (times.length > 1) {
      this.step = times[1] - times[0];
    }
    if (times.length && !this.goesOn(times[0])) {
      this.acquisition++;
    }
    for (let index = 0; index < times.length; index++) {
      if (this.whole && this.filled === this.size && this.size > 1) {
        this.fold();
      }
      this.times[this.head] = times[index];
      this.acquisitions[this.head] = this.acquisition;
      for (const [name, column] of this.columns) {
        const reading = readings[name]?.[index];
        column[this.head] = reading === undefined ? Number.NaN : reading;
      }
      for (const [name, column] of this.lows) {
        column[this.head] = peaks[name]?.lows[index] ?? Number.NaN;
      }
      for (const [name, column] of this.highs) {
        column[this.head] = peaks[name]?.highs[index] ?? Number.NaN;
      }
      for (const [name, column] of this.means) {
        column[this.head] = peaks[name]?.means?.[index] ?? Number.NaN;
      }
      this.head = (this.head + 1) % this.size;
      this.filled = Math.min(this.size, this.filled + 1);
    }
    if ((interval === undefined || !(interval > 0)) && times.length > 1) {
      this.step = times[times.length - 1] - times[times.length - 2];
    }
    this.version++;
  }

  /** Whether a batch starting at `time` goes on the last acquisition: a step after its last sample, give or take half. */
  private goesOn(time: number): boolean {
    if (!this.filled || !(this.step > 0)) {
      return false;
    }
    const step = time - this.lastTime();
    return step > 0 && step <= this.step * 1.5;
  }

  /** Whether the i-th sample goes on from the one before it in one acquisition: whether a line may join the two. */
  continues(index: number): boolean {
    return index > 0 && index < this.filled && this.acquisitions[this.slot(index)] === this.acquisitions[this.slot(index - 1)];
  }

  /** The first sample of the acquisition the i-th belongs to. */
  acquisitionStart(index: number): number {
    const own = this.acquisitions[this.slot(index)];
    let low = 0;
    let high = index;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.acquisitions[this.slot(middle)] < own) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low;
  }

  /** The last sample of the acquisition the i-th belongs to. */
  acquisitionEnd(index: number): number {
    const own = this.acquisitions[this.slot(index)];
    let low = index;
    let high = this.filled - 1;
    while (low < high) {
      const middle = (low + high + 1) >>> 1;
      if (this.acquisitions[this.slot(middle)] > own) {
        high = middle - 1;
      } else {
        low = middle;
      }
    }
    return low;
  }

  get keepsWhole(): boolean {
    return this.whole;
  }

  /** Keeps the whole record from now on — what it holds now is its start —, or goes back to being a ring. */
  keepWhole(whole: boolean) {
    if (whole && !this.whole) {
      this.origin = this.filled ? this.time(0) : Number.NaN;
    }
    this.whole = whole;
  }

  /** Where the whole record begins; the first kept sample when the memory is a ring. */
  recordStart(): number {
    return this.whole && Number.isFinite(this.origin) && this.filled ? Math.min(this.origin, this.firstTime()) : this.firstTime();
  }

  /**
   * Every two neighbouring samples, oldest first, become one: the later one's time and reading — a sample stands for
   * the interval before it —, the lower of their lows, the higher of their highs, and their means weighted by the time
   * each stood for. An odd last sample stays as it is. The memory is laid out from slot 0 again.
   */
  private fold() {
    const count = this.filled;
    const kept = Math.ceil(count / 2);
    const order = Array.from({ length: count }, (_, index) => this.slot(index));
    const times = new Float64Array(this.size);
    const acquisitions = new Float64Array(this.size);
    for (const name of this.columns.keys()) {
      if (!this.lows.has(name)) {
        this.lows.set(name, new Float64Array(this.size).fill(Number.NaN));
        this.highs.set(name, new Float64Array(this.size).fill(Number.NaN));
        this.means.set(name, new Float64Array(this.size).fill(Number.NaN));
      }
    }
    const folded = new Map<string, { readings: Float64Array; lows: Float64Array; highs: Float64Array; means: Float64Array }>();
    for (const [name, column] of this.columns) {
      const lows = this.lows.get(name)!;
      const highs = this.highs.get(name)!;
      const means = this.means.get(name)!;
      const into = {
        readings: new Float64Array(this.size).fill(Number.NaN), lows: new Float64Array(this.size).fill(Number.NaN),
        highs: new Float64Array(this.size).fill(Number.NaN), means: new Float64Array(this.size).fill(Number.NaN),
      };
      const own = (values: Float64Array, slot: number) => Number.isFinite(values[slot]) ? values[slot] : column[slot];
      for (let pair = 0; pair < kept; pair++) {
        const later = order[Math.min(count - 1, pair * 2 + 1)];
        const earlier = order[pair * 2];
        into.readings[pair] = column[later];
        if (later === earlier) {
          into.lows[pair] = own(lows, earlier);
          into.highs[pair] = own(highs, earlier);
          into.means[pair] = own(means, earlier);
          continue;
        }
        into.lows[pair] = Math.min(own(lows, earlier), own(lows, later));
        into.highs[pair] = Math.max(own(highs, earlier), own(highs, later));
        // The earlier sample stood for the interval before it — back to the record's start when it is the first; the
        // sample AT the start stands for nothing, so the record's integral is kept exactly through every fold.
        const before = pair > 0 ? this.times[order[pair * 2 - 1]]
          : Number.isFinite(this.origin) ? this.origin : 2 * this.times[earlier] - this.times[later];
        const first = Math.max(0, this.times[earlier] - before);
        const second = Math.max(0, this.times[later] - this.times[earlier]);
        into.means[pair] = first + second > 0
          ? (own(means, earlier) * first + own(means, later) * second) / (first + second)
          : (own(means, earlier) + own(means, later)) / 2;
      }
      folded.set(name, into);
    }
    for (let pair = 0; pair < kept; pair++) {
      times[pair] = this.times[order[Math.min(count - 1, pair * 2 + 1)]];
      acquisitions[pair] = this.acquisitions[order[Math.min(count - 1, pair * 2 + 1)]];
    }
    this.times = times;
    this.acquisitions = acquisitions;
    for (const [name, into] of folded) {
      this.columns.set(name, into.readings);
      this.lows.set(name, into.lows);
      this.highs.set(name, into.highs);
      this.means.set(name, into.means);
    }
    this.filled = kept;
    this.head = kept % this.size;
  }

  /** The i-th kept sample, oldest first: its slot in the ring. */
  slot(index: number): number {
    return (this.head - this.filled + index + this.size) % this.size;
  }

  time(index: number): number {
    return this.times[this.slot(index)];
  }

  /**
   * What each channel's reading is written over with — `X * pi / 2` —, applied as it is read: the samples kept are the
   * probe's, so changing or clearing an expression redraws the whole memory without losing anything. A channel without
   * one reads as it was sampled.
   */
  setTransforms(transforms: ReadonlyMap<string, ReadingTransform>) {
    this.transforms = transforms;
    this.version++;
  }

  reading(channel: string, index: number): number {
    const value = this.sampled(channel, index);
    const transform = this.transforms.get(channel);
    return transform ? transform(value) : value;
  }

  private sampled(channel: string, index: number): number {
    const column = this.columns.get(channel);
    return column ? column[this.slot(index)] : Number.NaN;
  }

  /** A peak as sampled: measured, or the reading itself. */
  private sampledPeak(peaks: Map<string, Float64Array>, channel: string, index: number): number {
    const value = peaks.get(channel)?.[this.slot(index)];
    return value !== undefined && Number.isFinite(value) ? value : this.sampled(channel, index);
  }

  /**
   * The lowest reading over the i-th sample's interval: its peak when measured, else the reading itself. Under an
   * expression the lower of the two peaks transformed — a falling expression turns the high peak into the low one.
   */
  low(channel: string, index: number): number {
    const transform = this.transforms.get(channel);
    const low = this.sampledPeak(this.lows, channel, index);
    return transform ? Math.min(transform(low), transform(this.sampledPeak(this.highs, channel, index))) : low;
  }

  /** The mean reading over the i-th sample's interval: averaged when measured, else the reading itself. */
  mean(channel: string, index: number): number {
    const transform = this.transforms.get(channel);
    const mean = this.sampledPeak(this.means, channel, index);
    return transform ? transform(mean) : mean;
  }

  /** The highest reading over the i-th sample's interval: its peak when measured, else the reading itself. */
  high(channel: string, index: number): number {
    const transform = this.transforms.get(channel);
    const high = this.sampledPeak(this.highs, channel, index);
    return transform ? Math.max(transform(high), transform(this.sampledPeak(this.lows, channel, index))) : high;
  }

  firstTime(): number {
    return this.filled ? this.time(0) : 0;
  }

  lastTime(): number {
    return this.filled ? this.time(this.filled - 1) : 0;
  }

  /** The first kept sample at or after `time` (binary search over the ring, which is in time order). */
  indexAt(time: number): number {
    let low = 0;
    let high = this.filled;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.time(middle) < time) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low;
  }

  /** The kept samples between two times, as plain arrays — for a recording, a measurement, a file. */
  slice(from: number, to: number): { time: number[]; channels: Record<string, number[]> } {
    const first = this.indexAt(from);
    const last = this.indexAt(to);
    const time: number[] = [];
    const names = this.channels;
    const channels: Record<string, number[]> = Object.fromEntries(names.map((name) => [name, []]));
    for (let index = first; index < last; index++) {
      time.push(this.time(index));
      for (const name of names) {
        channels[name].push(this.reading(name, index));
      }
    }
    return { time, channels };
  }
}

/** A recording: the next N samples as they arrive, kept whole, then closed. It is a file waiting to be saved. */
export class Recording {
  readonly time: number[] = [];
  readonly channels: Record<string, number[]> = {};

  readonly id: number;
  readonly target: number;
  readonly label: string;

  constructor(id: number, target: number, label: string) {
    this.id = id;
    this.target = target;
    this.label = label;
  }

  get complete(): boolean {
    return this.time.length >= this.target;
  }

  append(times: ArrayLike<number>, readings: Record<string, ArrayLike<number>>) {
    for (let index = 0; index < times.length && !this.complete; index++) {
      this.time.push(times[index]);
      for (const [name, values] of Object.entries(readings)) {
        (this.channels[name] ??= new Array<number>(this.time.length - 1).fill(Number.NaN)).push(values[index]);
      }
      // A channel this batch does not carry reads NaN here, so every column stays aligned with the times.
      for (const column of Object.values(this.channels)) {
        if (column.length < this.time.length) {
          column.push(Number.NaN);
        }
      }
    }
  }

  /** The recording as a memory, so a screen can show it as it shows a live one. */
  toMemory(): SampleMemory {
    const memory = new SampleMemory(Math.max(1, this.time.length));
    memory.append(this.time, this.channels);
    return memory;
  }

  /** The recording as CSV: a comment line, then a column per channel named with its unit — `A1 [A]`, `CH1 [V]`. */
  toCsv(header: string, unitOf: (channel: string) => string): string {
    const names = Object.keys(this.channels);
    const column = (name: string, unit: string) => unit ? `${name} [${unit}]` : name;
    const rows = [`# ${header}`, [column("time", "s"), ...names.map((name) => column(name, unitOf(name)))].join(",")];
    for (let index = 0; index < this.time.length; index++) {
      rows.push([this.time[index], ...names.map((name) => this.channels[name][index] ?? "")].join(","));
    }
    return rows.join("\r\n");
  }
}

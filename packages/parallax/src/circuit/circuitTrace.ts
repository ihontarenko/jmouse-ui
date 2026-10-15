import type { PartLoad } from "../transport/live";
import { GROUND, type CircuitElement } from "./circuit";

/**
 * A circuit through time, as the sheet plays it: every node's voltage (`out`, unit "V") and every part's current
 * (`R1` — into a two-terminal part's first terminal — or `U1.output` — into a model's pin —, unit "A"), named as the
 * circuit names them. A computed transient (the Graph) and a live run (the emulator) both come in these columns from the
 * engine, so one reading of them serves both — the sheet is told what the circuit does at the moment a clock is at,
 * never at the moment some frame happened to end.
 */
export interface CircuitSeries {
  axisValues: ArrayLike<number>;
  columns: readonly string[];
  values: readonly ArrayLike<number>[];
  /** Each column's unit, in the order of `columns`. */
  units?: readonly string[];
}

/** A column's unit by its name. */
export function unitsOf(series: CircuitSeries): Record<string, string> {
  return Object.fromEntries(series.columns.map((column, index) => [column, series.units?.[index] ?? ""]));
}

/**
 * What the sheet's current lights need at one moment: the current into every terminal now (how bright each wire is and
 * which way it runs), the charge that has passed into every terminal by then in sheet units (where each light stands),
 * and the `reference` — the current a wire is fully bright at, and at which its light runs its full pace: the RMS of the
 * circuit's busiest terminal in the present state, never a start-up surge or a spike. The currents and charges are in
 * `PartLoad`'s shape, so Kirchhoff's sums over wires (`wireCurrents`) read them alike.
 */
export interface FlowMoment {
  currents: Record<string, PartLoad>;
  charges: Record<string, PartLoad>;
  reference: number;
  /**
   * How strongly every terminal carries current, its RMS signed as its mean flows — what a wire is lit by. A live run
   * that traces one sample in several averages a fast alternation away from `currents`, never from this; absent where
   * every moment stands for its own instant, and `currents` is it.
   */
  strengths?: Record<string, PartLoad>;
}

/** A source of flow moments: the listener hears one every screen frame while the clock moves, and one when it is set. */
export type FlowFeed = (listener: (moment: FlowMoment) => void) => () => void;

/**
 * The traced moments of the last stretch of wall time before the clock — every part's terminal currents at each —, and
 * how long that stretch is in circuit seconds and in wall seconds: what tells a current that reverses faster than a
 * light can show from one that flows.
 */
export interface RecentFlow {
  moments: Record<string, PartLoad>[];
  /** Each moment's strengths, as {@link FlowMoment.strengths}; absent where the moments are instants. */
  strengths?: Record<string, PartLoad>[];
  circuitSeconds: number;
  wallSeconds: number;
  /** Circuit seconds per wall second it plays at. */
  speed: number;
}

/** Reads the recent flow: `wallSeconds` of wall time before the clock, or null before anything was traced. */
export type RecentFlowFeed = (wallSeconds: number) => RecentFlow | null;

/** Every column at a time, read between the two samples around it; null for a series with no samples. */
export function readingsAt(series: CircuitSeries, time: number): Record<string, number> | null {
  const times = series.axisValues;
  if (times.length === 0) {
    return null;
  }
  const index = sampleBefore(times, time);
  const next = Math.min(index + 1, times.length - 1);
  const share = times[next] > times[index] ? Math.max(0, Math.min(1, (time - times[index]) / (times[next] - times[index]))) : 0;
  const readings: Record<string, number> = {};
  series.columns.forEach((column, position) => {
    const samples = series.values[position];
    if (samples) {
      readings[column] = samples[index] + (samples[next] - samples[index]) * share;
    }
  });
  return readings;
}

/** The last sample at or before a time (the first, before the series begins): a binary search, read every frame. */
function sampleBefore(times: ArrayLike<number>, time: number): number {
  let low = 0;
  let high = times.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (times[middle] <= time) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

/** Every node's voltage — the columns in volts; ground is zero. */
export function levelsOf(readings: Record<string, number>, units: Record<string, string>): Record<string, number> {
  const levels: Record<string, number> = { [GROUND]: 0 };
  for (const [column, value] of Object.entries(readings)) {
    if (units[column] === "V") {
      levels[column] = value;
    }
  }
  return levels;
}

/**
 * Every part's terminal currents at the moment, in the shape the sheet reads them: a column in amperes named `R1` is the
 * current into a two-terminal part's "+" (out of its "−"), `U1.pin` into a model's pin. Given the elements, a part's
 * power at the moment too: a two-terminal part's current times the voltage across it, a model's sum over its pins of the
 * current into a pin times that pin's voltage. The currents are the engine's; only those products are taken here.
 */
export function loadsOf(readings: Record<string, number>, units: Record<string, string>,
  elements: readonly CircuitElement[] = []): Record<string, PartLoad> {
  const voltage = (node: string | null) => (node === null || node === GROUND || units[node] !== "V" ? 0 : readings[node] ?? 0);
  const loads: Record<string, PartLoad> = {};
  for (const [column, current] of Object.entries(readings)) {
    if (units[column] !== "A" || !Number.isFinite(current)) {
      continue;
    }
    const dot = column.indexOf(".");
    const part = dot < 0 ? column : column.slice(0, dot);
    const pin = dot < 0 ? null : column.slice(dot + 1);
    const load = loads[part] ?? (loads[part] = { power: null, terminals: {}, temperature: null });
    if (pin) {
      load.terminals[pin] = current;
      continue;
    }
    load.terminals["+"] = current;
    load.terminals["−"] = -current;
    const element = elements.find((candidate) => candidate.id === part);
    if (element) {
      load.power = current * (voltage(element.positive) - voltage(element.negative));
    }
  }
  for (const element of elements) {
    const load = loads[element.id];
    if (!load || !element.pins || load.power !== null) {
      continue;
    }
    load.power = Object.entries(load.terminals).reduce((power, [pin, current]) => power + current * voltage(element.pins?.[pin] ?? null), 0);
  }
  return loads;
}

/**
 * The series' reference current: the largest RMS of any terminal over the whole run, each sample weighted by the time
 * it stands for. An RMS, not a peak — a capacitor's surge at power-up or a diode's narrow pulses are many times the
 * current that flows for most of the run, and a peak as the reference left every steady wire dim and its light crawling.
 */
function referenceCurrent(series: CircuitSeries): number {
  const times = series.axisValues;
  const span = times.length > 1 ? times[times.length - 1] - times[0] : 0;
  let reference = 0;
  series.columns.forEach((_, position) => {
    const samples = series.values[position];
    if (series.units?.[position] !== "A" || !samples || !(span > 0)) {
      return;
    }
    let squares = 0;
    for (let index = 1; index < samples.length; index++) {
      const step = times[index] - times[index - 1];
      if (Number.isFinite(samples[index]) && Number.isFinite(samples[index - 1])) {
        squares += 0.5 * (samples[index] * samples[index] + samples[index - 1] * samples[index - 1]) * step;
      }
    }
    reference = Math.max(reference, Math.sqrt(squares / span));
  });
  return reference;
}

/**
 * A computed transient's flow, whole: the charge that has passed into every terminal since it began — the running
 * integral of each column in amperes, trapezoid by trapezoid — scaled so the busiest terminal's light travels `travel`
 * sheet units over the run. Read at the clock with {@link SeriesFlow.momentAt}.
 */
export class SeriesFlow {
  private readonly charges: CircuitSeries;
  private readonly reference: number;
  private readonly units: Record<string, string>;
  private readonly series: CircuitSeries;

  constructor(series: CircuitSeries, travel: number) {
    this.series = series;
    const times = series.axisValues;
    const columns: string[] = [];
    const values: number[][] = [];
    let busiest = 0;
    series.columns.forEach((column, position) => {
      const currents = series.values[position];
      if (series.units?.[position] !== "A" || !currents) {
        return;
      }
      const charge = [0];
      let travelled = 0;
      for (let index = 1; index < times.length; index++) {
        const step = times[index] - times[index - 1];
        charge.push(charge[index - 1] + 0.5 * (currents[index] + currents[index - 1]) * step);
        travelled += 0.5 * Math.abs(currents[index] + currents[index - 1]) * step;
      }
      busiest = Math.max(busiest, travelled);
      columns.push(column);
      values.push(charge);
    });
    const scale = busiest > 0 ? travel / busiest : 0;
    this.charges = { axisValues: times, columns, values: values.map((charge) => charge.map((value) => value * scale)) };
    this.reference = referenceCurrent(series);
    this.units = unitsOf(series);
  }

  momentAt(time: number): FlowMoment | null {
    const currents = readingsAt(this.series, time);
    const charges = readingsAt(this.charges, time);
    return currents && charges
      ? { currents: loadsOf(currents, this.units), charges: loadsOf(charges, this.units), reference: this.reference } : null;
  }
}

/** How fast the light of the reference current runs on a live sheet, in sheet units per second of wall time. */
const LIVE_LIGHT_SPEED = 72;
/** How many moments a live run keeps: a few seconds of play however slow or fast it goes. */
const LIVE_MOMENTS = 4096;
/** Over how much wall time a terminal's RMS is taken: long enough to smooth a 50 Hz pulse train, short enough to follow a switch. */
const RMS_SECONDS = 0.5;
/** How slowly the reference falls when the circuit quietens — a surge forgotten within seconds, a level never flickering. */
const REFERENCE_RELEASE_SECONDS = 2;

/**
 * A live run's flow, as its frames bring it: the moments the server traced, kept in a window, and the charge that has
 * passed into every terminal summed as they arrive. The charge is kept in sheet units, scaled so the reference current
 * runs `LIVE_LIGHT_SPEED` a second of wall time at the speed it plays — so at a hundredth of real time a 50 Hz bridge
 * shows each half-wave's path lighting in turn, one every second.
 *
 * <p>The reference is the RMS of the busiest terminal over the last `RMS_SECONDS` of wall time: it rises at once and
 * falls with `REFERENCE_RELEASE_SECONDS`. It was the largest current ever seen, and a capacitor's surge at power-up —
 * ten times the steady current in an RC filter, 1.3 A against 95 mA on a bridge supply — left every wire of the
 * running circuit dim and its light crawling for the rest of the run. A changed reference rescales only the charge that
 * comes after, so no light ever jumps; each moment keeps the reference it was traced under.
 */
export class LiveFlow {
  private columns: string[] = [];
  private units: Record<string, string> = {};
  private times: number[] = [];
  private readings: number[][] = [];
  /** Each column's RMS over the stretch each moment stands for, signed as the moment's mean. */
  private strengths: number[][] = [];
  private charges: number[][] = [];
  private references: number[] = [];
  private meanSquares: number[] = [];
  private reference = 0;
  private speed = 1;

  /** The speed it plays at, circuit seconds per wall second: the light keeps its pace on the screen whatever it is. */
  pace(speed: number) {
    this.speed = speed > 0 ? speed : 1;
  }

  clear() {
    this.columns = [];
    this.units = {};
    this.times = [];
    this.readings = [];
    this.strengths = [];
    this.charges = [];
    this.references = [];
    this.meanSquares = [];
    this.reference = 0;
  }

  get newest(): number {
    return this.times.length ? this.times[this.times.length - 1] : Number.NaN;
  }

  /** Each traced column's unit by its name. */
  get columnUnits(): Record<string, string> {
    return this.units;
  }

  /**
   * The moments of a frame. `rms`, when the server sent it, is each column's RMS over the stretch each moment stands
   * for: the moment's reading is then that stretch's mean.
   */
  append(time: ArrayLike<number>, columns: Record<string, ArrayLike<number>>, units: Record<string, string>,
    rms: Record<string, ArrayLike<number>> = {}) {
    const names = Object.keys(columns);
    if (names.join("\n") !== this.columns.join("\n")) {
      // The circuit changed under the run — a part failed, a switch closed —: the moments start again, the reference
      // does not, so a branch that died goes dark against what the others still carry.
      const reference = this.reference;
      this.clear();
      this.reference = reference;
      this.columns = names;
      this.units = units;
      this.readings = names.map(() => []);
      this.strengths = names.map(() => []);
      this.charges = names.map(() => []);
      this.meanSquares = names.map(() => Number.NaN);
    }
    for (let index = 0; index < time.length; index++) {
      const at = time[index];
      const previous = this.times.length - 1;
      if (previous >= 0 && at <= this.times[previous]) {
        continue;
      }
      const strengths = names.map((name) => {
        const reading = columns[name][index];
        const strength = rms[name]?.[index];
        return strength !== undefined && Number.isFinite(strength) ? (reading < 0 ? -strength : strength) : reading;
      });
      this.follow(strengths, previous >= 0 ? (at - this.times[previous]) / this.speed : 0);
      const scale = this.reference > 0 ? LIVE_LIGHT_SPEED / (this.reference * this.speed) : 0;
      for (let column = 0; column < names.length; column++) {
        const reading = columns[names[column]][index];
        const readings = this.readings[column];
        const charges = this.charges[column];
        readings.push(reading);
        this.strengths[column].push(strengths[column]);
        const before = previous >= 0 ? charges[previous] : 0;
        const passed = previous >= 0 && Number.isFinite(reading) && Number.isFinite(readings[previous])
          ? 0.5 * (reading + readings[previous]) * (at - this.times[previous]) * scale : 0;
        charges.push(before + passed);
      }
      this.references.push(this.reference);
      this.times.push(at);
    }
    const surplus = this.times.length - LIVE_MOMENTS;
    if (surplus > LIVE_MOMENTS / 4) {
      this.times.splice(0, surplus);
      this.references.splice(0, surplus);
      this.readings.forEach((readings) => readings.splice(0, surplus));
      this.strengths.forEach((strengths) => strengths.splice(0, surplus));
      this.charges.forEach((charges) => charges.splice(0, surplus));
    }
  }

  /**
   * Takes one moment's strengths into each current column's running mean square, `wallStep` seconds of wall time after
   * the last, and moves the reference: up to the busiest RMS at once, down towards it slowly.
   */
  private follow(strengths: readonly number[], wallStep: number) {
    const taken = 1 - Math.exp(-wallStep / RMS_SECONDS);
    let busiest = 0;
    strengths.forEach((strength, column) => {
      if (this.units[this.columns[column]] !== "A" || !Number.isFinite(strength)) {
        return;
      }
      const square = strength * strength;
      const mean = this.meanSquares[column];
      this.meanSquares[column] = Number.isFinite(mean) ? mean + (square - mean) * taken : square;
      busiest = Math.max(busiest, this.meanSquares[column]);
    });
    const level = Math.sqrt(busiest);
    this.reference = level >= this.reference
      ? level
      : this.reference + (level - this.reference) * (1 - Math.exp(-wallStep / REFERENCE_RELEASE_SECONDS));
  }

  /** The circuit's voltages and currents at a time, as the engine traced them; null before anything arrived. */
  readingsAt(time: number): Record<string, number> | null {
    return readingsAt({ axisValues: this.times, columns: this.columns, values: this.readings }, time);
  }

  /**
   * The circuit over the `wallSeconds` before `time`, as a reading shown that often should say it: each column's mean
   * over the stretch, every moment weighted by the time it stands for. A reading taken at one instant of a signal faster
   * than it is shown lands on a different phase each time and flickers; the mean holds still, and one slow enough to
   * follow is barely moved by it. The moment at `time` when the stretch holds fewer than two.
   */
  windowAt(time: number, wallSeconds: number): Record<string, number> | null {
    if (!Number.isFinite(time)) {
      return null;
    }
    const from = time - wallSeconds * this.speed;
    const sums = new Array<number>(this.columns.length).fill(0);
    let span = 0;
    for (let index = this.times.length - 1; index > 0 && this.times[index] > from; index--) {
      if (this.times[index] > time) {
        continue;
      }
      const weight = this.times[index] - Math.max(from, this.times[index - 1]);
      span += weight;
      this.readings.forEach((readings, column) => {
        sums[column] += Number.isFinite(readings[index]) ? readings[index] * weight : 0;
      });
    }
    if (!(span > 0)) {
      return this.readingsAt(time);
    }
    return Object.fromEntries(this.columns.map((column, position) => [column, sums[position] / span]));
  }

  /** The traced moments of the `wallSeconds` before `time`, at the speed it plays. */
  recent(time: number, wallSeconds: number): RecentFlow | null {
    if (!this.times.length || !Number.isFinite(time)) {
      return null;
    }
    const circuitSeconds = wallSeconds * this.speed;
    const moments: Record<string, PartLoad>[] = [];
    const strengths: Record<string, PartLoad>[] = [];
    for (let index = this.times.length - 1; index >= 0 && this.times[index] > time - circuitSeconds; index--) {
      if (this.times[index] > time) {
        continue;
      }
      moments.push(loadsOf(this.columnsAt(this.readings, index), this.units));
      strengths.push(loadsOf(this.columnsAt(this.strengths, index), this.units));
    }
    return { moments: moments.reverse(), strengths: strengths.reverse(), circuitSeconds, wallSeconds, speed: this.speed };
  }

  private columnsAt(values: number[][], index: number): Record<string, number> {
    const readings: Record<string, number> = {};
    this.columns.forEach((column, position) => {
      readings[column] = values[position][index];
    });
    return readings;
  }

  momentAt(time: number): FlowMoment | null {
    const currents = this.readingsAt(time);
    const charges = readingsAt({ axisValues: this.times, columns: this.columns, values: this.charges }, time);
    const strengths = readingsAt({ axisValues: this.times, columns: this.columns, values: this.strengths }, time);
    const reference = readingsAt({ axisValues: this.times, columns: ["reference"], values: [this.references] }, time)?.reference;
    return currents && charges
      ? { currents: loadsOf(currents, this.units), charges: loadsOf(charges, this.units), reference: reference ?? this.reference,
        strengths: strengths ? loadsOf(strengths, this.units) : undefined } : null;
  }
}

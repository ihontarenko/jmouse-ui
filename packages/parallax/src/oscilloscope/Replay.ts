import { phaseOf, shareAt, timeCurve, type ReplayOrder, type TimeCurve } from "./timeCourse";

/**
 * A stretch of what the memory holds, played again: from `from` to `to` in circuit time, at a pace measured against the
 * speed it was recorded at, along a course — the order of its passes and the curve laid over each (`timeCourse.ts`).
 * It is a position on a tape, not a copy of it — the samples stay in the memory, and the screen, the sheet and the
 * meters read them at {@link timeAt} as they read the live stream at the playback clock's time.
 *
 * The position is a phase: passes counted from 0, the fraction of the current one after the point. Wall time moves the
 * phase evenly; the course turns it into circuit time.
 */
export class Replay {
  readonly from: number;
  readonly to: number;
  /** The speed the run played at when it was recorded: what «1×» means for this stretch. */
  readonly recorded: number;
  private rate: number;
  private passOrder: ReplayOrder;
  private passCurve: TimeCurve;
  private running = true;
  private phase = 0;
  private phaseAt = Number.NaN;
  private readonly timeListeners = new Set<(time: number) => void>();
  private readonly stateListeners = new Set<() => void>();
  private version = 0;

  constructor(from: number, to: number, recorded: number, order: ReplayOrder = "loop", curve = "linear", multiple = 1) {
    this.from = from;
    this.to = Math.max(from, to);
    this.recorded = recorded > 0 ? recorded : 1;
    this.rate = this.recorded * multiple;
    this.passOrder = order;
    this.passCurve = timeCurve(curve);
  }

  /** The circuit time to show at wall time `now` (milliseconds), moved on by the wall time since it was last asked. */
  timeAt(now: number): number {
    if (this.running && Number.isFinite(this.phaseAt) && now > this.phaseAt) {
      const span = this.to - this.from;
      this.phase += span > 0 ? ((now - this.phaseAt) / 1000) * this.rate / span : 1;
      if (this.passOrder === "once" && this.phase >= 1) {
        this.phase = 1;
        this.running = false;
        this.changed();
      }
    }
    this.phaseAt = now;
    const time = this.time;
    this.timeListeners.forEach((listener) => listener(time));
    return time;
  }

  get time(): number {
    return this.from + shareAt(this.phase, this.passOrder, this.passCurve) * (this.to - this.from);
  }

  get playing(): boolean {
    return this.running;
  }

  get order(): ReplayOrder {
    return this.passOrder;
  }

  get curve(): TimeCurve {
    return this.passCurve;
  }

  /** How many times the recorded speed it plays at, on average over a pass. */
  get multiple(): number {
    return this.rate / this.recorded;
  }

  /** A change of state — playing, order, curve, pace — for whoever renders the controls; the moving time is {@link subscribeTime}. */
  get state(): number {
    return this.version;
  }

  play(playing: boolean) {
    if (playing && this.passOrder === "once" && this.phase >= 1) {
      this.phase = 0;
    }
    this.running = playing;
    this.phaseAt = Number.NaN;
    this.changed();
  }

  /** Shows the moment `time`, in the pass it is in and the direction that pass goes. */
  seek(time: number) {
    const span = this.to - this.from;
    const share = span > 0 ? Math.min(1, Math.max(0, (time - this.from) / span)) : 0;
    const pass = this.passOrder === "once" ? 0 : Math.floor(this.phase);
    this.phase = Math.min(this.passOrder === "once" ? 1 : Number.POSITIVE_INFINITY, phaseOf(share, pass, this.passOrder, this.passCurve));
    this.phaseAt = Number.NaN;
    this.timeListeners.forEach((listener) => listener(this.time));
  }

  pace(multiple: number) {
    this.rate = this.recorded * multiple;
    this.changed();
  }

  /** Another order of passes, from the moment shown now. */
  reorder(order: ReplayOrder) {
    const time = this.time;
    this.passOrder = order;
    this.phase = order === "once" ? Math.min(this.phase, 0.999999) : this.phase;
    this.seek(time);
    this.changed();
  }

  /** Another curve over each pass, from the moment shown now. */
  reshape(curve: string) {
    const time = this.time;
    this.passCurve = timeCurve(curve);
    this.seek(time);
    this.changed();
  }

  /** The time as it moves, every screen frame — what a timeline follows without re-rendering the page around it. */
  readonly subscribeTime = (listener: (time: number) => void): (() => void) => {
    this.timeListeners.add(listener);
    return () => this.timeListeners.delete(listener);
  };

  readonly subscribeState = (listener: () => void): (() => void) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };

  private changed() {
    this.version++;
    this.stateListeners.forEach((listener) => listener());
  }
}

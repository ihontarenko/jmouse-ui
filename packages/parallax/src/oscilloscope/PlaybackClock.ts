import type { Replay } from "./Replay";

/** How far behind the newest sample the screen plays, in wall time: three server frames, enough to hide their rhythm. */
const LEAD_MILLISECONDS = 120;
/** How much of the gap to where it should be the clock closes per animation frame, so it never jumps. */
const STEERING = 0.08;

/**
 * The circuit time a live screen shows, as a video player shows a stream: a little behind the newest sample, advancing
 * on every animation frame at the rate the samples arrive. Samples come from the server in frames, forty milliseconds
 * apart and never quite evenly; drawn as they come, the trace moves in jerks. Played from this clock, it moves at
 * sixty frames a second whatever the network does — at the price of the lead, which is also how late a moved knob
 * shows on the screen, and is kept short for that reason.
 */
export class PlaybackClock {
  /**
   * The other source of the shown time: a stretch of the memory played again. While it is set, everything that plays
   * from this clock — the screen, the sheet, the meters — plays the replay instead of the stream.
   */
  private replaying: Replay | null = null;
  private readonly replayListeners = new Set<() => void>();
  private shown = Number.NaN;
  private shownAt = 0;
  /** Circuit seconds per wall millisecond, as the samples arrive. */
  private rate = 0;
  private newest = Number.NaN;
  private newestAt = 0;

  /** The time to show at wall time {@code now} (milliseconds), given the newest sample's time. */
  timeAt(newest: number, now: number): number {
    if (this.replaying) {
      this.shown = this.replaying.timeAt(now);
      this.shownAt = now;
      return this.shown;
    }
    if (newest !== this.newest) {
      if (Number.isFinite(this.newest) && newest > this.newest && now > this.newestAt) {
        const measured = (newest - this.newest) / (now - this.newestAt);
        this.rate = this.rate > 0 ? this.rate * 0.85 + measured * 0.15 : measured;
      }
      this.newest = newest;
      this.newestAt = now;
    }
    const target = newest - this.rate * LEAD_MILLISECONDS;
    // A fresh run, a cleared memory or a clock left far behind starts where it should be.
    if (!Number.isFinite(this.shown) || this.shown > newest || this.shown < target - 4 * this.rate * LEAD_MILLISECONDS) {
      this.shown = target;
    } else {
      this.shown += (now - this.shownAt) * this.rate;
      this.shown += (target - this.shown) * STEERING;
    }
    this.shown = Math.min(this.shown, newest);
    this.shownAt = now;
    return this.shown;
  }

  /**
   * The time the screen showed last, for whatever else plays the same moment — the sheet's currents —; NaN when the
   * screen has not drawn for longer than `stale` wall milliseconds, so a hidden screen leaves nothing stopped on it.
   */
  shownTime(now: number, stale = 250): number {
    return Number.isFinite(this.shown) && now - this.shownAt <= stale ? this.shown : Number.NaN;
  }

  /** The buffer: how much the server has computed that the screen has not shown yet, in wall milliseconds of play. */
  bufferedMilliseconds(): number {
    if (!(this.rate > 0) || !Number.isFinite(this.shown)) {
      return 0;
    }
    return Math.max(0, (this.newest - this.shown) / this.rate);
  }

  get replay(): Replay | null {
    return this.replaying;
  }

  /** Plays a stretch of the memory instead of the stream, or — given null — goes back to following the stream. */
  play(replay: Replay | null) {
    this.replaying = replay;
    // Back to the stream starts where the stream is, not where the replay stopped.
    this.shown = Number.NaN;
    this.replayListeners.forEach((listener) => listener());
  }

  readonly subscribeReplay = (listener: () => void): (() => void) => {
    this.replayListeners.add(listener);
    return () => this.replayListeners.delete(listener);
  };

  /** The lead the clock keeps when the samples come in steadily. */
  static readonly LEAD_MILLISECONDS = LEAD_MILLISECONDS;
}

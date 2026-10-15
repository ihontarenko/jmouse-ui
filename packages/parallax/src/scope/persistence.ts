import type { SegmentBatch } from "../visual";

/** How long a trace stays on a phosphor screen after it was drawn, in wall milliseconds. */
const PERSISTENCE_MILLISECONDS = 450;
/** How bright the youngest of the past traces is, as a share of the live one. */
const AFTERGLOW = 0.55;
/** How many past traces are kept at most: at sixty a second, about the persistence. */
const KEPT = 28;

/**
 * A phosphor screen's afterglow: every trace the screen drew stays a moment, fading, under the live one — as an
 * analogue screen's phosphor does and a digital one's persistence imitates. A signal that moves a little from sweep
 * to sweep reads as a soft band instead of a line that jumps; one that holds still is one bright line.
 *
 * <p>It keeps the traces as they were drawn and fades their colours; the screen draws {@link #layer} under the live
 * trace and goes on redrawing while {@link #glowing}, so a stopped screen dims to its last trace.</p>
 */
/** How often a held screen keeps a trace, in wall milliseconds, and how many it keeps: a knob stepped once a second
 * leaves every step, and a screen held for minutes stays light. */
const HELD_EVERY_MILLISECONDS = 400;
const HELD_MOST = 80;
/** How bright a held trace is, as a share of the live one. */
const HELD_BRIGHTNESS = 0.7;

export class Persistence {
  private traces: { batch: SegmentBatch; at: number }[] = [];
  /** The last sweeps, for the trails; the newest is the live trace. */
  private trailing: SegmentBatch[] = [];
  /** Traces kept for good while the screen holds — infinite persistence —, until {@link #forget}. */
  private held: SegmentBatch[] = [];
  private heldAt = Number.NEGATIVE_INFINITY;

  /** A trace kept for good: one every so often, so a still signal is not stacked a thousand times over itself. */
  hold(batch: SegmentBatch, now: number) {
    if (now - this.heldAt < HELD_EVERY_MILLISECONDS) {
      return;
    }
    this.heldAt = now;
    this.held.push(faded(batch, HELD_BRIGHTNESS));
    if (this.held.length > HELD_MOST) {
      this.held.shift();
    }
  }

  /** Every trace held, as it was drawn. */
  heldLayer(): SegmentBatch[] {
    return this.held;
  }

  /** A trace the screen has just drawn, at wall time {@code now} (milliseconds). */
  remember(batch: SegmentBatch, now: number) {
    this.traces.push({ batch, at: now });
    if (this.traces.length > KEPT) {
      this.traces.shift();
    }
  }

  /** Whether a past trace is still fading: the screen has to redraw for it. */
  glowing(now: number): boolean {
    return this.traces.some((trace) => now - trace.at < PERSISTENCE_MILLISECONDS);
  }

  /** The past traces, oldest first, each as faint as its age makes it; the newest — the live trace — left out. */
  layer(now: number): SegmentBatch[] {
    this.traces = this.traces.filter((trace) => now - trace.at < PERSISTENCE_MILLISECONDS);
    return this.traces.slice(0, -1).map((trace) => faded(trace.batch, AFTERGLOW * (1 - (now - trace.at) / PERSISTENCE_MILLISECONDS) ** 2));
  }

  /**
   * Trails, as an electron-beam screen leaves them: the last {@code count} sweeps stay under the live one, each older one
   * fainter and thinner, so a trace that shakes from sweep to sweep reads as a soft band showing where it lives instead
   * of a line that flickers. Kept by sweep, not by time: a slowed run keeps its trails as long as a fast one.
   */
  trail(batch: SegmentBatch, count: number) {
    this.trailing.push(batch);
    while (this.trailing.length > Math.max(1, count) + 1) {
      this.trailing.shift();
    }
  }

  /**
   * The trails, oldest first and the live sweep left out: the n-th youngest at {@code intensity} × (1 − n / (count + 1))²
   * of the live trace's brightness, and narrowing to 40 % of its width.
   */
  trailLayer(count: number, intensity: number): SegmentBatch[] {
    const past = this.trailing.slice(0, -1).slice(-Math.max(1, count));
    return past.map((batch, index) => {
      const age = past.length - index;
      const share = 1 - age / (count + 1);
      return { ...faded(batch, intensity * share * share), width: (batch.width ?? 1.5) * (0.4 + 0.6 * share) };
    });
  }

  forget() {
    this.trailing = [];
    this.traces = [];
    this.held = [];
    this.heldAt = Number.NEGATIVE_INFINITY;
  }
}

/** The same segments with every colour's alpha scaled. */
function faded(batch: SegmentBatch, share: number): SegmentBatch {
  const colors = Float32Array.from(batch.colors);
  for (let index = 3; index < colors.length; index += 4) {
    colors[index] *= share;
  }
  return { ...batch, colors };
}

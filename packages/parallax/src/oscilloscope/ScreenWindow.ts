import { HORIZONTAL_DIVISIONS, holdsWholeRecord, windowOf, type ScopeSettings, type Window } from "./instrument";
import { SampleMemory } from "./SampleMemory";
import type { PlaybackClock } from "./PlaybackClock";

/** How far either side of a crossing its copy reaches, in screens: room to zoom out of a caught edge. */
const SNAPSHOT_SCREENS = 5;

/** The held picture under the time base and trigger position set now, around the crossing it was caught at. */
function heldAround(crossing: number, settings: ScopeSettings): Window {
  const span = settings.secondsPerDivision * HORIZONTAL_DIVISIONS;
  const position = Math.min(0.9, Math.max(0.1, settings.trigger.position));
  return { start: crossing - span * position, span, triggered: crossing };
}

/** The samples within `reach` of a crossing, copied into a memory of their own, as read — a channel's expression applied. */
function copyAround(memory: SampleMemory, crossing: number, reach: number): SampleMemory | null {
  const copied = memory.slice(crossing - reach, crossing + reach);
  if (copied.time.length < 2) {
    return null;
  }
  const snapshot = new SampleMemory(copied.time.length);
  snapshot.append(copied.time, copied.channels);
  return snapshot;
}

/**
 * How long auto keeps its last triggered picture when no crossing is found, before it free-runs: long enough for a run
 * slowed to read every sample to bring its next edge — at 1/1000 a 1 kHz edge comes once a second.
 */
const AUTO_HOLD_MILLISECONDS = 1500;

/** What a screen draws at one animation frame: the stretch of time, and where "now" is in it. */
export interface ScreenFrame {
  view: Window;
  /** The circuit time the screen plays at — the newest sample, or the playback clock behind it. */
  shownTime: number;
  /** The trigger fired at a crossing not reported before: single shot stops on it. */
  newlyTriggered: boolean;
  /**
   * What the frame is drawn from: the memory, or — a held picture whose samples the memory no longer keeps — the copy
   * taken when its trigger fired.
   */
  source: SampleMemory;
}

/** Everything a frame is decided from besides the memory and the panel. */
export interface ScreenMoment {
  /** Seconds the view is shifted into the past; 0 follows the stream. */
  back: number;
  /** The live screen's playback clock; absent for a memory that is not streaming. */
  clock?: PlaybackClock;
  /** Wall time, milliseconds. */
  now: number;
}

/**
 * Which stretch of the memory an oscilloscope's screen shows, frame after frame — the whole decision in one place, apart
 * from React and from drawing, so that it can be reasoned about and driven by a simulated stream.
 *
 * <ol>
 *   <li><strong>Where "now" is.</strong> A streaming screen plays a little behind the newest sample, from the playback
 *   clock. The clock's lead is wall time and the memory is samples, so at fine sampling the lead can be more circuit
 *   than the memory holds; while it is, the screen shows the newest samples instead, and returns to the clock only
 *   once it is well inside the memory again — never flipping between the two frame by frame.</li>
 *   <li><strong>Which window.</strong> {@link windowOf}: a triggered window whole inside one acquisition, an untriggered
 *   one never over a gap, a sweep from the record's start while the record is shorter than the screen.</li>
 *   <li><strong>What is held.</strong> Normal and single keep their last triggered picture until the next trigger, as
 *   a bench oscilloscope's screen does — even once the memory has rolled past it: at a fine time base the memory holds
 *   microseconds, and a picture that lasted only while its samples were kept vanished in a tenth of a second. So when
 *   the trigger fires, the stretch around it is copied, five screens either side; the held picture is drawn from the
 *   memory while it still has it, then from the copy. A changed time base re-frames the held picture around the same
 *   crossing — zooming into a caught edge is what one catches it for. Auto keeps it for a moment before it free-runs.</li>
 * </ol>
 */
export class ScreenWindow {
  private lastTriggered: Window | null = null;
  /** The stretch around the held crossing, copied when the trigger fired. */
  private snapshot: SampleMemory | null = null;
  /** What the held picture was taken under: another span or another trigger makes it a picture of something else. */
  private heldUnder = "";
  private triggeredAt = Number.NEGATIVE_INFINITY;
  private reportedCrossing: number | null = null;
  private followsNewest = false;
  private memory: SampleMemory | null = null;
  private generation = -1;

  /** The frame to draw now. */
  frame(memory: SampleMemory, settings: ScopeSettings, moment: ScreenMoment): ScreenFrame {
    this.forgetAcross(memory);
    this.forgetOutdated(settings);
    const shownTime = this.shownTime(memory, settings, moment);
    let view = windowOf(memory, settings, moment.back, shownTime);
    let source: SampleMemory = memory;
    let newlyTriggered = false;
    if (view.triggered !== null) {
      this.lastTriggered = view;
      this.triggeredAt = moment.now;
      if (this.reportedCrossing !== view.triggered) {
        this.reportedCrossing = view.triggered;
        this.snapshot = copyAround(memory, view.triggered, view.span * SNAPSHOT_SCREENS);
        newlyTriggered = true;
      }
    } else if (moment.back === 0 && this.holds(settings, moment.now) && this.lastTriggered?.triggered != null) {
      view = heldAround(this.lastTriggered.triggered, settings);
      source = view.start >= memory.firstTime() || !this.snapshot ? memory : this.snapshot;
    }
    return { view, shownTime, newlyTriggered, source };
  }

  /** A new memory, or the same one cleared for a new run: nothing held over from the old one is valid. */
  private forgetAcross(memory: SampleMemory) {
    if (memory === this.memory && memory.generation === this.generation) {
      return;
    }
    this.memory = memory;
    this.generation = memory.generation;
    this.lastTriggered = null;
    this.snapshot = null;
    this.triggeredAt = Number.NEGATIVE_INFINITY;
    this.reportedCrossing = null;
    this.followsNewest = false;
  }

  /**
   * A held picture is valid only under the trigger that caught it: another source, edge or level catches something
   * else. The time base and the trigger's position only re-frame it around the same crossing (`heldAround`).
   */
  private forgetOutdated(settings: ScopeSettings) {
    const { source, edge, level } = settings.trigger;
    const under = [settings.horizontal ?? "divisions", source, edge, level].join("|");
    if (under !== this.heldUnder) {
      this.heldUnder = under;
      this.lastTriggered = null;
      this.snapshot = null;
      this.triggeredAt = Number.NEGATIVE_INFINITY;
    }
  }

  private holds(settings: ScopeSettings, now: number): boolean {
    const mode = settings.trigger.mode;
    return mode === "normal" || mode === "single" || (mode === "auto" && now - this.triggeredAt < AUTO_HOLD_MILLISECONDS);
  }

  private shownTime(memory: SampleMemory, settings: ScopeSettings, moment: ScreenMoment): number {
    if (memory.length < 2) {
      return memory.lastTime();
    }
    const clock = moment.clock;
    const played = clock && moment.back === 0 ? clock.timeAt(memory.lastTime(), moment.now) : memory.lastTime();
    const replaying = Boolean(clock?.replay);
    if (holdsWholeRecord(settings) || replaying || moment.back > 0) {
      this.followsNewest = false;
      return Math.min(memory.lastTime(), played);
    }
    const span = settings.secondsPerDivision * HORIZONTAL_DIVISIONS;
    const recorded = memory.lastTime() - memory.firstTime();
    // How much of the memory lies before the screen the clock would show: below none, the clock has fallen behind the
    // memory; back above half of it, the clock is safely inside again.
    const room = played - span - memory.firstTime();
    this.followsNewest = this.followsNewest ? room < recorded / 2 : room < 0 && recorded >= span;
    return Math.min(memory.lastTime(), this.followsNewest ? memory.lastTime() : played);
  }
}

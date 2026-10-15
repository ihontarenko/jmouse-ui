import { HORIZONTAL_DIVISIONS, holdsWholeRecord, windowOf, type ScopeSettings, type Window } from "./instrument";
import type { PlaybackClock } from "./PlaybackClock";
import type { SampleMemory } from "./SampleMemory";

/** How long auto keeps its last triggered picture when no crossing is found, before it free-runs. */
const AUTO_HOLD_MILLISECONDS = 400;

/** What a screen draws at one animation frame: the stretch of time, and where "now" is in it. */
export interface ScreenFrame {
  view: Window;
  /** The circuit time the screen plays at — the newest sample, or the playback clock behind it. */
  shownTime: number;
  /** The trigger fired at a crossing not reported before: single shot stops on it. */
  newlyTriggered: boolean;
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
 *   <li><strong>What is held.</strong> Normal and single keep their last triggered picture while its samples are kept;
 *   auto keeps it for a moment before it free-runs, so one frame without a crossing does not swap a steady triggered
 *   picture for a rolling one and back.</li>
 * </ol>
 */
export class ScreenWindow {
  private lastTriggered: Window | null = null;
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
    let newlyTriggered = false;
    if (view.triggered !== null) {
      this.lastTriggered = view;
      this.triggeredAt = moment.now;
      if (this.reportedCrossing !== view.triggered) {
        this.reportedCrossing = view.triggered;
        newlyTriggered = true;
      }
    } else if (moment.back === 0 && this.holds(settings, moment.now) && this.lastTriggered && this.lastTriggered.start >= memory.firstTime()) {
      view = this.lastTriggered;
    }
    return { view, shownTime, newlyTriggered };
  }

  /** A new memory, or the same one cleared for a new run: nothing held over from the old one is valid. */
  private forgetAcross(memory: SampleMemory) {
    if (memory === this.memory && memory.generation === this.generation) {
      return;
    }
    this.memory = memory;
    this.generation = memory.generation;
    this.lastTriggered = null;
    this.triggeredAt = Number.NEGATIVE_INFINITY;
    this.reportedCrossing = null;
    this.followsNewest = false;
  }

  /**
   * A held picture is valid only under what shaped it: the time base and the trigger. Kept across a change of either,
   * the screen went on showing the old picture — another width, its crossing nowhere near the trigger mark.
   */
  private forgetOutdated(settings: ScopeSettings) {
    const { source, edge, level, position } = settings.trigger;
    const under = [settings.secondsPerDivision, settings.horizontal ?? "divisions", source, edge, level, position].join("|");
    if (under !== this.heldUnder) {
      this.heldUnder = under;
      this.lastTriggered = null;
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

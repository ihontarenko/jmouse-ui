// The frame rate this machine manages, measured where frames are drawn. A dataset is drawn on demand, not in a
// loop, so the rate is what one frame's drawing time allows — 1000 / milliseconds per frame, at most 60 — smoothed
// so a single slow frame does not lock anything. It belongs to the machine, not to one viewport, so it is shared.

const DISPLAY_RATE = 60;
const SMOOTHING = 0.25;
/** Frames measured before the rate is trusted enough to lock a control. */
const FRAMES_BEFORE_JUDGING = 5;

let framesPerSecond: number | null = null;
let measuredFrames = 0;
const listeners = new Set<() => void>();

/** Called by a renderer after it draws a frame. */
export function reportFrame(milliseconds: number) {
  const instantaneous = Math.min(DISPLAY_RATE, 1000 / Math.max(milliseconds, 0.1));
  framesPerSecond = framesPerSecond === null ? instantaneous : framesPerSecond + (instantaneous - framesPerSecond) * SMOOTHING;
  measuredFrames++;
  listeners.forEach((listener) => listener());
}

/** Calls the listener whenever a frame is measured; returns the call that stops it. */
export function subscribeToFrameRate(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The rate measured so far, or null before enough frames were drawn to trust it. */
export function measuredFrameRate(): number | null {
  return measuredFrames >= FRAMES_BEFORE_JUDGING ? framesPerSecond : null;
}

export interface FrameRateGuard {
  /** The measured rate, or null before enough frames were drawn. */
  framesPerSecond: number | null;
  /** The administrator's minimum (`interface.minimum-frame-rate`); 0 when the guard is off. */
  minimum: number;
  /** The machine does not keep the minimum: what adds to the drawing may not be raised. */
  starved: boolean;
}


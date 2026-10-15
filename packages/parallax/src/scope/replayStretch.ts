import { HORIZONTAL_DIVISIONS, windowOf, type SampleMemory, type ScopeSettings } from "../oscilloscope";

/** What a replay plays: everything the memory holds, or the stretch between the time cursors A and B. */
export type ReplayStretchKind = "memory" | "cursors";

/** Whether the stretch between the cursors can be replayed: the time cursors are on. */
export function cursorsStretchAvailable(settings: ScopeSettings): boolean {
  return settings.cursors.enabled && settings.cursors.axis !== "volts";
}

/**
 * The circuit times a replay runs between — the moment the screen's right edge and the sheet show goes from `from` to
 * `to`. The memory's whole stretch starts a screenful after its first sample, so the screen is full from the first
 * frame; a memory shorter than a screen is played from its start. The cursors' stretch is where A and B stand on the
 * screen now — `shownTime` is the moment the screen shows. Null while the memory holds less than two samples.
 */
export function replayStretch(memory: SampleMemory, settings: ScopeSettings, kind: ReplayStretchKind, back: number,
  shownTime: number): { from: number; to: number } | null {
  if (memory.length < 2) {
    return null;
  }
  const first = memory.firstTime();
  const last = memory.lastTime();
  if (kind === "cursors" && cursorsStretchAvailable(settings)) {
    const view = windowOf(memory, settings, back, Number.isFinite(shownTime) ? shownTime : last);
    const from = view.start + Math.min(settings.cursors.first, settings.cursors.second) * view.span;
    const to = view.start + Math.max(settings.cursors.first, settings.cursors.second) * view.span;
    if (to > from) {
      return { from: Math.max(first, from), to: Math.min(last, to) };
    }
  }
  const screenful = settings.secondsPerDivision * HORIZONTAL_DIVISIONS;
  return { from: first + screenful < last ? first + screenful : first, to: last };
}

import { useEffect, useRef, useState } from "react";
import type { Job } from "@jmouse/parallax";

/** The engine's phase words, as a reader says what is happening. An unknown word is shown as it came, capitalised. */
const PHASES: Record<string, string> = {
  sampling: "Sampling the function",
  iterating: "Iterating the map",
  integrating: "Integrating the equations",
  triangulating: "Building the surface",
  tracing: "Tracing the curves",
  deciding: "Deciding every pixel",
  sweeping: "Sweeping the parameter",
  advecting: "Moving the particles",
  walking: "Walking the random paths",
  throwing: "Throwing samples",
  rewriting: "Rewriting the L-system",
  playing: "Running the program",
  drawing: "Drawing",
};

function phaseOf(job: Job): string {
  if (job.status === "QUEUED") {
    return "Waiting for a worker";
  }
  const word = (job.progressMessage ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!word) {
    return "Computing";
  }
  return PHASES[word] ?? word.charAt(0).toUpperCase() + word.slice(1);
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}

/**
 * The one way a screen says the server is computing for it: the phase in words, how far it is, how long it has taken
 * and about how long is left. It shows a queued job, or the frames of an animation arriving (`frames`) — while those
 * come, the animation's own controls are locked by the timeline. A computation answered inline has no job and no
 * frames: it gets a thin running line instead, never a word.
 */
export function ComputationProgress({ job, computing, frames }: { job: Job | null; computing: boolean; frames?: { loaded: number; total: number } | null }) {
  const filling = frames && frames.total > 0 && frames.loaded < frames.total ? frames : null;
  const key = job?.id ?? (filling ? "frames" : null);
  const started = useRef<{ id: string; at: number } | null>(null);
  const [now, setNow] = useState(() => performance.now());
  if (key && started.current?.id !== key) {
    started.current = { id: key, at: performance.now() };
  }
  useEffect(() => {
    if (!key) {
      return;
    }
    const timer = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(timer);
  }, [key]);

  if (!job && !filling) {
    return computing ? <div className="parallax-computation-running" role="status" aria-label="Computing" /> : null;
  }
  const queued = job?.status === "QUEUED";
  const fraction = Math.max(0, Math.min(1, job ? job.progress : filling!.loaded / filling!.total));
  const elapsed = started.current ? now - started.current.at : 0;
  const remaining = fraction > 0.05 && fraction < 1 ? (elapsed * (1 - fraction)) / fraction : null;
  return (
    <div data-parallax-part="computation-progress" className="parallax-computation-progress" role="status" aria-live="polite">
      <div className="parallax-computation-progress-head">
        <strong>{job ? phaseOf(job) : "Computing the frames"}</strong>
        <span className="parallax-technical parallax-steady parallax-width-7">{queued ? "queued" : job ? `${Math.round(fraction * 100)} %` : `${filling!.loaded} / ${filling!.total}`}</span>
      </div>
      <div className={queued ? "parallax-computation-meter parallax-indeterminate" : "parallax-computation-meter"}>
        <span style={{ width: `${fraction * 100}%` }} />
      </div>
      <div className="parallax-computation-progress-foot parallax-technical">
        {formatDuration(elapsed)}{remaining !== null ? ` · about ${formatDuration(remaining)} left` : ""}
        {filling ? " · plays when every frame is in" : ""}
      </div>
    </div>
  );
}

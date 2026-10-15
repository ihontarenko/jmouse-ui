import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ParallaxIcon } from "../icons/ParallaxIcon";

export const PLAYBACK_SPEEDS = [0.5, 1, 2] as const;

/**
 * The timeline every animation shares — a graph's clock and a circuit's replay alike: play, the parameter scrubbed
 * along its range with how much of it is already computed shaded in, its value, the pace —
 * and, while frames are on their way, how many have arrived.
 */
export function Timeline({ name, value: givenValue, live, minimum, maximum, step, playing, onPlaying, onValue, buffered, speed, onSpeed, speeds = PLAYBACK_SPEEDS,
  format = formatValue, label, trailing, disabled, disabledReason, status }: {
  name: string;
  value: number;
  /** While playing, the value as the player moves it — the timeline renders itself for it, not the page around it. */
  live?: ((listener: (value: number) => void) => () => void) | null;
  minimum: number;
  maximum: number;
  step?: number;
  playing: boolean;
  onPlaying: (playing: boolean) => void;
  onValue: (value: number) => void;
  /** Frames computed ahead out of all of them; null when nothing is buffered. */
  buffered?: { loaded: number; total: number } | null;
  speed?: number;
  onSpeed?: (speed: number) => void;
  /** The paces offered, as multiples; 0.5×, 1× and 2× unless said. */
  speeds?: readonly number[];
  /** How the value is written: a circuit's replay writes seconds. */
  format?: (value: number) => string;
  /** What the range is called to a screen reader, when the name alone does not say it. */
  label?: string;
  /** Controls of the one using it, after the pace: a replay's stretch and its way back to the stream. */
  trailing?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  status?: ReactNode;
}) {
  const [liveValue, setLiveValue] = useState<number | null>(null);
  useEffect(() => {
    if (!live) {
      setLiveValue(null);
      return;
    }
    return live(setLiveValue);
  }, [live]);
  const value = live && liveValue !== null ? liveValue : givenValue;
  const span = maximum - minimum;
  const played = span > 0 ? ((value - minimum) / span) * 100 : 0;
  const ready = buffered && buffered.total > 0 ? (buffered.loaded / buffered.total) * 100 : 0;
  // While frames are computed the animation is locked; what is computing is said by `ComputationProgress` over the view.
  const filling = Boolean(buffered && buffered.loaded < buffered.total);
  const locked = disabled || filling;
  return (
    <div data-parallax-part="timeline" className="parallax-timeline">
      <button type="button" data-parallax-part="button" className="parallax-button parallax-small" aria-pressed={playing} disabled={disabled} title={disabled ? disabledReason : undefined}
        onClick={() => onPlaying(!playing)}>
        <ParallaxIcon name={playing ? "pause" : "play"} />{playing ? "Pause" : "Play"}
      </button>
      <label htmlFor={`timeline-${name}`} className="parallax-monospace">{name}</label>
      <input id={`timeline-${name}`} className="parallax-range parallax-timeline-range" type="range" min={minimum} max={maximum} step={step ?? (span / 200 || 0.01)} value={value}
        disabled={locked} title={filling ? "The frames are being computed" : undefined} aria-label={label}
        style={{ "--parallax-fill": `${played}%`, "--parallax-buffered": `${ready}%` } as CSSProperties}
        onChange={(event) => onValue(Number(event.target.value))} />
      <output htmlFor={`timeline-${name}`} className="parallax-timeline-value parallax-steady parallax-width-7">{format(value)}</output>
      {onSpeed ? (
        <div data-parallax-part="segmented" className="parallax-segmented parallax-small" role="group" aria-label="Speed">
          {speeds.map((candidate) => (
            <button key={candidate} type="button" aria-pressed={speed === candidate} disabled={filling} onClick={() => onSpeed(candidate)}>{multipleText(candidate)}</button>
          ))}
        </div>
      ) : null}
      {trailing}
      <span className="parallax-timeline-status" role="status">
        {buffered && !filling ? <span className="parallax-muted">{buffered.total} frames ready</span> : null}
        {status}
      </span>
    </div>
  );
}

/** A pace as a person says it: «¼×», «½×», «2×». */
function multipleText(multiple: number): string {
  const fractions: Record<number, string> = { 0.25: "¼", 0.5: "½" };
  return `${fractions[multiple] ?? multiple}×`;
}

function formatValue(value: number): string {
  return Number(value.toPrecision(4)).toString().replace("-", "−");
}

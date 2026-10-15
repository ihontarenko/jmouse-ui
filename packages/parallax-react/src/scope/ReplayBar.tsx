import { useSyncExternalStore } from "react";
import { REPLAY_ORDERS, TIME_CURVES, type Replay, type TimeCurve } from "@jmouse/parallax/oscilloscope";
import type { ReplayStretchKind } from "@jmouse/parallax/scope";
import { formatQuantity } from "@jmouse/parallax/quantities";
import { Segments, Tool } from "../controls/BenchControls";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { Timeline } from "../viewers/Timeline";

/** The paces a replay is offered at, as multiples of the speed it was recorded at. */
const REPLAY_MULTIPLES = [0.25, 0.5, 1, 2] as const;

/**
 * The transport of a replay: play and pause, the position scrubbed along the stretch, the pace against the recorded
 * one — and the course virtual time takes: which stretch, the order of the passes (once · loop · bounce), the curve laid
 * over each pass's linear time; and the way back to the running circuit. The position moves every screen frame without
 * rendering anything but the timeline.
 */
export function ReplayBar({ replay, stretch, cursorsAvailable, onStretch, onEnd }: {
  replay: Replay;
  stretch: ReplayStretchKind;
  /** Whether the time cursors are on, so their stretch can be chosen. */
  cursorsAvailable: boolean;
  onStretch: (stretch: ReplayStretchKind) => void;
  onEnd: () => void;
}) {
  useSyncExternalStore(replay.subscribeState, () => replay.state);
  const duration = replay.to - replay.from;
  return (
    <div data-parallax-part="replay" className="parallax-replay" role="region" aria-label="Replay">
      <Timeline name="t" label="Replay position, circuit time" value={replay.time} live={replay.subscribeTime}
        minimum={replay.from} maximum={replay.to} step={duration > 0 ? duration / 1000 : undefined}
        playing={replay.playing} onPlaying={(playing) => replay.play(playing)} onValue={(time) => replay.seek(time)}
        speed={replay.multiple} speeds={REPLAY_MULTIPLES} onSpeed={(multiple) => replay.pace(multiple)}
        format={(time) => formatQuantity(time, "s")}
        trailing={
          <Tool tone="primary" onClick={onEnd} title="Leave the replay: the screen and the sheet follow the circuit again (L)">
            <ParallaxIcon name="play" />Back to live
          </Tool>
        }
        status={<span>{formatQuantity(duration, "s")} of the circuit · recorded at {paceText(replay.recorded)}</span>} />
      <div data-parallax-part="replay-course" className="parallax-replay-course">
        <span className="parallax-scope-toolbar-caption" aria-hidden="true">Course</span>
        <Segments label="What is replayed" value={stretch} onChange={onStretch}
          options={[
            { value: "memory", label: "Memory", title: "Everything the memory holds" },
            { value: "cursors", label: "A–B", title: cursorsAvailable ? "The stretch between the time cursors A and B" : "Turn the Δt cursors on to replay the stretch between them",
              disabled: !cursorsAvailable },
          ]} />
        <Segments label="Order of the passes" value={replay.order} onChange={(order) => replay.reorder(order)}
          options={REPLAY_ORDERS.map((order) => ({ value: order.id, label: order.label, title: order.title }))} />
        <Segments label="Time curve over each pass" value={replay.curve.id} onChange={(curve) => replay.reshape(curve)}
          options={TIME_CURVES.map((curve) => ({ value: curve.id, label: <><CurveGlyph curve={curve} />{curve.label}</>, title: curve.title }))} />
      </div>
    </div>
  );
}

/** A curve drawn small beside its name: the share of the stretch reached (up) against the share of the pass's time (across). */
function CurveGlyph({ curve }: { curve: TimeCurve }) {
  const points = Array.from({ length: 17 }, (_, index) => {
    const u = index / 16;
    return `${(1 + u * 14).toFixed(2)},${(11 - curve.at(u) * 10).toFixed(2)}`;
  });
  return (
    <svg className="parallax-curve-glyph" viewBox="0 0 16 12" width="16" height="12" aria-hidden="true">
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** A speed as a share of real time: «real time», «1/100», «2×». */
function paceText(speed: number): string {
  // The measured speed wanders a few per cent around what was asked; that is still real time to the reader.
  if (Math.abs(speed - 1) < 0.05) {
    return "real time";
  }
  return speed > 1 ? `${Number(speed.toPrecision(2))}×` : `1/${Number((1 / speed).toPrecision(2)).toLocaleString("en")}`;
}

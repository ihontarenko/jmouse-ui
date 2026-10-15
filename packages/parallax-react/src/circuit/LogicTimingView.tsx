import { useMemo, useState } from "react";
import { VisualView } from "../viewers/VisualView";
import { css, FloatBuilder, partition, readTheme, type Dataset, type SegmentBatch, type Size, type StageLayer, type TimeSeriesDataset, type VisualTheme } from "@jmouse/parallax/visual";

function timingOf(dataset: Dataset | null): TimeSeriesDataset | null {
  return dataset ? (partition(dataset).drawable.find(([, part]) => part.format === "TIME_SERIES")?.[1] as TimeSeriesDataset | undefined) ?? null : null;
}

function state(value: number): string {
  return value === 1 ? "1" : value === 0 ? "0" : value === -2 ? "Z" : "X";
}

/** Where a level sits inside its lane, the lane being one unit tall: high near the top, low near the bottom. */
function level(value: number): number {
  return value === 1 ? 0.8 : value === 0 ? 0.2 : 0.5;
}

const NAME_COLUMN = 140;
const STATE_COLUMN = 28;

/**
 * Every node's step waveform in one batch: node `n` is the lane from −n−1 to −n, time runs along x. A known level is
 * drawn in the accent, a stretch of unknown or released state faintly in the muted ink.
 */
function waveforms(series: TimeSeriesDataset, theme: VisualTheme): SegmentBatch {
  const known = [...theme.accent.map((channel) => channel / 255), 1];
  const unknown = [...theme.muted.map((channel) => channel / 255), 0.45];
  const positions = new FloatBuilder();
  const colors = new FloatBuilder();
  series.values.forEach((values, lane) => {
    const base = -lane - 1;
    for (let index = 1; index < values.length; index++) {
      const start = series.axisValues[index - 1];
      const end = series.axisValues[index];
      const from = base + level(values[index - 1]);
      const to = base + level(values[index]);
      const uncertain = values[index - 1] !== 0 && values[index - 1] !== 1;
      positions.push(start, from, 0, end, from, 0);
      colors.push(...(uncertain ? unknown : known));
      if (to !== from) {
        positions.push(end, from, 0, end, to, 0);
        colors.push(...known);
      }
    }
  });
  return { kind: "segments", positions: positions.build(), colors: colors.build(), width: 2 };
}

/**
 * Step waveforms for the 0/1/X/Z samples of the event simulation, one lane per digital node, drawn by the drawing
 * library like every other trace; the cursor reads every node's state at one moment.
 */
export function LogicTimingView({ dataset }: { dataset: Dataset | null }) {
  const series = useMemo(() => timingOf(dataset), [dataset]);
  const [sample, setSample] = useState(0);
  const layers = useMemo<StageLayer[]>(() => (series ? [{ id: "waveforms", batches: [waveforms(series, readTheme(document.documentElement))] }] : []), [series]);
  if (!series) {
    return <p className="parallax-empty-inline">Computing digital timing…</p>;
  }
  const index = Math.min(sample, series.axisValues.length - 1);
  const time = series.axisValues[index] ?? 0;
  const duration = series.axisValues.at(-1) || 1;
  const lanes = series.columns.length;
  const window = { xMinimum: -duration * 0.02, xMaximum: duration * 1.02, yMinimum: -lanes, yMaximum: 0 };
  const overlay = (context: CanvasRenderingContext2D, size: Size, theme: VisualTheme) => {
    const laneHeight = size.height / lanes;
    const xOf = (value: number) => ((value - window.xMinimum) / (window.xMaximum - window.xMinimum)) * size.width;
    context.strokeStyle = theme.majorGrid;
    context.lineWidth = 1;
    context.beginPath();
    for (let lane = 1; lane < lanes; lane++) {
      context.moveTo(0, Math.round(lane * laneHeight) + 0.5);
      context.lineTo(size.width, Math.round(lane * laneHeight) + 0.5);
    }
    context.stroke();
    context.strokeStyle = css(theme.muted);
    context.beginPath();
    context.moveTo(Math.round(xOf(time)) + 0.5, 0);
    context.lineTo(Math.round(xOf(time)) + 0.5, size.height);
    context.stroke();
  };
  return (
    <div data-parallax-part="logic-timing" className="parallax-logic-timing">
      <div className="parallax-logic-timing-heading"><span>Digital nodes</span><output>{Number(time.toPrecision(4))} s</output></div>
      <div className="parallax-logic-lanes" style={{ gridTemplateRows: `repeat(${lanes}, 40px)`, gridTemplateColumns: `minmax(90px, ${NAME_COLUMN}px) minmax(0, 1fr) ${STATE_COLUMN}px` }}>
        {series.columns.map((name, column) => (
          <span key={`name-${name}`} className="parallax-monospace parallax-logic-lane-name" style={{ gridRow: column + 1, gridColumn: 1 }}>{name}</span>
        ))}
        <div className="parallax-logic-lane-view" style={{ gridRow: `1 / span ${lanes}`, gridColumn: 2 }}>
          <VisualView layers={layers} title={`Digital timing of ${series.columns.join(", ")}`} interactive={false} readout={false}
            pinned={window} grid={false} axes={false} overlay={overlay} />
        </div>
        {series.columns.map((name, column) => (
          <strong key={`state-${name}`} className="parallax-monospace parallax-logic-lane-state" style={{ gridRow: column + 1, gridColumn: 3 }}>{state(series.values[column][index])}</strong>
        ))}
      </div>
      <input type="range" aria-label="Digital timing cursor" min={0} max={series.axisValues.length - 1} value={index} onChange={(event) => setSample(Number(event.target.value))} />
      <p>1 high · 0 low · X unknown · Z released</p>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { formatQuantity } from "@jmouse/parallax/quantities";
import { FloatBuilder, parseColor, Stage, type Size, type VisualTheme } from "@jmouse/parallax/visual";
import { shownReading, type Meter, type MeterHistoryPoint, type MeterMode } from "@jmouse/parallax/meters";

const FRAME = { xMinimum: 0, xMaximum: 1, yMinimum: 0, yMaximum: 1 };
/** How much room the line keeps above and below what it read, as a share of its range. */
const MARGIN = 0.1;

/**
 * A meter's reading over time, as a chart recorder writes it: one point a gate — the DC, AC or RMS the display shows —
 * over the last half minute of the run, so a supply sagging under load or a part warming up is seen as it happens. The
 * waveform is the oscilloscope's: drawn here, half a second of a 100 Hz ripple was a solid band and told nothing.
 * Drawn by the one drawing library on a canvas — a bench may show many of these, and a page gets few WebGL contexts.
 */
export function MeterTrend({ meter, mode, history }: { meter: Meter; mode: MeterMode; history: readonly MeterHistoryPoint[] }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    stage.current = new Stage(element, { driver: "canvas", interactive: false, surface: "screen" });
    return () => {
      stage.current?.destroy();
      stage.current = null;
    };
  }, []);
  useEffect(() => {
    const element = host.current;
    const shownStage = stage.current;
    if (!element || !shownStage) {
      return;
    }
    const values = history.map((point) => shownReading(mode, point.reading));
    const read = values.some(Number.isFinite);
    const low = read ? Math.min(...values.filter(Number.isFinite)) : 0;
    const high = read ? Math.max(...values.filter(Number.isFinite)) : 1;
    // A steady reading is drawn as a level line in the middle, not stretched into noise.
    const range = read ? Math.max(high - low, Math.abs(high) * 1e-3, 1e-12) : 1;
    const bottom = read ? (high + low) / 2 - range * (0.5 + MARGIN) : 0;
    const top = bottom + range * (1 + 2 * MARGIN);
    const first = history.length ? history[0].time : 0;
    const last = history.length ? history[history.length - 1].time : 1;
    const span = Math.max(1e-12, last - first);
    const color = parseColor(getComputedStyle(element).getPropertyValue("--parallax-accent").trim() || "#e3b34a");
    const rgba = [color[0] / 255, color[1] / 255, color[2] / 255, 1];
    const positions = new FloatBuilder(512);
    const colors = new FloatBuilder(512);
    for (let index = 1; index < history.length; index++) {
      const before = values[index - 1];
      const after = values[index];
      if (!Number.isFinite(before) || !Number.isFinite(after)) {
        continue;
      }
      positions.push((history[index - 1].time - first) / span, (before - bottom) / (top - bottom), 0,
        (history[index].time - first) / span, (after - bottom) / (top - bottom), 0);
      colors.push(...rgba);
    }
    shownStage.setContent({
      layers: read ? [{ id: "trend", batches: [{ kind: "segments", positions: positions.build(), colors: colors.build(), width: 1.5 }] }] : [],
      pinned: FRAME,
      divisions: { horizontal: 10, vertical: 4 },
      overlay: (context, size, theme) => scale(context, size, theme, read ? { top, bottom } : null, history.length > 1 ? span : 0, meter.unit),
    });
    shownStage.renderNow();
  }, [history, mode, meter]);
  return <div ref={host} data-parallax-part="meter-trend" className="parallax-meter-trend" role="img"
    aria-label={`${meter.title} ${meter.id}, its ${mode} reading over the last half minute of the run`} />;
}

/** The figures the line is read against: the top and bottom of its scale, and how much of the run it spans. */
function scale(context: CanvasRenderingContext2D, size: Size, theme: VisualTheme, range: { top: number; bottom: number } | null, span: number, unit: string) {
  context.save();
  context.font = theme.labelFont;
  context.fillStyle = theme.label;
  if (range) {
    context.textBaseline = "top";
    context.fillText(formatQuantity(range.top, unit), 4, 3);
    context.textBaseline = "bottom";
    context.fillText(formatQuantity(range.bottom, unit), 4, size.height - 3);
  } else {
    context.textBaseline = "middle";
    context.fillText("Nothing read yet", 4, size.height / 2);
  }
  if (span > 0) {
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.fillText(`last ${formatQuantity(span, "s")} of the run`, size.width - 4, size.height - 3);
  }
  context.restore();
}

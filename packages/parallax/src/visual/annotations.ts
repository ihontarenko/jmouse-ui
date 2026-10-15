import { css, type Rgb } from "./color";
import type { PlaneView, Size } from "./plane";
import type { VisualTheme } from "./theme";

/*
 * What a stage writes over its geometry besides its own grid and readout: texts at points of the data, and values as
 * bars. Both change with every tick of a clock while the geometry does not, so the stage takes them on their own
 * (`setLabels`, `setBars`) and redraws only its overlay.
 */

/** A text at a point of the plane, or stacked in the corner when it has none. */
export interface StageLabel {
  id: string;
  text: string;
  /** Data coordinates; null puts the label in the top-left corner, under the ones before it. */
  at: [number, number] | null;
  /** A CSS colour or `var(--token)`; the ink without one. */
  color?: string;
}

/** One value drawn as a bar on a shared zero line. */
export interface StageBar {
  id: string;
  name: string;
  value: number | null;
  color?: string;
}

/** Bars and the largest magnitude their ruler is fixed to, so a moving bar grows against a still scale. */
export interface StageBars {
  bars: readonly StageBar[];
  reach: number;
  /** Whether any bar may go below zero: the zero line then sits in the middle. */
  signed: boolean;
}

type Resolve = (color: string | undefined) => Rgb;

/** The corner every view keeps its tools in, which labels stay out of, pixels. */
const TOOL_CORNER_WIDTH = 150;
const TOOL_CORNER_HEIGHT = 40;

/** Every label at its point on a plate of the background, in its colour; one outside the canvas is kept on its edge. */
export function drawLabels(context: CanvasRenderingContext2D, size: Size, theme: VisualTheme, view: PlaneView,
  labels: readonly StageLabel[], resolve: Resolve) {
  context.save();
  context.font = theme.labelFont;
  context.textBaseline = "middle";
  context.textAlign = "left";
  let corner = 0;
  // Texts already written, so a label near another — a peak and its −3 dB edge a few pixels apart — steps below it
  // instead of printing over it.
  const placed: { left: number; top: number; right: number; bottom: number }[] = [];
  const overlaps = (left: number, top: number, right: number, bottom: number) =>
    placed.some((other) => left < other.right && right > other.left && top < other.bottom && bottom > other.top);
  for (const label of labels) {
    let left: number;
    let middle: number;
    const color = css(resolve(label.color));
    if (label.at) {
      const pointX = size.width / 2 + (label.at[0] - view.centerX) * view.unitX;
      const pointY = size.height / 2 - (label.at[1] - view.centerY) * view.unitY;
      // The point itself, marked: the text says what it is, the dot says exactly where.
      if (pointX >= 0 && pointX <= size.width && pointY >= 0 && pointY <= size.height) {
        context.fillStyle = color;
        context.beginPath();
        context.arc(pointX, pointY, 3.5, 0, Math.PI * 2);
        context.fill();
      }
      left = pointX + 8;
      middle = pointY - 14;
    } else {
      left = 12;
      middle = 40 + corner * 22;
      corner++;
    }
    const width = context.measureText(label.text).width;
    left = Math.max(4, Math.min(size.width - width - 12, left));
    middle = Math.max(12, Math.min(size.height - 12, middle));
    // The top right corner is a view's tool row (zoom, fit, save): a label there was written under the buttons.
    if (left + width > size.width - TOOL_CORNER_WIDTH && middle < TOOL_CORNER_HEIGHT) {
      middle = TOOL_CORNER_HEIGHT + 10;
    }
    for (let attempt = 0; attempt < 8 && overlaps(left - 4, middle - 10, left + width + 4, middle + 10); attempt++) {
      middle = Math.min(size.height - 12, middle + 22);
    }
    placed.push({ left: left - 4, top: middle - 10, right: left + width + 4, bottom: middle + 10 });
    context.fillStyle = css(theme.background, 0.82);
    context.fillRect(left - 4, middle - 10, width + 8, 20);
    context.fillStyle = color;
    context.fillText(label.text, left, middle);
  }
  context.restore();
}

/** Bars side by side on a zero line, each with its value above and its name below, centred in the canvas. */
export function drawBars(context: CanvasRenderingContext2D, size: Size, theme: VisualTheme, bars: StageBars, resolve: Resolve) {
  const count = bars.bars.length;
  if (count === 0) {
    return;
  }
  context.save();
  context.font = theme.labelFont;
  context.textAlign = "center";
  const top = 36;
  const bottom = size.height - 40;
  const zero = bars.signed ? (top + bottom) / 2 : bottom;
  const span = bars.signed ? (bottom - top) / 2 : bottom - top;
  const slot = Math.min(140, (size.width - 48) / count);
  const left = (size.width - slot * count) / 2;
  context.strokeStyle = css(theme.ink);
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(left, zero + 0.5);
  context.lineTo(left + slot * count, zero + 0.5);
  context.stroke();
  bars.bars.forEach((bar, index) => {
    const color = resolve(bar.color);
    const center = left + slot * index + slot / 2;
    const width = slot * 0.56;
    const share = bar.value === null ? 0 : Math.max(-1, Math.min(1, bar.value / Math.max(bars.reach, 1e-12)));
    const height = share * span;
    context.fillStyle = css(color);
    context.fillRect(center - width / 2, Math.min(zero, zero - height), width, Math.abs(height));
    context.fillStyle = css(theme.ink);
    context.textBaseline = height >= 0 ? "bottom" : "top";
    context.fillText(bar.value === null ? "…" : formatValue(bar.value), center, height >= 0 ? zero - height - 4 : zero - height + 4);
    context.fillStyle = css(color);
    context.textBaseline = "top";
    context.fillText(bar.name, center, bottom + 8);
  });
  context.restore();
}

function formatValue(value: number): string {
  return Number(value.toPrecision(4)).toString().replace("-", "−");
}

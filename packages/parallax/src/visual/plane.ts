import { css, type Rgb } from "./color";
import { formatTick, gridStep, steps } from "./scale";
import type { VisualTheme } from "./theme";

/*
 * The plane: a 2-D coordinate system drawn full-bleed — grid, axes through the origin, numbers kept on screen — and
 * the camera that pans and zooms it. A curve on an object page, a time series and the graph all sit on this one plane.
 */

/** Where the plane looks: the point at its centre and how many pixels one unit spans on each axis. */
export interface PlaneView {
  centerX: number;
  centerY: number;
  unitX: number;
  unitY: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A rectangle of the plane, in its own units. */
export interface PlaneWindow {
  xMinimum: number;
  xMaximum: number;
  yMinimum: number;
  yMaximum: number;
}

export const defaultPlaneView: PlaneView = { centerX: 0, centerY: 0, unitX: 48, unitY: 48 };

const MINIMUM_UNIT = 1e-6;
const MAXIMUM_UNIT = 1e9;

export function visibleWindow(view: PlaneView, size: Size): PlaneWindow {
  const halfWidth = size.width / 2 / view.unitX;
  const halfHeight = size.height / 2 / view.unitY;
  return { xMinimum: view.centerX - halfWidth, xMaximum: view.centerX + halfWidth, yMinimum: view.centerY - halfHeight, yMaximum: view.centerY + halfHeight };
}

export function toPixels(view: PlaneView, size: Size, x: number, y: number): [number, number] {
  return [size.width / 2 + (x - view.centerX) * view.unitX, size.height / 2 - (y - view.centerY) * view.unitY];
}

export function toPlane(view: PlaneView, size: Size, pixelX: number, pixelY: number): [number, number] {
  return [view.centerX + (pixelX - size.width / 2) / view.unitX, view.centerY - (pixelY - size.height / 2) / view.unitY];
}

const bounded = (unit: number) => Math.min(MAXIMUM_UNIT, Math.max(MINIMUM_UNIT, unit));

/** The view zoomed around a pixel, which stays where it is; each axis by its own factor. */
export function zoomedAt(view: PlaneView, size: Size, factorX: number, factorY: number, pixelX: number, pixelY: number): PlaneView {
  const [unitX, unitY] = [bounded(view.unitX * factorX), bounded(view.unitY * factorY)];
  const [x, y] = toPlane(view, size, pixelX, pixelY);
  return { unitX, unitY, centerX: x - (pixelX - size.width / 2) / unitX, centerY: y + (pixelY - size.height / 2) / unitY };
}

export function pannedBy(view: PlaneView, pixelsX: number, pixelsY: number): PlaneView {
  return { ...view, centerX: view.centerX - pixelsX / view.unitX, centerY: view.centerY + pixelsY / view.unitY };
}

/**
 * The view that shows a window whole, with a margin of pixels around it. Equal units keep geometry honest; a window
 * far from square (a time series, a phase portrait) is stretched to fill instead.
 */
export function fittedView(window: PlaneWindow, size: Size, units: "equal" | "free" | "auto", margin = 24): PlaneView {
  const width = Math.max(window.xMaximum - window.xMinimum, 1e-12);
  const height = Math.max(window.yMaximum - window.yMinimum, 1e-12);
  const room = { width: Math.max(10, size.width - margin * 2), height: Math.max(10, size.height - margin * 2) };
  let unitX = room.width / width;
  let unitY = room.height / height;
  const aspect = width / height;
  const equal = units === "equal" || (units === "auto" && aspect > 1 / 3 && aspect < 3);
  if (equal) {
    unitX = unitY = Math.min(unitX, unitY);
  }
  return { centerX: (window.xMinimum + window.xMaximum) / 2, centerY: (window.yMinimum + window.yMaximum) / 2, unitX: bounded(unitX), unitY: bounded(unitY) };
}

export interface PlaneDecoration {
  grid: boolean;
  axes: boolean;
  /** Numbers on the axes; a thumbnail has no room for them. */
  labels: boolean;
  /** Names written at the ends of the axes, e.g. `t` and `V`. */
  axisNames?: [string, string];
  /**
   * The horizontal axis is the decimal logarithm of a quantity in this unit — a frequency response —: lines at whole
   * decades and at 2…9 within each, numbers written as the quantity itself (`10 Hz`, `1 kHz`), and no vertical axis at
   * x = 0, which is only 1 Hz.
   */
  horizontalDecades?: { unit: string };
}

/** Whole decades to mark, every one or — when they crowd — every second, fifth or tenth. */
function decadeLines(minimum: number, maximum: number, pixelsPerDecade: number): { major: number[]; minor: number[] } {
  const every = [1, 2, 5, 10].find((candidate) => candidate * pixelsPerDecade >= 48) ?? 10;
  const major = steps(minimum, maximum, every);
  const minor: number[] = [];
  if (every === 1 && pixelsPerDecade >= 60) {
    for (let decade = Math.floor(minimum); decade <= Math.ceil(maximum); decade++) {
      for (let multiple = 2; multiple <= 9; multiple++) {
        const at = decade + Math.log10(multiple);
        if (at >= minimum && at <= maximum) {
          minor.push(at);
        }
      }
    }
  }
  return { major, minor };
}

const SI_PREFIXES: Record<number, string> = { [-4]: "p", [-3]: "n", [-2]: "µ", [-1]: "m", 0: "", 1: "k", 2: "M", 3: "G", 4: "T" };

/** A whole decade as the quantity it stands for: 3 in Hz is «1 kHz», −2 in s is «10 ms». */
export function decadeLabel(decade: number, unit: string): string {
  const exponent = Math.round(decade);
  const group = Math.floor(exponent / 3);
  const prefix = SI_PREFIXES[group];
  if (prefix === undefined) {
    return `10${superscript(exponent)} ${unit}`.trim();
  }
  return `${10 ** (exponent - group * 3)} ${prefix}${unit}`.trim();
}

function superscript(value: number): string {
  const digits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return (value < 0 ? "⁻" : "") + String(Math.abs(value)).split("").map((digit) => digits[Number(digit)]).join("");
}

/** The grid, the axes through the origin, and their numbers on a background patch so a curve never hides them. */
export function drawPlaneGrid(context: CanvasRenderingContext2D, size: Size, view: PlaneView, theme: VisualTheme, decoration: PlaneDecoration) {
  const { width, height } = size;
  const visible = visibleWindow(view, size);
  const xStep = gridStep(view.unitX);
  const yStep = gridStep(view.unitY);
  const lines = (xValues: number[], yValues: number[], stroke: string) => {
    context.strokeStyle = stroke;
    context.beginPath();
    for (const x of xValues) {
      const pixel = Math.round(toPixels(view, size, x, 0)[0]) + 0.5;
      context.moveTo(pixel, 0);
      context.lineTo(pixel, height);
    }
    for (const y of yValues) {
      const pixel = Math.round(toPixels(view, size, 0, y)[1]) + 0.5;
      context.moveTo(0, pixel);
      context.lineTo(width, pixel);
    }
    context.stroke();
  };
  context.lineWidth = 1;
  const decades = decoration.horizontalDecades ? decadeLines(visible.xMinimum, visible.xMaximum, view.unitX) : null;
  if (decoration.grid) {
    lines(decades ? decades.minor : steps(visible.xMinimum, visible.xMaximum, xStep.minor), steps(visible.yMinimum, visible.yMaximum, yStep.minor), theme.minorGrid);
    lines(decades ? decades.major : steps(visible.xMinimum, visible.xMaximum, xStep.major), steps(visible.yMinimum, visible.yMaximum, yStep.major), theme.majorGrid);
  }
  if (!decoration.axes) {
    return;
  }
  const [originX, originY] = toPixels(view, size, 0, 0);
  context.strokeStyle = theme.axis;
  context.lineWidth = 1.5;
  context.beginPath();
  if (originX >= 0 && originX <= width && !decoration.horizontalDecades) {
    context.moveTo(Math.round(originX) + 0.5, 0);
    context.lineTo(Math.round(originX) + 0.5, height);
  }
  if (originY >= 0 && originY <= height) {
    context.moveTo(0, Math.round(originY) + 0.5);
    context.lineTo(width, Math.round(originY) + 0.5);
  }
  context.stroke();
}

/** The axes' numbers and names: drawn after the layers, on patches of the background. */
export function drawPlaneLabels(context: CanvasRenderingContext2D, size: Size, view: PlaneView, theme: VisualTheme, decoration: PlaneDecoration) {
  if (!decoration.axes || !decoration.labels) {
    return;
  }
  const { width, height } = size;
  const visible = visibleWindow(view, size);
  const xStep = gridStep(view.unitX);
  const yStep = gridStep(view.unitY);
  const [originX, originY] = toPixels(view, size, 0, 0);
  const background = css(theme.background);
  context.font = theme.labelFont;
  context.fillStyle = theme.label;
  context.textAlign = "center";
  context.textBaseline = "top";
  const decades = decoration.horizontalDecades;
  // On a logarithmic axis the frequencies are read along the bottom, as on Bode paper — not on the 0 dB line.
  const labelY = decades ? height - 18 : Math.min(height - 16, Math.max(4, originY + 4));
  if (decades) {
    for (const x of decadeLines(visible.xMinimum, visible.xMaximum, view.unitX).major) {
      patchedText(context, decadeLabel(x, decades.unit), toPixels(view, size, x, 0)[0], labelY, background);
    }
  } else {
    for (const x of steps(visible.xMinimum, visible.xMaximum, xStep.major)) {
      if (x !== 0) {
        patchedText(context, formatTick(x, xStep.major), toPixels(view, size, x, 0)[0], labelY, background);
      }
    }
  }
  context.textAlign = "right";
  context.textBaseline = "middle";
  // On a logarithmic axis there is no x = 0 to stand at: the numbers stand at the left edge.
  const labelX = decades ? 40 : Math.min(width - 4, Math.max(36, originX - 6));
  for (const y of steps(visible.yMinimum, visible.yMaximum, yStep.major)) {
    if (y !== 0) {
      patchedText(context, formatTick(y, yStep.major), labelX, toPixels(view, size, 0, y)[1], background);
    }
  }
  if (!decades && originX >= 0 && originX <= width && originY >= 0 && originY <= height) {
    context.textAlign = "right";
    context.textBaseline = "top";
    patchedText(context, "0", originX - 6, originY + 4, background);
  }
  if (decoration.axisNames) {
    context.textBaseline = "bottom";
    context.textAlign = "right";
    patchedText(context, decoration.axisNames[0], width - 8, Math.min(height - 20, Math.max(18, originY - 4)), background);
    context.textAlign = "left";
    context.textBaseline = "top";
    // Under the legend's row, which owns the top edge: the name of the vertical axis printed into it.
    patchedText(context, decoration.axisNames[1], Math.min(width - 40, Math.max(42, originX + 6)), 26, background);
  }
}

function patchedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, background: string) {
  if (!text) {
    return;
  }
  const measured = context.measureText(text).width;
  const left = context.textAlign === "center" ? x - measured / 2 : context.textAlign === "right" ? x - measured : x;
  const top = context.textBaseline === "middle" ? y - 7 : context.textBaseline === "bottom" ? y - 14 : y;
  const ink = context.fillStyle;
  context.fillStyle = background;
  context.fillRect(left - 2, top - 1, measured + 4, 15);
  context.fillStyle = ink;
  context.fillText(text, x, y);
}

/**
 * An instrument's graticule: a fixed number of divisions whatever the scale, the centre lines stronger, with small
 * ticks along them — the screen of an oscilloscope.
 */
export function drawDivisions(context: CanvasRenderingContext2D, size: Size, theme: VisualTheme, horizontal: number, vertical: number) {
  const { width, height } = size;
  const divisionWidth = width / horizontal;
  const divisionHeight = height / vertical;
  context.lineWidth = 1;
  context.strokeStyle = theme.minorGrid;
  context.beginPath();
  for (let line = 1; line < horizontal; line++) {
    const x = Math.round(line * divisionWidth) + 0.5;
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let line = 1; line < vertical; line++) {
    const y = Math.round(line * divisionHeight) + 0.5;
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();
  const middle = Math.round(height / 2) + 0.5;
  const centre = Math.round(width / 2) + 0.5;
  context.strokeStyle = theme.axis;
  context.beginPath();
  context.moveTo(0, middle);
  context.lineTo(width, middle);
  context.moveTo(centre, 0);
  context.lineTo(centre, height);
  for (let tick = 0; tick < horizontal * 5; tick++) {
    const x = Math.round((tick * divisionWidth) / 5) + 0.5;
    context.moveTo(x, middle - 3);
    context.lineTo(x, middle + 3);
  }
  for (let tick = 0; tick < vertical * 5; tick++) {
    const y = Math.round((tick * divisionHeight) / 5) + 0.5;
    context.moveTo(centre - 3, y);
    context.lineTo(centre + 3, y);
  }
  context.stroke();
}

/** The colour scale of a value raster, at the right edge: what the colours of a heat map mean. */
export function drawRampLegend(context: CanvasRenderingContext2D, size: Size, theme: VisualTheme, minimum: number, maximum: number, title?: string) {
  const height = Math.min(size.height - 48, 160);
  const x = size.width - 46;
  const top = (size.height - height) / 2;
  context.fillStyle = css(theme.background, 0.85);
  context.fillRect(x - 6, top - 22, 52, height + 30);
  for (let step = 0; step < height; step++) {
    const amount = 1 - step / height;
    context.fillStyle = css(theme.ramp[Math.round(amount * (theme.ramp.length - 1))]);
    context.fillRect(x, top + step, 10, 1);
  }
  context.strokeStyle = theme.majorGrid;
  context.strokeRect(x + 0.5, top + 0.5, 10, height);
  context.font = theme.labelFont;
  context.fillStyle = theme.label;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const step = Math.abs(maximum - minimum) / 10 || 1;
  context.fillText(formatTick(maximum, step), x + 14, top + 8);
  context.fillText(formatTick(minimum, step), x + 14, top + height);
  if (title) {
    context.fillText(title, x - 2, top - 8);
  }
}

/** The names of a canvas's series, each beside its colour, along the top edge. */
export function drawSeriesLegend(context: CanvasRenderingContext2D, theme: VisualTheme, entries: readonly { name: string; color: Rgb }[],
  quantity = "") {
  context.font = theme.labelFont;
  context.textAlign = "left";
  context.textBaseline = "middle";
  let x = 10;
  // What the vertical axis measures heads the row — `voltage, V` —: written inside the plot it lay across the data.
  if (quantity) {
    const measured = context.measureText(quantity).width;
    context.fillStyle = css(theme.background, 0.85);
    context.fillRect(x - 4, 4, measured + 8, 18);
    context.fillStyle = theme.label;
    context.fillText(quantity, x, 13);
    x += measured + 18;
  }
  for (const entry of entries) {
    const measured = context.measureText(entry.name).width;
    context.fillStyle = css(theme.background, 0.85);
    context.fillRect(x - 4, 4, measured + 26, 18);
    context.fillStyle = css(entry.color);
    context.fillRect(x, 12, 12, 2);
    context.fillStyle = theme.label;
    context.fillText(entry.name, x + 16, 13);
    x += measured + 32;
  }
}

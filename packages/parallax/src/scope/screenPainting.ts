import { channelDrawn, channelUnit, HORIZONTAL_DIVISIONS, PROBE_COLORS, VERTICAL_DIVISIONS, type SampleMemory, type ScopeSettings, type Window } from "../oscilloscope";
import { formatQuantity } from "../quantities";
import { css, FloatBuilder, parseColor, type Rgb, type SegmentBatch, type Size, type VisualTheme } from "../visual";
import { appendTrace } from "./traceEnvelope";
import { mathSource, mathUnit, mathUnitsOf } from "./mathChannel";
import { DEFAULT_SPECTRUM_RANGE, spectrumPeak, type SpectrumAxis } from "./spectrum";
import type { AnalysisReadout } from "./screenAnalysis";
import { decibelUnit, phasorScales } from "./screenReadout";

/* What the oscilloscope's screen paints: its traces as segments for the drawing library, its own marks on the overlay. */

/** The screen in divisions: x from 0 to 10 left to right, y from −4 to 4 bottom to top. */
export const SCREEN = { xMinimum: 0, xMaximum: HORIZONTAL_DIVISIONS, yMinimum: -VERTICAL_DIVISIONS / 2, yMaximum: VERTICAL_DIVISIONS / 2 };

/** The probe colours as the screen draws them, by their number 1 … 10 (index 0 unused): the `--parallax-probe-N` tokens. */
export function probeColors(element: HTMLElement): Rgb[] {
  const style = getComputedStyle(element);
  return Array.from({ length: PROBE_COLORS + 1 }, (_, color) => parseColor(style.getPropertyValue(`--parallax-probe-${Math.max(1, color)}`).trim() || "#e3b34a"));
}

/**
 * Every enabled channel's trace in screen divisions, for the drawing library. A dense stretch is drawn as the minimum
 * and maximum of the samples under each pixel column, so a million samples cost what a thousand do.
 */
export function screenTraces(memory: SampleMemory, settings: ScopeSettings, view: Window, columns: number, colors: Rgb[], readout?: AnalysisReadout): SegmentBatch[] {
  if (settings.display === "xy") {
    return xyTraces(memory, settings, view, colors);
  }
  if (settings.display === "fft") {
    return readout ? spectrumTraces(settings, readout, colors) : [];
  }
  if (settings.display === "phasors") {
    // The phasor diagram is drawn whole on the overlay, which knows how much room its words take.
    return [];
  }
  const positions = new FloatBuilder(8192);
  const segmentColors = new FloatBuilder(8192);
  const first = Math.max(0, memory.indexAt(view.start) - 1);
  const last = Math.min(memory.length, memory.indexAt(view.start + view.span) + 1);
  const xOf = (time: number) => ((time - view.start) / view.span) * HORIZONTAL_DIVISIONS;
  for (const channel of settings.channels) {
    if (!channelDrawn(channel)) {
      continue;
    }
    let offset = 0;
    if (channel.coupling === "AC") {
      let sum = 0;
      let count = 0;
      for (let index = first; index < last; index++) {
        const value = memory.reading(channel.id, index);
        if (Number.isFinite(value)) {
          sum += value;
          count++;
        }
      }
      offset = count ? sum / count : 0;
    }
    const yOf = (value: number) => (value - offset) / channel.voltsPerDivision + channel.position;
    const color = colors[channel.color];
    const rgba = [color[0] / 255, color[1] / 255, color[2] / 255, 1];
    const segment = (ax: number, ay: number, bx: number, by: number) => {
      positions.push(ax, ay, 0, bx, by, 0);
      segmentColors.push(...rgba);
    };
    appendTrace(segment, memory, channel.id, first, last, columns, xOf, yOf, HORIZONTAL_DIVISIONS);
  }
  const math = settings.math;
  if (math?.enabled) {
    const color = colors[math.color];
    const rgba = [color[0] / 255, color[1] / 255, color[2] / 255, 1];
    const yOf = (value: number) => value / math.voltsPerDivision + math.position;
    appendTrace((ax, ay, bx, by) => {
      positions.push(ax, ay, 0, bx, by, 0);
      segmentColors.push(...rgba);
    }, mathSource(memory, math), "M", first, last, columns, xOf, yOf, HORIZONTAL_DIVISIONS);
  }
  const trace: SegmentBatch = { kind: "segments", positions: positions.build(), colors: segmentColors.build(), width: 1.5 };
  return settings.phosphor ? [phosphorGlow(trace), trace] : [trace];
}

/**
 * The first channel on, across, against the second, up — sample by sample over the window the time base and the trigger
 * chose: the figure two signals draw together, in the second's colour. Each axis keeps its channel's volts per division
 * and position; across, zero is the screen's middle. An acquisition's end breaks the figure as it breaks a trace.
 */
function xyTraces(memory: SampleMemory, settings: ScopeSettings, view: Window, colors: Rgb[]): SegmentBatch[] {
  const [across, up] = settings.channels.filter((channel) => channel.enabled);
  if (!across || !up) {
    return [];
  }
  const positions = new FloatBuilder(8192);
  const segmentColors = new FloatBuilder(8192);
  const color = colors[up.color];
  const rgba = [color[0] / 255, color[1] / 255, color[2] / 255, 1];
  const xOf = (value: number) => HORIZONTAL_DIVISIONS / 2 + value / across.voltsPerDivision + across.position;
  const yOf = (value: number) => value / up.voltsPerDivision + up.position;
  const first = Math.max(0, memory.indexAt(view.start));
  const last = Math.min(memory.length, memory.indexAt(view.start + view.span) + 1);
  let previous: [number, number] | null = null;
  for (let index = first; index < last; index++) {
    const x = memory.reading(across.id, index);
    const y = memory.reading(up.id, index);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !memory.continues(index)) {
      previous = null;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
    }
    const point: [number, number] = [xOf(x), yOf(y)];
    if (previous) {
      positions.push(previous[0], previous[1], 0, point[0], point[1], 0);
      segmentColors.push(...rgba);
    }
    previous = point;
  }
  const trace: SegmentBatch = { kind: "segments", positions: positions.build(), colors: segmentColors.build(), width: 1.5 };
  return settings.phosphor ? [phosphorGlow(trace), trace] : [trace];
}

/**
 * Every enabled channel's spectrum in screen divisions: the frequency across on the axis's decades, the level up from
 * the range's top at its decibels a division. The spectra are the steady readout's, read once a frame.
 */
function spectrumTraces(settings: ScopeSettings, readout: AnalysisReadout, colors: Rgb[]): SegmentBatch[] {
  const { axis, spectra } = readout.spectra;
  if (!axis) {
    return [];
  }
  const range = settings.spectrum ?? DEFAULT_SPECTRUM_RANGE;
  const positions = new FloatBuilder(16384);
  const segmentColors = new FloatBuilder(16384);
  const xOf = spectrumX(axis);
  const yOf = (level: number) => VERTICAL_DIVISIONS / 2 - (range.top - level) / range.decibelsPerDivision;
  const floor = -VERTICAL_DIVISIONS / 2;
  const ceiling = VERTICAL_DIVISIONS / 2;
  spectra.forEach(({ channel, spectrum }) => {
    if (!spectrum) {
      return;
    }
    const color = colors[channel.color];
    const rgba = [color[0] / 255, color[1] / 255, color[2] / 255, 1];
    for (let bin = 1; bin < spectrum.frequencies.length; bin++) {
      const ay = Math.min(ceiling, Math.max(floor, yOf(spectrum.levels[bin - 1])));
      const by = Math.min(ceiling, Math.max(floor, yOf(spectrum.levels[bin])));
      positions.push(xOf(spectrum.frequencies[bin - 1]), ay, 0, xOf(spectrum.frequencies[bin]), by, 0);
      segmentColors.push(...rgba);
    }
  });
  const trace: SegmentBatch = { kind: "segments", positions: positions.build(), colors: segmentColors.build(), width: 1.25 };
  return settings.phosphor ? [phosphorGlow(trace), trace] : [trace];
}

/** A frequency as divisions across the screen, on the spectrum's decades. */
function spectrumX(axis: SpectrumAxis): (frequency: number) => number {
  const low = Math.log10(axis.lowest);
  const range = Math.max(1e-9, Math.log10(axis.highest) - low);
  return (frequency) => ((Math.log10(Math.max(frequency, axis.lowest)) - low) / range) * HORIZONTAL_DIVISIONS;
}

/**
 * A spectrum's marks: the frequencies along the bottom on its 1–2–5 steps, the levels on the right — the left top corner
 * is the readout's —, and each trace's strongest component marked on its curve. The figures of those peaks are the
 * readout's table (`spectrumPlate`), not painted here.
 */
function paintSpectrumMarks(context: CanvasRenderingContext2D, size: Size, theme: VisualTheme, settings: ScopeSettings, readout: AnalysisReadout, colors: Rgb[]) {
  const { width, height } = size;
  const { axis, spectra } = readout.spectra;
  const range = settings.spectrum ?? DEFAULT_SPECTRUM_RANGE;
  context.font = theme.labelFont;
  if (!axis) {
    context.fillStyle = theme.label;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Too few samples for a spectrum yet", width / 2, height / 2);
    return;
  }
  const xOf = spectrumX(axis);
  const toPixel = (divisions: number) => (divisions / HORIZONTAL_DIVISIONS) * width;
  const unitOf = (id: string) => id === "M" && settings.math ? mathUnit(settings.math, mathUnitsOf(settings.math, settings))
    : channelUnit(settings.channels.find((channel) => channel.id === id) ?? settings.channels[0]);
  context.fillStyle = theme.label;
  context.strokeStyle = theme.label;
  context.textBaseline = "bottom";
  context.textAlign = "center";
  let lastLabel = Number.NEGATIVE_INFINITY;
  for (let decade = Math.floor(Math.log10(axis.lowest)); decade <= Math.ceil(Math.log10(axis.highest)); decade++) {
    for (const step of [1, 2, 5]) {
      const frequency = step * 10 ** decade;
      if (frequency < axis.lowest * 0.999 || frequency > axis.highest * 1.001) {
        continue;
      }
      const x = toPixel(xOf(frequency));
      context.globalAlpha = step === 1 ? 0.25 : 0.1;
      context.beginPath();
      context.moveTo(Math.round(x) + 0.5, 0);
      context.lineTo(Math.round(x) + 0.5, height);
      context.stroke();
      context.globalAlpha = 1;
      const label = formatQuantity(frequency, "Hz");
      const half = context.measureText(label).width / 2 + 6;
      // Clear of the levels at the right edge.
      const at = Math.max(half, Math.min(width - half - 52, x));
      if (at - half > lastLabel) {
        context.fillText(label, at, height - 3);
        lastLabel = at + half;
      }
    }
  }
  context.textBaseline = "middle";
  context.textAlign = "right";
  const levelUnit = decibelUnit(unitOf(spectra[0]?.channel.id ?? "CH1"));
  for (let division = 0; division < VERTICAL_DIVISIONS; division += 2) {
    const level = range.top - division * range.decibelsPerDivision;
    context.fillText(`${level} ${levelUnit}`, width - 4, Math.max(8, (division / VERTICAL_DIVISIONS) * height));
  }
  // Each peak marked on its curve; its figures are the readout's.
  for (const { channel, spectrum } of spectra) {
    if (!spectrum) {
      continue;
    }
    const peak = spectrumPeak(spectrum);
    const x = toPixel(xOf(peak.frequency));
    const y = ((range.top - peak.level) / (range.decibelsPerDivision * VERTICAL_DIVISIONS)) * height;
    const color = css(colors[channel.color]);
    context.fillStyle = color;
    if (y >= 0 && y <= height) {
      context.beginPath();
      context.moveTo(x, y - 4);
      context.lineTo(x - 5, y - 11);
      context.lineTo(x + 5, y - 11);
      context.fill();
    }
  }
}

/**
 * The phasor diagram, drawn on the overlay — its arrows and their names. Every figure is the readout's table in the top
 * left corner (`phasorPlate`), whose size the host hands in as `reserved`: the diagram stands on the graticule's centre,
 * its arrows never longer than the room the table leaves, and a name at a tip is put where it covers neither another
 * name nor the table.
 */
function paintPhasorMarks(context: CanvasRenderingContext2D, size: Size, theme: VisualTheme, readout: AnalysisReadout, colors: Rgb[], reserved: Size) {
  const { width, height } = size;
  context.font = theme.labelFont;
  const diagram = readout.diagram;
  if (!diagram) {
    context.fillStyle = theme.label;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Phasors need a periodic first channel and at least one of its periods in the memory", width / 2, height / 2);
    return;
  }
  const scales = phasorScales(diagram);
  const lineHeight = 15;
  const table = { left: 0, top: 0, right: reserved.width > 0 ? 8 + reserved.width : 0, bottom: reserved.height > 0 ? 8 + reserved.height : 0 };

  // The graticule's centre; a division is its square one, shrunk if three and a half of them would reach the table.
  const centreX = width / 2;
  const centreY = height / 2;
  const division = Math.min(height / VERTICAL_DIVISIONS, (centreX - table.right - 24) / 3.5);
  if (!(division > 4)) {
    context.fillStyle = theme.label;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Too little room for the phasors — Expand the screen (E)", width / 2, height / 2);
    return;
  }

  // The axes through the centre.
  context.strokeStyle = theme.label;
  context.globalAlpha = 0.35;
  context.beginPath();
  context.moveTo(centreY > table.bottom ? 0 : table.right + 8, Math.round(centreY) + 0.5);
  context.lineTo(width, Math.round(centreY) + 0.5);
  context.moveTo(Math.round(centreX) + 0.5, 0);
  context.lineTo(Math.round(centreX) + 0.5, height);
  context.stroke();
  context.globalAlpha = 1;

  // The arrows, the longest of each unit three and a half divisions.
  const tips = diagram.phasors.map((phasor) => {
    const length = (phasor.amplitude / scales[phasor.unit]) * division;
    const x = centreX + length * Math.cos(phasor.angle);
    const y = centreY - length * Math.sin(phasor.angle);
    const color = css(colors[phasor.color]);
    const head = Math.min(9, length * 0.3);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(centreX, centreY);
    context.lineTo(x, y);
    context.stroke();
    if (head > 1) {
      const back = Math.atan2(centreY - y, centreX - x);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + head * Math.cos(back + 0.42), y + head * Math.sin(back + 0.42));
      context.lineTo(x + head * Math.cos(back - 0.42), y + head * Math.sin(back - 0.42));
      context.closePath();
      context.fill();
    }
    return { phasor, x, y, color };
  });
  context.lineWidth = 1;

  // The names at the tips: the first place round the tip, starting straight out along the arrow, that is clear.
  const taken: { left: number; top: number; right: number; bottom: number }[] = [table];
  context.textAlign = "left";
  context.textBaseline = "top";
  for (const tip of tips) {
    const textWidth = context.measureText(tip.phasor.id).width;
    const outward = Math.atan2(tip.y - centreY, tip.x - centreX);
    let placed = null as null | { left: number; top: number; right: number; bottom: number };
    for (let attempt = 0; attempt < 16 && !placed; attempt++) {
      const turn = (attempt % 2 === 0 ? 1 : -1) * Math.ceil(attempt / 2) * (Math.PI / 8);
      const reach = 10 + (attempt >= 8 ? 10 : 0);
      const anchorX = tip.x + reach * Math.cos(outward + turn);
      const anchorY = tip.y + reach * Math.sin(outward + turn);
      const left = Math.cos(outward + turn) >= 0 ? anchorX : anchorX - textWidth;
      const top = anchorY - lineHeight / 2;
      const box = { left, top, right: left + textWidth, bottom: top + lineHeight };
      const inside = box.left >= 2 && box.right <= width - 2 && box.top >= 2 && box.bottom <= height - 2;
      if (inside && !taken.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) {
        placed = box;
      }
    }
    if (placed) {
      taken.push(placed);
      context.fillStyle = tip.color;
      context.fillText(tip.phasor.id, placed.left, placed.top + 1);
    }
  }
}

/** The glow a phosphor screen gives a trace: the same path, wide and faint, drawn under it. */
function phosphorGlow(trace: SegmentBatch): SegmentBatch {
  const colors = Float32Array.from(trace.colors);
  for (let index = 3; index < colors.length; index += 4) {
    colors[index] = PHOSPHOR_GLOW_ALPHA;
  }
  return { kind: "segments", positions: trace.positions, colors, width: PHOSPHOR_GLOW_WIDTH };
}

const PHOSPHOR_GLOW_ALPHA = 0.22;
const PHOSPHOR_GLOW_WIDTH = 6;

/** The instrument's own marks over the traces: each channel's zero, the trigger's level and moment, cursors, times. */
export function paintScreenMarks(context: CanvasRenderingContext2D, size: Size, theme: VisualTheme, settings: ScopeSettings, view: Window, colors: Rgb[], waiting: string | null, recordStart: number, head: number,
  readout?: AnalysisReadout,
  /** The room the host's readout table takes in the top left corner, which a phasor diagram keeps clear. */
  reserved: Size = { width: 0, height: 0 }) {
  const { width, height } = size;
  const middle = height / 2;
  const divisionHeight = height / VERTICAL_DIVISIONS;
  context.font = theme.labelFont;
  if (waiting) {
    context.fillStyle = theme.label;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(waiting, width / 2, middle - 28);
    return;
  }
  if (settings.display === "xy") {
    paintAxes(context, width, height, settings, view, colors, theme);
    return;
  }
  if (settings.display === "fft" && readout) {
    paintSpectrumMarks(context, size, theme, settings, readout, colors);
    return;
  }
  if (settings.display === "phasors" && readout) {
    paintPhasorMarks(context, size, theme, readout, colors, reserved);
    return;
  }
  for (const channel of settings.channels) {
    if (!channelDrawn(channel)) {
      continue;
    }
    const zero = Math.max(6, Math.min(height - 6, middle - channel.position * divisionHeight));
    context.fillStyle = css(colors[channel.color]);
    context.beginPath();
    context.moveTo(0, zero - 5);
    context.lineTo(8, zero);
    context.lineTo(0, zero + 5);
    context.fill();
  }
  if (settings.math?.enabled) {
    // The math channel's zero, marked like a channel's and named: «M».
    const zero = Math.max(6, Math.min(height - 6, middle - settings.math.position * divisionHeight));
    context.fillStyle = css(colors[settings.math.color]);
    context.beginPath();
    context.moveTo(0, zero - 5);
    context.lineTo(8, zero);
    context.lineTo(0, zero + 5);
    context.fill();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText("M", 11, zero);
  }
  const source = settings.channels.find((channel) => channel.id === settings.trigger.source);
  if (source?.enabled && settings.trigger.mode !== "free") {
    const level = middle - (settings.trigger.level / source.voltsPerDivision + source.position) * divisionHeight;
    // The level the trigger waits for, across the whole screen as a faint dashed line in its channel's colour, with
    // its marker on the right edge — dragged to move it — and what it is: «T ↑ 2.5 V».
    context.strokeStyle = css(colors[source.color]);
    context.globalAlpha = 0.35;
    context.setLineDash([2, 4]);
    context.beginPath();
    context.moveTo(0, Math.round(level) + 0.5);
    context.lineTo(width - 8, Math.round(level) + 0.5);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
    context.fillStyle = css(colors[source.color]);
    context.beginPath();
    context.moveTo(width, level - 5);
    context.lineTo(width - 8, level);
    context.lineTo(width, level + 5);
    context.fill();
    context.textAlign = "right";
    context.textBaseline = level < 16 ? "top" : "bottom";
    context.fillText(`T ${TRIGGER_EDGE_MARKS[settings.trigger.edge]} ${formatQuantity(settings.trigger.level, channelUnit(source))}`, width - 12, level + (level < 16 ? 4 : -4));
  }
  if (view.triggered !== null) {
    const x = ((view.triggered - view.start) / view.span) * width;
    context.fillStyle = theme.label;
    context.beginPath();
    context.moveTo(x - 5, 0);
    context.lineTo(x + 5, 0);
    context.lineTo(x, 7);
    context.fill();
    // The moment the trigger fired, named: «T» — times on the cursors are counted from it.
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText("T", x + 7, 0);
  }
  // Where the memory begins and where the signal is being written now, as dotted lines: a trace that starts at the
  // first was never measured before it, and the second is the moment the screen plays — the writing head.
  // Each says what it is at its foot: an unnamed dotted line was a mark nobody could read.
  context.strokeStyle = theme.label;
  context.lineWidth = 1;
  context.setLineDash([2, 3]);
  for (const [time, name] of [[recordStart, "memory starts"], [head, "now"]] as const) {
    if (time > view.start && time < view.start + view.span) {
      const x = Math.round(((time - view.start) / view.span) * width) + 0.5;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
      context.fillStyle = theme.label;
      // At the top edge: the bottom corners hold the window's times, and a name there was written over one.
      context.textAlign = x > width - 80 ? "right" : "left";
      context.textBaseline = "top";
      context.fillText(name, x + (x > width - 80 ? -4 : 4), 4);
    }
  }
  context.setLineDash([]);
  if (settings.cursors.enabled) {
    paintCursors(context, size, theme, settings);
  }
  context.fillStyle = theme.label;
  context.textBaseline = "bottom";
  context.textAlign = "left";
  // As many digits as tell a tenth of the screen apart: three wrote 52.4 s at both ends of a 2 ms screen.
  const digits = (time: number) => Math.min(10, Math.max(3, Math.ceil(Math.log10(Math.abs(time) / (view.span / 10) + 1)) + 1));
  context.fillText(formatQuantity(view.start, "s", digits(view.start)), 6, height - 5);
  context.textAlign = "right";
  context.fillText(formatQuantity(view.start + view.span, "s", digits(view.start + view.span)), width - 6, height - 5);
}

/** An XY screen's marks: which channel is each axis and its scale, and how much time the figure holds. */
function paintAxes(context: CanvasRenderingContext2D, width: number, height: number, settings: ScopeSettings, view: Window, colors: Rgb[], theme: VisualTheme) {
  const [across, up] = settings.channels.filter((channel) => channel.enabled);
  context.textAlign = "left";
  if (up) {
    context.fillStyle = css(colors[up.color]);
    context.textBaseline = "top";
    context.fillText(`Y ${up.id} · ${formatQuantity(up.voltsPerDivision, channelUnit(up))}/div`, 6, 6);
  }
  context.textBaseline = "bottom";
  if (across) {
    context.fillStyle = css(colors[across.color]);
    context.fillText(`X ${across.id} · ${formatQuantity(across.voltsPerDivision, channelUnit(across))}/div`, 6, height - 5);
  }
  if (!across || !up) {
    context.fillStyle = theme.label;
    context.fillText("XY needs two channels on", 6, height - 22);
  }
  context.fillStyle = theme.label;
  context.textAlign = "right";
  context.fillText(`${formatQuantity(view.span, "s")} of signal`, width - 6, height - 5);
}

/**
 * The cursors' lines, A and B, dashed in the accent. What each marks — on the time axis the moment and every channel's
 * reading there, on the volts axis the active channel's level — is its tag, a readout table of its own beside the line
 * (`cursorPlates`, drawn by the host like the screen's corner table). The lines are grabbed and dragged ({@link cursorAt}).
 */
function paintCursors(context: CanvasRenderingContext2D, size: Size, theme: VisualTheme, settings: ScopeSettings) {
  const { width, height } = size;
  const volts = settings.cursors.axis === "volts";
  context.lineWidth = 1;
  context.strokeStyle = css(theme.accent);
  context.setLineDash([5, 3]);
  for (const fraction of [settings.cursors.first, settings.cursors.second]) {
    context.beginPath();
    if (volts) {
      const y = Math.round(fraction * height) + 0.5;
      context.moveTo(0, y);
      context.lineTo(width, y);
    } else {
      const x = Math.round(fraction * width) + 0.5;
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    context.stroke();
  }
  context.setLineDash([]);
}

/** Which cursor a pointer at this share across (or down) the screen grabs, within `reach` of the screen: none if neither. */
export function cursorAt(settings: ScopeSettings, fraction: number, reach: number): "first" | "second" | null {
  if (!settings.cursors.enabled) {
    return null;
  }
  const first = Math.abs(fraction - settings.cursors.first);
  const second = Math.abs(fraction - settings.cursors.second);
  if (Math.min(first, second) > reach) {
    return null;
  }
  return first <= second ? "first" : "second";
}

/** The edge a trigger waits for, as a mark. */
const TRIGGER_EDGE_MARKS: Record<ScopeSettings["trigger"]["edge"], string> = { rising: "↑", falling: "↓", either: "↕" };

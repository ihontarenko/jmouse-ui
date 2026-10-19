import { channelUnit, VERTICAL_DIVISIONS, type ChannelId, type ScopeSettings, type Window } from "../oscilloscope";
import { formatQuantity, ladderAtLeast } from "../quantities";
import { mathUnit, mathUnitsOf } from "./mathChannel";
import type { PhasorDiagram } from "./phasors";
import { DEFAULT_SPECTRUM_RANGE, spectrumPeak } from "./spectrum";
import type { AnalysisReadout } from "./screenAnalysis";

/*
 * The screen's readout: ONE table in the screen's top left corner for every display — each trace's scale and readings
 * against time, the peaks of a spectrum, the arrows of a phasor diagram —, so the eye looks in one place whatever the
 * screen shows. This is its content only; the host draws it (in React: `ScreenReadout`), and the screen leaves its room.
 */

/**
 * What a cell is, which decides how it is drawn: a trace's `name` (its colour, a way to make it active), a `setting` the
 * reader chose (a scale, a time base — it lights up for a moment when it changes), a `reading` measured off the signal
 * (numbers that move, kept in place by fixed columns), or a `note`.
 */
export type ReadoutTone = "name" | "setting" | "reading" | "note";

export interface ReadoutCell {
  text: string;
  tone: ReadoutTone;
  /** A figure right-aligned in its column, so the digits of a changing number keep their place. */
  numeric?: boolean;
  /** The full figure or what it means, for a pointer resting on it. */
  title?: string;
}

export interface ReadoutRow {
  key: string;
  /** The probe colour (1 … 10) of the trace the row describes. */
  color?: number;
  /** The channel the row is, when choosing it makes it the active trace. */
  channel?: ChannelId;
  cells: ReadoutCell[];
}

export interface ReadoutPlate {
  /** What the table lists, when it is not plain from its rows (Peaks, a phasor diagram's frequency). */
  heading?: string;
  rows: ReadoutRow[];
  /** One line under the rows: the time base, the trigger, the memory, a scale. */
  notes: ReadoutCell[];
}

/** The unit a spectrum's levels are in: dBV for volts, dBA for amperes, dB of anything else. */
export function decibelUnit(unit: string): string {
  return unit === "V" ? "dBV" : unit === "A" ? "dBA" : `dB(${unit})`;
}

/**
 * What a division of the phasor diagram holds, unit by unit — volts and amperes cannot share a ruler —: the longest arrow
 * of each unit three and a half divisions, on the 1–2–5 ladder.
 */
export function phasorScales(diagram: PhasorDiagram): Record<string, number> {
  const scales: Record<string, number> = {};
  for (const phasor of diagram.phasors) {
    scales[phasor.unit] = Math.max(scales[phasor.unit] ?? 1e-12, phasor.amplitude);
  }
  return Object.fromEntries(Object.entries(scales).map(([unit, longest]) => [unit, ladderAtLeast(longest / 3.5)]));
}

/** The unit of a trace by its id — a channel's own, or the math channel's from what it combines. */
function unitOfTrace(settings: ScopeSettings, id: string): string {
  return id === "M" && settings.math ? mathUnit(settings.math, mathUnitsOf(settings.math, settings))
    : channelUnit(settings.channels.find((channel) => channel.id === id) ?? settings.channels[0]);
}

/**
 * A spectrum's table: each trace's strongest component — the frequency and level a spectrum analyser's marker reads —,
 * and whether it stands above or below the screen; under them the window, the resolution and the scale.
 */
export function spectrumPlate(settings: ScopeSettings, readout: AnalysisReadout): ReadoutPlate | null {
  const { axis, spectra } = readout.spectra;
  if (!axis) {
    return null;
  }
  const range = settings.spectrum ?? DEFAULT_SPECTRUM_RANGE;
  const bottom = range.top - range.decibelsPerDivision * 8;
  const rows: ReadoutRow[] = [];
  for (const { channel, spectrum } of spectra) {
    if (!spectrum) {
      continue;
    }
    const peak = spectrumPeak(spectrum);
    const outside = peak.level > range.top ? "↑ above" : peak.level < bottom ? "↓ below" : "";
    rows.push({
      key: channel.id, color: channel.color, channel: channel.id === "M" ? undefined : channel.id as ChannelId,
      cells: [
        { text: channel.id, tone: "name" },
        { text: formatQuantity(peak.frequency, "Hz"), tone: "reading", numeric: true },
        { text: `${peak.level.toFixed(1)} ${decibelUnit(unitOfTrace(settings, channel.id))}`, tone: "reading", numeric: true },
        { text: outside, tone: "note" },
      ],
    });
  }
  const resolution = spectra.find((entry) => entry.spectrum)?.spectrum?.resolution ?? axis.lowest;
  return {
    heading: "Peaks",
    rows,
    notes: [
      { text: "Hann", tone: "note" },
      { text: `resolution ${formatQuantity(resolution, "Hz")}`, tone: "note" },
      { text: `${range.decibelsPerDivision} dB/div`, tone: "setting" },
      { text: `top ${range.top} dB`, tone: "setting" },
    ],
  };
}

/** A phasor diagram's table: its frequency, then each arrow's amplitude and angle; under them the scale of a division. */
export function phasorPlate(readout: AnalysisReadout): ReadoutPlate | null {
  const diagram = readout.diagram;
  if (!diagram) {
    return null;
  }
  const scales = phasorScales(diagram);
  return {
    heading: `${formatQuantity(diagram.frequency, "Hz")} · ${diagram.periods} period${diagram.periods === 1 ? "" : "s"}`,
    rows: diagram.phasors.map((phasor) => {
      const degrees = (phasor.angle * 180) / Math.PI;
      return {
        key: phasor.id, color: phasor.color,
        cells: [
          { text: phasor.id, tone: "name" },
          { text: formatQuantity(phasor.amplitude, phasor.unit), tone: "reading", numeric: true },
          { text: `∠ ${degrees >= 0 ? "+" : "−"}${Math.abs(degrees).toFixed(1)}°`, tone: "reading", numeric: true },
        ],
      };
    }),
    notes: [
      ...Object.entries(scales).map(([unit, scale]): ReadoutCell => ({ text: `${formatQuantity(scale, unit)}/div`, tone: "setting" })),
      { text: `against ${diagram.phasors[0]?.id ?? ""}`, tone: "note" },
    ],
  };
}

/** The active channel's level at a share down the screen: its volts per division and position read back. */
export function cursorVolts(fraction: number, channel: ScopeSettings["channels"][number]): number {
  return ((0.5 - fraction) * VERTICAL_DIVISIONS - channel.position) * channel.voltsPerDivision;
}

/** A cursor's tag: which cursor, along which axis, at what share of the screen, and the table it carries. */
export interface CursorPlate {
  name: "A" | "B";
  axis: "time" | "volts";
  /** Across the screen for a time cursor, down it for a volts cursor, 0 … 1. */
  fraction: number;
  plate: ReadoutPlate;
}

/**
 * The cursors' tags, as a bench oscilloscope writes them beside its lines: a time cursor's moment (from the trigger)
 * and every channel's reading there; a volts cursor's level on the active channel. Empty while the cursors are off.
 */
export function cursorPlates(settings: ScopeSettings, view: Window,
  readingAt?: (channel: ScopeSettings["channels"][number]["id"], time: number) => number): CursorPlate[] {
  if (!settings.cursors.enabled) {
    return [];
  }
  const volts = settings.cursors.axis === "volts";
  const active = settings.channels.find((channel) => channel.id === settings.active && channel.enabled);
  return ([["A", settings.cursors.first], ["B", settings.cursors.second]] as const).map(([name, fraction]): CursorPlate => {
    if (volts) {
      return {
        name, axis: "volts", fraction,
        plate: { rows: active ? [{ key: name, color: active.color, cells: [{ text: name, tone: "name" },
          { text: formatQuantity(cursorVolts(fraction, active), channelUnit(active)), tone: "reading", numeric: true }] }] : [], notes: [] },
      };
    }
    const time = view.start + fraction * view.span;
    const rows: ReadoutRow[] = [{ key: name, cells: [{ text: name, tone: "name" }, { text: formatQuantity(time - (view.triggered ?? view.start), "s"), tone: "reading", numeric: true }] }];
    for (const channel of settings.channels.filter((candidate) => candidate.enabled)) {
      const reading = readingAt?.(channel.id, time);
      if (reading !== undefined && Number.isFinite(reading)) {
        rows.push({ key: channel.id, color: channel.color, cells: [{ text: channel.id, tone: "name" },
          { text: formatQuantity(reading, channelUnit(channel)), tone: "reading", numeric: true }] });
      }
    }
    return { name, axis: "time", fraction, plate: { rows, notes: [] } };
  });
}

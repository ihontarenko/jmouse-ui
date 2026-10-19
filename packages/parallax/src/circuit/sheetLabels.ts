/*
 * What the texts beside each part on a sheet say: its name, its value, and — while the circuit runs — its readings
 * block (what it takes, the figures its component displays, the meters on it). Every part carried every text, and a
 * sheet of a dozen parts was a wall of figures; the reader now chooses, and a part's readings come in two depths.
 */

/** How much of a part's readings block the sheet shows: none, its one most telling line, or every line. */
export type ReadingsDetail = "off" | "brief" | "full";

export interface SheetLabels {
  /** Each part's name: R1, D1. */
  names: boolean;
  /** Each part's value as written: 10 kΩ, 1N4148. */
  values: boolean;
  readings: ReadingsDetail;
}

export const DEFAULT_SHEET_LABELS: SheetLabels = { names: true, values: true, readings: "brief" };

/** One line of a part's readings block: what it says, and whether it is a meter's figure rather than the part's own. */
export interface ReadingLine {
  key: string;
  text: string;
  meter: boolean;
  /** A figure that is a share of a limit — an `overvoltage` of 95 % —: how far toward it, in percent. */
  stress?: number;
}

/** A stress figure at least this near its limit is the line a brief block shows, over what the part takes. */
const TELLING_STRESS = 80;

/**
 * The lines a readings block shows at a depth. Brief keeps the meters on the part — the reader put them there — and the
 * one line of its own that tells most: a figure nearest its limit once it is near, else the first, what it takes;
 * the rest are counted on that line, «+2», for the reader to open.
 */
export function shownReadingLines(lines: readonly ReadingLine[], detail: ReadingsDetail): ReadingLine[] {
  if (detail === "off") {
    return [];
  }
  if (detail === "full") {
    return [...lines];
  }
  const own = lines.filter((line) => !line.meter);
  const meters = lines.filter((line) => line.meter);
  if (own.length <= 1) {
    return [...own, ...meters];
  }
  const nearest = own.reduce<ReadingLine | null>((best, line) =>
    line.stress !== undefined && line.stress >= TELLING_STRESS && (!best || line.stress > (best.stress ?? 0)) ? line : best, null);
  const telling = nearest ?? own[0];
  return [{ ...telling, text: `${telling.text}  +${own.length - 1}` }, ...meters];
}

/** How many lines the sheet makes room for beside a part: its block at the depth chosen, or every line when opened. */
export function reservedReadingLines(lineCount: number, meterCount: number, detail: ReadingsDetail, opened: boolean): number {
  if (detail === "off" && !opened) {
    return 0;
  }
  if (detail === "full" || opened) {
    return lineCount;
  }
  return Math.min(1, lineCount - meterCount) + meterCount;
}

import { formatQuantity } from "../quantities";
import type { StageLabel, TimeSeriesDataset } from "../visual";

/*
 * Reading a frequency response: which nodes to show, and the figures an engineer looks for on a Bode plot written at
 * the curve — the peak and the −3 dB edges of the band. One rule for every circuit, no branch on what kind of filter it
 * is: the edges are where the gain falls 3 dB below its own maximum, which is a low-pass's corner, a high-pass's corner,
 * a band-pass's two edges and a resonance's width alike.
 */

/** A frequency response column's node: `out gain` → `out`. */
export function responseNode(column: string): string {
  return column.replace(/ (gain|phase)$/, "");
}

/** The columns of the given nodes only, in their order; the whole response when none of them is in it. */
export function responseOfNodes(dataset: TimeSeriesDataset, nodes: readonly string[]): TimeSeriesDataset {
  const kept = dataset.columns.flatMap((column, index) => (nodes.includes(responseNode(column)) ? [index] : []));
  if (!kept.length) {
    return dataset;
  }
  return {
    ...dataset,
    columns: kept.map((index) => dataset.columns[index]),
    values: kept.map((index) => dataset.values[index]),
    units: dataset.units ? kept.map((index) => dataset.units![index]) : undefined,
  };
}

/** A gain as it is read: to a hundredth of a decibel, so a summit at unity is «0 dB», not «−4.77e−12 dB». */
function decibels(gain: number): number {
  return Math.round(gain * 100) / 100 || 0;
}

/** How far above both ends a maximum has to stand to be called a peak, dB. */
const PEAK_MARGIN = 1;
const EDGE = 3;

/**
 * The peak and the −3 dB edges of every gain column, as labels at their points — x in decades, as the series is drawn
 * —, each in its column's colour (`colorOf` its index among the series' columns).
 */
export function responseMarks(series: TimeSeriesDataset, colorOf: (column: number) => string): StageLabel[] {
  const frequencies = series.axisValues;
  const units = series.units ?? series.columns.map(() => "");
  const labels: StageLabel[] = [];
  series.values.forEach((gains, column) => {
    if (units[column] !== "dB" || gains.length < 3) {
      return;
    }
    let top = 0;
    for (let index = 1; index < gains.length; index++) {
      if (gains[index] > gains[top]) {
        top = index;
      }
    }
    const color = colorOf(column);
    const name = responseNode(series.columns[column]);
    const ends = Math.max(gains[0], gains[gains.length - 1]);
    if (top > 0 && top < gains.length - 1 && gains[top] - ends >= PEAK_MARGIN) {
      labels.push({ id: `${name}-peak`, color, at: [Math.log10(frequencies[top]), gains[top]],
        text: `${name}: peak ${formatQuantity(decibels(gains[top]), "dB")} at ${formatQuantity(frequencies[top], "Hz")}` });
    }
    const level = gains[top] - EDGE;
    for (const direction of [-1, 1]) {
      for (let index = top; index > 0 && index < gains.length - 1; index += direction) {
        const next = index + direction;
        if (gains[next] <= level) {
          const share = (gains[index] - level) / (gains[index] - gains[next] || 1);
          const decade = Math.log10(frequencies[index]) + (Math.log10(frequencies[next]) - Math.log10(frequencies[index])) * share;
          labels.push({ id: `${name}-edge-${direction}`, color, at: [decade, level],
            text: `${name}: −3 dB at ${formatQuantity(10 ** decade, "Hz")}` });
          break;
        }
      }
    }
  });
  return labels;
}

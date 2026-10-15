import type { Dataset } from "./datasets";

/**
 * A curve drawn only up to a value of its first coordinate — a trace that follows a clock (`until t` on a graph). The
 * points past it are dropped and the last segment is cut where it crosses, so the trace ends exactly at the value.
 * Anything that is not a plane polyline is returned as it is.
 */
export function revealUntil(dataset: Dataset, until: number): Dataset {
  if (dataset.format !== "POLYLINES" || dataset.dimension !== 2) {
    return dataset;
  }
  const lines = dataset.lines.flatMap((line) => {
    const points: number[] = [];
    for (let index = 0; index + 1 < line.points.length; index += 2) {
      const x = line.points[index];
      const y = line.points[index + 1];
      if (x <= until) {
        points.push(x, y);
        continue;
      }
      if (index >= 2) {
        const previousX = line.points[index - 2];
        const previousY = line.points[index - 1];
        if (previousX < until) {
          const share = (until - previousX) / (x - previousX);
          points.push(until, previousY + (y - previousY) * share);
        }
      }
      break;
    }
    return points.length >= 4 ? [{ ...line, points, scalars: null, closed: false }] : [];
  });
  return { ...dataset, lines };
}

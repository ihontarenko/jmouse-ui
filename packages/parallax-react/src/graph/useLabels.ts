import { useEffect, useMemo } from "react";
import type { Interpretation, ParallaxOwner } from "@jmouse/parallax";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { useAsync } from "../support/useAsync";
import {
  type LabelSource, type LabelValue, labelValueFrames, labelValueNow, parameterValuesOf, withLibrary,
} from "@jmouse/parallax/graph";

/**
 * The values of a label's expressions: read by the backend as any line, computed now, and — while the clock plays a
 * value one of them reads — at every frame of the clock, ahead of time.
 */
export function useLabelValues(expressions: readonly string[], library: string, values: Record<string, number>,
  animated: { parameter: string; grid: readonly number[] } | null, owner: ParallaxOwner | undefined): LabelValue[] {
  const transport = useParallaxTransport();
  const sources = expressions.map((expression) => withLibrary(library, expression));
  const sourcesKey = JSON.stringify(sources);
  const readings = useAsync((signal) => Promise.all(sources.map((source) => transport.formula.interpret(source, signal))), [transport, sourcesKey], sources.length > 0);
  const interpretations: (Interpretation | null)[] = readings.data ?? [];

  const nowKey = JSON.stringify(interpretations.map((interpretation) => parameterValuesOf(interpretation, values)));
  const now = useAsync((signal) => Promise.all(interpretations.map((interpretation) =>
    labelValueNow(transport, interpretation, values, owner, signal))), [readings.data, nowKey], interpretations.length > 0);

  const framesKey = animated ? JSON.stringify([animated.parameter, animated.grid.length, animated.grid[0], animated.grid.at(-1), nowKey]) : null;
  const frames = useAsync((signal) => Promise.all(interpretations.map((interpretation) =>
    labelValueFrames(transport, interpretation, values, animated, owner, signal))), [readings.data, framesKey], animated !== null && interpretations.length > 0);

  return useMemo(() => expressions.map((_, index) => ({
    now: now.data?.[index] ?? null,
    frames: animated ? frames.data?.[index] ?? null : null,
  })), [now.data, frames.data, animated, expressions.length]);
}

/** Tells the page a label's source whenever what it shows could change; tells it null when the line goes. */
export function useReportLabel(label: LabelSource | null, onLabel: (id: string, label: LabelSource | null) => void, id: string) {
  const key = label ? JSON.stringify(label) : null;
  useEffect(() => {
    onLabel(id, label);
  }, [key]);
  useEffect(() => () => onLabel(id, null), []);
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type Dataset, partition, type TimeSeriesDataset } from "@jmouse/parallax/visual";
import { HORIZONTAL_DIVISIONS, SampleMemory, windowOf, type ScopeChannel } from "@jmouse/parallax/oscilloscope";
import { ladderAtLeast } from "@jmouse/parallax/quantities";
import { useComputation } from "../viewers/useComputation";
import type { Refinement } from "../viewers/useDeeperZoom";
import { OscilloscopeScreen, useOscilloscope } from "./Oscilloscope";

/** Fewer samples than this across the screen, and the stretch in sight is computed again, finely. */
const SAMPLES_ON_SCREEN = 400;
/** How many samples a computed stretch has: two screens of it, five per pixel of a wide screen. */
const DETAIL_SAMPLES = 2000;

function transientOf(dataset: Dataset | null): TimeSeriesDataset | null {
  return dataset ? (partition(dataset).drawable.find(([, part]) => part.format === "TIME_SERIES")?.[1] as TimeSeriesDataset | undefined) ?? null : null;
}

/** Each node's column: the node's own name with the unit V (`out` [V]), or `V(out)` in results stored before that. */
function nodeColumns(series: TimeSeriesDataset | null): Map<string, number> {
  const found = new Map<string, number>();
  series?.columns.forEach((name, index) => {
    const written = /^V\(([^,)]+)\)$/.exec(name)?.[1];
    const node = written ?? (series.units?.[index] === "V" ? name : null);
    if (node && node !== "0") {
      found.set(node, index);
    }
  });
  return found;
}

/**
 * What a series puts into the memory between two times: each enabled channel's reading — its node against its
 * reference — and, against ground, the peaks between the samples, as the live scope's peak detection keeps them.
 */
function stretchOf(series: TimeSeriesDataset, channels: readonly ScopeChannel[], from: number, to: number) {
  const columns = nodeColumns(series);
  const indices = series.axisValues.flatMap((time, index) => (time >= from && time < to ? [index] : []));
  const reading = (node: string, index: number) => node === "ground" ? 0 : (series.values[columns.get(node) ?? -1]?.[index] ?? Number.NaN);
  const readings = Object.fromEntries(channels.map((channel) =>
    [channel.id, indices.map((index) => reading(channel.node, index) - reading(channel.reference, index))]));
  // The peaks of a difference are not the difference of two nodes' peaks: only a channel against ground has them.
  const peaks = Object.fromEntries(channels.flatMap((channel) => {
    const band = channel.reference === "ground" ? series.peaks?.[series.columns[columns.get(channel.node) ?? -1]] : undefined;
    return band ? [[channel.id, { lows: indices.map((index) => band.lows[index]), highs: indices.map((index) => band.highs[index]) }]] : [];
  }));
  const interval = series.axisValues.length > 1 ? series.axisValues[1] - series.axisValues[0] : undefined;
  return { time: indices.map((index) => series.axisValues[index]), readings, peaks, interval };
}

/**
 * A computed transient on the same oscilloscope screen the live bench uses: the whole response is the memory, each
 * channel is its probe's node against its clip's, and the reader zooms and scrolls through it as through a capture.
 *
 * <p>With `refinement` — what the response was computed from —, a zoom past the response's own samples computes the
 * stretch in sight again, sampled finely, and the screen draws it in their place: a switch's edge a few nanoseconds
 * long inside a run of milliseconds is drawn as it happens, not as a line between two samples a microsecond apart.</p>
 */
export function ComputedOscilloscope({ dataset, diagram, refinement }: {
  dataset: Dataset | null;
  diagram?: (attachProbe: (node: string) => void) => ReactNode;
  refinement?: Refinement;
}) {
  const series = useMemo(() => transientOf(dataset), [dataset]);
  const columns = useMemo(() => nodeColumns(series), [series]);
  const nodes = useMemo(() => [...columns.keys()], [columns]);
  const scope = useOscilloscope(nodes);
  const enabled = scope.settings.channels.filter((channel) => channel.enabled);
  const channelsKey = scope.settings.channels.map((channel) => `${channel.id}:${channel.enabled}:${channel.node}:${channel.reference}`).join("|");

  // The response as computed: what the screen looks into, and what decides where it looks.
  const whole = useMemo(() => {
    const time = series?.axisValues ?? [];
    const store = new SampleMemory(Math.max(1, time.length));
    if (series) {
      const all = stretchOf(series, enabled, -Infinity, Infinity);
      store.append(all.time, all.readings, all.peaks);
    }
    return store;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, channelsKey]);

  const stretch = useDetailedStretch(refinement, series, whole, scope);
  // Zoomed back out, the stretch is dropped, whatever its last computation holds.
  const detail = useMemo(() => (stretch.window ? transientOf(stretch.computation.ready?.dataset ?? null) : null), [stretch.window, stretch.computation.ready]);

  // The finely computed stretch in place of the response's own samples there, the rest as it was: one memory, so
  // that scrolling, the trigger and the measurements read it as they read any capture.
  const memory = useMemo(() => {
    if (!series || !detail || detail.axisValues.length < 2) {
      return whole;
    }
    const from = detail.axisValues[0];
    const to = detail.axisValues[detail.axisValues.length - 1];
    const before = stretchOf(series, enabled, -Infinity, from);
    const within = stretchOf(detail, enabled, from, Infinity);
    const after = stretchOf(series, enabled, to + 1e-15, Infinity);
    const store = new SampleMemory(Math.max(1, before.time.length + within.time.length + after.time.length));
    store.append(before.time, before.readings, before.peaks, before.interval);
    store.append(within.time, within.readings, within.peaks, within.interval);
    // Told the response's own interval, the samples after the stretch go on the same acquisition rather than start one.
    store.append(after.time, after.readings, after.peaks, after.interval);
    return store;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, detail, whole, channelsKey]);

  // A new response is shown whole and fitted, once per response and probes — as the live scope fits a fresh
  // acquisition; after that the reader's scales are the reader's. The probes settle on the response's nodes one
  // render after it arrives, so a fit keyed on the response alone measured nothing and fell to the smallest scale.
  const fittedFor = useRef<{ series: TimeSeriesDataset; channels: string } | null>(null);
  useEffect(() => {
    if (!series || whole.length < 2 || (fittedFor.current?.series === series && fittedFor.current.channels === channelsKey)) {
      return;
    }
    if (!scope.settings.channels.some((channel) => channel.enabled && (channel.node === "ground" || columns.has(channel.node)))) {
      return;
    }
    fittedFor.current = { series, channels: channelsKey };
    scope.update({ secondsPerDivision: ladderAtLeast((whole.lastTime() - whole.firstTime()) / HORIZONTAL_DIVISIONS) });
    window.setTimeout(() => scope.fit(whole), 0);
  }, [series, whole, scope, channelsKey, columns]);

  const attach = (node: string) => scope.channel(scope.settings.active, { node: node === "0" ? "ground" : node, enabled: true });
  return (
    <div data-parallax-part="computed-scope" className="parallax-computed-scope">
      {diagram ? <div className="parallax-computed-scope-drawing">{diagram(attach)}</div> : null}
      <div className="parallax-computed-scope-screen">
        <OscilloscopeScreen memory={memory} scope={scope} waiting={series ? null : "Computing the response…"} />
        {stretch.computation.computing ? <p className="parallax-computed-scope-status" role="status">Computing the stretch in sight finely…</p> : null}
      </div>
    </div>
  );
}

/**
 * The stretch the screen shows, computed again when the response has too few samples across it: two screens of it,
 * the one in sight in the middle, so that a scroll within it or a trigger that moves a little costs nothing. Where it
 * is is decided from the response itself, never from the stretch — a window that followed what it computed would
 * chase itself. Zooming back out drops it.
 */
function useDetailedStretch(refinement: Refinement | undefined, series: TimeSeriesDataset | null, whole: SampleMemory,
  scope: ReturnType<typeof useOscilloscope>) {
  const [stretch, setStretch] = useState<[number, number] | null>(null);
  const view = useMemo(() => (whole.length > 1 ? windowOf(whole, scope.settings, scope.back) : null), [whole, scope.settings, scope.back]);
  const interval = series && series.axisValues.length > 1 ? series.axisValues[1] - series.axisValues[0] : 0;
  const end = series?.axisValues[series.axisValues.length - 1] ?? 0;
  // Whether it can be computed again at all: a host builds its refinement anew on every render.
  const refinable = refinement !== undefined;

  useEffect(() => {
    if (!refinable || !view || !(interval > 0) || view.span / interval >= SAMPLES_ON_SCREEN) {
      setStretch(null);
      return;
    }
    const timer = window.setTimeout(() => setStretch((current) => {
      const covered = current && current[0] <= Math.max(0, view.start) && current[1] >= Math.min(end, view.start + view.span)
        && (current[1] - current[0]) / DETAIL_SAMPLES <= view.span / SAMPLES_ON_SCREEN;
      if (covered) {
        return current;
      }
      const from = Math.max(0, view.start - view.span / 2);
      const to = Math.min(end, view.start + view.span * 1.5);
      return to > from ? [from, to] : null;
    }), 250);
    return () => window.clearTimeout(timer);
  }, [refinable, view, interval, end]);

  const computation = useComputation(refinement?.target ?? null, refinement?.representation ?? null, refinement?.values ?? {}, stretch !== null,
    { ...refinement?.settings, samples: DETAIL_SAMPLES, window: stretch });
  return { window: stretch, computation };
}

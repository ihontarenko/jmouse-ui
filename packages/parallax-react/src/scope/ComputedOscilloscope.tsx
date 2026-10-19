import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { type Dataset, partition, type TimeSeriesDataset } from "@jmouse/parallax/visual";
import { HORIZONTAL_DIVISIONS, SampleMemory } from "@jmouse/parallax/oscilloscope";
import { ladderAtLeast } from "@jmouse/parallax/quantities";
import { OscilloscopeScreen, useOscilloscope } from "./Oscilloscope";

function transientOf(dataset: Dataset | null): TimeSeriesDataset | null {
  return dataset ? (partition(dataset).drawable.find(([, part]) => part.format === "TIME_SERIES")?.[1] as TimeSeriesDataset | undefined) ?? null : null;
}

/**
 * A computed transient on the same oscilloscope screen the live bench uses: the whole response is the memory, each
 * channel is its probe's node against its clip's, and the reader zooms and scrolls through it as through a capture.
 */
export function ComputedOscilloscope({ dataset, diagram }: { dataset: Dataset | null; diagram?: (attachProbe: (node: string) => void) => ReactNode }) {
  const series = useMemo(() => transientOf(dataset), [dataset]);
  const columns = useMemo(() => {
    // A node's column is the node's own name with the unit V (`out` [V]); a part's current is its name with A. Results
    // stored before circuits spoke their own language name a node `V(out)`, and are read too. Matching `V(…)` alone, the
    // screen found no node in any response written since, and showed an empty screen with a full memory.
    const found = new Map<string, number>();
    series?.columns.forEach((name, index) => {
      const written = /^V\(([^,)]+)\)$/.exec(name)?.[1];
      const node = written ?? (series.units?.[index] === "V" ? name : null);
      if (node && node !== "0") {
        found.set(node, index);
      }
    });
    return found;
  }, [series]);
  const nodes = useMemo(() => [...columns.keys()], [columns]);
  const scope = useOscilloscope(nodes);
  const channelsKey = scope.settings.channels.map((channel) => `${channel.id}:${channel.enabled}:${channel.node}:${channel.reference}`).join("|");

  const memory = useMemo(() => {
    const time = series?.axisValues ?? [];
    const store = new SampleMemory(Math.max(1, time.length));
    const reading = (node: string, index: number) => node === "ground" ? 0 : (series?.values[columns.get(node) ?? -1]?.[index] ?? Number.NaN);
    const enabled = scope.settings.channels.filter((channel) => channel.enabled);
    const readings = Object.fromEntries(enabled.map((channel) =>
      [channel.id, time.map((_, index) => reading(channel.node, index) - reading(channel.reference, index))]));
    // What a node went through between the samples, as the live scope's peak detection keeps it — only against ground:
    // the peaks of a difference are not the difference of two nodes' peaks.
    const peaks = Object.fromEntries(enabled.flatMap((channel) => {
      const band = channel.reference === "ground" ? series?.peaks?.[series.columns[columns.get(channel.node) ?? -1]] : undefined;
      return band ? [[channel.id, band]] : [];
    }));
    store.append(time, readings, peaks);
    return store;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, columns, channelsKey]);

  // A new response is shown whole and fitted, once per response and probes — as the live scope fits a fresh
  // acquisition; after that the reader's scales are the reader's. The probes settle on the response's nodes one
  // render after it arrives, so a fit keyed on the response alone measured nothing and fell to the smallest scale.
  const fittedFor = useRef<{ series: TimeSeriesDataset; channels: string } | null>(null);
  useEffect(() => {
    if (!series || memory.length < 2 || (fittedFor.current?.series === series && fittedFor.current.channels === channelsKey)) {
      return;
    }
    if (!scope.settings.channels.some((channel) => channel.enabled && (channel.node === "ground" || columns.has(channel.node)))) {
      return;
    }
    fittedFor.current = { series, channels: channelsKey };
    scope.update({ secondsPerDivision: ladderAtLeast((memory.lastTime() - memory.firstTime()) / HORIZONTAL_DIVISIONS) });
    window.setTimeout(() => scope.fit(memory), 0);
  }, [series, memory, scope, channelsKey, columns]);

  const attach = (node: string) => scope.channel(scope.settings.active, { node: node === "0" ? "ground" : node, enabled: true });
  return (
    <div data-parallax-part="computed-scope" className="parallax-computed-scope">
      {diagram ? <div className="parallax-computed-scope-drawing">{diagram(attach)}</div> : null}
      <div className="parallax-computed-scope-screen">
        <OscilloscopeScreen memory={memory} scope={scope} waiting={series ? null : "Computing the response…"} />
      </div>
    </div>
  );
}

import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { useEffect, useMemo } from "react";
import { useAsync } from "../support/useAsync";
import type { Dataset, StageLayer } from "@jmouse/parallax/visual";
import { useComputation } from "../viewers/useComputation";
import { type GraphPaneDocument, PART_CURRENTS, probeSamples, signalDataset } from "@jmouse/parallax/graph";

/** Reports the signal of a circuit pane as a layer of the line, and nothing while it is not computed or not named. */
export function useSignalLayer({ enabled, id, source, pane, clock, values, color, visible, onLayer }: {
  /** Whether the line is a signal at all; a line that is not never touches its layer here. */
  enabled: boolean;
  id: string;
  source: string;
  pane: GraphPaneDocument | null;
  clock: { minimum: number; maximum: number } | null;
  values: Record<string, number>;
  color: string;
  visible: boolean;
  onLayer: (id: string, layer: StageLayer | null) => void;
}): { computing: boolean; problem: string | null } {
  const transport = useParallaxTransport();
  const slug = enabled ? pane?.uses ?? "" : "";
  const detail = useAsync((signal) => transport.catalogue.object(slug, signal), [slug], slug.length > 0);
  const parameters = detail.data?.parameters ?? [];
  const shared = Object.fromEntries(parameters.filter((parameter) => parameter.name in values).map((parameter) => [parameter.name, values[parameter.name]]));
  const computation = useComputation(detail.data ? slug : null, "TRANSIENT_RESPONSE", shared, Boolean(detail.data), PART_CURRENTS);
  const series = computation.ready?.dataset.format === "TIME_SERIES" ? computation.ready.dataset : null;
  const column = source.trim();
  const samples = useMemo(() => (series ? probeSamples(series, column) : null), [series, column]);

  const dataset = useMemo<Dataset | null>(() => (series && samples && pane ? signalDataset(series, samples, pane, clock, column) : null),
    [series, samples, pane, clock?.minimum, clock?.maximum]);

  useEffect(() => {
    if (enabled) {
      onLayer(id, visible && dataset ? { id, color, dataset } : null);
    }
  }, [enabled, dataset, visible, color]);

  const problem = !enabled ? null : !pane ? "names no circuit pane of this graph"
    : series && !samples ? `the circuit reports no ${column}; it reports ${series.columns.join(", ")}` : null;
  return { computing: computation.computing, problem };
}

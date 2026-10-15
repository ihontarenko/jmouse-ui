import { useMemo, useState, type ReactNode } from "react";
import {
  type Computation, isLogicLevels, representationLabel, visualizationSurface,
} from "@jmouse/parallax/computation";
import { responseMarks, responseNode, responseOfNodes } from "@jmouse/parallax/circuit";
import { formatQuantity } from "@jmouse/parallax/quantities";
import type { TimeSeriesDataset } from "@jmouse/parallax/visual";
import { ComputedFrame } from "../viewers/ComputedViewport";
import { DatasetFacts, hasDrawable } from "../viewers/DatasetFacts";
import { ErrorState } from "../support/feedback";
import { Segments } from "../controls/BenchControls";
import { ExpandTool } from "../controls/BenchGrid";
import { LogicTimingView } from "./LogicTimingView";
import { ComputedOscilloscope } from "../scope/ComputedOscilloscope";

/**
 * A computed circuit result, mounted in the emulator, an object page or another host: a transient on the oscilloscope
 * screen, digital timing as a timing diagram, a frequency response as a Bode plot that says what it shows, anything else
 * as a plot. The live transient is the bench's own.
 */
export function EmulatorInstrument({ representation, computation, title, facts = false, diagram, focus }: {
  representation: string;
  computation: Computation;
  title: string;
  /** Who the result belongs to, for a host that labels exports; the instrument itself does not need it. */
  context?: { circuit: string; settings: string };
  facts?: boolean;
  diagram?: (attachProbe?: (node: string) => void) => ReactNode;
  /** The nodes the reader probes: a frequency response shows these first, every node on request. */
  focus?: readonly string[];
}) {
  const dataset = computation.ready?.dataset ?? null;
  const levels = isLogicLevels(dataset);
  const surface = levels ? "plot" : visualizationSurface("CIRCUIT", representation);
  const response = representation === "FREQUENCY_RESPONSE" && dataset?.format === "TIME_SERIES" ? dataset as TimeSeriesDataset : null;
  const [everyNode, setEveryNode] = useState(false);
  const probed = useMemo(() => {
    const nodes = new Set(response?.columns.map(responseNode) ?? []);
    return (focus ?? []).filter((node) => nodes.has(node));
  }, [response, focus]);
  const narrowed = Boolean(response) && probed.length > 0 && !everyNode;
  const shown = useMemo(() => (narrowed && response && computation.ready
    ? { ...computation, ready: { ...computation.ready, dataset: responseOfNodes(response, probed) } } : computation),
  [computation, narrowed, response, probed]);
  if (computation.error) {
    return <>
      {diagram?.()}
      <ErrorState title={levels ? "Digital timing did not settle" : "The circuit did not settle"} description={computation.error.detail} />
    </>;
  }
  return <>
    {surface === "oscilloscope" ? <ComputedOscilloscope dataset={dataset} diagram={diagram} />
      : <>
        {diagram?.()}
        {response ? <ResponseHeading response={response} probed={probed} everyNode={everyNode} onEveryNode={setEveryNode} /> : null}
        {levels ? <LogicTimingView dataset={dataset} />
          // A result with nothing to draw — an operating point — is its numbers alone, never an empty frame above them.
          : dataset && !hasDrawable(dataset) ? null
          : <ComputedFrame computation={shown} title={`${title}, ${representationLabel(representation)}`} variant="scene" view="series" tools={<ExpandTool />}
            annotate={response ? (series) => responseMarks(series, (column) => `var(--parallax-series-${(column % 6) + 1})`) : undefined} />}
      </>}
    {facts && dataset && surface !== "oscilloscope" ? <DatasetFacts dataset={dataset} /> : null}
  </>;
}

/**
 * What a Bode plot shows, said over it: the sweep, what the gain is measured against, which nodes — and the switch
 * between the probed nodes and every node of the circuit.
 */
function ResponseHeading({ response, probed, everyNode, onEveryNode }: {
  response: TimeSeriesDataset;
  probed: readonly string[];
  everyNode: boolean;
  onEveryNode: (everyNode: boolean) => void;
}) {
  const frequencies = response.axisValues;
  const nodes = [...new Set(response.columns.map(responseNode))];
  const shown = probed.length && !everyNode ? probed : nodes;
  return (
    <div data-parallax-part="response-heading" className="parallax-response-heading">
      <p title="How much of the source's sine reaches each node — gain in dB, 0 dB is the source's own level — and how far it lags or leads, phase in degrees, at every frequency of the sweep">
        <strong>Frequency response</strong> · gain and phase against the source, {formatQuantity(frequencies[0], "Hz")} – {formatQuantity(frequencies[frequencies.length - 1], "Hz")} · <span className="parallax-monospace">{shown.join(", ")}</span>
      </p>
      {probed.length ? (
        <Segments label="Which nodes" value={everyNode ? "every" : "probed"} onChange={(choice) => onEveryNode(choice === "every")}
          options={[{ value: "probed", label: "Probed nodes", title: `The nodes the oscilloscope probes: ${probed.join(", ")}` },
            { value: "every", label: `Every node (${nodes.length})`, title: `Every node of the circuit: ${nodes.join(", ")}` }]} />
      ) : null}
    </div>
  );
}

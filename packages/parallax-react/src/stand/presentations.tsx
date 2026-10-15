import { useEffect, type ReactNode } from "react";
import type { ObjectDetail } from "@jmouse/parallax";
import type { Dataset } from "@jmouse/parallax/visual";
import { SymbolPicture } from "../symbols/SymbolDrawing";
import { readSymbolDrawing } from "@jmouse/parallax/schematic";
import { ComputedFrame } from "../viewers/ComputedViewport";
import { drawingOfCircuit, isCircuit, withShownValues } from "@jmouse/parallax/circuit";
import { EmulatorInstrument } from "../circuit/EmulatorInstrument";
import { Schematic } from "../circuit/Schematic";
import { ComponentPreview } from "../symbols/ComponentPreview";
import type { ComputationTarget } from "@jmouse/parallax/computation";
import { useComputation } from "../viewers/useComputation";

export interface PresentationProperties {
  detail: ObjectDetail;
  target: ComputationTarget;
  values: Record<string, number>;
  saved: boolean;
  /** The representation shown; the object's primary one when not given. */
  representation?: string;
  /** Fill a workbench stage rather than stand at 16:10 on a page. */
  fill?: boolean;
  /** Told the dataset the view computed, so the explanation can say what came out and where it is drawn. */
  onDataset?: (dataset: Dataset | null) => void;
}

/**
 * How a page presents an object, by what the backend derived (`explanation.presentation`) — never by its kind. A new
 * presentation is one more entry here, and nowhere else.
 */
const presentations: Record<string, (properties: PresentationProperties) => ReactNode> = {
  dataset: (properties) => <ComputedPresentation {...properties} />,
  instrument: (properties) => <InstrumentPresentation {...properties} />,
  drawing: ({ detail, fill }) => typeof detail.definition.drawing === "string"
    ? <figure data-parallax-part="viewport" className={fill ? "parallax-viewport parallax-viewport-fill parallax-viewport-drawing" : "parallax-viewport parallax-viewport-drawing"} aria-label={`${detail.summary.title} symbol`}>
      <SymbolPicture className="parallax-symbol-drawing" drawing={readSymbolDrawing(detail.definition.drawing) ?? { version: 1, paths: [] }}
        label={`${detail.summary.title} symbol`} showPins margin={24} />
      <figcaption className="parallax-viewport-status"><span>DRAWING</span><span>pins shown</span></figcaption>
    </figure>
    : null,
  part: ({ detail, saved }) => saved ? <div data-parallax-part="panel" className="parallax-panel"><ComponentPreview reference={`${detail.summary.slug}@${detail.definitionRevision}`} /></div> : null,
};

/** The settings the object declares for a representation in its view (`level_set levels 25`, `matrix_analysis steps 50`). */
function declaredSettings(detail: ObjectDetail, shown: string | null | undefined): Record<string, unknown> {
  return detail.representations.find((declared) => declared.kind === shown)?.settings ?? {};
}

export function Presentation(properties: PresentationProperties) {
  const presentation = properties.detail.explanation?.presentation.value ?? "dataset";
  return <>{(presentations[presentation] ?? presentations.dataset)(properties)}</>;
}

/**
 * Computed data, drawn by what it declares: a dataset on a canvas gets its frame, numbers without a canvas are the view
 * themselves — a value is not drawn in an empty frame with a pointer to a panel below it.
 */
function ComputedPresentation({ detail, target, values, representation, fill, onDataset }: PresentationProperties) {
  const shown = representation ?? detail.summary.primaryRepresentation;
  const computation = useComputation(target, shown, values, true, declaredSettings(detail, shown));
  const dataset: Dataset | null = computation.ready?.dataset ?? null;
  useEffect(() => onDataset?.(dataset), [dataset, onDataset]);
  const drawn = dataset === null || dataset.canvas !== "NONE";
  return drawn ? <ComputedFrame computation={computation} title={detail.summary.title} variant={fill ? "fill" : "scene"} latex={detail.summary.formulaLatex} material="surface"
    refinement={shown ? { target, representation: shown, values } : undefined} /> : null;
}

/** A circuit under measurement: the instrument with its schematic, every part labelled with its value. */
function InstrumentPresentation({ detail, target, values, representation, onDataset }: PresentationProperties) {
  const shown = representation ?? detail.summary.primaryRepresentation;
  const computation = useComputation(target, shown, values, true, declaredSettings(detail, shown));
  const dataset: Dataset | null = computation.ready?.dataset ?? null;
  useEffect(() => onDataset?.(dataset), [dataset, onDataset]);
  const circuit = isCircuit(detail.definition) ? detail.definition : null;
  if (!shown) {
    return null;
  }
  return <EmulatorInstrument representation={shown} computation={computation}
    title={detail.summary.title} context={{ circuit: `${detail.summary.slug}@${detail.definitionRevision}`, settings: "{}" }}
    diagram={circuit ? (selectNode) => <Schematic elements={withShownValues(circuit.elements, detail.parameters, values)}
      drawing={drawingOfCircuit(circuit)} onProbeSelect={selectNode} /> : undefined} />;
}

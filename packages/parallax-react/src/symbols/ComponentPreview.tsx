import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { useAsync } from "../support/useAsync";
import { ParallaxLink } from "../providers/ParallaxNavigation";
import type { ComponentModelView } from "@jmouse/parallax";
import { SymbolPicture } from "./SymbolDrawing";
import { readSymbolDrawing, type SymbolDrawingDocument } from "@jmouse/parallax/schematic";
import { pinSide } from "@jmouse/parallax/component";

/**
 * A component as a schematic draws it: its symbol document with each port named by the pin it stands for, or — for
 * a component drawn from its pins (`symbol box`, `symbol triangle`) — the pins on their sides.
 */
export function ComponentPreview({ reference }: { reference: string }) {
  const transport = useParallaxTransport();
  const model = useAsync((signal) => transport.components.model(reference, signal), [reference]);
  if (model.error) {
    return <p className="parallax-diagnostic parallax-danger" role="alert">{model.error.detail}</p>;
  }
  if (!model.data) {
    return <div className="parallax-skeleton" style={{ height: 160 }} aria-label="Loading component symbol" />;
  }
  const definition = model.data;
  const drawing = readSymbolDrawing(definition.symbolDrawing);
  return <figure data-parallax-part="component-preview" className="parallax-component-preview">
    <div data-parallax-part="panel-head" className="parallax-panel-head"><h3>{definition.name}</h3><span className="parallax-technical parallax-push">symbol</span></div>
    {drawing ? <DrawnPreview definition={definition} drawing={drawing} /> : <SidedPreview definition={definition} />}
    <figcaption className="parallax-panel-foot">{definition.units.length ? `Units: ${definition.units.join(", ")}` : `${definition.pins.length} pins`} · {definition.parameters.length} parameters
      {definition.symbolVariants.map((slug, index) => <span key={slug}> · <ParallaxLink to={{ kind: "object", slug }}>{slug}</ParallaxLink>{index === 0 && definition.symbolVariants.length > 1 ? " (default)" : ""}</span>)}
    </figcaption>
  </figure>;
}

function DrawnPreview({ definition, drawing }: { definition: ComponentModelView; drawing: SymbolDrawingDocument }) {
  return <div className="parallax-component-preview-drawing">
    <div data-parallax-part="symbol-hero" className="parallax-symbol-hero"><SymbolPicture className="parallax-symbol-drawing" drawing={drawing} label={`${definition.name} symbol`} showPins namePins={false} margin={8} /></div>
    <table className="parallax-table parallax-dense parallax-pins-table">
      <thead><tr><th scope="col">Pin</th><th scope="col">Port</th></tr></thead>
      <tbody>{(drawing.pins ?? []).map((pin) => <tr key={pin.name}><td>{pin.name}</td><td>{definition.symbolPorts[pin.name] ?? "not connected"}</td></tr>)}</tbody>
    </table>
  </div>;
}

function SidedPreview({ definition }: { definition: ComponentModelView }) {
  const shape = definition.symbol[0]?.toLowerCase() ?? "box";
  const sides = ["left", "right", "top", "bottom"] as const;
  return <div className="parallax-component-preview-body">
    {sides.map((side) => <div key={side} className="parallax-component-preview-pins" data-side={side}>
      {definition.pins.filter((pin) => pinSide(definition, pin.name) === side).map((pin) =>
        <span key={pin.name} title={pin.description ?? undefined}>
          <b className="parallax-monospace">{pin.name}</b><small className="parallax-technical">{Object.entries(pin.numbers).map(([unit, number]) => `${unit ? `${unit}:` : ""}${number}`).join(", ")}</small>
        </span>)}
    </div>)}
    <div className={`parallax-component-preview-core ${shape.startsWith("triangle") ? "parallax-triangle" : ""}`}>{definition.kind}</div>
  </div>;
}

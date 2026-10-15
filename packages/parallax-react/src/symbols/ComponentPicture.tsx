import { boxGeometry, type DrawingItem } from "@jmouse/parallax/circuit";
import type { ComponentModelView } from "@jmouse/parallax";
import { useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import { usePartLibrary } from "../providers/usePartLibrary";
import { PartSymbol } from "./PartSymbol";
import { SymbolPicture } from "./SymbolDrawing";

/** How far past a box's edge its pins' leads reach, and the room around them. */
const LEAD_ROOM = 24;

/**
 * A component as a sheet draws it, by its reference: its default symbol document, or — for one that draws itself from
 * its pins (`symbol box`) — the same box with its pins a part of it is drawn as on a sheet. A shelf, a palette and an
 * inspector show it this way, so a component looks the same wherever it is seen.
 */
export function ComponentPicture({ reference, className, margin = 10, showPins = true, label }: {
  reference: string;
  className?: string;
  margin?: number;
  showPins?: boolean;
  /** What a reader of the picture is told it is; absent, it is decoration beside its name. */
  label?: string;
}) {
  const library = useParallaxPartLibrary();
  usePartLibrary([reference]);
  const model = library.componentModelOf(reference);
  const drawing = model?.symbolReference ? library.symbolDrawingOf(model.symbolReference) : undefined;
  if (drawing) {
    return <SymbolPicture className={className} drawing={drawing} showPins={showPins} namePins={false} margin={margin} label={label} />;
  }
  if (model === undefined) {
    return <span className="parallax-technical" aria-label={label ? `${label}, loading` : undefined}>…</span>;
  }
  if (model === null) {
    return <span className="parallax-technical">not readable</span>;
  }
  const item = boxItemOf(reference, model);
  const box = boxGeometry(library, item);
  const room = LEAD_ROOM + margin;
  return (
    <svg className={`parallax-circuit-diagram-authored parallax-component-picture${className ? ` ${className}` : ""}`}
      viewBox={`${-box.halfWidth - room} ${-box.halfHeight - room} ${2 * (box.halfWidth + room)} ${2 * (box.halfHeight + room)}`}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <g className="parallax-circuit-diagram-element"><PartSymbol item={item} className="parallax-drawing-symbol" /></g>
    </svg>
  );
}

/** A part of the component standing alone, every pin of it a terminal: what its box is drawn from. */
function boxItemOf(reference: string, model: ComponentModelView): DrawingItem {
  const id = model.designator ?? "U";
  return {
    id, type: "MODEL", x: 0, y: 0, rotation: 0,
    element: { id, type: "MODEL", positive: null, negative: null, value: "", component: reference,
      pins: Object.fromEntries(model.pins.map((pin) => [pin.name, ""])), overrides: {} },
  };
}

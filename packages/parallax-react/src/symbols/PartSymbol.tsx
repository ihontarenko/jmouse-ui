import { useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import type { PointerEvent } from "react";
import { boxGeometry, labelPositionOf, partDrawingOf, type DrawingItem } from "@jmouse/parallax/circuit";
import { anchorAway, type LabelPlacement, type Point } from "@jmouse/parallax/schematic";
import { SymbolDrawing } from "./SymbolDrawing";

/**
 * One part on a sheet, in its own coordinates — the caller rotates and mirrors it. A part is drawn from its symbol
 * document; one whose component draws itself from its pins (`symbol box`), or whose data has not arrived, is a box
 * with its pins on their sides. Shared by the schematic editor and the emulator's drawn schematic.
 */
export function PartSymbol({ item, className }: { item: DrawingItem; className: string }) {
  const library = useParallaxPartLibrary();
  const upright = (x: number) => item.mirrored ? { transform: "scale(-1 1)", x: -x } : { transform: undefined, x };
  const pinLabel = (key: string, text: string, x: number, y: number, anchor: "start" | "end" | "middle") => {
    const placed = upright(x);
    return <text key={key} className="parallax-drawing-pin-name" transform={placed.transform} x={placed.x} y={y} textAnchor={anchor}>{text}</text>;
  };
  const drawn = partDrawingOf(library, item);
  if (drawn) {
    return <>
      <SymbolDrawing drawing={drawn.drawing} className={className} turn={{ rotation: item.rotation, mirrored: Boolean(item.mirrored) }} />
      {drawn.drawing.pins?.filter((pin) => pin.label).map((pin) =>
        pinLabel(pin.name, pin.label!, pin.x + (pin.x < 0 ? 6 : -6), pin.y - 6, pin.x < 0 ? "start" : "end"))}
    </>;
  }
  const box = boxGeometry(library, item);
  const name = upright(0);
  return <>
    <rect x={-box.halfWidth} y={-box.halfHeight} width={box.halfWidth * 2} height={box.halfHeight * 2} />
    <text transform={name.transform} textAnchor="middle" y={box.namePlace === "over" ? -box.halfHeight - 6 : box.namePlace === "under" ? box.halfHeight + 14 : 4} className="parallax-drawing-model-name">{box.name}</text>
    {box.ports.map((port) => {
      const { side, edge } = port;
      // A pin's name sits inside the box at its lead: beside it on the left and right, under or over it at the top and bottom.
      const label = side === "left" ? { x: edge.x + 6, y: edge.y + 3, anchor: "start" as const }
        : side === "right" ? { x: edge.x - 6, y: edge.y + 3, anchor: "end" as const }
          : { x: edge.x, y: edge.y + (side === "top" ? 12 : -6), anchor: "middle" as const };
      return <g key={port.name}>
        <path className="parallax-drawing-model-lead" d={`M${port.x} ${port.y}L${edge.x} ${edge.y}`} />
        {pinLabel(port.name, port.name, label.x, label.y, label.anchor)}
      </g>;
    })}
  </>;
}

/**
 * A part's name and value, upright at the anchors its symbol document places them; the value only when it has one.
 * A sheet that laid its labels out together (`placeLabels`) passes where each one landed.
 */
export function PartLabels({ item, nameClassName, valueClassName, placement, onTextDown, onTextReset }: {
  item: DrawingItem; nameClassName: string; valueClassName: string; placement?: LabelPlacement;
  /** A text taken with the pointer, to be put somewhere else: which, and where it stands now. */
  onTextDown?: (event: PointerEvent<SVGElement>, text: "name" | "value", at: Point) => void;
  /** A text put somewhere by hand, given back to where the sheet places it. */
  onTextReset?: (text: "name" | "value") => void;
}) {
  const library = useParallaxPartLibrary();
  if (item.type === "JUNCTION") {
    return null;
  }
  // A ground mark is a net, not a part: node 0 carries no name at all, another ground the name of its net.
  if (item.type === "GROUND" && !item.net && !item.common) {
    return null;
  }
  const name = placement ? placement.name : labelPositionOf(library, item, "name");
  const value = item.element?.value ? placement ? placement.value : labelPositionOf(library, item, "value") : null;
  const label = (subject: "name" | "value", point: { x: number; y: number }, className: string, text: string) => {
    const across = point.x - item.x;
    const down = point.y - item.y;
    return <text className={onTextDown ? `${className} parallax-circuit-diagram-text-movable` : className} x={across} y={down}
      textAnchor={anchorAway(across, down)} dominantBaseline="central"
      onPointerDown={onTextDown ? (event) => onTextDown(event, subject, point) : undefined}
      onDoubleClick={onTextReset && item.labels?.[subject] ? () => onTextReset(subject) : undefined}>{text}</text>;
  };
  return <>
    {name ? label("name", name, nameClassName, item.type === "GROUND" ? item.net ?? "0 V" : item.id) : null}
    {value ? label("value", value, valueClassName, item.element!.value!) : null}
  </>;
}

import { drawingExtent, type SymbolDrawingDocument } from "@jmouse/parallax/schematic";

/**
 * Shared vector geometry for the symbol editor, the symbols shelf, the component preview and the schematic. Pins are
 * marked when `showPins` asks for it (an editor or a preview); on a sheet the sheet marks its own contacts.
 */
export function SymbolDrawing({ drawing, className, showPins = false, namePins = true, pinNames, turn }: {
  drawing: SymbolDrawingDocument;
  className?: string;
  showPins?: boolean;
  /** Whether a marked pin carries its name; a picture scaled up names its pins outside the drawing. */
  namePins?: boolean;
  /** The name printed beside each pin in place of its own, such as the component pin a port stands for. */
  pinNames?: Record<string, string>;
  /**
   * How the part this drawing stands for is turned on its sheet, which the caller applies around it: the drawing's
   * upright paths are turned back by it, so a meter's V reads V on a part stood on end, not «<».
   */
  turn?: { rotation: number; mirrored: boolean };
}) {
  const back = turn ? `scale(${turn.mirrored ? -1 : 1} 1) rotate(${-turn.rotation})` : undefined;
  return <g className={className}>
    {drawing.paths.map((path, index) => <path key={`${index}-${path}`} d={path} />)}
    {drawing.upright?.length ? <g transform={back}>
      {drawing.upright.map((path, index) => <path key={`upright-${index}-${path}`} d={path} />)}
    </g> : null}
    {showPins ? drawing.pins?.map((pin) => <g key={pin.name} className="parallax-drawing-symbol-pin">
      <circle cx={pin.x} cy={pin.y} r="2.8" />
      {namePins ? <text x={pin.x + 5} y={pin.y - 5}>{pinNames?.[pin.name] ?? pin.name}</text> : null}
    </g>) : null}
  </g>;
}

/** A whole drawing as one picture, sized to its extent: shelf cards, palettes and object pages. */
export function SymbolPicture({ drawing, label, className, showPins = false, namePins = true, pinNames, margin = 6 }: {
  drawing: SymbolDrawingDocument;
  label?: string;
  className?: string;
  showPins?: boolean;
  namePins?: boolean;
  pinNames?: Record<string, string>;
  margin?: number;
}) {
  const { halfWidth, halfHeight } = drawingExtent(drawing);
  const viewBox = `${-halfWidth - margin} ${-halfHeight - margin} ${2 * (halfWidth + margin)} ${2 * (halfHeight + margin)}`;
  return <svg className={className} viewBox={viewBox} role={label ? "img" : undefined} aria-label={label}
    aria-hidden={label ? undefined : true}>
    <SymbolDrawing drawing={drawing} className="parallax-symbol-picture-strokes" showPins={showPins} namePins={namePins} pinNames={pinNames} />
  </svg>;
}

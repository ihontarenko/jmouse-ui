/**
 * A symbol document's drawing as the server reads it from the jMX lines (`size`, `path`, `pin … at`, `label … at`):
 * coordinates centred on the part's origin, the same in every schematic, preview and editor.
 */
export interface SymbolDrawingDocument {
  /** Where the part's live figures are drawn while it runs. */
  indicators?: SymbolIndicator[];
  version: 1;
  /** The extent across and down, centred on the origin; absent when the document writes no `size`. */
  width?: number;
  height?: number;
  paths: string[];
  /** Paths that stay upright however the part is turned — a meter's letter —, written `path "…" upright`. */
  upright?: string[];
  /** Where each port meets the drawing; `label` is text printed beside it, absent for none. */
  pins?: SymbolPin[];
  /** Where the part's name and value are printed, the text centred on the point. */
  labels?: SymbolLabel[];
}

export interface SymbolPin { name: string; x: number; y: number; label?: string }
export interface SymbolLabel { subject: "name" | "value"; x: number; y: number }

const isPoint = (value: { x: unknown; y: unknown }) => Number.isFinite(value.x) && Number.isFinite(value.y);

/** Where a part's live figure of that name is drawn: a box in the symbol's coordinates (`indicator level from … to …`). */
export interface SymbolIndicator {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The drawing JSON a symbol definition or a component model carries, or null when it is absent or not a drawing. */
export function readSymbolDrawing(source: string | null | undefined): SymbolDrawingDocument | null {
  if (!source) {
    return null;
  }
  try {
    const value = JSON.parse(source) as SymbolDrawingDocument;
    const pathsRead = Array.isArray(value.paths) && value.paths.every((path) => typeof path === "string")
      && (value.upright === undefined || (Array.isArray(value.upright) && value.upright.every((path) => typeof path === "string")));
    const pinsRead = value.pins === undefined || (Array.isArray(value.pins)
      && value.pins.every((pin) => typeof pin.name === "string" && isPoint(pin)));
    const labelsRead = value.labels === undefined || (Array.isArray(value.labels)
      && value.labels.every((label) => (label.subject === "name" || label.subject === "value") && isPoint(label)));
    if (value.version !== 1 || !pathsRead || !pinsRead || !labelsRead) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** The box a drawing occupies: its written size, or the bounds of its pins when it writes none. */
export function drawingExtent(drawing: SymbolDrawingDocument): { halfWidth: number; halfHeight: number } {
  const pins = drawing.pins ?? [];
  const halfWidth = drawing.width ? drawing.width / 2 : Math.max(30, ...pins.map((pin) => Math.abs(pin.x)));
  const halfHeight = drawing.height ? drawing.height / 2 : Math.max(20, ...pins.map((pin) => Math.abs(pin.y)));
  return { halfWidth, halfHeight };
}

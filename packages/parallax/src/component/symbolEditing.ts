import type { SymbolDrawingDocument } from "../schematic/symbolDrawingDocument";
import { holds, type Box } from "../editor/selection";
import { parsePathData, translatePath, turnedPath, type PathTurn } from "./pathData";

/*
 * A symbol drawing as an editor works on it, headless: its shapes as one list, what is selected as keys, and what a
 * selection can have done to it — moved, removed, copied, pasted. The sheet editor's counterpart is `sheetSelection`;
 * both feed the same editor shell.
 */

/** A shape as the editor works on it: its path, and whether it stays upright as the part turns. */
export interface SymbolShape {
  path: string;
  upright: boolean;
}

/** One pin of a symbol, as its document keeps it. */
export type SymbolPin = NonNullable<SymbolDrawingDocument["pins"]>[number];

/**
 * The drawing's shapes as one list — those that turn with the part, then those that stay upright —, so selecting,
 * moving and removing treat them alike; the document keeps them in two lists, `paths` and `upright`.
 */
export function shapesOf(drawing: SymbolDrawingDocument): SymbolShape[] {
  return [...drawing.paths.map((path) => ({ path, upright: false })), ...(drawing.upright ?? []).map((path) => ({ path, upright: true }))];
}

/** The drawing with these shapes, split back into its two lists; `upright` is left out when none stays upright. */
export function withShapes(drawing: SymbolDrawingDocument, shapes: readonly SymbolShape[]): SymbolDrawingDocument {
  const upright = shapes.filter((shape) => shape.upright).map((shape) => shape.path);
  const { upright: _dropped, ...rest } = drawing;
  return { ...rest, paths: shapes.filter((shape) => !shape.upright).map((shape) => shape.path), ...(upright.length ? { upright } : {}) };
}

/** What the drawing tools make. */
export type SymbolShapeTool = "line" | "rectangle" | "ellipse";

/** The path a drawing tool makes between two points. */
export function shapePath(tool: SymbolShapeTool, from: { x: number; y: number }, to: { x: number; y: number }): string {
  if (tool === "rectangle") {
    return `M${from.x} ${from.y} H${to.x} V${to.y} H${from.x} Z`;
  }
  if (tool === "ellipse") {
    const radiusX = Math.abs(to.x - from.x) / 2;
    const radiusY = Math.abs(to.y - from.y) / 2;
    const centerX = (from.x + to.x) / 2;
    const centerY = (from.y + to.y) / 2;
    return `M${centerX - radiusX} ${centerY} A${radiusX} ${radiusY} 0 1 0 ${centerX + radiusX} ${centerY} A${radiusX} ${radiusY} 0 1 0 ${centerX - radiusX} ${centerY} Z`;
  }
  return `M${from.x} ${from.y} L${to.x} ${to.y}`;
}

/** What a symbol's selection is made of: shapes and pins by their place in their lists — `shape:2`, `pin:0`. */
export type SymbolKey = `shape:${number}` | `pin:${number}`;

export const shapeKey = (index: number): SymbolKey => `shape:${index}`;
export const pinKey = (index: number): SymbolKey => `pin:${index}`;

/** The shape indices among the keys, and the pin indices. */
export function selectedShapes(keys: readonly string[]): number[] {
  return keys.filter((key) => key.startsWith("shape:")).map((key) => Number(key.slice(6)));
}

export function selectedPins(keys: readonly string[]): number[] {
  return keys.filter((key) => key.startsWith("pin:")).map((key) => Number(key.slice(4)));
}

/**
 * Where a path reaches: every point and control point it is written through, and an arc's radii around its ends — an
 * ellipse drawn as two arcs reaches its radius above and below the line between them.
 */
export function pathBounds(path: string): Box {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const take = (pointX: number, pointY: number, radiusX = 0, radiusY = 0) => {
    left = Math.min(left, pointX - radiusX);
    right = Math.max(right, pointX + radiusX);
    top = Math.min(top, pointY - radiusY);
    bottom = Math.max(bottom, pointY + radiusY);
  };
  for (const command of parsePathData(path)) {
    const relative = command.letter === command.letter.toLowerCase();
    const letter = command.letter.toUpperCase();
    const values = command.values;
    if (letter === "Z") {
      x = startX;
      y = startY;
      continue;
    }
    if (letter === "H") {
      x = relative ? x + values[0] : values[0];
      take(x, y);
      continue;
    }
    if (letter === "V") {
      y = relative ? y + values[0] : values[0];
      take(x, y);
      continue;
    }
    if (letter === "A") {
      const radiusX = Math.abs(values[0]);
      const radiusY = Math.abs(values[1]);
      take(x, y, radiusX, radiusY);
      x = relative ? x + values[5] : values[5];
      y = relative ? y + values[6] : values[6];
      take(x, y, radiusX, radiusY);
      continue;
    }
    // M L C S Q T: pairs of numbers, the last pair where the pen ends.
    for (let index = 0; index + 1 < values.length; index += 2) {
      take(relative ? x + values[index] : values[index], relative ? y + values[index + 1] : values[index + 1]);
    }
    x = relative ? x + values[values.length - 2] : values[values.length - 2];
    y = relative ? y + values[values.length - 1] : values[values.length - 1];
    if (letter === "M") {
      startX = x;
      startY = y;
    }
  }
  return Number.isFinite(left) ? { x: left, y: top, width: right - left, height: bottom - top } : { x: 0, y: 0, width: 0, height: 0 };
}

/** What a box let go over the drawing takes: every shape and every pin it holds whole. */
export function symbolKeysInBox(drawing: SymbolDrawingDocument, box: Box): SymbolKey[] {
  const keys: SymbolKey[] = [];
  shapesOf(drawing).forEach((shape, index) => {
    if (holds(box, pathBounds(shape.path))) {
      keys.push(shapeKey(index));
    }
  });
  (drawing.pins ?? []).forEach((pin, index) => {
    if (holds(box, { x: pin.x, y: pin.y, width: 0, height: 0 })) {
      keys.push(pinKey(index));
    }
  });
  return keys;
}

/** The selected shapes and pins moved by (dx, dy): shapes by their commands, never resampled into polylines. */
export function movedSelection(drawing: SymbolDrawingDocument, keys: readonly string[], dx: number, dy: number): SymbolDrawingDocument {
  const shapes = new Set(selectedShapes(keys));
  const pins = new Set(selectedPins(keys));
  const moved = withShapes(drawing, shapesOf(drawing).map((shape, index) => shapes.has(index)
    ? { ...shape, path: translatePath(shape.path, dx, dy) } : shape));
  return { ...moved, pins: (drawing.pins ?? []).map((pin, index) => pins.has(index) ? { ...pin, x: pin.x + dx, y: pin.y + dy } : pin) };
}

/** The grid a turned selection's centre lands on, so points on the drawing's grid stay on it. */
const TURN_GRID = 5;

/**
 * The selected shapes and pins turned a quarter clockwise, or mirrored left to right, about the centre of what is
 * selected — on the grid —; shapes by their commands, arcs included.
 */
export function turnedSelection(drawing: SymbolDrawingDocument, keys: readonly string[], turn: PathTurn): SymbolDrawingDocument {
  const shapes = new Set(selectedShapes(keys));
  const pins = new Set(selectedPins(keys));
  const boxes: Box[] = [
    ...shapesOf(drawing).filter((_, index) => shapes.has(index)).map((shape) => pathBounds(shape.path)),
    ...(drawing.pins ?? []).filter((_, index) => pins.has(index)).map((pin) => ({ x: pin.x, y: pin.y, width: 0, height: 0 })),
  ];
  if (!boxes.length) {
    return drawing;
  }
  const left = Math.min(...boxes.map((box) => box.x));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const top = Math.min(...boxes.map((box) => box.y));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  const cx = Math.round((left + right) / 2 / TURN_GRID) * TURN_GRID;
  const cy = Math.round((top + bottom) / 2 / TURN_GRID) * TURN_GRID;
  const turned = withShapes(drawing, shapesOf(drawing).map((shape, index) => shapes.has(index)
    ? { ...shape, path: turnedPath(shape.path, turn, cx, cy) } : shape));
  return { ...turned, pins: (drawing.pins ?? []).map((pin, index) => !pins.has(index) ? pin
    : turn === "quarter" ? { ...pin, x: cx - (pin.y - cy), y: cy + (pin.x - cx) } : { ...pin, x: 2 * cx - pin.x }) };
}

/** The drawing without the selected shapes and pins. */
export function withoutSelection(drawing: SymbolDrawingDocument, keys: readonly string[]): SymbolDrawingDocument {
  const shapes = new Set(selectedShapes(keys));
  const pins = new Set(selectedPins(keys));
  const kept = withShapes(drawing, shapesOf(drawing).filter((_, index) => !shapes.has(index)));
  return { ...kept, pins: (drawing.pins ?? []).filter((_, index) => !pins.has(index)) };
}

/** What a symbol's clipboard holds: shapes and pins, as they were. */
export interface SymbolClipboard {
  shapes: SymbolShape[];
  pins: SymbolPin[];
}

export function copiedSelection(drawing: SymbolDrawingDocument, keys: readonly string[]): SymbolClipboard {
  const shapes = shapesOf(drawing);
  const pins = drawing.pins ?? [];
  return {
    shapes: selectedShapes(keys).map((index) => shapes[index]).filter((shape): shape is SymbolShape => !!shape),
    pins: selectedPins(keys).map((index) => pins[index]).filter((pin): pin is SymbolPin => !!pin),
  };
}

/** The most pins a symbol may have. */
export const MAXIMUM_PINS = 64;

/** The next pin name not taken: P1, P2, … */
export function freePinName(pins: readonly SymbolPin[]): string {
  const names = new Set(pins.map((pin) => pin.name));
  let number = pins.length + 1;
  while (names.has(`P${number}`)) {
    number++;
  }
  return `P${number}`;
}

/**
 * The clipboard placed into the drawing, moved by (dx, dy): its pins under fresh names — two pins of one name would be
 * one port twice. Gives the drawing and the keys of what was placed, to be selected; pins past the limit are left out.
 */
export function pastedInto(drawing: SymbolDrawingDocument, copied: SymbolClipboard, dx: number, dy: number): { drawing: SymbolDrawingDocument; keys: SymbolKey[] } {
  const shapes = shapesOf(drawing);
  const placedShapes = copied.shapes.map((shape) => ({ ...shape, path: translatePath(shape.path, dx, dy) }));
  const pins = [...(drawing.pins ?? [])];
  const keys: SymbolKey[] = [];
  for (const pin of copied.pins) {
    if (pins.length >= MAXIMUM_PINS) {
      break;
    }
    keys.push(pinKey(pins.length));
    pins.push({ ...pin, name: freePinName(pins), x: pin.x + dx, y: pin.y + dy });
  }
  // Shapes keep their order: those that turn first, the upright after — the new ones placed among their own kind.
  const next = withShapes(drawing, [...shapes, ...placedShapes]);
  const ordered = shapesOf(next);
  placedShapes.forEach((shape) => {
    const index = ordered.findIndex((candidate, position) => candidate.path === shape.path && candidate.upright === shape.upright
      && !keys.includes(shapeKey(position)));
    if (index >= 0) {
      keys.push(shapeKey(index));
    }
  });
  return { drawing: { ...next, pins }, keys };
}

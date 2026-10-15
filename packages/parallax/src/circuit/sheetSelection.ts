import type { PartLibraryView } from "../schematic/partLibrary";
import { holds, type Box } from "../editor/selection";
import { bodyOf, parsePort, portKey, wirePoints, type DrawingItem, type DrawingWire, type SchematicDocument } from "./SchematicDocument";

/**
 * What a sheet's selection is made of: parts and wires, each by a key — `item:R1`, `wire:wire-7` — so one set holds
 * both, as the shared editor's selection does.
 */
export type SheetKey = `item:${string}` | `wire:${string}`;

export const itemKey = (id: string): SheetKey => `item:${id}`;
export const wireKey = (id: string): SheetKey => `wire:${id}`;

/** A key's kind and id. */
export function parseSheetKey(key: string): { kind: "item" | "wire"; id: string } {
  const colon = key.indexOf(":");
  return { kind: key.slice(0, colon) === "wire" ? "wire" : "item", id: key.slice(colon + 1) };
}

/** The ids of the parts among the keys. */
export function selectedItemIds(keys: readonly string[]): string[] {
  return keys.map(parseSheetKey).filter((key) => key.kind === "item").map((key) => key.id);
}

/** The ids of the wires among the keys. */
export function selectedWireIds(keys: readonly string[]): string[] {
  return keys.map(parseSheetKey).filter((key) => key.kind === "wire").map((key) => key.id);
}

/** A part's body as a box on the sheet, turned as the part is. */
export function itemBox(library: PartLibraryView, item: DrawingItem): Box {
  const body = bodyOf(library, item);
  const turned = item.rotation % 180 !== 0;
  const halfWidth = turned ? body.halfHeight : body.halfWidth;
  const halfHeight = turned ? body.halfWidth : body.halfHeight;
  return { x: item.x - halfWidth, y: item.y - halfHeight, width: 2 * halfWidth, height: 2 * halfHeight };
}

/**
 * What a box let go over the sheet takes: every part whose body it holds whole, and every wire it holds whole — the
 * wire as drawn, every corner of it —, as a drawing program takes what lies wholly inside the rectangle.
 */
export function keysInBox(library: PartLibraryView, document: SchematicDocument, box: Box): SheetKey[] {
  const keys: SheetKey[] = [];
  for (const item of document.items) {
    if (holds(box, itemBox(library, item))) {
      keys.push(itemKey(item.id));
    }
  }
  for (const wire of document.wires) {
    const points = wirePoints(library, document, wire);
    if (points.length && points.every((point) => holds(box, { x: point.x, y: point.y, width: 0, height: 0 }))) {
      keys.push(wireKey(wire.id));
    }
  }
  return keys;
}

/**
 * The parts selected and every wire between two of them, as the clipboard keeps them: copying two connected parts
 * copies their connection. A wire to a part left behind stays behind — a copy cannot be wired to the original.
 */
export function copiedTogether(document: SchematicDocument, keys: readonly string[]): { items: DrawingItem[]; wires: DrawingWire[] } {
  const itemIds = new Set(selectedItemIds(keys));
  const items = document.items.filter((item) => itemIds.has(item.id));
  const wires = document.wires.filter((wire) => itemIds.has(parsePort(wire.from).id) && itemIds.has(parsePort(wire.to).id));
  return { items, wires };
}

/** A wire's ends moved onto the copies of its parts. */
export function rewiredTo(wire: DrawingWire, renamed: ReadonlyMap<string, string>, id: string, dx: number, dy: number): DrawingWire {
  const end = (port: string) => {
    const { id: part, name } = parsePort(port);
    return portKey(renamed.get(part) ?? part, name);
  };
  return { ...wire, id, from: end(wire.from), to: end(wire.to), bends: wire.bends?.map((bend) => ({ x: bend.x + dx, y: bend.y + dy })) };
}

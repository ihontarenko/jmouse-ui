import type { PartLibraryView } from "../schematic/partLibrary";
import { elementTypes } from "./circuit";
import { createDrawingItem, GRID, parsePort, portKey, portsOf, positionOf, routedSheet, snap, wirePoints,
  type DrawingItem, type DrawingType, type DrawingWire, type SchematicDocument } from "./SchematicDocument";

/**
 * Editing a sheet — the one model behind every sheet a person changes, the circuit editor's and the bench's alike: the
 * document, its history, the tool in hand, and every gesture as an operation on the document. It draws nothing; the
 * sheet (`Schematic`) draws the document and hands its gestures here.
 */

/** What is in hand: choosing and moving, drawing wires, cutting a wire into two open ends, or moving the sheet. */
export type SheetTool = "select" | "wire" | "cut" | "pan";
/** Which end of a wire: where it was drawn from, or where it was drawn to. */
export type WireEnd = "from" | "to";
export type SheetSelection = { kind: "item" | "wire"; id: string } | null;
export type SheetPlacement = { type: DrawingType; component?: string; pins?: Record<string, string>; common?: boolean; label?: boolean };
export type SheetPoint = { x: number; y: number };

/** What the pointer is drawn to: a contact, or a point on a wire — where a wire being drawn would end. */
export type WireTarget = { kind: "port"; key: string; at: SheetPoint } | { kind: "wire"; id: string; at: SheetPoint };

/** How near, in sheet units, a contact draws the pointer to it; a wire draws it from a little nearer. */
const PORT_MAGNET = 20;
const WIRE_MAGNET = 12;

export const labelOf = (type: DrawingType) => type === "GROUND" ? "Ground" : type === "JUNCTION" ? "Junction" : elementTypes[type].label;

export const wireId = () => `wire-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** The sheet with every wire on `id` free of its corners — they were drawn for its pins where they stood. */
export function rerouted(document: SchematicDocument, id: string): SchematicDocument {
  return { ...document, wires: document.wires.map((wire) => parsePort(wire.from).id === id || parsePort(wire.to).id === id ? { ...wire, bends: [] } : wire) };
}

export function portPoint(library: PartLibraryView, document: SchematicDocument, key: string): SheetPoint {
  const { id, name } = parsePort(key);
  const item = document.items.find((candidate) => candidate.id === id);
  return item ? positionOf(library, item, name) : { x: 0, y: 0 };
}

export function sameTarget(left: WireTarget | null, right: WireTarget | null): boolean {
  if (!left || !right) {
    return left === right;
  }
  return left.kind === right.kind && left.at.x === right.at.x && left.at.y === right.at.y
    && (left.kind === "port" ? left.key === (right as typeof left).key : left.id === (right as typeof left).id);
}

/**
 * The contact or the wire nearest the pointer within the magnet's reach — a contact before a wire —; never where the
 * wire being drawn starts: its own contact, the wires on that contact, the wire it starts on.
 */
export function magnetAt(library: PartLibraryView, document: SchematicDocument, point: SheetPoint, start?: WireTarget | null): WireTarget | null {
  const from = start?.kind === "port" ? start.key : undefined;
  let best: { target: WireTarget; distance: number } | null = null;
  for (const item of document.items) {
    for (const port of portsOf(library, item)) {
      const key = portKey(item.id, port.name);
      if (key === from) {
        continue;
      }
      const at = positionOf(library, item, port.name);
      const distance = Math.hypot(at.x - point.x, at.y - point.y);
      if (distance <= PORT_MAGNET && (!best || distance < best.distance)) {
        best = { target: { kind: "port", key, at }, distance };
      }
    }
  }
  if (best) {
    return best.target;
  }
  for (const wire of document.wires) {
    if ((from && (wire.from === from || wire.to === from)) || (start?.kind === "wire" && start.id === wire.id)) {
      continue;
    }
    const nearest = nearestOnWire(library, document, wire.id, point);
    if (nearest && nearest.distance <= WIRE_MAGNET && (!best || nearest.distance < best.distance)) {
      best = { target: { kind: "wire", id: wire.id, at: nearest.at }, distance: nearest.distance };
    }
  }
  return best?.target ?? null;
}

/** The grid point of a wire's routed path nearest `point`, and how far it is. */
export function nearestOnWire(library: PartLibraryView, document: SchematicDocument, id: string, point: SheetPoint): { at: SheetPoint; distance: number } | null {
  const wire = document.wires.find((candidate) => candidate.id === id);
  if (!wire) {
    return null;
  }
  const points = wirePoints(library, document, wire);
  let best: { at: SheetPoint; distance: number } | null = null;
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1];
    const end = points[index];
    const at = start.x === end.x
      ? { x: start.x, y: snap(clamp(point.y, start.y, end.y)) }
      : { x: snap(clamp(point.x, start.x, end.x)), y: start.y };
    const distance = Math.hypot(point.x - at.x, point.y - at.y);
    if (!best || distance < best.distance) {
      best = { at, distance };
    }
  }
  return best;
}

const clamp = (value: number, one: number, other: number) => Math.max(Math.min(value, Math.max(one, other)), Math.min(one, other));

/** A wire cut in two at `at` by a new junction, which every wire meeting it there is joined through. */
function splitWire(library: PartLibraryView, document: SchematicDocument, id: string, at: SheetPoint): { document: SchematicDocument; junction: string } | null {
  const wire = document.wires.find((candidate) => candidate.id === id);
  if (!wire) {
    return null;
  }
  const points = wirePoints(library, document, wire);
  const index = points.findIndex((point, position) => position > 0 && onSegment(points[position - 1], point, at));
  if (index < 0) {
    return null;
  }
  const item = createDrawingItem(library, document.items, "JUNCTION", at.x, at.y);
  const junction = portKey(item.id, "j");
  const before = points.slice(1, index).filter((point) => !(point.x === at.x && point.y === at.y));
  const after = points.slice(index, -1).filter((point) => !(point.x === at.x && point.y === at.y));
  return {
    junction,
    document: { ...document, items: [...document.items, item], wires: [...document.wires.filter((candidate) => candidate.id !== id),
      { ...wire, id: `${wire.id}-a`, to: junction, bends: wire.bends.length ? before : [] },
      { ...wire, id: `${wire.id}-b`, from: junction, bends: wire.bends.length ? after : [] }] },
  };
}

/** The segment of a wire's routed path that `at` lies on: the path, and the index its segment ends at. */
function segmentAt(library: PartLibraryView, document: SchematicDocument, wire: DrawingWire, at: SheetPoint): { points: SheetPoint[]; index: number } | null {
  const points = wirePoints(library, document, wire);
  const index = points.findIndex((point, position) => position > 0 && onSegment(points[position - 1], point, at));
  return index < 0 ? null : { points, index };
}

/** A wire cut at `point` into two halves, each ending open a grid step either side of the cut. */
export function cutWire(library: PartLibraryView, document: SchematicDocument, id: string, point: SheetPoint): SchematicDocument | null {
  const wire = document.wires.find((candidate) => candidate.id === id);
  const at = nearestOnWire(library, document, id, point)?.at;
  const segment = wire && at ? segmentAt(library, document, wire, at) : null;
  if (!wire || !at || !segment) {
    return null;
  }
  const start = segment.points[segment.index - 1];
  const end = segment.points[segment.index];
  const along = { x: Math.sign(end.x - start.x), y: Math.sign(end.y - start.y) };
  const near = createDrawingItem(library, document.items, "JUNCTION", at.x - along.x * GRID, at.y - along.y * GRID);
  const far = createDrawingItem(library, [...document.items, near], "JUNCTION", at.x + along.x * GRID, at.y + along.y * GRID);
  const bent = wire.bends.length > 0;
  return { ...document, items: [...document.items, near, far], wires: [...document.wires.filter((candidate) => candidate.id !== id),
    { ...wire, id: `${id}-a`, to: portKey(near.id, "j"), bends: bent ? segment.points.slice(1, segment.index) : [] },
    { ...wire, id: `${id}-b`, from: portKey(far.id, "j"), bends: bent ? segment.points.slice(segment.index, -1) : [] }] };
}

/**
 * A part of two contacts put into a wire's break at `point`: centred there, turned so its contacts lie along the wire,
 * the half toward the wire's start on the contact nearer it. Null when the part has not two contacts or the point is off
 * the wire.
 */
export function insertedInto(library: PartLibraryView, document: SchematicDocument, id: string, point: SheetPoint, placement: SheetPlacement): { document: SchematicDocument; item: string } | null {
  const wire = document.wires.find((candidate) => candidate.id === id);
  const at = nearestOnWire(library, document, id, point)?.at;
  const segment = wire && at ? segmentAt(library, document, wire, at) : null;
  if (!wire || !at || !segment) {
    return null;
  }
  const created = createDrawingItem(library, document.items, placement.type, at.x, at.y, placement.component, placement.pins);
  const ports = portsOf(library, created);
  if (ports.length !== 2) {
    return null;
  }
  const start = segment.points[segment.index - 1];
  const end = segment.points[segment.index];
  const contacts = (item: DrawingItem) => [positionOf(library, item, ports[0].name), positionOf(library, item, ports[1].name)];
  const lyingAcross = (item: DrawingItem) => {
    const [one, other] = contacts(item);
    return Math.abs(other.x - one.x) >= Math.abs(other.y - one.y);
  };
  const turned = lyingAcross(created) === (start.y === end.y) ? created : { ...created, rotation: 90 };
  // Centred on the cut: the middle of its two contacts stands where the wire was pressed.
  const [one, other] = contacts(turned);
  const item = { ...turned, x: snap(turned.x + at.x - (one.x + other.x) / 2), y: snap(turned.y + at.y - (one.y + other.y) / 2) };
  const [first, second] = contacts(item);
  const firstNearStart = Math.hypot(first.x - start.x, first.y - start.y) <= Math.hypot(second.x - start.x, second.y - start.y);
  const [towardStart, towardEnd] = (firstNearStart ? [ports[0], ports[1]] : [ports[1], ports[0]]).map((port) => portKey(item.id, port.name));
  return {
    item: item.id,
    document: { ...document, items: [...document.items, item], wires: [...document.wires.filter((candidate) => candidate.id !== id),
      { ...wire, id: `${id}-a`, to: towardStart, bends: [] },
      { ...wire, id: `${id}-b`, from: towardEnd, bends: [] }] },
  };
}

function onSegment(start: SheetPoint, end: SheetPoint, point: SheetPoint): boolean {
  return (start.x === end.x && point.x === start.x && point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y))
    || (start.y === end.y && point.y === start.y && point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x));
}

/**
 * The wire being drawn, laid by the sheet's own router: to the target when the pointer is drawn to one, else to a
 * junction standing where the pointer is — the preview is the wire the gesture will make, not a straight guess.
 */
export function previewWire(library: PartLibraryView, document: SchematicDocument, start: WireTarget, bends: SheetPoint[], target: WireTarget | null, pointer: SheetPoint): SheetPoint[] {
  const from = endingAt(library, document, start, start.at);
  const ending = endingAt(library, from.document, target ? resolvedOn(library, from.document, target) : null, pointer);
  const wire: DrawingWire = { id: "wire-preview", from: from.to, to: ending.to, bends };
  return routedSheet(library, { ...ending.document, wires: [...ending.document.wires, wire] }).paths.get(wire.id) ?? [];
}

/** The sheet a wire would end on and the contact it would end at: a contact, a wire cut by a junction, or a loose end. */
export function endingAt(library: PartLibraryView, document: SchematicDocument, target: WireTarget | null, pointer: SheetPoint): { document: SchematicDocument; to: string } {
  if (target?.kind === "port") {
    return { document, to: target.key };
  }
  const split = target?.kind === "wire" ? splitWire(library, document, target.id, target.at) : null;
  if (split) {
    return { document: split.document, to: split.junction };
  }
  const loose = createDrawingItem(library, document.items, "JUNCTION", pointer.x, pointer.y);
  return { document: { ...document, items: [...document.items, loose] }, to: portKey(loose.id, "j") };
}

/**
 * `target` on `document` as it now stands: a point on a wire that the other end of the same wire has just cut is on
 * one of the two halves.
 */
export function resolvedOn(library: PartLibraryView, document: SchematicDocument, target: WireTarget): WireTarget {
  if (target.kind === "port" || document.wires.some((wire) => wire.id === target.id)) {
    return target;
  }
  const half = document.wires.find((wire) => wire.id.startsWith(`${target.id}-`)
    && wirePoints(library, document, wire).some((point, index, points) => index > 0 && onSegment(points[index - 1], point, target.at)));
  return half ? { ...target, id: half.id } : target;
}

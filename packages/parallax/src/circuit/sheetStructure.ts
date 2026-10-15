import type { PartLibraryView } from "../schematic/partLibrary";
import { formatQuantity } from "../quantities";
import { READING_LINE, READING_RESERVE, type LabelPlacement, type PartText } from "../schematic/labelPlacement";
import { slowEnoughFor, type WireAlternation } from "./alternation";
import type { CircuitElement } from "./circuit";
import { SIMULATION_SPEEDS } from "./liveCircuitSession";
import { groundNodeOf, parsePort, portKey, portsOf, positionOf, SHEET_HEIGHT, SHEET_WIDTH, wirePoints,
  type SchematicDocument } from "./SchematicDocument";

/**
 * What a drawn sheet is made of besides its drawing: which node every contact is on, where each probe stands, what the
 * placement depends on, the frame it is shown in, and the sheet with a part or a text carried somewhere else.
 */

/**
 * An oscilloscope probe as the sheet shows it: its tip on `node`, its ground clip on `reference` (null on the circuit's
 * ground), in its channel's colour (1 … 10, the `--parallax-probe-N` tokens).
 */
export interface SheetProbe {
  /** The channel the probe belongs to: CH1 … CH4. */
  id: string;
  /** What the channel is called on the sheet. */
  channel: string;
  /** The contact its tip is drawn on, as a port key; the first contact of its node when none is named or it is gone. */
  contact?: string;
  /** The contact its clip is drawn on, the same way. */
  referenceContact?: string;
  node: string;
  reference: string | null;
  color: number;
}

/** A part being dragged: where the sheet puts it now, on the grid. */
/** A part carried to (x, y); the rest of the selection, `together`, goes the same way by the same distance. */
export interface PartMove { id: string; x: number; y: number; together?: readonly string[] }

/** The sheet with a part's text where it is being carried to, from the part's centre. */
export function withText(document: SchematicDocument, carried: { id: string; text: PartText; offset: { x: number; y: number } } | null): SchematicDocument {
  if (!carried) {
    return document;
  }
  return { ...document, items: document.items.map((item) => item.id === carried.id
    ? { ...item, labels: { ...item.labels, [carried.text]: carried.offset } } : item) };
}

/** Every contact's node, a junction's too: a junction is the node of whatever its wires reach. */
function wiredNodes(library: PartLibraryView, document: SchematicDocument, nodeByPort: Map<string, string>): Map<string, string> {
  const nodes = new Map(nodeByPort);
  for (const item of document.items.filter((candidate) => candidate.type === "GROUND")) {
    for (const port of portsOf(library, item)) {
      nodes.set(portKey(item.id, port.name), groundNodeOf(item));
    }
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const wire of document.wires) {
      const from = nodes.get(wire.from);
      const to = nodes.get(wire.to);
      if (from && !to) {
        nodes.set(wire.to, from);
        changed = true;
      } else if (to && !from) {
        nodes.set(wire.from, to);
        changed = true;
      }
    }
  }
  return nodes;
}

/** One line for the sheet's head: the fastest alternation shown, and the speed at which it would be seen flowing. */
export function alternationSummary(wires: Map<string, WireAlternation>, speed: number, threshold?: number): string | null {
  const fastest = [...wires.values()].sort((first, second) => second.frequency - first.frequency)[0];
  if (!fastest) {
    return null;
  }
  const slow = slowEnoughFor(fastest, speed, threshold);
  const fitting = SIMULATION_SPEEDS.map((choice) => ({ label: choice.label, value: Number(choice.value) }))
    .filter((choice) => choice.value <= slow).sort((first, second) => second.value - first.value)[0];
  const frequency = `${fastest.atLeast ? "over " : "≈ "}${formatQuantity(fastest.frequency, "Hz", 2)}`;
  const what = fastest.kind === "pulsing" ? "switching" : "alternating";
  return fitting ? `${frequency} ${what} — slow to ${fitting.label} to see it flow` : `${frequency} ${what} — too fast to see flow`;
}

/** Where each probe is drawn: its tip on one contact of its node, and its clip, when not on ground, on one of its reference's. */
export interface ProbeMarker {
  probe: SheetProbe;
  tip: { key: string; point: { x: number; y: number } };
  clip: { key: string; point: { x: number; y: number } } | null;
  /** How many probes before this one are on the same contact: their tags stand one above another. */
  stack: number;
}

export function probeMarkers(library: PartLibraryView, document: SchematicDocument, probes: readonly SheetProbe[], nodeByPort: Map<string, string>): ProbeMarker[] {
  // A probe stands where its node's wires meet when there is such a point, else on its first contact.
  const nodes = wiredNodes(library, document, nodeByPort);
  const ordered = [...document.items.filter((item) => item.type === "JUNCTION"), ...document.items.filter((item) => item.type !== "JUNCTION")];
  const contact = (node: string, wanted?: string) => {
    const keys = ordered.flatMap((item) => portsOf(library, item).map((port) => portKey(item.id, port.name)))
      .filter((key) => nodes.get(key) === node);
    const key = wanted && keys.includes(wanted) ? wanted : keys[0];
    if (!key) {
      return null;
    }
    const item = document.items.find((candidate) => candidate.id === parsePort(key).id)!;
    return { key, point: positionOf(library, item, parsePort(key).name) };
  };
  const onContact = new Map<string, number>();
  return probes.flatMap((probe) => {
    const tip = contact(probe.node, probe.contact);
    if (!tip) {
      return [];
    }
    const stack = onContact.get(tip.key) ?? 0;
    onContact.set(tip.key, stack + 1);
    return [{ probe, tip, clip: probe.reference ? contact(probe.reference, probe.referenceContact) : null, stack }];
  });
}

/** The node a contact is on — a junction's and a ground mark's included. */
export function nodeOfContact(library: PartLibraryView, document: SchematicDocument, key: string, nodeByPort: Map<string, string>): string | null {
  return wiredNodes(library, document, nodeByPort).get(key) ?? null;
}

/** The probe whose tip is on a node; the first channel when several are. */
export function probeOn(probes: readonly SheetProbe[], node: string | null | undefined): SheetProbe | null {
  return node ? probes.find((probe) => probe.node === node) ?? null : null;
}

/** Every contact's node as the netlist names it: a model's pins, a two-terminal part's "+" and "−". */
export function nodesByPort(elements: readonly CircuitElement[]): Map<string, string> {
  const nodeByPort = new Map<string, string>();
  for (const element of elements) {
    if (element.type === "MODEL") {
      for (const [pin, node] of Object.entries(element.pins ?? {})) {
        nodeByPort.set(portKey(element.id, pin), node);
      }
    } else {
      if (element.positive) {
        nodeByPort.set(portKey(element.id, "+"), element.positive);
      }
      if (element.negative) {
        nodeByPort.set(portKey(element.id, "−"), element.negative);
      }
    }
  }
  return nodeByPort;
}

/** What a sheet's placement depends on: each element's identity, part and connections — not its value. */
export function structureOf(elements: readonly CircuitElement[]): string {
  return JSON.stringify(elements.map((element) => [element.id, element.type, element.component ?? null, element.symbol ?? null,
    element.positive, element.negative, element.pins ?? null]));
}

/** The placed sheet with each item carrying the element as it is now, so labels show the current values. */
export function withCurrentElements(placed: SchematicDocument, elements: readonly CircuitElement[]): SchematicDocument {
  const byId = new Map(elements.map((element) => [element.id, element]));
  return { ...placed, items: placed.items.map((item) => item.element ? { ...item, element: byId.get(item.id) ?? item.element } : item) };
}

/**
 * The part of the sheet shown: every part and wire with a margin around them, and every text placed beside them —
 * a readings block at the edge must not be cut off by the frame.
 */
export function frameOf(library: PartLibraryView, document: SchematicDocument, labels: Map<string, LabelPlacement> = new Map()): { x: number; y: number; width: number; height: number } {
  const points = [...document.items.map((item) => ({ x: item.x, y: item.y })),
    ...document.wires.flatMap((wire) => wirePoints(library, document, wire))];
  if (points.length === 0) {
    // An empty sheet is shown at the size a first part is drawn at, around the middle of the page.
    return { x: SHEET_WIDTH / 4, y: SHEET_HEIGHT / 4, width: SHEET_WIDTH / 2, height: SHEET_HEIGHT / 2 };
  }
  const margin = 90;
  const reach = READING_RESERVE;
  const bounds = {
    left: Math.min(...points.map((point) => point.x)) - margin, right: Math.max(...points.map((point) => point.x)) + margin,
    top: Math.min(...points.map((point) => point.y)) - margin, bottom: Math.max(...points.map((point) => point.y)) + margin,
  };
  for (const placement of labels.values()) {
    const block = placement.readings;
    if (!block) {
      continue;
    }
    const left = block.anchor === "start" ? block.point.x : block.anchor === "end" ? block.point.x - reach : block.point.x - reach / 2;
    bounds.left = Math.min(bounds.left, left - 8);
    bounds.right = Math.max(bounds.right, left + reach + 8);
    bounds.top = Math.min(bounds.top, block.point.y - 20);
    bounds.bottom = Math.max(bounds.bottom, block.point.y + 3 * READING_LINE + 8);
  }
  return { x: bounds.left, y: bounds.top, width: Math.max(360, bounds.right - bounds.left), height: Math.max(220, bounds.bottom - bounds.top) };
}

/** The sheet with a part — and the parts selected with it — where they are being dragged to. */
export function movedItem(document: SchematicDocument, move: PartMove): SchematicDocument {
  const leader = document.items.find((item) => item.id === move.id);
  if (!leader) {
    return document;
  }
  const dx = move.x - leader.x;
  const dy = move.y - leader.y;
  const together = new Set(move.together ?? []);
  return { ...document, items: document.items.map((item) => item.id === move.id || together.has(item.id)
    ? { ...item, x: item.x + dx, y: item.y + dy } : item) };
}

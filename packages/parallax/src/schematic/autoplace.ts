import type { PartLibraryView } from "./partLibrary";
import type { CircuitElement } from "../circuit/circuit";
import {
  bodyOf, GROUND_TERMINAL, portKey, portsOf, positionOf,
  type DrawingItem, type DrawingType, type DrawingWire, type SchematicDocument,
} from "../circuit/SchematicDocument";
import { GRID, snap } from "../routing";

/**
 * A sheet for a circuit that has no drawing of its own, laid out the way an engineer draws one: the signal flows left
 * to right from its source; a part between two signal nodes lies along the top in series; a part to ground stands
 * under its node; a part with many pins sits below them; and every pin on ground gets its own ground mark instead of
 * one rail threaded through the whole sheet. Parts never overlap — each keeps a channel around it for the router.
 *
 * Placement only: the wires are each node's pins in order along the sheet, and `lib/schematic-routing` decides where they run.
 */

const GROUND = "0";
const COLUMN = GRID * 10;
const ROW = GRID * 8;
/** The free band kept around every part, so two wires can pass between neighbours. */
const CLEARANCE = GRID * 2;

type Box = { left: number; right: number; top: number; bottom: number };

const terminalsOf = (element: CircuitElement): [string, string][] => element.type === "MODEL"
  ? Object.entries(element.pins ?? {})
  : [["+", element.positive ?? ""], ["−", element.negative ?? ""]];

/** A part with more than two terminals — a timer, a potentiometer — is placed as a block; the rest lie in series or stand to ground. */
const isBlock = (element: CircuitElement) => terminalsOf(element).length > 2;

const signalNodes = (element: CircuitElement) => terminalsOf(element).map(([, node]) => node).filter((node) => node && node !== GROUND);

/**
 * How far each node is from the source, in parts: two-terminal parts carry the signal one step; a part with many pins
 * passes it on to the pins it has not reached yet, one step further than the farthest it has.
 */
function depthsOf(elements: readonly CircuitElement[]): Map<string, number> {
  const depths = new Map<string, number>();
  const source = elements.find((element) => element.type === "VOLTAGE_SOURCE" || element.type === "CURRENT_SOURCE");
  const start = (source ? [source.positive, source.negative].find((node) => node && node !== GROUND) : null)
    ?? elements.flatMap(signalNodes)[0];
  if (!start) {
    return depths;
  }
  depths.set(start, 0);
  let changed = true;
  while (changed) {
    changed = false;
    // Two-terminal parts first, breadth by breadth.
    let frontier = [...depths.keys()];
    while (frontier.length) {
      const next: string[] = [];
      for (const element of elements) {
        if (isBlock(element)) {
          continue;
        }
        const nodes = signalNodes(element);
        if (nodes.length !== 2) {
          continue;
        }
        const [first, second] = nodes;
        for (const [from, to] of [[first, second], [second, first]]) {
          if (frontier.includes(from) && !depths.has(to)) {
            depths.set(to, depths.get(from)! + 1);
            next.push(to);
          }
        }
      }
      frontier = next;
    }
    for (const element of elements.filter(isBlock)) {
      const nodes = signalNodes(element);
      const reached = nodes.filter((node) => depths.has(node));
      if (reached.length && reached.length < nodes.length) {
        const beyond = Math.max(...reached.map((node) => depths.get(node)!)) + 1;
        nodes.filter((node) => !depths.has(node)).forEach((node) => depths.set(node, beyond));
        changed = true;
      }
    }
  }
  for (const node of elements.flatMap(signalNodes)) {
    if (!depths.has(node)) {
      depths.set(node, 0);
    }
  }
  return depths;
}

function boxOf(library: PartLibraryView, item: DrawingItem): Box {
  const { halfWidth, halfHeight } = bodyOf(library, item);
  const vertical = item.rotation % 180 !== 0;
  const width = (vertical ? halfHeight : halfWidth) + CLEARANCE;
  const height = (vertical ? halfWidth : halfHeight) + CLEARANCE;
  const ports = portsOf(library, item).map((port) => positionOf(library, item, port.name));
  return {
    left: Math.min(item.x - width, ...ports.map((port) => port.x - CLEARANCE)),
    right: Math.max(item.x + width, ...ports.map((port) => port.x + CLEARANCE)),
    top: Math.min(item.y - height, ...ports.map((port) => port.y - CLEARANCE)),
    bottom: Math.max(item.y + height, ...ports.map((port) => port.y + CLEARANCE)),
  };
}

const overlap = (first: Box, second: Box) => first.left < second.right && second.left < first.right
  && first.top < second.bottom && second.top < first.bottom;

export function placeCircuit(library: PartLibraryView, elements: readonly CircuitElement[]): SchematicDocument {
  const depths = depthsOf(elements);
  const placed: DrawingItem[] = [];
  const boxes: Box[] = [];
  const columnX = (depth: number) => depth * COLUMN;

  /** Puts a part at its place, or the first free one below it (or to its right, for a part with many pins). */
  const settle = (item: DrawingItem, sideways: boolean) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const box = boxOf(library, item);
      if (!boxes.some((other) => overlap(box, other))) {
        placed.push(item);
        boxes.push(box);
        return;
      }
      if (sideways) {
        item.x += COLUMN / 2;
      } else {
        item.y += ROW / 2;
      }
    }
    placed.push(item);
    boxes.push(boxOf(library, item));
  };

  /** A two-terminal part's turn so that `wanted` faces the way asked: left, or up. */
  const turned = (item: DrawingItem, wanted: string, axis: "left" | "up") => {
    for (const rotation of axis === "left" ? [0, 180] : [90, 270]) {
      const candidate = { ...item, rotation };
      const terminal = positionOf(library, candidate, wanted);
      if (axis === "left" ? terminal.x < candidate.x : terminal.y < candidate.y) {
        return candidate;
      }
    }
    return { ...item, rotation: axis === "left" ? 0 : 90 };
  };

  const ordered = [...elements].sort((first, second) => {
    const rank = (element: CircuitElement) => isBlock(element) ? 2 : signalNodes(element).length === 2 ? 0 : 1;
    return rank(first) - rank(second);
  });
  for (const element of ordered) {
    const base: DrawingItem = { id: element.id, type: element.type as DrawingType, x: 0, y: 0, rotation: 0, element };
    const nodes = signalNodes(element);
    const terminals = terminalsOf(element);
    if (isBlock(element)) {
      const depth = nodes.length ? nodes.reduce((sum, node) => sum + depths.get(node)!, 0) / nodes.length : 0;
      settle({ ...base, x: snap(columnX(depth)), y: snap(ROW * 2.5) }, true);
    } else if (nodes.length === 2) {
      const [first, second] = nodes;
      const [nearer, farther] = depths.get(first)! <= depths.get(second)! ? [first, second] : [second, first];
      const towardsSource = terminals.find(([, node]) => node === nearer)![0];
      const middle = (depths.get(nearer)! + Math.max(depths.get(farther)!, depths.get(nearer)! + 1)) / 2;
      settle(turned({ ...base, x: snap(columnX(middle)), y: 0 }, towardsSource, "left"), false);
    } else {
      const node = nodes[0];
      const signal = terminals.find(([, candidate]) => candidate === node)?.[0] ?? terminals[0][0];
      settle(turned({ ...base, x: snap(columnX(node ? depths.get(node)! : 0)), y: ROW }, signal, "up"), false);
    }
  }

  refine(library, placed);

  // Every pin on ground gets its own mark, just below it.
  const items = [...placed];
  const wires: DrawingWire[] = [];
  const groundPorts: { item: DrawingItem; terminal: string }[] = [];
  const byNode = new Map<string, string[]>();
  for (const item of placed) {
    for (const [terminal, node] of terminalsOf(item.element!)) {
      if (!node) {
        continue;
      }
      if (node === GROUND) {
        groundPorts.push({ item, terminal });
      } else {
        byNode.set(node, [...byNode.get(node) ?? [], portKey(item.id, terminal)]);
      }
    }
  }
  groundPorts.forEach(({ item, terminal }, index) => {
    const pin = positionOf(library, item, terminal);
    const below = Math.max(pin.y, boxOf(library, item).bottom - CLEARANCE) + GRID * 2;
    const mark: DrawingItem = { id: `GND${index + 1}`, type: "GROUND", x: snap(pin.x), y: snap(below), rotation: 0 };
    const terminalPoint = positionOf(library, mark, GROUND_TERMINAL);
    mark.x = snap(mark.x + (pin.x - terminalPoint.x));
    mark.y = snap(mark.y + (below - terminalPoint.y));
    items.push(mark);
    wires.push({ id: `wire-${wires.length + 1}`, from: portKey(item.id, terminal), to: portKey(mark.id, GROUND_TERMINAL), bends: [] });
  });

  // A node's pins are chained along the sheet, left to right; the router merges the chain into one tree.
  for (const ports of byNode.values()) {
    const sorted = [...ports].sort((first, second) => {
      const at = (key: string) => {
        const separator = key.indexOf(":");
        const item = items.find((candidate) => candidate.id === key.slice(0, separator))!;
        return positionOf(library, item, key.slice(separator + 1));
      };
      return at(first).x - at(second).x || at(first).y - at(second).y;
    });
    for (let index = 1; index < sorted.length; index++) {
      wires.push({ id: `wire-${wires.length + 1}`, from: sorted[index - 1], to: sorted[index], bends: [] });
    }
  }

  // The sheet starts at a margin from its origin.
  const left = Math.min(...items.map((item) => boxOf(library, item).left));
  const top = Math.min(...items.map((item) => boxOf(library, item).top));
  for (const item of items) {
    item.x = snap(item.x - left + GRID * 4);
    item.y = snap(item.y - top + GRID * 4);
  }
  return { version: 1, items, wires };
}

const REFINE_PASSES = 10;
const SEARCH_STEPS = 4;
/** How strongly a part keeps to its column in the signal's flow, per grid step away from it. */
const FLOW_PULL = 0.15;
/** What a part pays for turning its ground pin anywhere but down. */
const GROUND_UP = 3;

/**
 * Moves every part, a few passes over, to the spot and turn near where its nodes' other pins are that makes the
 * wiring shortest — the half perimeter of each node's pins, the measure placement tools use — without overlapping
 * another part, keeping lightly to its column in the flow, and with its ground pin down.
 */
function refine(library: PartLibraryView, placed: DrawingItem[]) {
  const pinsOf = (item: DrawingItem) => terminalsOf(item.element!).map(([terminal, node]) => ({ node, point: positionOf(library, item, terminal) }));
  const column = new Map(placed.map((item) => [item.id, item.x]));
  const wiring = (moved: DrawingItem) => {
    const byNode = new Map<string, { x: number; y: number }[]>();
    for (const item of placed) {
      for (const { node, point } of pinsOf(item.id === moved.id ? moved : item)) {
        if (node && node !== GROUND) {
          byNode.set(node, [...byNode.get(node) ?? [], point]);
        }
      }
    }
    let total = 0;
    for (const node of new Set(pinsOf(moved).map((pin) => pin.node))) {
      const points = byNode.get(node);
      if (!points || points.length < 2) {
        continue;
      }
      total += Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))
        + Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    }
    return total / GRID;
  };
  const groundPenalty = (item: DrawingItem) => {
    const pins = pinsOf(item);
    const ground = pins.filter((pin) => pin.node === GROUND);
    const others = pins.filter((pin) => pin.node !== GROUND);
    if (!ground.length || !others.length) {
      return 0;
    }
    return ground.some((pin) => others.some((other) => pin.point.y < other.point.y + GRID / 2)) ? GROUND_UP : 0;
  };
  const score = (item: DrawingItem) => wiring(item) + groundPenalty(item)
    + FLOW_PULL * Math.abs(item.x - column.get(item.id)!) / GRID;

  for (let pass = 0; pass < REFINE_PASSES; pass++) {
    let moved = false;
    for (let index = 0; index < placed.length; index++) {
      const item = placed[index];
      const others = placed.filter((other) => other.id !== item.id).map((other) => boxOf(library, other));
      const rotations = terminalsOf(item.element!).length === 2 ? [0, 90, 180, 270] : [item.rotation];
      let best = item;
      let bestScore = score(item);
      for (const rotation of rotations) {
        for (let across = -SEARCH_STEPS; across <= SEARCH_STEPS; across++) {
          for (let down = -SEARCH_STEPS; down <= SEARCH_STEPS; down++) {
            const candidate = { ...item, rotation, x: item.x + across * GRID * 2, y: item.y + down * GRID * 2 };
            const box = boxOf(library, candidate);
            if (others.some((other) => overlap(box, other))) {
              continue;
            }
            const candidateScore = score(candidate);
            if (candidateScore < bestScore - 0.01) {
              best = candidate;
              bestScore = candidateScore;
            }
          }
        }
      }
      if (best !== item) {
        placed[index] = best;
        moved = true;
      }
    }
    if (!moved) {
      break;
    }
  }
}

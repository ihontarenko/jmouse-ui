import { GRID, parsePort, portKey, snap } from "./grid";

/**
 * Wires routed the way a careful draughtsman routes them, on the sheet's grid:
 *
 * - a wire never passes through a part's body or over another node's pin;
 * - a wire never runs along another node's wire — it may only cross it, at a right angle, and never turns on it,
 *   so a crossing can never be mistaken for a connection;
 * - a wire may run along its own node's wires — that is how a node's pins join into one tree — and where three or
 *   more of its runs meet, the junction gets a dot;
 * - where a wire crosses another node, the horizontal one hops over the vertical one with a half circle, so a
 *   crossing reads as "not connected" at a glance;
 * - fewer bends and fewer crossings win; shorter wires are routed first, so the long ones go around.
 *
 * Electrical meaning never comes from here: the netlist does. This only decides where the lines are drawn.
 */

/** A point on the sheet, in sheet units. */
export type SheetPoint = { x: number; y: number };
type Point = SheetPoint;
type Axis = "horizontal" | "vertical";

/** A part standing on the sheet: its centre and its turn in degrees. */
export interface SheetPart {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

/** A wire between two pins, each named by `portKey`, through the bends a person drew. */
export interface SheetWire {
  id: string;
  from: string;
  to: string;
  bends: readonly SheetPoint[];
}

/** What the router has to know of a part's shape; the caller knows what the part is. */
export interface PartGeometry<Part extends SheetPart> {
  /** A bare junction: no body, and its one pin leaves in no particular direction. */
  isJunction(part: Part): boolean;
  /** Half the extent of the part's body in its own coordinates, before it is turned. */
  bodyOf(part: Part): { halfWidth: number; halfHeight: number };
  /** The names of the part's pins. */
  pinNamesOf(part: Part): readonly string[];
  /** Where a pin stands on the sheet, the part's turn and mirroring applied. */
  pinPositionOf(part: Part, pin: string): SheetPoint;
}

/** Every wire of a sheet as a path, with its junction dots and its hops. */
export interface RoutedSheet {
  paths: Map<string, Point[]>;
  /** Where a node's wires branch, three or more ways: drawn as dots. */
  junctions: Point[];
  /** Per wire, the points where it hops over another node's wire. */
  hops: Map<string, Point[]>;
}

const HOP = GRID * 0.3;

/** A routed wire as an SVG path, with a half circle over every crossing on its horizontal runs. */
export function wirePath(points: readonly Point[], hops: readonly Point[] = []): string {
  let path = "";
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    if (index === 0) {
      path += `M${point.x} ${point.y}`;
      continue;
    }
    const from = points[index - 1];
    if (from.y === point.y && from.x !== point.x) {
      const direction = Math.sign(point.x - from.x);
      const over = hops.filter((hop) => hop.y === point.y && (hop.x - from.x) * direction > HOP && (point.x - hop.x) * direction > HOP)
        .sort((first, second) => (first.x - second.x) * direction);
      for (const hop of over) {
        path += `L${hop.x - HOP * direction} ${hop.y}A${HOP} ${HOP} 0 0 ${direction > 0 ? 1 : 0} ${hop.x + HOP * direction} ${hop.y}`;
      }
    }
    path += `L${point.x} ${point.y}`;
  }
  return path;
}

const keyOf = (point: Point) => `${point.x},${point.y}`;
const BEND = 2;
const CROSSING = 6;
const OWN_RUN = 0.4;
const SEARCH_LIMIT = 40_000;

const directions: { step: Point; axis: Axis }[] = [
  { step: { x: GRID, y: 0 }, axis: "horizontal" }, { step: { x: 0, y: GRID }, axis: "vertical" },
  { step: { x: -GRID, y: 0 }, axis: "horizontal" }, { step: { x: 0, y: -GRID }, axis: "vertical" },
];

/** Which way a pin leaves its part: away from the part's centre, along the longer offset. */
function outward<Part extends SheetPart>(item: Part, pin: Point, geometry: PartGeometry<Part>): Point {
  if (geometry.isJunction(item)) {
    return { x: 0, y: 0 };
  }
  const across = pin.x - item.x;
  const down = pin.y - item.y;
  return Math.abs(across) > Math.abs(down) ? { x: Math.sign(across), y: 0 } : { x: 0, y: Math.sign(down) || -1 };
}

/** The node every pin belongs to, by the wires drawn between pins. */
function nodesOf<Part extends SheetPart>(document: RoutableSheet<Part>, geometry: PartGeometry<Part>): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    if (!parent.has(key)) {
      parent.set(key, key);
    }
    const root = parent.get(key)!;
    if (root === key) {
      return key;
    }
    const top = find(root);
    parent.set(key, top);
    return top;
  };
  for (const item of document.items) {
    for (const pin of geometry.pinNamesOf(item)) {
      find(portKey(item.id, pin));
    }
  }
  for (const wire of document.wires) {
    const first = find(wire.from);
    const second = find(wire.to);
    if (first !== second) {
      parent.set(second, first);
    }
  }
  return new Map([...parent.keys()].map((key) => [key, find(key)]));
}

/** A sheet as the router reads it: the parts standing on it and the wires drawn between their pins. */
type RoutableSheet<Part extends SheetPart> = { items: readonly Part[]; wires: readonly SheetWire[] };

/** Every wire of a sheet routed together, by the rules above; `geometry` says where each part's body and pins are. */
export function routeSheet<Part extends SheetPart>(document: RoutableSheet<Part>, geometry: PartGeometry<Part>): RoutedSheet {
  const nodes = nodesOf(document, geometry);
  const itemById = new Map(document.items.map((item) => [item.id, item]));
  const bodies = document.items.filter((item) => !geometry.isJunction(item)).map((item) => {
    const { halfWidth, halfHeight } = geometry.bodyOf(item);
    const vertical = item.rotation % 180 !== 0;
    return { item, width: vertical ? halfHeight : halfWidth, height: vertical ? halfWidth : halfHeight };
  });
  const insideBody = (point: Point) => bodies.some(({ item, width, height }) =>
    Math.abs(point.x - item.x) < width && Math.abs(point.y - item.y) < height);

  // Every pin and the grid step in front of it belong to its node; no other node may touch them.
  const reserved = new Map<string, string>();
  const pinOf = (key: string) => {
    const { id, name } = parsePort(key);
    const item = itemById.get(id);
    if (!item) {
      return null;
    }
    const pin = geometry.pinPositionOf(item, name);
    const direction = outward(item, pin, geometry);
    const stub = { x: snap(pin.x + direction.x * GRID), y: snap(pin.y + direction.y * GRID) };
    return { pin, stub, node: nodes.get(key) ?? key };
  };
  for (const item of document.items) {
    for (const pin of geometry.pinNamesOf(item)) {
      const found = pinOf(portKey(item.id, pin));
      if (found) {
        reserved.set(keyOf({ x: snap(found.pin.x), y: snap(found.pin.y) }), found.node);
        reserved.set(keyOf(found.stub), found.node);
      }
    }
  }

  const runs: Record<Axis, Map<string, string>> = { horizontal: new Map(), vertical: new Map() };
  const ownedBy = (point: Point) => runs.horizontal.get(keyOf(point)) ?? runs.vertical.get(keyOf(point)) ?? null;
  const record = (path: Point[], node: string) => {
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1];
      const to = path[index];
      const axis: Axis = from.y === to.y ? "horizontal" : "vertical";
      const steps = Math.round(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / GRID);
      for (let step = 0; step <= steps; step++) {
        const point = { x: snap(from.x + (to.x - from.x) * step / Math.max(1, steps)), y: snap(from.y + (to.y - from.y) * step / Math.max(1, steps)) };
        runs[axis].set(keyOf(point), node);
      }
    }
  };

  const extent = document.items.reduce((box, item) => ({
    left: Math.min(box.left, item.x), right: Math.max(box.right, item.x),
    top: Math.min(box.top, item.y), bottom: Math.max(box.bottom, item.y),
  }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const margin = GRID * 12;

  const search = (start: Point, end: Point, node: string): Point[] | null => {
    type State = { point: Point; direction: number; cost: number; score: number; parent?: State };
    const heap: State[] = [];
    const push = (state: State) => {
      heap.push(state);
      let index = heap.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (heap[parent].score <= state.score) {
          break;
        }
        heap[index] = heap[parent];
        index = parent;
      }
      heap[index] = state;
    };
    const pop = () => {
      const first = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        let index = 0;
        while (index * 2 + 1 < heap.length) {
          let child = index * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) {
            child++;
          }
          if (heap[child].score >= last.score) {
            break;
          }
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
      }
      return first;
    };
    const estimate = (point: Point) => (Math.abs(point.x - end.x) + Math.abs(point.y - end.y)) / GRID;
    const best = new Map<string, number>();
    const endKey = keyOf(end);
    push({ point: start, direction: -1, cost: 0, score: estimate(start) });
    for (let iteration = 0; heap.length && iteration < SEARCH_LIMIT; iteration++) {
      const current = pop();
      if (keyOf(current.point) === endKey) {
        const path: Point[] = [];
        for (let state: State | undefined = current; state; state = state.parent) {
          path.push(state.point);
        }
        return path.reverse();
      }
      const here = ownedBy(current.point);
      for (let direction = 0; direction < 4; direction++) {
        const { step, axis } = directions[direction];
        const point = { x: current.point.x + step.x, y: current.point.y + step.y };
        const key = keyOf(point);
        if (point.x < extent.left - margin || point.x > extent.right + margin || point.y < extent.top - margin || point.y > extent.bottom + margin) {
          continue;
        }
        const turning = current.direction >= 0 && current.direction !== direction;
        // Never turn on another node's wire: it would read as a connection.
        if (turning && here !== null && here !== node) {
          continue;
        }
        if (key !== endKey) {
          const owner = reserved.get(key);
          if ((owner !== undefined && owner !== node) || insideBody(point)) {
            continue;
          }
        }
        const along = runs[axis].get(key);
        const across = runs[axis === "horizontal" ? "vertical" : "horizontal"].get(key);
        if (along !== undefined && along !== node) {
          continue;
        }
        const own = along === node || across === node;
        const cost = current.cost + (own ? OWN_RUN : 1) + (turning ? BEND : 0)
          + (across !== undefined && across !== node ? CROSSING : 0);
        const state = `${key}:${direction}`;
        if (cost >= (best.get(state) ?? Infinity)) {
          continue;
        }
        best.set(state, cost);
        push({ point, direction, cost, score: cost + estimate(point), parent: current });
      }
    }
    return null;
  };

  const compact = (points: Point[]) => points.filter((point, index) => index === 0 || index === points.length - 1
    || (point.x - points[index - 1].x) * (points[index + 1].y - point.y) !== (point.y - points[index - 1].y) * (points[index + 1].x - point.x));

  const paths = new Map<string, Point[]>();
  const planned = document.wires.map((wire) => ({ wire, from: pinOf(wire.from), to: pinOf(wire.to) }))
    .sort((first, second) => {
      const length = (entry: typeof first) => entry.from && entry.to
        ? Math.abs(entry.from.pin.x - entry.to.pin.x) + Math.abs(entry.from.pin.y - entry.to.pin.y) : 0;
      return length(first) - length(second);
    });
  for (const { wire, from, to } of planned) {
    if (!from || !to) {
      paths.set(wire.id, []);
      continue;
    }
    const node = from.node;
    const anchors = [from.stub, ...wire.bends.map((bend) => ({ x: snap(bend.x), y: snap(bend.y) })), to.stub];
    const route: Point[] = [from.pin];
    for (let index = 1; index < anchors.length; index++) {
      const leg = search(anchors[index - 1], anchors[index], node)
        ?? [anchors[index - 1], { x: anchors[index].x, y: anchors[index - 1].y }, anchors[index]];
      route.push(...(index === 1 ? leg : leg.slice(1)));
    }
    route.push(to.pin);
    const path = compact(route);
    record(path.slice(1, -1).length > 1 ? path.slice(1, -1) : path, node);
    paths.set(wire.id, path);
  }

  const nodeOfWire = new Map(document.wires.map((wire) => [wire.id, nodes.get(wire.from) ?? wire.from]));
  return { paths, junctions: junctionsOf(paths, document.wires, nodes), hops: hopsOf(paths, nodeOfWire) };
}

/**
 * The points where three or more runs of one node meet — a pin counts as one of them: two wires leaving one pin are a
 * branch, and KiCad dots it as surely as a tee in the open.
 *
 * <p>Which wires are one node is told by what they share, not by the node map alone: a wire between a junction and a
 * ground mark has no node of its own in it, and keyed by its own end each such wire was a node apart — three wires met
 * in a point and no dot was drawn.</p>
 */
function junctionsOf(paths: Map<string, Point[]>, wires: readonly SheetWire[], nodes: Map<string, string>): Point[] {
  const parents = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    while (parents.has(root) && parents.get(root) !== root) {
      root = parents.get(root)!;
    }
    parents.set(key, root);
    return root;
  };
  const join = (first: string, second: string) => {
    const one = find(first);
    const other = find(second);
    if (one !== other) {
      parents.set(one, other);
    }
  };
  for (const wire of wires) {
    for (const end of [wire.from, wire.to]) {
      join(`wire:${wire.id}`, `end:${end}`);
      const node = nodes.get(end);
      if (node) {
        join(`wire:${wire.id}`, `node:${node}`);
      }
    }
  }
  const edges = new Map<string, Set<string>>();
  const touch = (node: string, point: Point, neighbour: string) => {
    const key = `${node}|${keyOf(point)}`;
    if (!edges.has(key)) {
      edges.set(key, new Set());
    }
    edges.get(key)!.add(neighbour);
  };
  for (const wire of wires) {
    const node = find(`wire:${wire.id}`);
    const path = paths.get(wire.id) ?? [];
    if (path.length > 1) {
      touch(node, path[0], `pin:${wire.from}`);
      touch(node, path[path.length - 1], `pin:${wire.to}`);
    }
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1];
      const to = path[index];
      if (from.x !== to.x && from.y !== to.y) {
        continue;
      }
      const steps = Math.round(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / GRID);
      for (let step = 0; step < steps; step++) {
        const stepStart = { x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps };
        const stepEnd = { x: from.x + (to.x - from.x) * (step + 1) / steps, y: from.y + (to.y - from.y) * (step + 1) / steps };
        for (const [point, other] of [[stepStart, stepEnd], [stepEnd, stepStart]] as const) {
          touch(node, point, keyOf(other));
        }
      }
    }
  }
  return [...edges.entries()].filter(([, neighbours]) => neighbours.size >= 3).map(([key]) => {
    const [x, y] = key.split("|")[1].split(",").map(Number);
    return { x, y };
  });
}

/** Where each wire's horizontal runs cross another node's vertical runs, strictly between their ends. */
function hopsOf(paths: Map<string, Point[]>, nodeOfWire: Map<string, string>): Map<string, Point[]> {
  const verticals: { node: string; x: number; top: number; bottom: number }[] = [];
  for (const [id, path] of paths) {
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1];
      const to = path[index];
      if (from.x === to.x && from.y !== to.y) {
        verticals.push({ node: nodeOfWire.get(id)!, x: from.x, top: Math.min(from.y, to.y), bottom: Math.max(from.y, to.y) });
      }
    }
  }
  const hops = new Map<string, Point[]>();
  for (const [id, path] of paths) {
    const node = nodeOfWire.get(id)!;
    const found: Point[] = [];
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1];
      const to = path[index];
      if (from.y !== to.y) {
        continue;
      }
      const left = Math.min(from.x, to.x);
      const right = Math.max(from.x, to.x);
      for (const vertical of verticals) {
        if (vertical.node !== node && vertical.x > left && vertical.x < right && from.y > vertical.top && from.y < vertical.bottom) {
          found.push({ x: vertical.x, y: from.y });
        }
      }
    }
    hops.set(id, found);
  }
  return hops;
}

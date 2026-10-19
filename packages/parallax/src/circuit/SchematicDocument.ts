import { COMMON_SYMBOL, GROUND_SYMBOL, LABEL_SYMBOL, type PartLibraryView } from "../schematic/partLibrary";
import { GRID, parsePort, portKey, routeSheet, snap, type PartGeometry, type RoutedSheet } from "../routing";
import { placeCircuit } from "../schematic/autoplace";
import { drawingExtent, type SymbolDrawingDocument } from "../schematic/symbolDrawingDocument";
import { pinSide } from "../component/symbol";
import { elementTypes, type CircuitElement, type CircuitElementType, type CircuitDefinition, type MeterShow, type SchematicLayout } from "./circuit";

export type DrawingType = CircuitElementType | "GROUND" | "JUNCTION";
/** `net` is the net a ground mark is: absent for node 0, a name (`agnd`) for a ground of its own. */
export interface DrawingItem {
  id: string; type: DrawingType; x: number; y: number; rotation: number; mirrored?: boolean; element?: CircuitElement; net?: string;
  /** A ground mark drawn as the circuit's 0 V — the common of a bipolar supply —, not as an earth. */
  common?: boolean;
  /**
   * A net's label, as KiCad draws a power port: a mark that is its `net`, drawn as a flag with the net's name. Every
   * label of one net is that net — no wire is drawn between them —, so a rail reaches its pins without crossing the sheet.
   */
  label?: boolean;
  /** Where its texts stand when put there by hand, from its centre; the sheet places the others. */
  labels?: Partial<Record<"name" | "value" | "readings", { x: number; y: number }>>;
  /** How an instrument's display reads, when the reader chose; kept with the circuit. */
  shows?: MeterShow[];
}

/** The node a ground mark is: its own net, or node 0. */
export function groundNodeOf(item: DrawingItem): string {
  return item.net ?? "0";
}
export interface DrawingWire { id: string; from: string; to: string; bends: { x: number; y: number }[] }
export interface SchematicDocument { version: 1; items: DrawingItem[]; wires: DrawingWire[] }

export const SHEET_WIDTH = 1200;
export const SHEET_HEIGHT = 760;
export { GRID, parsePort, portKey, snap };

/** The terminal of the sheet's ground mark: the one pin of its symbol document. */
export const GROUND_TERMINAL = "ground";
/** The terminal of a 0 V mark: `Z1.common`. */
export const COMMON_TERMINAL = "common";
/** The terminal of a net's label: `L1.label`. */
export const LABEL_TERMINAL = "label";

/** The one terminal of a ground mark, by how it is drawn. */
export function groundTerminalOf(item: DrawingItem): string {
  return item.label ? LABEL_TERMINAL : item.common ? COMMON_TERMINAL : GROUND_TERMINAL;
}
/** A primitive's two terminals, in the order its component's pins are written. */
const PRIMITIVE_TERMINALS = ["+", "−"] as const;

type Side = "left" | "right" | "top" | "bottom";
type Port = { name: string; x: number; y: number };
type Point = { x: number; y: number };

/** The component a part is — a model's pinned reference, or the component a primitive's netlist word names. */
export function componentReferenceOf(item: DrawingItem): string | null {
  if (item.type === "GROUND" || item.type === "JUNCTION") {
    return null;
  }
  if (item.type === "MODEL") {
    return item.element?.component || null;
  }
  return elementTypes[item.type].component;
}

export function componentReferencesOf(items: readonly DrawingItem[]): string[] {
  return items.map(componentReferenceOf).filter((reference): reference is string => !!reference);
}

/** The names a part's wires attach to: a model's pins, a primitive's `+` and `−`, the ground's one terminal. */
export function terminalsOf(item: DrawingItem): string[] {
  if (item.type === "JUNCTION") {
    return ["j"];
  }
  if (item.type === "GROUND") {
    return [groundTerminalOf(item)];
  }
  if (item.type === "MODEL") {
    return Object.keys(item.element?.pins ?? {});
  }
  return [...PRIMITIVE_TERMINALS];
}

/**
 * The symbol document a part is drawn from and where each of its terminals lands on it — or null when the part is
 * drawn as a box: its component draws itself from its pins (`symbol box`), its data has not arrived, or a terminal
 * has no port. A model's terminal is its pin (`A.output` is the pin `output`); a primitive's `+` is its component's
 * first pin and `−` its second; each pin is found at the port the component's `symbol uses` line maps to it.
 */
export function partDrawingOf(library: PartLibraryView, item: DrawingItem): { drawing: SymbolDrawingDocument; ports: Port[] } | null {
  if (item.type === "JUNCTION") {
    return null;
  }
  if (item.type === "GROUND") {
    const drawing = library.symbolDrawingOf(item.label ? LABEL_SYMBOL : item.common ? COMMON_SYMBOL : GROUND_SYMBOL);
    const pin = drawing?.pins?.[0];
    return drawing && pin ? { drawing, ports: [{ name: groundTerminalOf(item), x: pin.x, y: pin.y }] } : null;
  }
  const reference = componentReferenceOf(item);
  const model = reference ? library.componentModelOf(reference) : null;
  // A part's own `symbol …` wins; otherwise its component's default drawing — a generator brings its own.
  const chosen = item.element?.symbol && model?.symbolVariants.includes(item.element.symbol) ? item.element.symbol
    : model?.symbolReference;
  const drawing = chosen ? library.symbolDrawingOf(chosen) : undefined;
  if (!model || !drawing) {
    return null;
  }
  const pinOf = (terminal: string, index: number) => item.type === "MODEL"
    ? terminal.split(".").at(-1) ?? terminal : model.pins[index]?.name;
  const ports: Port[] = [];
  const terminals = terminalsOf(item);
  for (let index = 0; index < terminals.length; index++) {
    const pin = pinOf(terminals[index], index);
    const port = drawing.pins?.find((candidate) => model.symbolPorts[candidate.name] === pin);
    if (!port) {
      return null;
    }
    ports.push({ name: terminals[index], x: port.x, y: port.y });
  }
  return { drawing, ports };
}

/** Pins of a box stand two grid steps apart, so a wire can leave every one of them on its own grid line. */
const BOX_PITCH = GRID * 2;
/** A pin leaves its box through a lead one grid step long; the wire starts at the lead's end. */
const BOX_LEAD = GRID;
/** How wide a pin's name is drawn inside a box: 9 px technical type. */
const labelWidth = (text: string) => text.length * 5.5 + 6;
const roundUp = (value: number, step: number) => Math.ceil(value / step) * step;

export interface BoxGeometry {
  halfWidth: number;
  halfHeight: number;
  name: string;
  /** Where the component's name stands: over the box, under it when pins leave its top, inside only when both do. */
  namePlace: "over" | "under" | "inside";
  ports: (Port & { side: Side; edge: Point })[];
}

/**
 * The box a part without a drawing is drawn as, sized by what is written on it: its pins on their sides two grid steps
 * apart, wide enough for the longest left and right pin names with the part's name between them, and tall enough for
 * the longer side. Every pin lands on the sheet's grid, so routes leave pins straight.
 */
export function boxGeometry(library: PartLibraryView, item: DrawingItem): BoxGeometry {
  const names = terminalsOf(item);
  const sides: Record<Side, string[]> = { left: [], right: [], top: [], bottom: [] };
  for (const name of names) {
    sides[boxSideOf(library, item, name)].push(name);
  }
  const reference = item.element?.component ?? "";
  const name = library.componentModelOf(reference)?.name ?? (reference.split("@")[0] || "Part");
  const widest = (list: string[]) => Math.max(0, ...list.map(labelWidth));
  const across = Math.max(widest(sides.top), widest(sides.bottom), BOX_PITCH);
  const horizontalPitch = roundUp(across + 8, BOX_PITCH);
  // As small as its pins allow: the pins' names inside, the component's name over it (`namePlace`) — a regulator of three
  // pins was a 160 × 80 box beside 80-long resistors, its name sharing a row with two pin names.
  const namePlace: BoxGeometry["namePlace"] = !sides.top.length ? "over" : !sides.bottom.length ? "under" : "inside";
  const inner = Math.max(widest(sides.left) + widest(sides.right) + 12 + (namePlace === "inside" ? labelWidth(name) : 0),
    sides.top.length * horizontalPitch, sides.bottom.length * horizontalPitch, 48);
  const halfWidth = roundUp(inner / 2, GRID);
  const halfHeight = Math.max(GRID, roundUp((Math.max(sides.left.length, sides.right.length) * BOX_PITCH) / 2, GRID));
  const along = (list: string[], index: number, pitch: number) => (index - (list.length - 1) / 2) * pitch;
  const ports: BoxGeometry["ports"] = [];
  for (const side of ["left", "right", "top", "bottom"] as const) {
    sides[side].forEach((pin, index) => {
      if (side === "left" || side === "right") {
        const y = snap(along(sides[side], index, BOX_PITCH));
        const edge = side === "left" ? -halfWidth : halfWidth;
        ports.push({ name: pin, side, x: edge + (side === "left" ? -BOX_LEAD : BOX_LEAD), y, edge: { x: edge, y } });
      } else {
        const x = snap(along(sides[side], index, horizontalPitch));
        const edge = side === "top" ? -halfHeight : halfHeight;
        ports.push({ name: pin, side, x, y: edge + (side === "top" ? -BOX_LEAD : BOX_LEAD), edge: { x, y: edge } });
      }
    });
  }
  return { halfWidth, halfHeight, name, namePlace, ports };
}

/** Which side of its box a terminal leaves from: the component's `symbol box` sides, else alternating. */
export function boxSideOf(library: PartLibraryView, item: DrawingItem, terminal: string): Side {
  const reference = componentReferenceOf(item);
  const model = reference ? library.componentModelOf(reference) : null;
  if (model && item.type === "MODEL") {
    return pinSide(model, terminal.split(".").at(-1) ?? terminal);
  }
  return terminalsOf(item).indexOf(terminal) % 2 ? "right" : "left";
}

export function portsOf(library: PartLibraryView, item: DrawingItem): Port[] {
  if (item.type === "JUNCTION") {
    return [{ name: "j", x: 0, y: 0 }];
  }
  const drawn = partDrawingOf(library, item);
  if (drawn) {
    return drawn.ports;
  }
  return boxGeometry(library, item).ports.map(({ name, x, y }) => ({ name, x, y }));
}

/** A point in a part's own coordinates, rotated and mirrored with it onto the sheet. */
export function sheetPointOf(item: DrawingItem, point: { x: number; y: number }): { x: number; y: number } {
  const radians = item.rotation * Math.PI / 180;
  const localX = item.mirrored ? -point.x : point.x;
  return { x: item.x + localX * Math.cos(radians) - point.y * Math.sin(radians),
    y: item.y + localX * Math.sin(radians) + point.y * Math.cos(radians) };
}

export function positionOf(library: PartLibraryView, item: DrawingItem, name: string): { x: number; y: number } {
  return sheetPointOf(item, portsOf(library, item).find((candidate) => candidate.name === name) ?? { x: 0, y: 0 });
}

/**
 * Where a part's name or value is printed on the sheet: the symbol document's `label name` / `label value` anchor,
 * moved with the part while the text stays upright; above and below a box. Null when the drawing places no such label.
 */
export function labelPositionOf(library: PartLibraryView, item: DrawingItem, subject: "name" | "value"): { x: number; y: number } | null {
  const drawn = partDrawingOf(library, item);
  if (!drawn) {
    if (item.type === "JUNCTION") {
      return null;
    }
    // A box's name stands off its top-left corner, clear of the pins that leave its top.
    const { halfWidth, halfHeight } = boxGeometry(library, item);
    return subject === "name" ? { x: item.x - halfWidth - 6, y: item.y - halfHeight - 10 } : { x: item.x + halfWidth + 6, y: item.y + halfHeight + 10 };
  }
  const anchor = drawn.drawing.labels?.find((label) => label.subject === subject);
  return anchor ? sheetPointOf(item, anchor) : null;
}

/** Half the extent of a part's body in its own coordinates, which wires are routed around. */
export function bodyOf(library: PartLibraryView, item: DrawingItem): { halfWidth: number; halfHeight: number } {
  if (item.type === "JUNCTION") {
    return { halfWidth: 0, halfHeight: 0 };
  }
  const drawn = partDrawingOf(library, item);
  if (drawn) {
    const extent = drawingExtent(drawn.drawing);
    return { halfWidth: extent.halfWidth - 1, halfHeight: extent.halfHeight + 6 };
  }
  const box = boxGeometry(library, item);
  return { halfWidth: box.halfWidth + 4, halfHeight: box.halfHeight + 4 };
}

// Routes depend on where parts put their terminals, so a sheet is routed again when the part library changes — or when
// another library draws it.
const routed = new WeakMap<SchematicDocument, { library: PartLibraryView; revision: number; sheet: RoutedSheet }>();

/** A part's body and pins as the router reads them, from one library. */
function drawingGeometry(library: PartLibraryView): PartGeometry<DrawingItem> {
  return {
    isJunction: (item) => item.type === "JUNCTION",
    bodyOf: (item) => bodyOf(library, item),
    pinNamesOf: (item) => portsOf(library, item).map((port) => port.name),
    pinPositionOf: (item, pin) => positionOf(library, item, pin),
  };
}

/**
 * Every wire of a sheet routed together — see `lib/schematic-routing` for the rules —, except a lead: a wire to an
 * instrument hangs as a rope between its ends and the points it is hung through (`useTethers`), so the router neither
 * lays it nor steers other wires around it; its path here is the line through those points.
 */
export function routedSheet(library: PartLibraryView, document: SchematicDocument): RoutedSheet {
  const cached = routed.get(document);
  if (cached && cached.library === library && cached.revision === library.revision()) {
    return cached.sheet;
  }
  const leads = document.wires.filter((wire) => isLead(library, document, wire));
  const sheet = routeSheet(leads.length ? { ...document, wires: document.wires.filter((wire) => !leads.includes(wire)) } : document, drawingGeometry(library));
  leads.forEach((lead) => sheet.paths.set(lead.id, leadHolds(library, document, lead)));
  routed.set(document, { library, revision: library.revision(), sheet });
  return sheet;
}

/** Whether a wire is a lead: one end on an instrument — a part whose component says what it measures. */
export function isLead(library: PartLibraryView, document: SchematicDocument, wire: DrawingWire): boolean {
  return [wire.from, wire.to].some((end) => {
    const item = document.items.find((candidate) => candidate.id === parsePort(end).id);
    const reference = item ? componentReferenceOf(item) : null;
    return Boolean(reference && library.componentModelOf(reference)?.measures?.length);
  });
}

/** How a lead looks: what its instrument writes for the pin it ends on — or null when it writes nothing. */
export function leadLookOf(library: PartLibraryView, document: SchematicDocument, wire: DrawingWire): { colour: string; stripes: string | null } | null {
  for (const end of [wire.from, wire.to]) {
    const item = document.items.find((candidate) => candidate.id === parsePort(end).id);
    const reference = item ? componentReferenceOf(item) : null;
    const look = reference ? library.componentModelOf(reference)?.leads?.[parsePort(end).name] : undefined;
    if (look) {
      return look;
    }
  }
  return null;
}

/** Where a lead is held: its two ends and every point it was hung through, in order. */
export function leadHolds(library: PartLibraryView, document: SchematicDocument, wire: DrawingWire): Point[] {
  const end = (key: string) => {
    const item = document.items.find((candidate) => candidate.id === parsePort(key).id);
    return item ? positionOf(library, item, parsePort(key).name) : { x: 0, y: 0 };
  };
  return [end(wire.from), ...wire.bends, end(wire.to)];
}

export function wirePoints(library: PartLibraryView, document: SchematicDocument, wire: DrawingWire): Point[] {
  return routedSheet(library, document).paths.get(wire.id) ?? [];
}

/** The saved geometry is presentation data. The netlist derived below remains the solver's authoritative input. */
export function drawCircuit(library: PartLibraryView, elements: readonly CircuitElement[], serialized?: string): SchematicDocument {
  if (serialized) {
    try {
      const saved = JSON.parse(serialized) as SchematicDocument;
      if (saved.version === 1 && Array.isArray(saved.items) && Array.isArray(saved.wires)
        && saved.items.every((item) => typeof item.id === "string" && Number.isFinite(item.x) && Number.isFinite(item.y))) {
        const byId = new Map(elements.map((element) => [element.id, element]));
        return { version: 1, items: saved.items.filter((item) => item.type === "GROUND" || item.type === "JUNCTION" || byId.has(item.id))
          // Only placement is kept: how a part is drawn always comes from its symbol document, never from the layout.
          .map(({ id, type, x, y, rotation, mirrored, net, common, label, labels, shows }) => ({ id, type, x, y, rotation, mirrored,
            ...(net ? { net } : {}), ...(common ? { common } : {}), ...(label ? { label } : {}), ...(labels && Object.keys(labels).length ? { labels } : {}),
            ...(shows?.length ? { shows } : {}),
            element: type === "GROUND" || type === "JUNCTION" ? undefined : byId.get(id) })), wires: saved.wires };
      }
    } catch { /* An old or damaged layout falls back to a readable generated sheet. */ }
  }
  if (!elements.length) {
    return { version: 1, items: [], wires: [] };
  }
  return placeCircuit(library, elements);
}

/** A new part's id: what its component calls it (`meta designator R`) — "U" when it says nothing — and the next free number. */
export function nextDrawingId(library: PartLibraryView, items: readonly DrawingItem[], type: DrawingType, component?: string): string {
  const prefix = type === "GROUND" ? "GND" : type === "JUNCTION" ? "J"
    : type === "MODEL" ? (component ? library.componentModelOf(component)?.designator : null) ?? "U" : elementTypes[type].prefix;
  let number = 1;
  while (items.some((item) => item.id === `${prefix}${number}`)) {
    number++;
  }
  return `${prefix}${number}`;
}

/**
 * A new net label: the next free id (`L1`, `L2`) and a net no label names yet (`N1`, `N2`). It starts a net of its
 * own; renamed to another label's net, it is that net.
 */
export function newNetLabel(items: readonly DrawingItem[], x: number, y: number): DrawingItem {
  let number = 1;
  while (items.some((item) => item.id === `L${number}`)) {
    number++;
  }
  const nets = new Set(items.filter((item) => item.type === "GROUND" && item.net).map((item) => item.net));
  let net = 1;
  while (nets.has(`N${net}`)) {
    net++;
  }
  return { id: `L${number}`, type: "GROUND", x: snap(x), y: snap(y), rotation: 0, label: true, net: `N${net}` };
}

/** Whether a name can be a net's: a letter or an underscore, then letters, digits and underscores. */
export function isNetName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name);
}

/** What a placed item is, in a word for a heading: a part's kind, or which mark it is. */
export function itemKindOf(item: DrawingItem): string {
  if (item.type === "GROUND") {
    return item.label ? "Net label" : item.common ? "0 V common" : item.net ? "Ground of its own" : "Ground";
  }
  return item.type === "JUNCTION" ? "Junction" : elementTypes[item.type].label;
}

export function createDrawingItem(library: PartLibraryView, items: readonly DrawingItem[], type: DrawingType, x: number, y: number,
                                  component?: string, pins?: Record<string, string>): DrawingItem {
  const id = nextDrawingId(library, items, type, component);
  if (type === "GROUND" || type === "JUNCTION") {
    return { id, type, x: snap(x), y: snap(y), rotation: 0 };
  }
  const element: CircuitElement = type === "MODEL"
    ? { id, type, positive: null, negative: null, value: "", component: component ?? "", pins: pins ?? {}, overrides: {} }
    : { id, type, positive: `n_${id}_p`, negative: `n_${id}_n`, value: writtenValue(library, type) };
  return { id, type, x: snap(x), y: snap(y), rotation: 0, element };
}

/**
 * What a new primitive starts at: its component's value — the first parameter, as the engine reads it (`resistance =
 * 1 kOhm`, `inductance = 1 mH`) —, in SI. While the document has not arrived it is empty, and the engine asks for one.
 */
function writtenValue(library: PartLibraryView, type: CircuitElementType): string {
  const value = library.componentModelOf(elementTypes[type].component)?.parameters[0]?.value;
  return value === undefined ? "" : String(value);
}

/** A node name the sheet made up for a pin wired to nothing yet (`n_VM1_plus`) or for a fresh net (`n3`), not one the circuit chose. */
const INVENTED_NODE = /^n(_|\d+$)/;

/** Union-find over drawn wires. Each connected set receives one stable node name; ground wins. */
export function circuitFromDrawing(library: PartLibraryView, document: SchematicDocument): CircuitElement[] {
  const itemsById = new Map<string, DrawingItem>();
  for (const item of document.items) {
    if (!itemsById.has(item.id)) {
      itemsById.set(item.id, item);
    }
  }
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    if (!parent.has(key)) {
      parent.set(key, key);
    }
    const root = parent.get(key)!;
    if (root !== key) {
      parent.set(key, find(root));
    }
    return parent.get(key)!;
  };
  const join = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };
  for (const item of document.items) {
    for (const port of portsOf(library, item)) {
      find(portKey(item.id, port.name));
    }
  }
  for (const wire of document.wires) {
    if (parent.has(wire.from) && parent.has(wire.to)) {
      join(wire.from, wire.to);
    }
  }
  const groups = new Map<string, string[]>();
  for (const key of parent.keys()) {
    const root = find(key);
    const group = groups.get(root);
    if (group) {
      group.push(key);
    } else {
      groups.set(root, [key]);
    }
  }
  const names = new Map<string, string>();
  const used = new Set<string>(["0"]);
  for (const [root, keys] of groups) {
    const ground = keys.map((key) => itemsById.get(parsePort(key).id)).find((item) => item?.type === "GROUND");
    if (ground) {
      const node = groundNodeOf(ground);
      names.set(root, node);
      used.add(node);
      continue;
    }
    const existingNames = keys.map((key) => existingNodeOf(itemsById, key))
      .filter((name): name is string => !!name && name !== "0" && !used.has(name));
    // A net keeps the circuit's own name for it: a part just wired in (a voltmeter's lead) carries a name invented while
    // its pin hung free — `n_VM1_plus` —, and taking that one renamed the circuit's node under the probes reading it.
    const existing = existingNames.find((name) => !INVENTED_NODE.test(name)) ?? existingNames[0];
    const firstPort = parsePort(keys[0]);
    let candidate = existing ?? `n_${firstPort.id}_${firstPort.name.replace(/[^a-zA-Z0-9_]/g, "p")}`;
    if (used.has(candidate)) {
      let number = 1;
      while (used.has(`n${number}`)) {
        number++;
      }
      candidate = `n${number}`;
    }
    used.add(candidate);
    names.set(root, candidate);
  }
  const nodeOf = (key: string) => names.get(find(key)) ?? "0";
  return document.items.filter((item): item is DrawingItem & { element: CircuitElement } => item.type !== "GROUND" && item.type !== "JUNCTION" && !!item.element)
    .map((item) => item.type === "MODEL"
      ? { ...item.element, pins: Object.fromEntries(portsOf(library, item).map((port) => [port.name, nodeOf(portKey(item.id, port.name))])) }
      : { ...item.element, positive: nodeOf(portKey(item.id, "+")), negative: nodeOf(portKey(item.id, "−")) });
}

/** The node the circuit already gives a terminal: a model's pin, or a primitive's positive or negative end. */
function existingNodeOf(itemsById: ReadonlyMap<string, DrawingItem>, key: string): string | null | undefined {
  const { id, name } = parsePort(key);
  const item = itemsById.get(id);
  if (item?.type === "MODEL") {
    return item.element?.pins?.[name];
  }
  return name === "+" ? item?.element?.positive : item?.element?.negative;
}

/** A terminal as the text writes it: a primitive's `+` and `−` are `positive` and `negative`. */
const TEXT_TERMINALS: Record<string, string> = { "+": "positive", "−": "negative" };
const SHEET_TERMINALS: Record<string, string> = { positive: "+", negative: "−" };
const textTerminal = (key: string) => { const { id, name } = parsePort(key); return `${id}.${TEXT_TERMINALS[name] ?? name}`; };
// Only a primitive writes its terminals as `positive`/`negative`; a model's pin of that name (a generator's) is its own.
const sheetTerminal = (written: string, primitive: (id: string) => boolean) => {
  const separator = written.indexOf(".");
  const id = written.slice(0, separator);
  const name = written.slice(separator + 1);
  return portKey(id, primitive(id) ? SHEET_TERMINALS[name] ?? name : name);
};

/**
 * A circuit's `layout` block as the sheet the canvas and the simulator draw — serialized, as `drawCircuit` takes it —,
 * or undefined when the circuit has none and a sheet lays it out itself.
 */
export function drawingOfCircuit(definition: CircuitDefinition): string | undefined {
  const layout = definition.layout;
  if (!layout || layout.items.length === 0) {
    return undefined;
  }
  const types = new Map(definition.elements.map((element) => [element.id, element.type as DrawingType]));
  const primitive = (id: string) => types.has(id) && types.get(id) !== "MODEL";
  const document: SchematicDocument = { version: 1,
    items: layout.items.map((item) => ({ id: item.id, x: item.x, y: item.y, rotation: item.rotation, mirrored: item.mirrored,
      type: item.mark === "ground" || item.mark === "common" || item.mark === "label" ? "GROUND" : item.mark === "junction" ? "JUNCTION" : types.get(item.id) ?? "MODEL",
      ...((item.mark === "ground" || item.mark === "label") && item.net ? { net: item.net } : {}), ...(item.mark === "common" ? { common: true } : {}),
      ...(item.mark === "label" ? { label: true } : {}),
      ...(item.labels && Object.keys(item.labels).length ? { labels: item.labels } : {}), ...(item.shows?.length ? { shows: item.shows } : {}) })),
    wires: layout.wires.map((wire) => ({ id: wire.id, from: sheetTerminal(wire.from, primitive), to: sheetTerminal(wire.to, primitive), bends: wire.bends })) };
  return serializeDrawing(document);
}

/** The sheet as the circuit's `layout` block. */
export function layoutOfDrawing(serialized: string): SchematicLayout {
  const document = JSON.parse(serialized) as SchematicDocument;
  return {
    items: document.items.map((item) => ({ id: item.id, mark: item.type === "GROUND" ? item.label ? "label" : item.common ? "common" : "ground" : item.type === "JUNCTION" ? "junction" : null,
      net: item.type === "GROUND" ? item.net ?? null : null,
      x: item.x, y: item.y, rotation: item.rotation, mirrored: Boolean(item.mirrored), labels: item.labels ?? {}, shows: item.shows ?? [] })),
    wires: document.wires.map((wire) => ({ id: wire.id, from: textTerminal(wire.from), to: textTerminal(wire.to), bends: wire.bends })),
  };
}

export function serializeDrawing(document: SchematicDocument): string {
  return JSON.stringify({ version: 1, items: document.items.map(({ element: _element, ...item }) => item), wires: document.wires });
}


/**
 * The circuit `base` wired as the sheet `drawn` says: every part keeps its values from `base` and takes its nodes from
 * the drawing; a part only the drawing has comes as drawn, a part the drawing no longer has is gone.
 */
export function rewiredElements(base: readonly CircuitElement[], drawn: readonly CircuitElement[]): CircuitElement[] {
  const byId = new Map(base.map((element) => [element.id, element]));
  return drawn.map((element) => {
    const kept = byId.get(element.id);
    return kept ? { ...kept, positive: element.positive, negative: element.negative, pins: element.pins } : element;
  });
}

/** What is connected to what, and nothing else: two circuits with the same wiring differ only in their values. */
export function wiringOf(elements: readonly CircuitElement[]): string {
  return JSON.stringify([...elements].sort((left, right) => left.id.localeCompare(right.id)).map((element) => [element.id, element.type, element.component ?? null,
    element.type === "MODEL" ? element.pins ?? null : [element.positive, element.negative]]));
}

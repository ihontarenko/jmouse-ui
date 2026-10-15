import type { PartLoad } from "../transport/live";
import { formatQuantity } from "../quantities";
import type { PartLibraryView } from "../schematic/partLibrary";
import { componentReferenceOf, parsePort, type DrawingWire, type SchematicDocument } from "./SchematicDocument";
import { elementTypes } from "./circuit";

/**
 * What a running circuit's parts are doing, read off the engine's `PartLoad`: the current along every wire, what each
 * part takes or gives and how it stands against its limits. Nothing is computed here but what the sheet shows.
 */

/** A wire's current: how large, and whether it runs from the wire's `from` end towards its `to` end. */
export interface WireCurrent {
  amperes: number;
  forward: boolean;
}

/**
 * The current along every wire, by Kirchhoff's current law over each node's wires. A node's wires join part terminals,
 * junctions and ground marks; every terminal puts its part's current into them (the opposite of the current into the
 * terminal), a ground mark takes what is left, and a wire carries what enters on one side of it — so a wire between two
 * junctions carries its share as surely as one ending at a part. A node whose wires close a loop is cut to a tree, its
 * loop wires left still. A terminal the engine did not report is what the node's others leave over, when it is the
 * only one and no ground mark could take the surplus instead; with two unknown, or one beside a ground mark, nothing
 * divides the current and the node is left out whole rather than guessed.
 */
export function wireCurrents(document: SchematicDocument, loads: Record<string, PartLoad>): Map<string, WireCurrent> {
  const touching = new Map<string, DrawingWire[]>();
  for (const wire of document.wires) {
    for (const end of [wire.from, wire.to]) {
      touching.set(end, [...(touching.get(end) ?? []), wire]);
    }
  }
  const kindOf = new Map(document.items.map((item) => [item.id, item.type]));
  const injection = (end: string): number | null => {
    const { id, name } = parsePort(end);
    const kind = kindOf.get(id);
    if (kind === "JUNCTION" || kind === "GROUND") {
      return 0;
    }
    const into = loads[id]?.terminals[name];
    return into === undefined ? null : -into;
  };
  const currents = new Map<string, WireCurrent>();
  const visited = new Set<string>();
  for (const start of touching.keys()) {
    if (visited.has(start)) {
      continue;
    }
    const component = endsConnectedTo(start, touching);
    component.forEach((end) => visited.add(end));
    const unknown = component.filter((end) => injection(end) === null);
    const grounded = component.some((end) => kindOf.get(parsePort(end).id) === "GROUND");
    if (unknown.length > 1 || (unknown.length === 1 && grounded)) {
      continue;
    }
    const inferred = new Map<string, number>();
    if (unknown.length === 1) {
      inferred.set(unknown[0], -component.filter((end) => end !== unknown[0]).reduce((sum, end) => sum + (injection(end) ?? 0), 0));
    }
    // The tree is hung from a ground mark when the node has one: the mark is where the node's surplus goes.
    const root = component.find((end) => kindOf.get(parsePort(end).id) === "GROUND") ?? component[0];
    const parentWire = new Map<string, DrawingWire>();
    const order = [root];
    const reached = new Set([root]);
    for (let index = 0; index < order.length; index++) {
      const end = order[index];
      for (const wire of touching.get(end) ?? []) {
        const other = wire.from === end ? wire.to : wire.from;
        if (!reached.has(other)) {
          reached.add(other);
          parentWire.set(other, wire);
          order.push(other);
        }
      }
    }
    // Leaves first: what flows out of a subtree towards the root is what its ends put in.
    const outOfSubtree = new Map(order.map((end) => [end, injection(end) ?? inferred.get(end) ?? 0]));
    for (const end of [...order].reverse()) {
      const wire = parentWire.get(end);
      if (!wire) {
        continue;
      }
      const amperes = outOfSubtree.get(end) ?? 0;
      const parent = wire.from === end ? wire.to : wire.from;
      outOfSubtree.set(parent, (outOfSubtree.get(parent) ?? 0) + amperes);
      // Positive flows from `end` towards its parent; forward is from `from` to `to`.
      currents.set(wire.id, { amperes: Math.abs(amperes), forward: (amperes > 0) === (wire.from === end) });
    }
  }
  return currents;
}

function endsConnectedTo(start: string, touching: Map<string, DrawingWire[]>): string[] {
  const ends = [start];
  const seen = new Set(ends);
  for (let index = 0; index < ends.length; index++) {
    for (const wire of touching.get(ends[index]) ?? []) {
      for (const other of [wire.from, wire.to]) {
        if (!seen.has(other)) {
          seen.add(other);
          ends.push(other);
        }
      }
    }
  }
  return ends;
}

/** The largest current into any of a part's terminals: a two-terminal part's own, an IC's busiest pin. */
export function largestTerminalCurrent(load: PartLoad): number | null {
  const currents = Object.values(load.terminals).map(Math.abs);
  return currents.length ? Math.max(...currents) : null;
}

/**
 * What a part takes, or gives, and how warm it gets, as one line of its readings: `2.82 W · 364 °C`, `gives 2.82 W`;
 * null when it takes nothing — or no more than `floor` watts: a solver's rounding is not a power, and an ammeter
 * reading «gives 0.000257 pW» beside a 3 W resistor is noise written as a figure.
 */
export function loadText(library: PartLibraryView, item: SchematicDocument["items"][number], load: PartLoad | undefined, floor = 0): string | null {
  if (load?.failure) {
    return `burnt ${load.failure}${load.temperature !== null ? ` · ${Math.round(load.temperature)} °C` : ""}`;
  }
  const given = load?.power ?? 0;
  const power = Math.abs(given);
  if (!load || power <= floor) {
    return null;
  }
  const rated = load.rating && given > 0 ? ` of ${formatQuantity(load.rating, "W")}` : "";
  return `${given < 0 ? (isSource(library, item) ? "gives " : "returns ") : ""}${formatQuantity(power, "W")}${rated}${load.temperature !== null ? ` · ${Math.round(load.temperature)} °C` : ""}`;
}

/** How a part stands against its limits: burnt, over its temperature limit, over its power rating, or within them. */
export function loadState(load: PartLoad | undefined): "burnt" | "overheated" | "overloaded" | "within" {
  if (load?.failure) {
    return "burnt";
  }
  if (load && load.temperature !== null && load.maximum != null && load.temperature > load.maximum) {
    return "overheated";
  }
  if (load && load.power !== null && load.rating != null && load.power > load.rating) {
    return "overloaded";
  }
  return "within";
}

/**
 * What can hand back energy it stored: a capacitor's charge, an inductor's field. Such a part giving power «returns»
 * it; anything else that gives power is a source and «gives» it — a supply, a generator, a battery nobody has written yet.
 */
const STORING = new Set(["CAPACITOR", "INDUCTOR", "capacitor", "inductor"]);

/** A part that gives power by what it is: anything that does not merely give back what it stored. */
function isSource(library: PartLibraryView, item: SchematicDocument["items"][number]): boolean {
  if (item.element && STORING.has(item.element.type)) {
    return false;
  }
  const reference = item.type === "MODEL" ? componentReferenceOf(item) : null;
  return !(reference && STORING.has(library.componentModelOf(reference)?.kind ?? ""));
}

/** What a part does with power, by what it is — never by the sign of one frame's figure, which flips with the phase. */
export type PartRole = "source" | "storing" | "instrument" | "dissipating";

const SOURCE_KINDS = new Set(["generator", "power-supply", "dual-power-supply", "voltage-source", "current-source"]);
const STORING_KINDS = new Set(["capacitor", "inductor"]);

/**
 * A part's role on a running sheet: a source delivers power, a capacitor or an inductor stores it and hands it back,
 * an instrument reads, anything else turns it into heat. Taken from the element's type or the component's kind.
 */
export function partRole(library: PartLibraryView, item: SchematicDocument["items"][number]): PartRole {
  if (item.element) {
    if (elementTypes[item.element.type]?.source) {
      return "source";
    }
    if (STORING.has(item.element.type)) {
      return "storing";
    }
  }
  const reference = item.type === "MODEL" ? componentReferenceOf(item) : item.element ? elementTypes[item.element.type]?.component ?? null : null;
  const model = reference ? library.componentModelOf(reference) : null;
  const kind = model?.kind ?? "";
  return SOURCE_KINDS.has(kind) ? "source" : STORING_KINDS.has(kind) ? "storing" : kind === "meter" ? "instrument" : "dissipating";
}

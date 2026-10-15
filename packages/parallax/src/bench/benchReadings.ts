import type { CircuitDefinition, CircuitElement } from "../circuit/circuit";

/* What the bench reads off a running circuit and how it names it: its nets, a part's terminals, its pace. */

/** Samples across one screen of the oscilloscope: ten divisions of its time base. */
const SAMPLES_PER_SCREEN = 1000;

/** The time between samples that puts a thousand of them across the screen, within what the server accepts. */
export function samplesForScreen(secondsPerDivision: number): number {
  return Math.min(1, Math.max(1e-9, secondsPerDivision * 10 / SAMPLES_PER_SCREEN));
}

/** The nets a circuit wires its parts to, ground left out. */
export function nodesOfCircuit(circuit: CircuitDefinition | null): string[] {
  if (!circuit) {
    return [];
  }
  const nodes = new Set(circuit.elements.flatMap((element) => [element.positive, element.negative, ...Object.values(element.pins ?? {})]));
  nodes.delete("0");
  nodes.delete("");
  return [...nodes].filter(Boolean) as string[];
}

/** The terminals of a part and the nets they are on. */
export function terminalsOf(element: CircuitElement): [string, string][] {
  if (element.type === "MODEL") {
    return Object.entries(element.pins ?? {});
  }
  return [["+", element.positive ?? ""], ["−", element.negative ?? ""]];
}

/** A net as the bench names it: node 0 is ground. */
export function netName(node: string): string {
  return node === "0" || node === "" ? "ground" : node;
}

/** A share of real time as a reader says it: 2.5×, or 1/40. */
export function shareOfRealTime(speed: number): string {
  return speed >= 0.5 ? `${Number(speed.toPrecision(2))}×` : `1/${Math.round(1 / Math.max(speed, 1e-9))}`;
}

import type { ParameterDefinition } from "../transport/wire";
import { formatQuantity } from "../quantities";

/**
 * The backend's `CIRCUIT` definition: elements between named nodes, node "0" the reference. A type alias rather
 * than an interface, so it is assignable to the open record a draft carries.
 */
export type CircuitDefinition = {
  kind: "CIRCUIT";
  time: { minimum: number; maximum: number };
  elements: CircuitElement[];
  /** How the circuit is drawn — its `layout` block —, or null when a sheet lays it out itself. */
  layout?: SchematicLayout | null;
  /** What a bench runs it under; the engine applies it. Null or absent: 25 °C, every part nominal. */
  conditions?: BenchConditions | null;
  /** What a bench measures it with — its `probes` block: the oscilloscope's channels (CH1…CH4). A meter is a part. */
  probes?: BenchProbe[];
  /** The time base the oscilloscope opens on, seconds a division — the `probes` block's `time 5 ms/div`; null: the bench chooses. */
  timePerDivision?: number | null;
};

/** A line of the `probes` block (`ObjectDefinition.BenchProbe`): `CH1 out 2 V/div`, `M2 current PS1.negative rms`. */
export interface BenchProbe {
  id: string;
  measure: "voltage" | "current" | "power" | "level";
  /** A node, or a part — a current's with its terminal, `PS1.negative`. */
  target: string;
  reference: string | null;
  /** An oscilloscope channel's volts per division. */
  scale: number | null;
  /** A meter's display. */
  mode: "dc" | "ac" | "rms" | null;
  /** What an oscilloscope channel's screen shows instead of its reading, X being the reading: `X * pi / 2`. */
  expression?: string | null;
}

/**
 * A bench's conditions, as the engine reads them (`ObjectDefinition.BenchConditions`): the interface says what they
 * are, the engine moves the parts by them.
 */
export interface BenchConditions {
  /** °C, −40…125. */
  temperature: number;
  /** −1 every part at the low end of its tolerance, 0 nominal, +1 the high end. */
  corner: -1 | 0 | 1;
  /** A resistor's or capacitor's own tolerance (±%) and coefficient (ppm/°C), by element id. */
  tolerances: Record<string, { percent: number; coefficient: number }>;
  /** A DC value added to a source, by element id, as jMF. */
  offsets: Record<string, string>;
  /** Whether a part that overheats past its component's limit fails, as its component says it fails. */
  realistic?: boolean;
}

/** What an instrument's display can be set to read: its mode, and a figure or a graph. */
export type MeterShow = "dc" | "ac" | "rms" | "figure" | "gauge" | "graph";

/** The `layout` block: placed parts and marks, and wires between terminals (`R1.positive`, `GND1.ground`). */
export interface SchematicLayout {
  /** `net`: the net a ground mark is (`agnd`) — absent or null for node 0. */
  items: { id: string; mark: "ground" | "common" | "junction" | "label" | null; net?: string | null; x: number; y: number; rotation: number; mirrored: boolean;
    /** Where its texts stand when put there by hand (`name at dx, dy`), from its centre. */
    labels?: Partial<Record<"name" | "value" | "readings", { x: number; y: number }>>;
    /** How an instrument's display reads, when the reader chose (`shows rms graph`). */
    shows?: MeterShow[] }[];
  wires: { id: string; from: string; to: string; bends: { x: number; y: number }[] }[];
}

export type CircuitElementType = "RESISTOR" | "CAPACITOR" | "INDUCTOR" | "VOLTAGE_SOURCE" | "CURRENT_SOURCE" | "DIODE" | "MODEL";
/** A primitive source is constant or switched on at the start; a sine or a square is a generator component. */

export interface CircuitElement {
  id: string;
  type: CircuitElementType;
  positive: string | null;
  negative: string | null;
  /** A jMF expression over the object's parameters: ohms, farads, henries, volts or amperes by type; a diode's saturation current. */
  value: string | null;
  component?: string | null;
  pins?: Record<string, string>;
  overrides?: Record<string, string>;
  /** Which of its component's symbols the part is drawn with, when not the default: `symbol r2` on its line. */
  symbol?: string | null;
}

export const GROUND = "0";

/**
 * What each element type is called, the component it is — the word a netlist writes (`R1 resistor (in, out)`), whose
 * `symbol uses` line draws it — its unit and the prefix its id starts with.
 */
export const elementTypes: Record<CircuitElementType, { label: string; component: string; unit: string; prefix: string; source: boolean }> = {
  RESISTOR: { label: "Resistor", component: "resistor", unit: "Ω", prefix: "R", source: false },
  CAPACITOR: { label: "Capacitor", component: "capacitor", unit: "F", prefix: "C", source: false },
  INDUCTOR: { label: "Inductor", component: "inductor", unit: "H", prefix: "L", source: false },
  VOLTAGE_SOURCE: { label: "Voltage source", component: "voltage-source", unit: "V", prefix: "V", source: true },
  CURRENT_SOURCE: { label: "Current source", component: "current-source", unit: "A", prefix: "I", source: true },
  DIODE: { label: "Diode", component: "diode", unit: "A, saturation current; anode first", prefix: "D", source: false },
  MODEL: { label: "Component model", component: "", unit: "", prefix: "U", source: false },
};

export function isCircuit(definition: { kind: string }): definition is CircuitDefinition {
  return definition.kind === "CIRCUIT";
}

/** A first circuit to start from: the RC low-pass filter, with its values as parameters. */
export function starterCircuit(): CircuitDefinition {
  return {
    kind: "CIRCUIT",
    time: { minimum: 0, maximum: 0.01 },
    elements: [
      { id: "V1", type: "VOLTAGE_SOURCE", positive: "in", negative: GROUND, value: "U" },
      { id: "R1", type: "RESISTOR", positive: "in", negative: "out", value: "R" },
      { id: "C1", type: "CAPACITOR", positive: "out", negative: GROUND, value: "C * 1e-9" },
    ],
  };
}

/** The next free id for a type: R1, R2, … */
export function nextIdentifier(elements: readonly CircuitElement[], type: CircuitElementType): string {
  const prefix = elementTypes[type].prefix;
  let number = 1;
  while (elements.some((element) => element.id === `${prefix}${number}`)) {
    number += 1;
  }
  return `${prefix}${number}`;
}

/** Every node the elements name, the reference first. */
export function nodesOf(elements: readonly CircuitElement[]): string[] {
  const nodes = new Set<string>([GROUND]);
  for (const element of elements) {
    if (element.type === "MODEL") {
      Object.values(element.pins ?? {}).forEach((node) => nodes.add(node));
    } else {
      if (element.positive) {
        nodes.add(element.positive);
      }
      if (element.negative) {
        nodes.add(element.negative);
      }
    }
  }
  return [...nodes].filter(Boolean);
}

// jMF's own names: they are functions and constants, never parameters.
const formulaNames = new Set([
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh", "exp", "log", "ln", "log10", "sqrt", "abs",
  "floor", "ceil", "round", "min", "max", "sign", "pi", "e", "gamma", "erf", "mod",
]);

/**
 * The parameters the values use: every free name, keeping what was already said about a known one. Exponent
 * notation (1e-9) is a number, not a name. The backend compiles every value and refuses what is still unknown.
 */
export function parametersOf(definition: CircuitDefinition, known: readonly ParameterDefinition[]): ParameterDefinition[] {
  const names = new Set<string>();
  for (const element of definition.elements) {
    for (const source of [element.type === "MODEL" ? "" : element.value ?? "", ...Object.values(element.overrides ?? {})]) {
      const withoutNumbers = source.replace(/\b\d+(\.\d+)?(e[+-]?\d+)?\b/gi, " ");
      for (const name of withoutNumbers.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
        if (!formulaNames.has(name)) {
          names.add(name);
        }
      }
    }
  }
  return [...names].map(
    (name) => known.find((parameter) => parameter.name === name) ?? { name, label: name, defaultValue: 1, minimum: 0.01, maximum: 100, step: 0.01, animatable: false },
  );
}

/**
 * The elements as a sheet labels them: a value that is one parameter shows that parameter's current value in the unit
 * its slider is shown in — `capacitance = C` reads `1 µF`, not `C`; a value written as a number shows as a quantity of
 * its part's unit — `capacitance = 1000 µF` is kept in SI as 0.0010000000000000002 and reads `1000 µF`, never that.
 * Only the label changes; the expression is what is computed, and stays in the definition.
 */
export function withShownValues(elements: readonly CircuitElement[], parameters: readonly ParameterDefinition[],
  values: Readonly<Record<string, number>>): CircuitElement[] {
  return elements.map((element) => {
    const parameter = parameters.find((candidate) => candidate.name === element.value?.trim());
    if (!parameter) {
      const literal = literalQuantity(element);
      return literal === null ? element : { ...element, value: literal };
    }
    const scale = parameter.scale ?? 1;
    const value = (values[parameter.name] ?? parameter.defaultValue) / scale;
    // A value written in a prefixed unit (`1 kΩ`) is shown in it; one written in the bare unit takes the prefix it
    // needs, so a swept resistance reads «3.33 kΩ» on the sheet as under it, never «3325 Ω».
    if (parameter.unit && scale === 1) {
      return { ...element, value: formatQuantity(value, parameter.unit) };
    }
    const shown = Number(value.toPrecision(4)).toString();
    return { ...element, value: parameter.unit ? `${shown} ${parameter.unit}` : shown };
  });
}

/** The units a part's own value is a quantity of; a diode's and a model's value are not one. */
const VALUE_UNITS: Partial<Record<CircuitElementType, string>> = { RESISTOR: "Ω", CAPACITOR: "F", INDUCTOR: "H", VOLTAGE_SOURCE: "V", CURRENT_SOURCE: "A" };

/**
 * A value written as a bare number, as a quantity of its part's unit — four significant figures, an SI prefix; a
 * capacitance from a microfarad to ten thousand in microfarads, as electrolytics are marked. Null for anything else.
 */
function literalQuantity(element: CircuitElement): string | null {
  const unit = VALUE_UNITS[element.type];
  const text = element.value?.trim() ?? "";
  if (!unit || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text)) {
    return null;
  }
  const value = Number(Number(text).toPrecision(4));
  if (unit === "F" && Math.abs(value) >= 1e-6 && Math.abs(value) < 1e-2) {
    return `${Number((value * 1e6).toPrecision(4))} µF`;
  }
  return formatQuantity(value, unit);
}

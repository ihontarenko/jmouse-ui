import { elementTypes, type BenchConditions, type CircuitDefinition, type CircuitElement } from "../circuit/circuit";
import type { PartLibraryView } from "../schematic/partLibrary";

export type Corner = BenchConditions["corner"];
export type Tolerances = BenchConditions["tolerances"];

/** What the bench changes on top of the saved circuit: offsets on the sources, temperature and tolerances. */
export interface BenchSetup {
  circuit: CircuitDefinition;
  offsets: Record<string, string>;
  temperature: number;
  corner: Corner;
  tolerances: Tolerances;
  /** A realistic bench: a part past its component's temperature limit fails. An ideal one only warns. */
  realistic: boolean;
}

export function initialSetup(circuit: CircuitDefinition): BenchSetup {
  return { circuit: structuredClone(circuit), offsets: {}, temperature: 25, corner: 0, tolerances: {}, realistic: false };
}

/**
 * What a part's tolerance fields show before they are changed: what its component writes (`tolerance = 1 %`,
 * `temperature_coefficient = 100 ppm/K`) — the engine reads the same —, or the kind's default while it has not arrived.
 */
export function passiveDefaults(library: PartLibraryView, element: CircuitElement) {
  const fallback = element.type === "RESISTOR" ? { percent: 1, coefficient: 100 } : { percent: 10, coefficient: 200 };
  const model = library.componentModelOf(element.component || elementTypes[element.type].component);
  const written = (name: string) => model?.parameters.find((parameter) => parameter.name === name)?.value;
  return { percent: written("tolerance") ?? fallback.percent, coefficient: written("temperature_coefficient") ?? fallback.coefficient };
}

/**
 * What the form can tell at once, in a sentence; null when it has nothing to say. The engine checks the same again
 * and its answer is the one that counts.
 */
export function setupProblem(setup: BenchSetup): string | null {
  const { circuit, temperature, tolerances } = setup;
  if (!Number.isFinite(circuit.time.maximum) || circuit.time.maximum <= 0) {
    return "Choose a positive simulation window.";
  }
  if (circuit.elements.some((element) => (element.type === "VOLTAGE_SOURCE" || element.type === "CURRENT_SOURCE")
    && !element.value?.trim())) {
    return "Each source needs a value.";
  }
  if (!Number.isFinite(temperature) || temperature < -40 || temperature > 125 || Object.values(tolerances).some(({ percent, coefficient }) =>
    !Number.isFinite(percent) || percent < 0 || percent > 30 || !Number.isFinite(coefficient) || Math.abs(coefficient) > 2000)) {
    return "Temperature must be −40…125 °C; tolerance 0…30%; coefficient within ±2000 ppm/°C.";
  }
  return null;
}

/**
 * The circuit the bench runs: as it was edited, carrying the bench's conditions. Nothing is computed here — the engine
 * moves the parts by temperature and tolerance and puts the offsets in series (`BenchConditioning`).
 */
export function benchCircuit(setup: BenchSetup): CircuitDefinition {
  const { circuit, temperature, corner, tolerances, offsets, realistic } = setup;
  return { ...circuit, conditions: { temperature, corner, tolerances, offsets, realistic } };
}

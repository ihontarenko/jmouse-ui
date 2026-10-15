import type { ObjectNature } from "../transport/wire";
import type { Dataset } from "../visual/datasets";

export type VisualizationSurface = "plot" | "oscilloscope" | "symbol";

/** The unit the engine gives a digital node's column; such a series is drawn as timing lanes, not as traces. */
const LEVEL_UNIT = "level";

/** The object's definition chooses representations; this chooses a viewer for each representation. */
export function visualizationSurface(nature: ObjectNature, representation: string): VisualizationSurface {
  if (nature === "COMPONENT") {
    return "symbol";
  }
  if (nature === "CIRCUIT" && representation === "TRANSIENT_RESPONSE") {
    return "oscilloscope";
  }
  return "plot";
}

/** Whether a computed series holds logic levels — every column in the engine's `level` unit. */
export function isLogicLevels(dataset: Dataset | null): boolean {
  if (dataset?.format !== "TIME_SERIES" || !dataset.units || dataset.units.length === 0) {
    return false;
  }
  return dataset.units.every((unit) => unit === LEVEL_UNIT);
}

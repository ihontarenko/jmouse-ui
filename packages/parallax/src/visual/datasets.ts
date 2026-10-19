/** The datasets `POST /computations` answers — `jmouse-computation`' sealed `Dataset`, discriminated by `format`. */

/** What every dataset says of itself (DECISIONS §14): what came out, and the canvas it is drawn on. */
export type DatasetShape = "LINES" | "RASTER" | "POINTS" | "VECTORS" | "MESH" | "VALUES" | "COMPOSITE";
export type DatasetCanvas = "PLANE" | "SPACE" | "NONE";

interface Declared {
  shape: DatasetShape;
  canvas: DatasetCanvas;
}

export interface Range {
  minimum: number;
  maximum: number;
}

export interface MeshDataset extends Declared {
  format: "MESH";
  dimension: number;
  positions: number[];
  normals: number[] | null;
  indices: number[];
  scalars?: number[] | null;
  scalarName?: string | null;
  minimum: number[];
  maximum: number[];
  seams: number[];
}

export interface Polyline {
  points: number[];
  scalars?: number[] | null;
  label?: string | null;
  closed: boolean;
}

export interface PolylinesDataset extends Declared {
  format: "POLYLINES";
  dimension: number;
  lines: Polyline[];
  minimum: number[];
  maximum: number[];
}

export interface ScalarGridDataset extends Declared {
  format: "SCALAR_GRID";
  columns: number;
  rows: number;
  x: Range;
  y: Range;
  values: number[];
  minimum: number;
  maximum: number;
  quantity?: string;
}

export interface BinaryGridDataset extends Declared {
  format: "BINARY_GRID";
  columns: number;
  rows: number;
  values: number[];
}

export interface VectorSamplesDataset extends Declared {
  format: "VECTOR_SAMPLES";
  dimension: number;
  origins: number[];
  vectors: number[];
  magnitudes: number[];
  maximumMagnitude: number;
}

export interface PointCloudDataset extends Declared {
  format: "POINT_CLOUD";
  dimension: number;
  points: number[];
  values?: number[] | null;
  valueName?: string | null;
}

export interface Feature {
  position: number[];
  value: number | null;
  classification: string;
  facts: Record<string, unknown>;
}

export interface FeaturePointsDataset extends Declared {
  format: "FEATURE_POINTS";
  features: Feature[];
}

export interface ComplexGridDataset extends Declared {
  format: "COMPLEX_GRID";
  columns: number;
  rows: number;
  real: Range;
  imaginary: Range;
  modulus: number[];
  phase: number[];
}

export interface IterationGridDataset extends Declared {
  format: "ITERATION_GRID";
  columns: number;
  rows: number;
  real: Range;
  imaginary: Range;
  values: number[];
  basins?: number[] | null;
  maximumIterations: number;
  roots?: number[][];
}

export interface TimeSeriesDataset extends Declared {
  format: "TIME_SERIES";
  axis: string;
  axisValues: number[];
  columns: string[];
  values: number[][];
  /**
   * Each column's unit, in the order of `columns`: "V", "A", "W", or "" for a plain number. A circuit names its columns
   * as it names its nodes and parts (`out`, `R1`, `U1.output`); the unit is what tells a voltage from a current.
   */
  units?: string[];
  /** How the axis is read, as what computed the series declares it: evenly, or in decades — a frequency response. */
  axisScale?: "LINEAR" | "LOGARITHMIC";
  /**
   * By column, the lowest and highest value it reached over each sample's interval — from the sample before to this
   * one —, over every step the engine took between: what happened between two samples, which neither shows. A column
   * left out has none.
   */
  peaks?: Record<string, SeriesBand>;
}

/** A column's lowest and highest value over each sample's interval, sample by sample. */
export interface SeriesBand {
  lows: number[];
  highs: number[];
}

export interface MatrixAnalysisDataset extends Declared {
  format: "MATRIX_ANALYSIS";
  rows: number;
  columns: number;
  matrix: number[][];
  determinant: number;
  rank: number;
  trace: number;
  eigenpairs: { real: number; imaginary: number; vector: number[] }[];
  singularValues: number[];
}

export interface SymbolicDataset extends Declared {
  format: "SYMBOLIC";
  text: Record<string, string>;
  latex: Record<string, string>;
}

export interface MeasurementsDataset extends Declared {
  format: "MEASUREMENTS";
  values: Record<string, number>;
  notes: Record<string, string>;
  /** A value's unit by its name; a name left out is a plain number. */
  units?: Record<string, string>;
}

export interface CompositeDataset extends Declared {
  format: "COMPOSITE";
  parts: Record<string, Dataset>;
}

export type DrawableDataset =
  | MeshDataset
  | PolylinesDataset
  | ScalarGridDataset
  | BinaryGridDataset
  | VectorSamplesDataset
  | PointCloudDataset
  | FeaturePointsDataset
  | ComplexGridDataset
  | IterationGridDataset
  | TimeSeriesDataset;

export type PanelDataset = MatrixAnalysisDataset | SymbolicDataset | MeasurementsDataset;

export type Dataset = DrawableDataset | PanelDataset | CompositeDataset;

/** Splits a dataset — a composite included — into what a canvas draws and what a panel lists. */
export function partition(dataset: Dataset, name = "result"): { drawable: [string, DrawableDataset][]; panels: [string, PanelDataset][] } {
  if (dataset.format === "COMPOSITE") {
    const result = { drawable: [] as [string, DrawableDataset][], panels: [] as [string, PanelDataset][] };
    for (const [partName, part] of Object.entries(dataset.parts)) {
      const inner = partition(part, partName);
      result.drawable.push(...inner.drawable);
      result.panels.push(...inner.panels);
    }
    return result;
  }
  if (dataset.shape === "VALUES") {
    return { drawable: [], panels: [[name, dataset as PanelDataset]] };
  }
  return { drawable: [[name, dataset as DrawableDataset]], panels: [] };
}

/** A dataset on the Plane is drawn as a chart; the rest live in the camera's Space — as the dataset declares. */
export function isPlanar(dataset: DrawableDataset): boolean {
  return dataset.canvas === "PLANE";
}

/** A sentence for a screen reader: what is drawn and how much of it. */
export function describeDataset(dataset: Dataset): string {
  switch (dataset.format) {
    case "MESH":
      return `a surface of ${dataset.indices.length / 3} triangles`;
    case "POLYLINES":
      return `${dataset.lines.length} lines`;
    case "SCALAR_GRID":
      return `a heat map ${dataset.columns}×${dataset.rows}, values from ${dataset.minimum.toFixed(2)} to ${dataset.maximum.toFixed(2)}`;
    case "BINARY_GRID":
      return `a bitmap ${dataset.columns}×${dataset.rows}`;
    case "VECTOR_SAMPLES":
      return `${dataset.magnitudes.length} vectors`;
    case "POINT_CLOUD":
      return `${dataset.points.length / dataset.dimension} points`;
    case "FEATURE_POINTS":
      return `${dataset.features.length} feature points`;
    case "COMPLEX_GRID":
      return `domain colouring ${dataset.columns}×${dataset.rows}`;
    case "ITERATION_GRID":
      return `an iteration grid ${dataset.columns}×${dataset.rows}`;
    case "TIME_SERIES":
      return `a time series: ${dataset.columns.join(", ")}`;
    case "COMPOSITE":
      return Object.values(dataset.parts).map(describeDataset).join("; ");
    default:
      return "numeric results";
  }
}

const count = (amount: number, one: string, many = `${one}s`) => `${amount.toLocaleString("en")} ${amount === 1 ? one : many}`;

/**
 * What a dataset holds, as a reader says it — its layers by shape, each with its size: "path: a line of 4,000 points ·
 * series: 3 series over t, 4,000 samples". A composite names every part; where it is drawn is said by its canvas.
 */
export function describeLayers(dataset: Dataset, name?: string): string {
  const named = (text: string) => (name ? `${name}: ${text}` : text);
  switch (dataset.format) {
    case "COMPOSITE":
      return Object.entries(dataset.parts).map(([part, inner]) => describeLayers(inner, part)).join(" · ");
    case "POLYLINES": {
      const points = dataset.lines.reduce((sum, line) => sum + line.points.length / dataset.dimension, 0);
      return named(`${dataset.lines.length === 1 ? "a line" : count(dataset.lines.length, "line")} of ${count(points, "point")}`);
    }
    case "TIME_SERIES":
      return named(`${count(dataset.columns.length, "series", "series")} over ${dataset.axis}, ${count(dataset.axisValues.length, "sample")}`);
    case "MESH":
      return named(`a surface of ${count(dataset.indices.length / 3, "triangle")}`);
    case "SCALAR_GRID":
    case "BINARY_GRID":
    case "COMPLEX_GRID":
    case "ITERATION_GRID":
      return named(`a raster of ${dataset.columns} × ${dataset.rows} cells`);
    case "VECTOR_SAMPLES":
      return named(count(dataset.origins.length / dataset.dimension, "arrow"));
    case "POINT_CLOUD":
      return named(count(dataset.points.length / dataset.dimension, "point"));
    case "FEATURE_POINTS":
      return named(count(dataset.features.length, "point"));
    case "MATRIX_ANALYSIS":
      return named(`a ${dataset.rows} × ${dataset.columns} matrix and its invariants`);
    case "SYMBOLIC":
      return named(count(Object.keys(dataset.text).length, "formula"));
    case "MEASUREMENTS":
      return named(count(Object.keys(dataset.values).length, "number"));
  }
}

/**
 * A series split by unit, one part per unit in the order its columns first appear: a frequency response's gains (dB)
 * and phases (°), a transient's voltages (V) and currents (A). One axis holds one unit — drawn together, a current of
 * milliamperes lay flat at zero under volts, and degrees dwarfed decibels. A series of one unit is itself.
 */
export function seriesByUnit(dataset: TimeSeriesDataset): { unit: string; series: TimeSeriesDataset }[] {
  const units = dataset.units ?? dataset.columns.map(() => "");
  const order: string[] = [];
  units.forEach((unit) => {
    if (!order.includes(unit)) {
      order.push(unit);
    }
  });
  if (order.length < 2) {
    return [{ unit: order[0] ?? "", series: dataset }];
  }
  return order.map((unit) => {
    const indices = units.flatMap((candidate, index) => (candidate === unit ? [index] : []));
    return {
      unit,
      series: {
        ...dataset,
        columns: indices.map((index) => dataset.columns[index]),
        values: indices.map((index) => dataset.values[index]),
        units: indices.map(() => unit),
      },
    };
  });
}

/** What a unit measures, for the name of an axis: `gain, dB`, `phase, °`, `voltage, V`; the unit itself when unknown. */
export function unitAxisName(unit: string): string {
  const names: Record<string, string> = { dB: "gain", "°": "phase", V: "voltage", A: "current", W: "power", Hz: "frequency", s: "time" };
  return names[unit] ? `${names[unit]}, ${unit}` : unit;
}

/**
 * What one axis can show of a dataset: a series of several units keeps its first unit only — a card or a specimen has
 * room for one plot, and a current of milliamperes drawn under volts is a flat line at zero that reads as a dead wire.
 * Any other dataset is itself.
 */
export function onOneAxis<T extends { format: string }>(dataset: T): T {
  if (dataset.format !== "TIME_SERIES") {
    return dataset;
  }
  return seriesByUnit(dataset as unknown as TimeSeriesDataset)[0].series as unknown as T;
}

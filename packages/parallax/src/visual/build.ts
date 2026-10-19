import { hslToRgb, mix, RAMP_STEPS, rampIndex, type Rgb } from "./color";
import { partition, type BinaryGridDataset, type ComplexGridDataset, type Dataset, type DrawableDataset, type FeaturePointsDataset, type IterationGridDataset, type MeshDataset, type PointCloudDataset, type PolylinesDataset, type ScalarGridDataset, type TimeSeriesDataset, type VectorSamplesDataset } from "./datasets";
import { FloatBuilder, type Batch, type Drawing, type ImageBatch, type Marker } from "./geometry";
import type { PlaneWindow } from "./plane";
import type { VisualTheme } from "./theme";

/*
 * Datasets into batches: one builder per format, each writing primitives in data units. The same batches go to every
 * driver, so a surface looks the same whether the GPU or a 2-D canvas draws it.
 */

export type Mode = "plane" | "space";

export interface LayerStyle {
  theme: VisualTheme;
  /** The layer's own colour; without one, the accent, or the ramp where the data carries values. */
  color: Rgb | null;
  emphasized: boolean;
  /** How strongly a mask raster (a region) covers what is under it. */
  opacity: number;
  /** The window a raster without its own coordinates covers; a bitmap's own pixels otherwise. */
  extent: PlaneWindow | null;
  material: "surface" | "wireframe";
  flipX: boolean;
  flipY: boolean;
  /** `series` draws only the time series a composite carries beside its picture. */
  view: "primary" | "series";
}

const MAXIMUM_POINTS = 60000;
const MAXIMUM_ARROWS = 1400;

type Rgba = [number, number, number, number];
const rgba = (color: Rgb, alpha = 1): Rgba => [color[0] / 255, color[1] / 255, color[2] / 255, alpha];

/** The parts of a dataset a canvas of this mode draws: space takes what is spatial, the plane the rest. */
export function drawableParts(dataset: Dataset, view: "primary" | "series"): { mode: Mode; parts: DrawableDataset[] } {
  const parts = partition(dataset).drawable.map(([, part]) => part);
  const series = parts.filter((part) => part.format === "TIME_SERIES");
  if (view === "series") {
    return { mode: "plane", parts: series.slice(0, 1) };
  }
  const spatial = parts.filter((part) => part.canvas === "SPACE");
  if (spatial.length > 0) {
    return { mode: "space", parts: spatial };
  }
  const planar = parts.filter((part) => part.format !== "TIME_SERIES");
  return { mode: "plane", parts: planar.length > 0 ? planar : series.slice(0, 1) };
}

export function buildDrawing(parts: readonly DrawableDataset[], mode: Mode, style: LayerStyle): Drawing {
  const batches: Batch[] = [];
  const markers: Marker[] = [];
  const bounds = boundsOf(parts, style);
  for (const part of parts) {
    switch (part.format) {
      case "POLYLINES":
        batches.push(polylines(part, style, mode));
        break;
      case "MESH":
        batches.push(mesh(part, style, mode));
        break;
      case "POINT_CLOUD":
        batches.push(points(part, style));
        break;
      case "VECTOR_SAMPLES":
        batches.push(vectors(part, style, bounds));
        break;
      case "FEATURE_POINTS":
        markers.push(...features(part, style));
        break;
      case "TIME_SERIES": {
        const excursions = seriesExcursions(part, style);
        if (excursions) {
          batches.push(excursions);
        }
        batches.push(series(part, style));
        break;
      }
      case "SCALAR_GRID":
      case "BINARY_GRID":
      case "COMPLEX_GRID":
      case "ITERATION_GRID":
        if (mode === "plane") {
          batches.push(raster(part, style));
        }
        break;
    }
  }
  return { batches, markers, bounds };
}

/** The names and colours of a time series' columns, for the legend. */
export function seriesEntries(parts: readonly DrawableDataset[], theme: VisualTheme): { name: string; color: Rgb }[] {
  const series = parts.find((part) => part.format === "TIME_SERIES") as TimeSeriesDataset | undefined;
  return series ? series.columns.map((name, index) => ({ name, color: theme.series[index % theme.series.length] })) : [];
}

/** Whether a time series runs over decades — a frequency response — and is read on a logarithmic axis. */
export function isGeometricSweep(values: ArrayLike<number>): boolean {
  if (values.length < 3 || !(values[0] > 0) || values[values.length - 1] / values[0] < 100) {
    return false;
  }
  const ratio = values[1] / values[0];
  for (let index = 2; index < values.length; index++) {
    if (Math.abs(values[index] / values[index - 1] - ratio) > ratio * 1e-3) {
      return false;
    }
  }
  return true;
}

/** The smallest and largest finite value, in one pass — a spread into Math.min overflows the stack on big data. */
function rangeOf(values: ArrayLike<number>): [number, number] | null {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (Number.isFinite(value)) {
      if (value < minimum) {
        minimum = value;
      }
      if (value > maximum) {
        maximum = value;
      }
    }
  }
  return minimum <= maximum ? [minimum, maximum] : null;
}

// ─── bounds ──────────────────────────────────────────────────────────────────────────────────────────────

function boundsOf(parts: readonly DrawableDataset[], style: LayerStyle): Drawing["bounds"] {
  const minimum: [number, number, number] = [Infinity, Infinity, Infinity];
  const maximum: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const include = (values: ArrayLike<number>, dimension: number) => {
    const stride = Math.max(1, Math.floor(values.length / dimension / 20000));
    for (let index = 0; index + dimension - 1 < values.length; index += dimension * stride) {
      for (let axis = 0; axis < 3; axis++) {
        const value = axis < dimension ? values[index + axis] : 0;
        if (Number.isFinite(value)) {
          minimum[axis] = Math.min(minimum[axis], value);
          maximum[axis] = Math.max(maximum[axis], value);
        }
      }
    }
  };
  const includeWindow = (window: PlaneWindow) => include([window.xMinimum, window.yMinimum, window.xMaximum, window.yMaximum], 2);
  for (const part of parts) {
    switch (part.format) {
      case "MESH":
        include(part.positions, part.dimension);
        break;
      case "POLYLINES":
        part.lines.forEach((line) => include(line.points, part.dimension));
        break;
      case "VECTOR_SAMPLES":
        include(part.origins, part.dimension);
        break;
      case "POINT_CLOUD":
        include(part.points, part.dimension);
        break;
      case "FEATURE_POINTS":
        part.features.forEach((feature) => feature.position && include(feature.position, feature.position.length));
        break;
      case "TIME_SERIES": {
        const time = rangeOf(axisOf(part));
        const peaks = Object.values(part.peaks ?? {}).flatMap((band) => [...band.lows, ...band.highs]);
        const value = rangeOf([...part.values.flat(), ...peaks]);
        if (time && value) {
          include([time[0], value[0], time[1], value[1]], 2);
        }
        break;
      }
      default:
        includeWindow(extentOf(part as ScalarGridDataset | BinaryGridDataset | ComplexGridDataset | IterationGridDataset, style));
        break;
    }
  }
  if (!Number.isFinite(minimum[0])) {
    return null;
  }
  for (let axis = 0; axis < 3; axis++) {
    if (!Number.isFinite(minimum[axis])) {
      minimum[axis] = 0;
      maximum[axis] = 0;
    }
  }
  return { minimum, maximum };
}

// ─── lines ───────────────────────────────────────────────────────────────────────────────────────────────

function lineWidth(count: number, style: LayerStyle): number {
  return (count > 200 ? 1 : 2) + (style.emphasized ? 1 : 0);
}

/**
 * Where a planar curve jumps across an asymptote (tan x): a step many times the typical step and a large share of
 * the curve's whole range. The pen lifts there instead of drawing a vertical line.
 */
function jumpLimit(points: ArrayLike<number>, dimension: number): number {
  const steps: number[] = [];
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let index = dimension; index + 1 < points.length; index += dimension) {
    const y = points[index + 1];
    const previous = points[index + 1 - dimension];
    if (Number.isFinite(y) && Number.isFinite(previous)) {
      steps.push(Math.abs(y - previous));
      minimum = Math.min(minimum, y);
      maximum = Math.max(maximum, y);
    }
  }
  if (steps.length < 8) {
    return Infinity;
  }
  steps.sort((first, second) => first - second);
  const typical = steps[Math.floor(steps.length / 2)];
  return Math.max(typical * 40, (maximum - minimum) * 0.25);
}

function polylines(dataset: PolylinesDataset, style: LayerStyle, mode: Mode): Batch {
  const dimension = dataset.dimension;
  const positions = new FloatBuilder();
  const colors = new FloatBuilder();
  const withScalars = dataset.lines.some((line) => line.scalars && line.scalars.length > 0);
  const [scalarMinimum, scalarMaximum] = (withScalars ? rangeOf(dataset.lines.flatMap((line) => line.scalars ?? [])) : null) ?? [0, 1];
  const alpha = dataset.lines.length > 200 ? 0.55 : 1;
  const base = rgba(style.color ?? style.theme.accent, alpha);
  for (const line of dataset.lines) {
    const count = line.points.length / dimension;
    const limit = mode === "plane" && dimension === 2 ? jumpLimit(line.points, dimension) : Infinity;
    const at = (index: number): [number, number, number] =>
      [line.points[index * dimension], line.points[index * dimension + 1], dimension > 2 ? line.points[index * dimension + 2] : 0];
    for (let index = 1; index < count + (line.closed && count > 2 ? 1 : 0); index++) {
      const a = at(index - 1);
      const b = at(index % count);
      if (![...a, ...b].every(Number.isFinite) || Math.abs(b[1] - a[1]) > limit) {
        continue;
      }
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      if (withScalars && !style.color) {
        const ramp = style.theme.ramp[rampIndex(line.scalars?.[index - 1] ?? scalarMinimum, scalarMinimum, scalarMaximum)];
        colors.push(...rgba(ramp, alpha));
      } else {
        colors.push(...base);
      }
    }
  }
  return { kind: "segments", positions: positions.build(), colors: colors.build(), width: lineWidth(dataset.lines.length, style) };
}

function series(dataset: TimeSeriesDataset, style: LayerStyle): Batch {
  const axis = axisOf(dataset);
  const positions = new FloatBuilder();
  const colors = new FloatBuilder();
  dataset.values.forEach((column, columnIndex) => {
    const color = rgba(style.theme.series[columnIndex % style.theme.series.length]);
    for (let index = 1; index < column.length; index++) {
      const values = [axis[index - 1], column[index - 1], axis[index], column[index]];
      if (values.every(Number.isFinite)) {
        positions.push(values[0], values[1], 0, values[2], values[3], 0);
        colors.push(...color);
      }
    }
  });
  return { kind: "segments", positions: positions.build(), colors: colors.build(), width: 1.75 + (style.emphasized ? 1 : 0) };
}

/**
 * What each column went through between its samples beyond the straight line drawn between them, as a band in its
 * own colour, faded, over the interval: a transistor's overshoot a nanosecond long between samples 25 ns apart, which
 * the line through the samples alone does not show. Only the excursion past the line is filled — the whole span from
 * the lowest to the highest would thicken every slope into a block. Null when no column has peaks.
 */
function seriesExcursions(dataset: TimeSeriesDataset, style: LayerStyle): Batch | null {
  if (!dataset.peaks) {
    return null;
  }
  const axis = axisOf(dataset);
  const positions = new FloatBuilder();
  const colors = new FloatBuilder();
  const indices: number[] = [];
  let vertices = 0;
  const band = (from: number, to: number, bottom: number, top: number, color: Rgba) => {
    positions.push(from, bottom, 0, to, bottom, 0, to, top, 0, from, top, 0);
    for (let corner = 0; corner < 4; corner++) {
      colors.push(...color);
    }
    indices.push(vertices, vertices + 1, vertices + 2, vertices, vertices + 2, vertices + 3);
    vertices += 4;
  };
  dataset.columns.forEach((name, columnIndex) => {
    const peaks = dataset.peaks?.[name];
    if (!peaks) {
      return;
    }
    const column = dataset.values[columnIndex];
    const range = rangeOf(column);
    // An excursion smaller than this is the rounding of a float, not something that happened.
    const negligible = range ? (range[1] - range[0]) * 1e-4 : 0;
    // Its own colour faded into the background: neither driver blends a filled triangle.
    const color = rgba(mix(style.theme.background, style.theme.series[columnIndex % style.theme.series.length], 0.45));
    for (let index = 1; index < column.length; index++) {
      const top = Math.max(column[index - 1], column[index]);
      const bottom = Math.min(column[index - 1], column[index]);
      if (![axis[index - 1], axis[index], top, bottom].every(Number.isFinite)) {
        continue;
      }
      if (peaks.highs[index] - top > negligible) {
        band(axis[index - 1], axis[index], top, peaks.highs[index], color);
      }
      if (bottom - peaks.lows[index] > negligible) {
        band(axis[index - 1], axis[index], peaks.lows[index], bottom, color);
      }
    }
  });
  if (vertices === 0) {
    return null;
  }
  return { kind: "triangles", positions: positions.build(), normals: null, colors: colors.build(), indices: new Uint32Array(indices), lit: false };
}

/**
 * Whether a series is read in decades: as it declares — a sweep refined around a resonance is no longer evenly spaced
 * and must not fall back to a linear axis —, or, for one stored before the declaration existed, by its spacing.
 */
export function readsInDecades(dataset: TimeSeriesDataset): boolean {
  return dataset.axisScale ? dataset.axisScale === "LOGARITHMIC" : isGeometricSweep(dataset.axisValues);
}

/** A time series' horizontal axis, in decades when it is read in decades. */
export function axisOf(dataset: TimeSeriesDataset): number[] {
  return readsInDecades(dataset) ? dataset.axisValues.map((value) => Math.log10(value)) : dataset.axisValues;
}

function vectors(dataset: VectorSamplesDataset, style: LayerStyle, bounds: Drawing["bounds"]): Batch {
  const dimension = dataset.dimension;
  const count = dataset.magnitudes.length;
  const stride = Math.max(1, Math.ceil(count / MAXIMUM_ARROWS));
  const shown = Math.ceil(count / stride);
  const span = bounds ? Math.max(bounds.maximum[0] - bounds.minimum[0], bounds.maximum[1] - bounds.minimum[1]) : 1;
  const cell = (span / Math.max(1, Math.pow(shown, 1 / Math.max(2, dimension)))) * 0.8;
  const maximum = dataset.maximumMagnitude || 1;
  const positions = new FloatBuilder();
  const colors = new FloatBuilder();
  for (let index = 0; index < count; index += stride) {
    const offset = index * dimension;
    const magnitude = dataset.magnitudes[index];
    if (!(magnitude > 0)) {
      continue;
    }
    const length = (cell * Math.sqrt(magnitude / maximum)) / magnitude;
    const origin: [number, number, number] = [dataset.origins[offset], dataset.origins[offset + 1], dimension > 2 ? dataset.origins[offset + 2] : 0];
    const direction: [number, number, number] = [dataset.vectors[offset] * length, dataset.vectors[offset + 1] * length, (dimension > 2 ? dataset.vectors[offset + 2] : 0) * length];
    const tip: [number, number, number] = [origin[0] + direction[0], origin[1] + direction[1], origin[2] + direction[2]];
    const color = style.color ? rgba(style.color, 0.9) : rgba(style.theme.ramp[Math.max(8, rampIndex(Math.sqrt(magnitude / maximum), 0, 1))], 0.9);
    positions.push(...origin, ...tip);
    colors.push(...color);
    // The head: two short strokes back from the tip, in the plane of the arrow and the vertical.
    const size = Math.hypot(...direction) * 0.35;
    const angle = Math.atan2(direction[1], direction[0]);
    for (const turn of [-0.5, 0.5]) {
      positions.push(...tip, tip[0] - size * Math.cos(angle + turn), tip[1] - size * Math.sin(angle + turn), tip[2] - direction[2] * 0.35);
      colors.push(...color);
    }
  }
  return { kind: "segments", positions: positions.build(), colors: colors.build(), width: 1 };
}

// ─── surfaces and points ─────────────────────────────────────────────────────────────────────────────────

function mesh(dataset: MeshDataset, style: LayerStyle, mode: Mode): Batch {
  const dimension = dataset.dimension;
  const vertexCount = dataset.positions.length / dimension;
  const positions = new Float32Array(vertexCount * 3);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    positions[vertex * 3] = dataset.positions[vertex * dimension];
    positions[vertex * 3 + 1] = dataset.positions[vertex * dimension + 1];
    positions[vertex * 3 + 2] = dimension > 2 ? dataset.positions[vertex * dimension + 2] : 0;
  }
  if (style.material === "wireframe") {
    const segments = new FloatBuilder();
    const colors = new FloatBuilder();
    const triangleCount = Math.floor(dataset.indices.length / 3);
    const color = rgba(style.color ?? style.theme.accent, triangleCount > 12000 ? 0.3 : 0.5);
    // Two triangles share every interior edge; drawn once, the wireframe is half the work and no edge is darker.
    const drawnEdges = new Set<number>();
    for (let triangle = 0; triangle < triangleCount; triangle++) {
      const corners = [0, 1, 2].map((corner) => dataset.indices[triangle * 3 + corner]);
      for (let edge = 0; edge < 3; edge++) {
        const a = corners[edge];
        const b = corners[(edge + 1) % 3];
        const key = Math.min(a, b) * vertexCount + Math.max(a, b);
        if (drawnEdges.has(key)) {
          continue;
        }
        drawnEdges.add(key);
        segments.push(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2], positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]);
        colors.push(...color);
      }
    }
    return { kind: "segments", positions: segments.build(), colors: colors.build(), width: 0.75 };
  }
  const scalars = dataset.scalars && dataset.scalars.length === vertexCount ? dataset.scalars : null;
  const [minimum, maximum] = (scalars ? rangeOf(scalars) : null) ?? [0, 1];
  const colors = new Float32Array(vertexCount * 4);
  const base = style.color ?? style.theme.accent;
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const color = scalars && !style.color ? style.theme.ramp[rampIndex(scalars[vertex], minimum, maximum)] : base;
    colors.set(rgba(color), vertex * 4);
  }
  const normals = dataset.normals && dataset.normals.length === dataset.positions.length && dimension === 3 ? Float32Array.from(dataset.normals) : null;
  return { kind: "triangles", positions, normals, colors, indices: Uint32Array.from(dataset.indices), lit: mode === "space" };
}

function points(dataset: PointCloudDataset, style: LayerStyle): Batch {
  const dimension = dataset.dimension;
  const count = dataset.points.length / dimension;
  const stride = Math.max(1, Math.ceil(count / MAXIMUM_POINTS));
  const values = dataset.values && dataset.values.length === count ? dataset.values : null;
  const [minimum, maximum] = (values ? rangeOf(values) : null) ?? [0, 1];
  const alpha = count > 20000 ? 0.55 : 0.85;
  const positions = new FloatBuilder();
  const colors = new FloatBuilder();
  for (let index = 0; index < count; index += stride) {
    const offset = index * dimension;
    positions.push(dataset.points[offset], dataset.points[offset + 1], dimension > 2 ? dataset.points[offset + 2] : 0);
    const color = values && !style.color ? style.theme.ramp[Math.max(6, rampIndex(values[index], minimum, maximum))] : style.color ?? style.theme.accent;
    colors.push(...rgba(color, alpha));
  }
  return { kind: "points", positions: positions.build(), colors: colors.build(), size: count > 20000 ? 1.5 : count > 2000 ? 2.5 : 5 };
}

function features(dataset: FeaturePointsDataset, style: LayerStyle): Marker[] {
  const color = rgba(style.color ?? style.theme.accent);
  // A feature's own label decides when it carries one: an empty label is a helper that is not marked at all, a blank
  // one is marked without a word, any other is the word (a graph's named point). Without one, the classification.
  const written = (feature: FeaturePointsDataset["features"][number]) => (typeof feature.facts?.label === "string" ? feature.facts.label : null);
  return dataset.features
    .filter((feature) => feature.position && feature.position.length >= 2 && written(feature) !== "")
    .map((feature) => {
      const classification = feature.classification.toUpperCase();
      const shape: Marker["shape"] = classification.includes("MAX") ? "triangle" : classification.includes("SADDLE") ? "diamond"
        : classification.includes("MIN") || classification.includes("STABLE") || classification.includes("SINK") ? "circle" : "square";
      const label = written(feature);
      return {
        position: [feature.position[0], feature.position[1], feature.position[2] ?? 0],
        shape,
        // Beyond three markers the labels collide; the facts beside the canvas name every one.
        label: label !== null ? (label.trim() || null) : dataset.features.length <= 3 ? classification.toLowerCase().replaceAll("_", " ") : null,
        color,
      };
    });
}

// ─── rasters ─────────────────────────────────────────────────────────────────────────────────────────────

type Raster = ScalarGridDataset | BinaryGridDataset | ComplexGridDataset | IterationGridDataset;

function extentOf(grid: Raster, style: LayerStyle): PlaneWindow {
  if (grid.format === "BINARY_GRID") {
    return style.extent ?? { xMinimum: 0, xMaximum: grid.columns, yMinimum: 0, yMaximum: grid.rows };
  }
  const horizontal = grid.format === "SCALAR_GRID" ? grid.x : grid.real;
  const vertical = grid.format === "SCALAR_GRID" ? grid.y : grid.imaginary;
  return { xMinimum: horizontal.minimum, xMaximum: horizontal.maximum, yMinimum: vertical.minimum, yMaximum: vertical.maximum };
}

/**
 * A raster as RGBA rows, top row first. Sampled grids are written y-up and flipped here; a bitmap (a program's
 * picture, a region) already has its first row at the top.
 */
function raster(grid: Raster, style: LayerStyle): ImageBatch {
  const { columns, rows } = grid;
  const pixels = new Uint8ClampedArray(columns * rows * 4);
  const { theme } = style;
  const write = (index: number, color: Rgb, alpha = 255) => {
    const binary = grid.format === "BINARY_GRID";
    const sourceColumn = index % columns;
    const column = binary && style.flipX ? columns - 1 - sourceColumn : sourceColumn;
    const sourceRow = binary ? Math.floor(index / columns) : rows - 1 - Math.floor(index / columns);
    const row = binary && style.flipY ? rows - 1 - sourceRow : sourceRow;
    const offset = (row * columns + column) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = alpha;
  };
  const cells = columns * rows;
  if (grid.format === "BINARY_GRID") {
    const ink = style.color ?? theme.ink;
    const alpha = Math.round(255 * style.opacity);
    for (let index = 0; index < cells; index++) {
      if (grid.values[index] === 1) {
        write(index, ink, alpha);
      }
    }
  } else if (grid.format === "SCALAR_GRID") {
    for (let index = 0; index < cells; index++) {
      const value = grid.values[index];
      if (Number.isFinite(value)) {
        write(index, theme.ramp[rampIndex(value, grid.minimum, grid.maximum)]);
      }
    }
  } else if (grid.format === "COMPLEX_GRID") {
    for (let index = 0; index < cells; index++) {
      const modulus = grid.modulus[index];
      if (Number.isFinite(modulus)) {
        const logarithm = Math.log2(Math.max(modulus, 1e-12));
        write(index, hslToRgb((grid.phase[index] * 180) / Math.PI, 0.72, 0.32 + 0.28 * (logarithm - Math.floor(logarithm))));
      }
    }
  } else {
    const basins = grid.basins && grid.basins.length === cells ? grid.basins : null;
    const basinCount = basins ? Math.max(1, ...Array.from(new Set(basins))) + 1 : 1;
    for (let index = 0; index < cells; index++) {
      const amount = Math.min(1, grid.values[index] / (grid.maximumIterations || 1));
      if (basins) {
        if (basins[index] >= 0) {
          write(index, hslToRgb((360 * basins[index]) / basinCount + 210, 0.55, 0.62 - 0.4 * Math.sqrt(amount)));
        }
      } else if (amount < 1) {
        write(index, theme.ramp[Math.max(0, Math.round(Math.sqrt(Math.max(0, amount)) * (RAMP_STEPS - 1)))]);
      } else {
        write(index, mix(theme.background, theme.ink, 0.92));
      }
    }
  }
  return { kind: "image", pixels, columns, rows, extent: extentOf(grid, style), smooth: grid.format !== "BINARY_GRID" };
}

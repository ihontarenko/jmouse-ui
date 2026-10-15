import type { PlaneWindow } from "./plane";

/*
 * What a driver draws: batches of primitives in data units, built once per dataset and style and then only
 * transformed. Nothing here knows a dataset format or a driver — the builder writes batches, a driver reads them.
 */

/** Straight segments `a → b`, each with its own colour, drawn `width` pixels wide whatever the zoom. */
export interface SegmentBatch {
  kind: "segments";
  /** Six numbers per segment: a.x, a.y, a.z, b.x, b.y, b.z. */
  positions: Float32Array;
  /** Four numbers per segment, 0–1: red, green, blue, alpha. */
  colors: Float32Array;
  width: number;
}

/** Triangles with a colour per vertex; `lit` shades them by their normals, as a surface under one light. */
export interface TriangleBatch {
  kind: "triangles";
  /** Three numbers per vertex. */
  positions: Float32Array;
  /** Three numbers per vertex, or null when the surface is drawn flat. */
  normals: Float32Array | null;
  /** Four numbers per vertex, 0–1. */
  colors: Float32Array;
  indices: Uint32Array;
  lit: boolean;
}

/** Round points `size` pixels across. */
export interface PointBatch {
  kind: "points";
  positions: Float32Array;
  colors: Float32Array;
  size: number;
}

/** A raster of RGBA pixels laid over a window of the plane, its first row at the top. */
export interface ImageBatch {
  kind: "image";
  pixels: Uint8ClampedArray;
  columns: number;
  rows: number;
  extent: PlaneWindow;
  smooth: boolean;
}

/**
 * A batch drawn part of the way toward another of the same shape — an animation between two frames. The WebGL driver
 * mixes the two in its shader, so playing costs no work on the CPU; the Canvas driver mixes them itself.
 */
export interface BlendBatch {
  kind: "blend";
  from: SegmentBatch | TriangleBatch | PointBatch;
  to: SegmentBatch | TriangleBatch | PointBatch;
  amount: number;
}

export type Batch = SegmentBatch | TriangleBatch | PointBatch | ImageBatch | BlendBatch;

/** A marker the overlay draws over the geometry: a classified point, with an optional label. */
export interface Marker {
  position: [number, number, number];
  shape: "triangle" | "diamond" | "circle" | "square";
  label: string | null;
  color: [number, number, number, number];
}

/** A dataset as it is drawn: its batches, its markers, and the window of data it covers. */
export interface Drawing {
  batches: Batch[];
  markers: Marker[];
  bounds: { minimum: [number, number, number]; maximum: [number, number, number] } | null;
}

function lerp(from: Float32Array, to: Float32Array, amount: number): Float32Array {
  const result = new Float32Array(from.length);
  for (let index = 0; index < from.length; index++) {
    result[index] = from[index] + (to[index] - from[index]) * amount;
  }
  return result;
}

/** Whether two batches can be blended: the same kind with the same number of everything. */
function sameShape(from: Batch, to: Batch): boolean {
  if (from.kind !== to.kind || from.kind === "image" || from.kind === "blend") {
    return false;
  }
  if (from.kind === "triangles" && to.kind === "triangles") {
    return from.positions.length === to.positions.length && from.indices.length === to.indices.length
      && (from.normals === null) === (to.normals === null);
  }
  return (from as SegmentBatch | PointBatch).positions.length === (to as SegmentBatch | PointBatch).positions.length;
}

/**
 * How far a vertex may move between two frames, along each axis as a share of the batch's extent on it, for a straight-line morph between
 * them to stand for the frames the parameter would give in between. Beyond it the morph invents a picture: two
 * phases of `sin(b x)` averaged cancel into beats the function never has.
 */
const BLENDABLE_SHARE = 0.02;

const blendable = new WeakMap<Float32Array, WeakMap<Float32Array, boolean>>();

/** Whether two frames' positions are close enough that every point between them is (nearly) a real frame. */
function closeEnough(from: Float32Array, to: Float32Array): boolean {
  let known = blendable.get(from);
  const remembered = known?.get(to);
  if (remembered !== undefined) {
    return remembered;
  }
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  const largestMove = [0, 0, 0];
  for (let index = 0; index < from.length; index++) {
    const axis = index % 3;
    const value = from[index];
    if (value < minimum[axis]) {
      minimum[axis] = value;
    }
    if (value > maximum[axis]) {
      maximum[axis] = value;
    }
    const move = Math.abs(to[index] - value);
    if (move > largestMove[axis]) {
      largestMove[axis] = move;
    }
  }
  // Each axis on its own: a curve 180 wide and 8 tall must not let a point move 3.6 up and down.
  const answer = largestMove.every((move, axis) => move <= (maximum[axis] - minimum[axis]) * BLENDABLE_SHARE);
  if (!known) {
    known = new WeakMap();
    blendable.set(from, known);
  }
  known.set(to, answer);
  return answer;
}

/**
 * The batches between two frames of an animation. Batches of the same shape become a blend; any other pair shows the
 * first frame, so a frame whose structure changed jumps rather than tears — and so does one that moved too far to morph
 * honestly (`closeEnough`).
 */
export function blendBatches(from: readonly Batch[], to: readonly Batch[], amount: number): Batch[] {
  if (amount <= 0 || from.length !== to.length) {
    return [...from];
  }
  return from.map((batch, index) => sameShape(batch, to[index])
    && closeEnough((batch as SegmentBatch).positions, (to[index] as SegmentBatch).positions)
    ? { kind: "blend", from: batch as BlendBatch["from"], to: to[index] as BlendBatch["to"], amount }
    : batch);
}

/** A blend worked out on the CPU, for a driver without shaders. */
export function resolveBlend(blend: BlendBatch): SegmentBatch | TriangleBatch | PointBatch {
  const { from, to, amount } = blend;
  if (from.kind === "triangles" && to.kind === "triangles") {
    return { ...from, positions: lerp(from.positions, to.positions, amount), colors: lerp(from.colors, to.colors, amount),
      normals: from.normals && to.normals ? lerp(from.normals, to.normals, amount) : from.normals };
  }
  return { ...from, positions: lerp(from.positions, (to as SegmentBatch | PointBatch).positions, amount) } as SegmentBatch | PointBatch;
}

/** Grows flat arrays without knowing their length in advance. */
export class FloatBuilder {
  #values: Float32Array;
  #length = 0;

  constructor(capacity = 1024) {
    this.#values = new Float32Array(capacity);
  }

  push(...values: number[]) {
    if (this.#length + values.length > this.#values.length) {
      const grown = new Float32Array(Math.max(this.#values.length * 2, this.#length + values.length));
      grown.set(this.#values.subarray(0, this.#length));
      this.#values = grown;
    }
    for (const value of values) {
      this.#values[this.#length++] = value;
    }
  }

  get length(): number {
    return this.#length;
  }

  build(): Float32Array {
    return this.#values.slice(0, this.#length);
  }
}

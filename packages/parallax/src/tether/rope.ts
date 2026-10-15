/**
 * A rope hung between fixed points — a test lead from an instrument, a leader from a label to its part: one chain of
 * points integrated by Verlet, pinned at its ends and at every point it is hung through. A lead behaves as copper wire
 * in its insulation: heavy, slow to swing, stiff to bend and never folded tighter than its bend radius, so it lies in
 * smooth arcs and stays where it was laid. A leader is the same rope drawn taut: no slack, no weight, no swing. It
 * moves only while something moved it and stops once it has settled, so a sheet at rest costs nothing. It knows
 * nothing of the DOM; a caller steps it and draws its `path()`.
 */

export interface RopePoint {
  x: number;
  y: number;
}

/** Where a rope may lie: no point of it leaves this box — the sheet. */
export interface RopeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RopeOptions {
  /** How much longer than the straight line between two holds the rope is: 1.15 sags, 1 is taut. */
  slack?: number;
  /** Downward pull, in sheet units per second squared. */
  gravity?: number;
  /** The share of its speed a point keeps from one step to the next. */
  damping?: number;
  /** The box it lies in; unbounded when none. */
  bounds?: RopeBounds;
}

const STEP_SECONDS = 1 / 60;
const CONSTRAINT_PASSES = 40;
/**
 * How hard each point is pulled toward the middle of its neighbours in every pass: wire's resistance to bending. A
 * chain has none and swings into any shape; copper in its insulation takes a curve and keeps it smooth.
 */
const BENDING = 0.3;
/** The tightest a lead turns, in sheet units: a test lead's insulated copper does not kink. */
const BEND_RADIUS = 28;
/**
 * How long a link is, in sheet units. A fixed length, not a fixed count per span: with long links the bend radius
 * could not be kept — a link longer than the radius folds at a hold — and a long span bent in corners.
 */
const LINK_LENGTH = 8;
const MINIMUM_LINKS = 4;
const MAXIMUM_LINKS = 96;
/** Below this movement in a step, in sheet units, a point is at rest. */
const AT_REST = 0.05;
/** How many steps in a row every point must be at rest before the rope is. */
const STEPS_AT_REST = 12;
const SETTLE_STEPS = 600;

/** One span's cable as it lies before it is hung again: its line, its length, and its points when it keeps them. */
interface Stretch {
  line: RopePoint[];
  cable: number;
  old: { points: RopePoint[]; previous: RopePoint[] } | null;
}

export class Rope {
  private holds: RopePoint[] = [];
  private points: RopePoint[] = [];
  private previous: RopePoint[] = [];
  /** Each link's rest length: a span's links share its length. */
  private rests: number[] = [];
  /** The chain index of every hold — its ends and the points it hangs through —, in order. */
  private pinned: number[] = [];
  private stillSteps = 0;
  private grabbed: { index: number; at: RopePoint } | null = null;
  private readonly slack: number;
  private readonly gravity: number;
  private readonly damping: number;
  private readonly bounds: RopeBounds | null;

  constructor(holds: readonly RopePoint[], options: RopeOptions = {}) {
    this.slack = options.slack ?? 1.15;
    this.gravity = options.gravity ?? 1600;
    this.damping = options.damping ?? 0.97;
    this.bounds = options.bounds ?? null;
    this.hang(holds);
    this.settle();
  }

  /** Whether it is still swinging. */
  get moving(): boolean {
    return this.grabbed !== null || this.stillSteps < STEPS_AT_REST;
  }

  /**
   * Hangs it through holds — its ends moved, or a point it hangs through was added or taken away. With as many holds as
   * before the chain keeps where it is and swings to its new rest. Hung through a point more or less, it keeps the shape
   * it has — a lead let go lies as it was pulled — and each span keeps the length of cable it holds; only a new rope is
   * laid out along its holds. A taut rope is always exactly as long as the line between its holds.
   */
  hang(holds: readonly RopePoint[]) {
    const wanted = holds.map((hold) => this.within(hold));
    const same = wanted.length === this.holds.length
      && wanted.every((hold, index) => hold.x === this.holds[index].x && hold.y === this.holds[index].y);
    if (same) {
      return;
    }
    const kept = wanted.length === this.holds.length && this.points.length > 1;
    const stretches = this.stretchesFor(wanted, kept);
    const points: RopePoint[] = [];
    const previous: RopePoint[] = [];
    // A rope hung through nothing has no point to pin.
    const pinned: number[] = wanted.length ? [0] : [];
    const rests: number[] = [];
    for (let span = 1; span < wanted.length; span++) {
      const straight = Math.max(1, Math.hypot(wanted[span].x - wanted[span - 1].x, wanted[span].y - wanted[span - 1].y));
      const { line, cable, old } = stretches[span - 1];
      const length = this.slack > 1 ? Math.max(straight * this.slack, cable) : straight;
      const links = Math.min(MAXIMUM_LINKS, Math.max(MINIMUM_LINKS, Math.ceil(length / LINK_LENGTH)));
      // A span whose links are as many as they were keeps its points and their motion; any other is laid along its line.
      const keeps = old !== null && old.points.length === links + 1;
      const chain = keeps ? old.points : resample(line, links);
      const motion = keeps ? old.previous : chain;
      for (let index = span === 1 ? 0 : 1; index <= links; index++) {
        points.push({ ...chain[index] });
        previous.push({ ...motion[index] });
      }
      pinned.push(points.length - 1);
      for (let link = 0; link < links; link++) {
        rests.push(length / links);
      }
    }
    if (wanted.length === 1) {
      points.push({ ...wanted[0] });
      previous.push({ ...wanted[0] });
    }
    this.holds = wanted;
    this.points = points;
    this.previous = previous;
    this.pinned = pinned;
    this.rests = rests;
    this.grabbed = null;
    this.stillSteps = 0;
  }

  /** One step of motion; whether it is still moving after it. */
  step(): boolean {
    const last = this.points.length - 1;
    const pull = this.gravity * STEP_SECONDS * STEP_SECONDS;
    for (let index = 0; index <= last; index++) {
      if (this.isFixed(index)) {
        continue;
      }
      const point = this.points[index];
      const before = this.previous[index];
      const velocityX = (point.x - before.x) * this.damping;
      const velocityY = (point.y - before.y) * this.damping;
      before.x = point.x;
      before.y = point.y;
      point.x += velocityX;
      point.y += velocityY + pull;
    }
    for (let pass = 0; pass < CONSTRAINT_PASSES; pass++) {
      this.pin();
      for (let index = 1; index <= last; index++) {
        this.keepLength(index - 1, index);
      }
      this.bend(pass % 2 === 1);
      this.keepWithin();
    }
    this.pin();
    let largest = 0;
    for (let index = 0; index <= last; index++) {
      largest = Math.max(largest, Math.hypot(this.points[index].x - this.previous[index].x, this.points[index].y - this.previous[index].y));
    }
    this.stillSteps = largest < AT_REST ? this.stillSteps + 1 : 0;
    return this.moving;
  }

  /** Lets it come to rest at once: what a reader who asks for reduced motion sees, and where it starts. */
  settle() {
    for (let step = 0; step < SETTLE_STEPS && (this.grabbed !== null || this.stillSteps < STEPS_AT_REST); step++) {
      this.step();
    }
    this.previous = this.points.map((point) => ({ ...point }));
    this.stillSteps = STEPS_AT_REST;
  }

  /** Takes hold of the rope at the point of it nearest `at`; it follows `pull` until let go. */
  grab(at: RopePoint) {
    let best = -1;
    let distance = Infinity;
    this.points.forEach((point, index) => {
      const away = Math.hypot(point.x - at.x, point.y - at.y);
      if (!this.pinned.includes(index) && away < distance) {
        best = index;
        distance = away;
      }
    });
    this.grabbed = best >= 0 ? { index: best, at: this.within(at) } : null;
    this.stillSteps = 0;
  }

  pull(to: RopePoint) {
    if (this.grabbed) {
      this.grabbed.at = this.within(to);
    }
  }

  /** Lets go; where it was held, and between which two of its holds — for hanging it through that point from now on. */
  release(): { at: RopePoint; span: number } | null {
    const grabbed = this.grabbed;
    this.grabbed = null;
    this.stillSteps = 0;
    if (!grabbed) {
      return null;
    }
    const next = this.pinned.findIndex((index) => index > grabbed.index);
    return { at: grabbed.at, span: Math.max(0, (next < 0 ? this.pinned.length : next) - 1) };
  }

  /** Its shape as an SVG path: a smooth curve through every point of the chain. */
  path(): string {
    return smoothPath(this.points);
  }

  /** The points of the chain, for drawing along it and for hit-testing. */
  chain(): RopePoint[] {
    return this.points.map((point) => ({ ...point }));
  }

  /**
   * Each span's cable as it lies now, for the holds it is to hang through, and its length: the old span with its ends
   * moved when the holds are as many as before; a new rope's straight line; otherwise the chain cut at the points
   * nearest each new hold.
   */
  private stretchesFor(holds: readonly RopePoint[], kept: boolean): Stretch[] {
    const stretches: Stretch[] = [];
    if (this.points.length < 2) {
      for (let span = 1; span < holds.length; span++) {
        stretches.push({ line: [holds[span - 1], holds[span]], cable: 0, old: null });
      }
      return stretches;
    }
    if (kept) {
      for (let span = 1; span < holds.length; span++) {
        const from = this.pinned[span - 1];
        const to = this.pinned[span];
        const points = this.points.slice(from, to + 1).map((point) => ({ ...point }));
        points[0] = { ...holds[span - 1] };
        points[points.length - 1] = { ...holds[span] };
        stretches.push({ line: points, cable: arcLength(this.points, from, to),
          old: { points, previous: this.previous.slice(from, to + 1).map((point) => ({ ...point })) } });
      }
      return stretches;
    }
    const anchors: number[] = [0];
    for (let hold = 1; hold < holds.length - 1; hold++) {
      const from = anchors[anchors.length - 1];
      let best = from;
      let distance = Infinity;
      for (let index = from; index < this.points.length; index++) {
        const away = Math.hypot(this.points[index].x - holds[hold].x, this.points[index].y - holds[hold].y);
        if (away < distance) {
          best = index;
          distance = away;
        }
      }
      anchors.push(best);
    }
    anchors.push(this.points.length - 1);
    for (let span = 1; span < holds.length; span++) {
      const line = [{ ...holds[span - 1] }, ...this.points.slice(anchors[span - 1] + 1, anchors[span]), { ...holds[span] }];
      stretches.push({ line, cable: arcLength(line, 0, line.length - 1), old: null });
    }
    return stretches;
  }

  private isFixed(index: number): boolean {
    return this.pinned.includes(index) || this.grabbed?.index === index;
  }

  private pin() {
    for (let hold = 0; hold < this.pinned.length; hold++) {
      const point = this.points[this.pinned[hold]];
      point.x = this.holds[hold].x;
      point.y = this.holds[hold].y;
    }
    if (this.grabbed) {
      const point = this.points[this.grabbed.index];
      point.x = this.grabbed.at.x;
      point.y = this.grabbed.at.y;
    }
  }

  /** A point brought inside the bounds, when there are any. */
  private within(point: RopePoint): RopePoint {
    if (!this.bounds) {
      return { ...point };
    }
    return {
      x: Math.min(this.bounds.right, Math.max(this.bounds.left, point.x)),
      y: Math.min(this.bounds.bottom, Math.max(this.bounds.top, point.y)),
    };
  }

  /** Every free point kept on the sheet: a lead lies on the bench, never past its edge. */
  private keepWithin() {
    if (!this.bounds) {
      return;
    }
    this.points.forEach((point, index) => {
      if (!this.isFixed(index)) {
        const inside = this.within(point);
        point.x = inside.x;
        point.y = inside.y;
      }
    });
  }

  private keepLength(first: number, second: number) {
    const one = this.points[first];
    const other = this.points[second];
    const dx = other.x - one.x;
    const dy = other.y - one.y;
    const distance = Math.hypot(dx, dy);
    const rest = this.rests[first];
    if (distance <= rest || distance === 0) {
      return;
    }
    // A rope pulls when stretched and gives when pushed: only too long a link is corrected.
    const correction = (distance - rest) / distance;
    const firstFixed = this.isFixed(first);
    const secondFixed = this.isFixed(second);
    if (firstFixed && secondFixed) {
      return;
    }
    if (firstFixed) {
      other.x -= dx * correction;
      other.y -= dy * correction;
    } else if (secondFixed) {
      one.x += dx * correction;
      one.y += dy * correction;
    } else {
      one.x += dx * correction / 2;
      one.y += dy * correction / 2;
      other.x -= dx * correction / 2;
      other.y -= dy * correction / 2;
    }
  }

  /**
   * A cable cannot be folded tighter than its bend radius: the two points either side of every point — a hold and the
   * point under the pointer included — are kept at least as far apart as that radius allows, so it turns through a
   * hold or a pull as an arc. Each free point is also eased toward the middle of its neighbours, its stiffness.
   */
  private bend(backwards: boolean) {
    const last = this.points.length - 1;
    // Swept from either end in turn: a turn forced at a hold spreads both ways along the cable as an arc, instead of
    // one direction being corrected late and the cable kinking on the other side of the hold.
    for (let step = 1; step < last; step++) {
      const index = backwards ? last - step : step;
      const before = this.points[index - 1];
      const after = this.points[index + 1];
      const link = (this.rests[index - 1] + this.rests[index]) / 2;
      const turn = Math.min(Math.PI, link / BEND_RADIUS);
      const nearest = 2 * link * Math.cos(turn / 2);
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      const distance = Math.hypot(dx, dy);
      if (distance < nearest && distance > 0) {
        this.separate(index - 1, index + 1, (nearest - distance) / distance, dx, dy);
      }
      if (!this.isFixed(index)) {
        const point = this.points[index];
        point.x += ((before.x + after.x) / 2 - point.x) * BENDING;
        point.y += ((before.y + after.y) / 2 - point.y) * BENDING;
      }
    }
  }

  /** Moves two points apart along the line between them by `share` of it, each as far as it is free to move. */
  private separate(first: number, second: number, share: number, dx: number, dy: number) {
    const firstFree = !this.isFixed(first);
    const secondFree = !this.isFixed(second);
    if (!firstFree && !secondFree) {
      return;
    }
    const part = firstFree && secondFree ? share / 2 : share;
    if (firstFree) {
      this.points[first].x -= dx * part;
      this.points[first].y -= dy * part;
    }
    if (secondFree) {
      this.points[second].x += dx * part;
      this.points[second].y += dy * part;
    }
  }
}

/** `links + 1` points equally spaced along a polyline, its ends included. */
function resample(line: readonly RopePoint[], links: number): RopePoint[] {
  const total = arcLength(line, 0, line.length - 1);
  if (total === 0) {
    return Array.from({ length: links + 1 }, () => ({ ...line[0] }));
  }
  const points: RopePoint[] = [{ ...line[0] }];
  let segment = 1;
  let walked = 0;
  for (let link = 1; link < links; link++) {
    const target = total * link / links;
    let length = Math.hypot(line[segment].x - line[segment - 1].x, line[segment].y - line[segment - 1].y);
    while (walked + length < target && segment < line.length - 1) {
      walked += length;
      segment++;
      length = Math.hypot(line[segment].x - line[segment - 1].x, line[segment].y - line[segment - 1].y);
    }
    const share = length === 0 ? 0 : (target - walked) / length;
    const from = line[segment - 1];
    const to = line[segment];
    points.push({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share });
  }
  points.push({ ...line[line.length - 1] });
  return points;
}

/** The length of a polyline between two of its indices. */
function arcLength(line: readonly RopePoint[], from: number, to: number): number {
  let length = 0;
  for (let index = from + 1; index <= to; index++) {
    length += Math.hypot(line[index].x - line[index - 1].x, line[index].y - line[index - 1].y);
  }
  return length;
}

/** A smooth curve through points: each piece a cubic Bézier with Catmull–Rom tangents. */
export function smoothPath(points: readonly RopePoint[]): string {
  if (points.length === 0) {
    return "";
  }
  const at = (point: RopePoint) => `${round(point.x)} ${round(point.y)}`;
  let path = `M${at(points[0])}`;
  for (let index = 0; index < points.length - 1; index++) {
    const before = points[Math.max(0, index - 1)];
    const from = points[index];
    const to = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const first = { x: from.x + (to.x - before.x) / 6, y: from.y + (to.y - before.y) / 6 };
    const second = { x: to.x - (after.x - from.x) / 6, y: to.y - (after.y - from.y) / 6 };
    path += `C${at(first)} ${at(second)} ${at(to)}`;
  }
  return path;
}

/**
 * Stripes along a rope: a short mark every `spacing` units of its length, slanted at 45° to the rope where it stands,
 * `width` across — what a striped test lead looks like, however it bends.
 */
export function stripePath(points: readonly RopePoint[], spacing = 6, width = 3.6): string {
  if (points.length < 2) {
    return "";
  }
  let path = "";
  let carried = spacing / 2;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) {
      continue;
    }
    const along = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    const across = { x: -along.y, y: along.x };
    const half = width / 2;
    let travelled = carried;
    while (travelled <= length) {
      const centre = { x: from.x + along.x * travelled, y: from.y + along.y * travelled };
      const start = { x: centre.x - across.x * half - along.x * half, y: centre.y - across.y * half - along.y * half };
      const end = { x: centre.x + across.x * half + along.x * half, y: centre.y + across.y * half + along.y * half };
      path += `M${round(start.x)} ${round(start.y)}L${round(end.x)} ${round(end.y)}`;
      travelled += spacing;
    }
    carried = travelled - length;
  }
  return path;
}

const round = (value: number) => Math.round(value * 10) / 10;

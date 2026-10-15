import type { PartLibraryView } from "./partLibrary";
import { labelPositionOf, type DrawingItem } from "../circuit/SchematicDocument";

export type Point = { x: number; y: number };

/**
 * Where a part's texts landed: its name, its value, and its readings block — the first line's baseline point and how the
 * lines align to it —, null for a text it does not have.
 */
export interface LabelPlacement {
  name: Point | null;
  value: Point | null;
  /** A name or a value put away from its part by hand is tied back to it. */
  nameLeader: Leader | null;
  valueLeader: Leader | null;
  readings: { point: Point; anchor: "start" | "middle" | "end"; leader: Leader | null } | null;
}

/** A text of a part that can be put somewhere by hand. */
export type PartText = "name" | "value" | "readings";

/** A thin line from a text that stands off to the point it describes: from the text's edge to the part's or node's. */
export interface Leader { from: Point; to: Point }

type Box = ReturnType<typeof labelBox>;

const clampTo = (point: Point, box: Box): Point => ({
  x: Math.min(box.right, Math.max(box.left, point.x)), y: Math.min(box.bottom, Math.max(box.top, point.y)) });
const centreOf = (box: Box): Point => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });

/** The leader of a text placed off its first ring: from the text's box to the nearest point of what it describes. */
function leaderOf(textBox: Box, described: Box): Leader {
  const to = clampTo(centreOf(textBox), described);
  return { from: clampTo(to, textBox), to };
}

/**
 * The leader of a readings block: from where its text is anchored — the block's figures change width as they run, so
 * the reserved box's corner could be well clear of the text and the leader hung in the air beside it —, on the side
 * nearest the part, to the nearest point of the part.
 */
function readingsLeader(point: Point, anchor: "start" | "middle" | "end", tall: number, described: Box): Leader {
  const top = point.y - 10;
  const bottom = top + tall;
  const middle = centreOf(described);
  const from = anchor === "middle"
    ? { x: point.x, y: described.top >= bottom ? bottom + 2 : described.bottom <= top ? top - 2 : (top + bottom) / 2 }
    : { x: point.x + (anchor === "start" ? -3 : 3), y: Math.min(bottom, Math.max(top, middle.y)) };
  return { from, to: clampTo(from, described) };
}

/** What a sheet's texts must keep clear of besides the parts: a wire's run or a pin, as a box in sheet units. */
export type SheetObstacle = { left: number; right: number; top: number; bottom: number };

/** One line of a part's readings block, and the widest a line is reserved for — the figures change, the place must not. */
export const READING_LINE = 13;
/** The widest a readings line is reserved for, sheet units: about seven per character of the technical face. */
export const READING_RESERVE = 22 * 7 + 4;
const READING_WIDTH = READING_RESERVE;

/** An estimate of a label's width: the sheet's labels are 10 px technical type, about six pixels a character. */
const textWidth = (text: string) => text.length * 6 + 4;

/** The box a label covers when printed at a point of a part, anchored the way `PartLabels` anchors it. */
export function labelBox(item: DrawingItem, point: Point, text: string) {
  const across = point.x - item.x;
  const down = point.y - item.y;
  const width = textWidth(text);
  const anchor = anchorAway(across, down);
  const left = anchor === "start" ? point.x : anchor === "end" ? point.x - width : point.x - width / 2;
  return { left, right: left + width, top: point.y - 7, bottom: point.y + 7 };
}

const overlaps = (first: Box, second: Box) => first.left < second.right && second.left < first.right
  && first.top < second.bottom && second.top < first.bottom;

/**
 * Every text a part carries, laid out by one rule so none overprints another, a body, a pin or a wire. A text put
 * somewhere by hand (`item.labels`) stands there and is kept clear of first, tied back to its part when it stands
 * away from it. Then every other name and value — each tried where its symbol places it, then mirrored across the
 * part, then a line lower or higher on either side —, then each readings block of `readings` lines (what the part
 * takes and how warm it is, its meters' figures): under the part, over it, to its right, to its left. The first free
 * place wins; when none is, the first choice stands.
 */
export function placeLabels(library: PartLibraryView, items: readonly DrawingItem[], bodyOf: (item: DrawingItem) => { halfWidth: number; halfHeight: number },
  obstacles: readonly SheetObstacle[] = [], readings: ReadonlyMap<string, number> = new Map()): Map<string, LabelPlacement> {
  const bodyBox = (item: DrawingItem): Box => {
    const { halfWidth, halfHeight } = bodyOf(item);
    const vertical = item.rotation % 180 !== 0;
    const width = (vertical ? halfHeight : halfWidth) - 8;
    const height = (vertical ? halfWidth : halfHeight) - 8;
    return { left: item.x - width, right: item.x + width, top: item.y - height, bottom: item.y + height };
  };
  const bodies: Box[] = items.filter((item) => item.type !== "JUNCTION").map(bodyBox);
  const occupied: Box[] = [...bodies, ...obstacles];
  // The names and values placed so far: a readings block's leader must not run through one.
  const texts: Box[] = [];
  // A text that stands clear of its part by more than this is tied back to it.
  const farFrom = (box: Box, body: Box) => box.left > body.right + 14 || box.right < body.left - 14 || box.top > body.bottom + 14 || box.bottom < body.top - 14;
  const handPlaced = new Map<string, { name?: { point: Point; leader: Leader | null }; value?: { point: Point; leader: Leader | null } }>();
  for (const item of items) {
    for (const subject of ["name", "value"] as const) {
      const offset = item.labels?.[subject];
      const text = subject === "name" ? item.id : item.element?.value;
      if (!offset || !text || item.type === "JUNCTION") {
        continue;
      }
      const point = { x: item.x + offset.x, y: item.y + offset.y };
      const box = labelBox(item, point, text);
      occupied.push(box);
      texts.push(box);
      const body = bodyBox(item);
      handPlaced.set(item.id, { ...handPlaced.get(item.id), [subject]: { point, leader: farFrom(box, body) ? leaderOf(box, body) : null } });
    }
  }
  const placements = new Map<string, LabelPlacement>();
  for (const item of items) {
    if (item.type === "JUNCTION") {
      continue;
    }
    const place = (subject: "name" | "value", text: string | null | undefined): Point | null => {
      const placed = handPlaced.get(item.id)?.[subject];
      if (placed) {
        return placed.point;
      }
      const anchor = text ? labelPositionOf(library, item, subject) : null;
      if (!anchor || !text) {
        return null;
      }
      const mirrored = { x: 2 * item.x - anchor.x, y: 2 * item.y - anchor.y };
      const candidates = [anchor, mirrored, { x: anchor.x, y: anchor.y + 14 }, { x: mirrored.x, y: mirrored.y + 14 },
        { x: anchor.x, y: anchor.y - 14 }, { x: mirrored.x, y: mirrored.y - 14 }];
      const chosen = candidates.find((candidate) => !occupied.some((box) => overlaps(box, labelBox(item, candidate, text)))) ?? anchor;
      occupied.push(labelBox(item, chosen, text));
      texts.push(labelBox(item, chosen, text));
      return chosen;
    };
    placements.set(item.id, { name: place("name", item.id), value: place("value", item.element?.value), readings: null,
      nameLeader: handPlaced.get(item.id)?.name?.leader ?? null, valueLeader: handPlaced.get(item.id)?.value?.leader ?? null });
  }
  for (const item of items) {
    const lines = readings.get(item.id) ?? 0;
    if (item.type === "JUNCTION" || lines === 0) {
      continue;
    }
    const { halfWidth, halfHeight } = bodyOf(item);
    const turned = item.rotation % 180 !== 0;
    const across = (turned ? halfHeight : halfWidth) + 6;
    const down = (turned ? halfWidth : halfHeight) + 4;
    const tall = lines * READING_LINE;
    const body = { left: item.x - across + 6, right: item.x + across - 6, top: item.y - down + 4, bottom: item.y + down - 4 };
    const offset = item.labels?.readings;
    if (offset) {
      // Put by hand: it stands there, its top line's start at the point, and is tied back when away from its part.
      const point = { x: item.x + offset.x, y: item.y + offset.y };
      const box = { left: point.x, right: point.x + READING_WIDTH, top: point.y - 10, bottom: point.y - 10 + tall };
      occupied.push(box);
      placements.get(item.id)!.readings = { point, anchor: "start", leader: farFrom(box, body) ? readingsLeader(point, "start", tall, body) : null };
      continue;
    }
    // Each side at the body's edge, then a grid step further out at a time — past the wire that usually runs along it;
    // a block that stands off is tied back by a leader. Besides the four sides, the four corners: under or over the part,
    // starting at its right edge or ending at its left — a vertical part's sides are often a wire away from another.
    const slots: { point: Point; anchor: "start" | "middle" | "end"; box: Box; further: number }[] = [0, 20, 40, 60, 80, 100, 120].flatMap((further) => [
      { further, point: { x: item.x, y: item.y + down + further + 10 }, anchor: "middle" as const,
        box: { left: item.x - READING_WIDTH / 2, right: item.x + READING_WIDTH / 2, top: item.y + down + further, bottom: item.y + down + further + tall } },
      { further, point: { x: item.x, y: item.y - down - further - tall + 10 }, anchor: "middle" as const,
        box: { left: item.x - READING_WIDTH / 2, right: item.x + READING_WIDTH / 2, top: item.y - down - further - tall, bottom: item.y - down - further } },
      { further, point: { x: item.x + across + further, y: item.y - tall / 2 + 10 }, anchor: "start" as const,
        box: { left: item.x + across + further, right: item.x + across + further + READING_WIDTH, top: item.y - tall / 2, bottom: item.y + tall / 2 } },
      { further, point: { x: item.x - across - further, y: item.y - tall / 2 + 10 }, anchor: "end" as const,
        box: { left: item.x - across - further - READING_WIDTH, right: item.x - across - further, top: item.y - tall / 2, bottom: item.y + tall / 2 } },
      { further, point: { x: item.x + across - 6, y: item.y + down + further + 10 }, anchor: "start" as const,
        box: { left: item.x + across - 6, right: item.x + across - 6 + READING_WIDTH, top: item.y + down + further, bottom: item.y + down + further + tall } },
      { further, point: { x: item.x - across + 6, y: item.y + down + further + 10 }, anchor: "end" as const,
        box: { left: item.x - across + 6 - READING_WIDTH, right: item.x - across + 6, top: item.y + down + further, bottom: item.y + down + further + tall } },
      { further, point: { x: item.x + across - 6, y: item.y - down - further - tall + 10 }, anchor: "start" as const,
        box: { left: item.x + across - 6, right: item.x + across - 6 + READING_WIDTH, top: item.y - down - further - tall, bottom: item.y - down - further } },
      { further, point: { x: item.x - across + 6, y: item.y - down - further - tall + 10 }, anchor: "end" as const,
        box: { left: item.x - across + 6 - READING_WIDTH, right: item.x - across + 6, top: item.y - down - further - tall, bottom: item.y - down - further } },
    ]);
    // A slot whose leader would cross a name or a value is as taken as one its box would cover.
    const chosen = leastCovered(slots, occupied, (slot) => slot.further > 0
      && texts.some((text) => crosses(readingsLeader(slot.point, slot.anchor, tall, body), text)));
    occupied.push(chosen.box);
    placements.get(item.id)!.readings = { point: chosen.point, anchor: chosen.anchor,
      leader: chosen.further > 0 ? readingsLeader(chosen.point, chosen.anchor, tall, body) : null };
  }
  return placements;
}

/**
 * The first slot nothing covers and nothing forbids; when there is none, the one that runs over the FEWEST things —
 * then, of those, the least area —, among those not forbidden, then among all. Measured by area alone, running over a
 * wire was nearly free — a wire is three units thick — and readings were laid across wires while a clear place stood
 * two steps further out.
 */
function leastCovered<Slot extends { box: Box }>(slots: readonly Slot[], occupied: readonly Box[], forbidden: (slot: Slot) => boolean = () => false): Slot {
  const overlapOf = (slot: Slot, box: Box) => Math.max(0, Math.min(box.right, slot.box.right) - Math.max(box.left, slot.box.left))
    * Math.max(0, Math.min(box.bottom, slot.box.bottom) - Math.max(box.top, slot.box.top));
  const crossed = (slot: Slot) => occupied.filter((box) => overlapOf(slot, box) > 0).length;
  const covered = (slot: Slot) => occupied.reduce((area, box) => area + overlapOf(slot, box), 0);
  const allowed = slots.filter((slot) => !forbidden(slot));
  const candidates = allowed.length ? allowed : slots;
  return candidates.find((slot) => crossed(slot) === 0)
    ?? [...candidates].sort((first, second) => crossed(first) - crossed(second) || covered(first) - covered(second))[0];
}

/** Whether a leader runs through a box: a point of it, every few units along, inside the box. */
function crosses(leader: Leader, box: Box): boolean {
  const length = Math.hypot(leader.to.x - leader.from.x, leader.to.y - leader.from.y);
  const steps = Math.max(1, Math.ceil(length / 3));
  for (let step = 0; step <= steps; step++) {
    const x = leader.from.x + (leader.to.x - leader.from.x) * step / steps;
    const y = leader.from.y + (leader.to.y - leader.from.y) * step / steps;
    if (x > box.left && x < box.right && y > box.top && y < box.bottom) {
      return true;
    }
  }
  return false;
}

/**
 * How text sits on an anchor so it grows away from the part: centred above or below it, starting to its right, ending
 * to its left — a part turned on its side keeps a long value off its own drawing.
 */
export function anchorAway(across: number, down: number): "start" | "middle" | "end" {
  if (Math.abs(across) <= Math.abs(down)) {
    return "middle";
  }
  return across > 0 ? "start" : "end";
}

/**
 * What is selected in a drawing: a set of ids, in the order they were taken. One click takes one thing; Shift (or
 * Ctrl) with a click adds it or takes it away again; a box takes what it holds, added to what was taken with Shift.
 */
export type Selection = readonly string[];

export const NOTHING: Selection = [];

/** A click on `id`: only it — or, `adding`, it added or taken away from what is selected. */
export function clicked(selection: Selection, id: string, adding: boolean): Selection {
  if (!adding) {
    return selection.length === 1 && selection[0] === id ? selection : [id];
  }
  return selection.includes(id) ? selection.filter((selected) => selected !== id) : [...selection, id];
}

/** A box let go over `ids`: those — or, `adding`, those added to what was selected. */
export function boxed(selection: Selection, ids: readonly string[], adding: boolean): Selection {
  if (!adding) {
    return [...ids];
  }
  return [...selection, ...ids.filter((id) => !selection.includes(id))];
}

/** What is still selected once `present` are all there is: a removed thing is not selected any more. */
export function within(selection: Selection, present: (id: string) => boolean): Selection {
  const kept = selection.filter(present);
  return kept.length === selection.length ? selection : kept;
}

/** A rectangle in drawing units, from two corners in any order. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function boxBetween(from: { x: number; y: number }, to: { x: number; y: number }): Box {
  return { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) };
}

/** Whether `inner` lies wholly in `outer` — what a box takes: things it holds whole, as in every drawing program. */
export function holds(outer: Box, inner: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

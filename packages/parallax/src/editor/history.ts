/**
 * What an editor can take back: every kept state before the present, and those undone after it. One gesture is one
 * step — a drag previews as it goes and keeps its result once —, an unchanged state is not a step, and only so many
 * are kept. The same for a sheet, a symbol or any drawing: written once, not once per editor.
 */
export class EditHistory<T> {

  private readonly past: T[] = [];
  private readonly undone: T[] = [];

  private readonly limit: number;
  private readonly same: (left: T, right: T) => boolean;

  constructor(limit = 100, same: (left: T, right: T) => boolean = sameJson) {
    this.limit = limit;
    this.same = same;
  }

  /** Keeps `before` as a step back, unless it is the same as `after`; a new step forgets what was undone. */
  record(before: T, after: T): boolean {
    if (this.same(before, after)) {
      return false;
    }
    this.past.push(before);
    if (this.past.length > this.limit) {
      this.past.shift();
    }
    this.undone.length = 0;
    return true;
  }

  /** The state to go back to from `present`, or null when there is none. */
  undo(present: T): T | null {
    const previous = this.past.pop();
    if (previous === undefined) {
      return null;
    }
    this.undone.push(present);
    return previous;
  }

  /** The state undone last, back again, or null when there is none. */
  redo(present: T): T | null {
    const next = this.undone.pop();
    if (next === undefined) {
      return null;
    }
    this.past.push(present);
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  /** Forgets every step: a new subject, or the original given back. */
  clear() {
    this.past.length = 0;
    this.undone.length = 0;
  }
}

function sameJson<T>(left: T, right: T): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

import type { TraceSource } from "./mathChannel";

/**
 * One channel of the memory between two sample indices as segments, in whatever units `xOf` and `yOf` map time and
 * value to. Shared by every screen that draws the memory — the oscilloscope's, a meter's graph.
 *
 * <p>Every sample stands for its interval with its peaks — the lowest and highest reading the source saw in it —, so
 * a signal faster than the samples is drawn as the band it fills, as a digital oscilloscope's peak detection draws it:
 * a 20 kHz square on a 5 ms division is a wall from one level to the other, never a saw of whichever level a sample
 * happened to land on. A stretch denser than the pixel columns it covers is drawn column by column — the lowest and
 * highest peak under each, joined to the next from the last reading under it to the first under the next, the signal's
 * own path —, so a million samples cost what a thousand do.
 *
 * <p>Where one acquisition ends and the next begins, the line breaks, as a gap in the readings breaks it: a live run at
 * real time keeps one block of samples a frame and goes through the rest unread, and a line drawn across the gap is a
 * signal that was never there. The memory says where those ends are; nothing here guesses them from the times.
 */
export function appendTrace(segment: (ax: number, ay: number, bx: number, by: number) => void, memory: TraceSource, channel: string,
  first: number, last: number, columns: number, xOf: (time: number) => number, yOf: (value: number) => number, width: number) {
  if (last - first > columns * 2) {
    let column = -1;
    let low = 0;
    let high = 0;
    let entry = 0;
    let exit = 0;
    let previous: [number, number] | null = null;
    let broken = false;
    const flush = () => {
      if (column < 0) {
        return;
      }
      const x = ((column + 0.5) / columns) * width;
      if (previous && !broken) {
        segment(previous[0], previous[1], x, yOf(entry));
      }
      if (high > low) {
        segment(x, yOf(low), x, yOf(high));
      }
      previous = [x, yOf(exit)];
      broken = false;
    };
    for (let index = first; index < last; index++) {
      const value = memory.reading(channel, index);
      if (!Number.isFinite(value)) {
        continue;
      }
      const time = memory.time(index);
      const gap = !memory.continues(index);
      const pixel = Math.floor((xOf(time) / width) * columns);
      if (pixel !== column || gap) {
        flush();
        broken = gap;
        column = pixel;
        low = memory.low(channel, index);
        high = memory.high(channel, index);
        entry = value;
      } else {
        low = Math.min(low, memory.low(channel, index));
        high = Math.max(high, memory.high(channel, index));
      }
      exit = value;
    }
    flush();
    return;
  }
  // Sample to sample. A sample's peaks are read against the two readings that bound its interval:
  // · within them — the signal went from one to the other, however it moved: one line between the readings;
  // · beyond them on one side — it turned once in between, a ring's crest: the line goes through that crest, at the
  //   middle of the interval, since the peak says how high but not when;
  // · beyond them on both sides — it moved faster than the samples, and an instant is whichever phase it landed on: the
  //   samples are joined by their peaks, top to top and bottom to bottom, the band the signal fills.
  // Every spread interval was drawn as that band once, and a smooth ring zoomed in on was a doubled line with rungs.
  let previous: { x: number; value: number; low: number; high: number; fast: boolean } | null = null;
  for (let index = first; index < last; index++) {
    const value = memory.reading(channel, index);
    const time = memory.time(index);
    if (!Number.isFinite(value) || !memory.continues(index)) {
      previous = null;
      if (!Number.isFinite(value)) {
        continue;
      }
    }
    const x = xOf(time);
    const low = memory.low(channel, index);
    const high = memory.high(channel, index);
    if (!previous) {
      previous = { x, value, low, high, fast: false };
      continue;
    }
    const tolerance: number = 1e-5 * Math.max(Math.abs(low), Math.abs(high), Math.abs(value), Math.abs(previous.value), 1e-3);
    const above: boolean = high > Math.max(previous.value, value) + tolerance;
    const below: boolean = low < Math.min(previous.value, value) - tolerance;
    const fast: boolean = above && below;
    if (fast) {
      segment(x, yOf(low), x, yOf(high));
      if (previous.fast) {
        segment(previous.x, yOf(previous.high), x, yOf(high));
        segment(previous.x, yOf(previous.low), x, yOf(low));
      } else {
        segment(previous.x, yOf(previous.value), x, yOf(value));
      }
    } else if (above || below) {
      const middle = (previous.x + x) / 2;
      const crest = above ? high : low;
      segment(previous.x, yOf(previous.value), middle, yOf(crest));
      segment(middle, yOf(crest), x, yOf(value));
    } else {
      segment(previous.x, yOf(previous.value), x, yOf(value));
    }
    previous = { x, value, low, high, fast };
  }
}

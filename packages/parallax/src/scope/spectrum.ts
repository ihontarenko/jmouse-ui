import type { Window } from "../oscilloscope";
import type { TraceSource } from "./mathChannel";
import { ladderAtLeast } from "../quantities";

/*
 * The screen in the frequency domain, as a digital oscilloscope's FFT shows it: the stretch the screen holds, resampled
 * evenly, weighed by a Hann window and transformed; each bin's amplitude calibrated to the volts of a sine at that
 * frequency (a 1 V sine reads 0 dBV), drawn against the frequency on a logarithmic axis. It is the samples the screen
 * shows, read another way — like the frequency and duty measured under the screen —, so it moves with the run and
 * with the time base: a longer window, a finer resolution.
 */

/** The most points transformed: 2¹³ — a fine resolution over a window, and still well inside a frame. */
const MOST_POINTS = 8192;

export interface Spectrum {
  /** Each bin's frequency, Hz, from the resolution up to half the sample rate. */
  frequencies: Float64Array;
  /** Each bin's amplitude as a sine's peak would read, dBV (0 dBV = 1 V). */
  levels: Float64Array;
  /** The spacing of the bins: 1 / the window, Hz. */
  resolution: number;
  /** Half the sample rate the window was resampled at: the highest frequency the window can tell. */
  nyquist: number;
}

/**
 * The spectrum of one channel over the record that ends where the screen ends: the window shown, reached further back
 * through the memory up to {@link MOST_POINTS} samples — as a bench oscilloscope's FFT reads its whole acquisition, not
 * the ten divisions —, so a 100 ms screen of a 50 Hz signal is not five coarse bins that the peak hops between. Null
 * with fewer than 16 samples.
 */
export function spectrumOf(memory: TraceSource, channel: string, view: Window): Spectrum | null {
  const { first, last } = analysisRecord(memory, view);
  const count = last - first;
  if (count < 16) {
    return null;
  }
  const size = Math.min(MOST_POINTS, 2 ** Math.ceil(Math.log2(count)));
  const start = memory.time(first);
  const span = memory.time(last - 1) - start;
  if (!(span > 0)) {
    return null;
  }
  // Evenly in time — a live memory may hold blocks of samples a frame apart —, linear between the samples kept.
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  let index = first;
  let sum = 0;
  for (let point = 0; point < size; point++) {
    const time = start + (span * point) / (size - 1);
    while (index < last - 2 && memory.time(index + 1) < time) {
      index++;
    }
    const before = memory.time(index);
    const after = memory.time(Math.min(last - 1, index + 1));
    const share = after > before ? Math.min(1, Math.max(0, (time - before) / (after - before))) : 0;
    const a = memory.reading(channel, index);
    const b = memory.reading(channel, Math.min(last - 1, index + 1));
    real[point] = Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * share : 0;
    sum += real[point];
  }
  // The mean is taken out before the window: a collector sitting at 10 V leaked through the Hann window's skirt into the
  // lowest bins, outshone the 50 Hz it swings at, and the peak — and every phasor read from it — hopped between them.
  const mean = sum / size;
  let windowSum = 0;
  for (let point = 0; point < size; point++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * point) / (size - 1));
    real[point] = (real[point] - mean) * hann;
    windowSum += hann;
  }
  transform(real, imaginary);
  const bins = size / 2;
  const frequencies = new Float64Array(bins - 1);
  const levels = new Float64Array(bins - 1);
  const duration = (span * size) / (size - 1);
  for (let bin = 1; bin < bins; bin++) {
    const amplitude = (2 * Math.hypot(real[bin], imaginary[bin])) / windowSum;
    frequencies[bin - 1] = bin / duration;
    levels[bin - 1] = 20 * Math.log10(Math.max(amplitude, 1e-9));
  }
  return { frequencies, levels, resolution: 1 / duration, nyquist: bins / duration };
}

/**
 * The samples a spectrum or a phasor is read from: the unbroken stretch that ends where the screen ends, or — when the
 * screen's end falls early in a block, a few hundred samples in — the whole block before it, whichever is longer, at
 * most {@link MOST_POINTS}. A live stream arrives in blocks of 4096 samples with a gap as long between them, and the
 * screen plays a little behind it: read up to the screen's end alone, the record was 900 samples and the resolution 227 Hz.
 */
export function analysisRecord(memory: TraceSource, view: Window): { first: number; last: number } {
  const last = Math.min(memory.length, memory.indexAt(view.start + view.span));
  const first = unbrokenFrom(memory, last);
  let record = { first: Math.max(first, last - MOST_POINTS), last };
  if (first > 2) {
    const before = { first: unbrokenFrom(memory, first), last: first };
    if (before.last - before.first > record.last - record.first) {
      record = { first: Math.max(before.first, before.last - MOST_POINTS), last: before.last };
    }
  }
  return record;
}

/**
 * Where the unbroken stretch of samples that ends before `last` begins: the start of its acquisition. A live memory
 * holds the stream in blocks, and a block can stand a frame after the one before it — the samples between were never
 * kept. A transform taken across such a gap, the gap bridged by a straight line, read a 2 V sine 5.8 dB low and 1.3 Hz
 * off; so the record is only what was sampled without a break.
 */
export function unbrokenFrom(memory: TraceSource, last: number): number {
  if (last < 2) {
    return 0;
  }
  let first = last - 1;
  while (first > 0 && memory.continues(first)) {
    first--;
  }
  return first;
}

/**
 * The strongest component and where it is, between the bins — see {@link peakNear}. A 480 Hz tone at a 50 Hz resolution
 * read 500 Hz from its bin alone.
 */
export function spectrumPeak(spectrum: Spectrum): { frequency: number; level: number } {
  const levels = spectrum.levels;
  let top = 0;
  for (let bin = 1; bin < levels.length; bin++) {
    if (levels[bin] > levels[top]) {
      top = bin;
    }
  }
  return peakNear(spectrum, top);
}

/**
 * A tone where it really is, from the bin it stands in and its two neighbours, by the Hann window's own shape
 * (Grandke): its offset from the bin is δ = 2(c − a) / (a + 2b + c) of a resolution, a, b, c the three magnitudes, and its
 * amplitude the bin's divided by the window's response that far off, sinc(δ) / (1 − δ²). A parabola through the
 * decibels — what stood here before — read a 0.4 V tone 0.28 dB high and a 1.2 kHz reference 1.5 Hz low.
 */
export function peakNear(spectrum: Spectrum, bin: number): { frequency: number; level: number } {
  const levels = spectrum.levels;
  if (bin <= 0 || bin >= levels.length - 1) {
    return { frequency: spectrum.frequencies[bin], level: levels[bin] };
  }
  const [before, at, after] = [levels[bin - 1], levels[bin], levels[bin + 1]].map((level) => 10 ** (level / 20));
  const offset = Math.max(-0.5, Math.min(0.5, (2 * (after - before)) / (before + 2 * at + after)));
  const response = offset === 0 ? 1 : Math.sin(Math.PI * offset) / (Math.PI * offset) / (1 - offset * offset);
  return { frequency: spectrum.frequencies[bin] + offset * spectrum.resolution, level: 20 * Math.log10(at / response) };
}

/** The frequency axis a spectrum is drawn on: decades from the resolution to the highest frequency the window tells. */
export interface SpectrumAxis {
  lowest: number;
  highest: number;
}

export function spectrumAxisOf(spectra: readonly (Spectrum | null)[]): SpectrumAxis | null {
  const shown = spectra.filter((spectrum): spectrum is Spectrum => spectrum !== null);
  if (!shown.length) {
    return null;
  }
  // On the 1–2–5 ladder, outwards: the record's length moves by a few samples from read to read, and an axis taken from
  // it as it is shifted every curve sideways each time.
  return { lowest: ladderBelow(Math.min(...shown.map((spectrum) => spectrum.resolution))), highest: ladderAtLeast(Math.max(...shown.map((spectrum) => spectrum.nyquist))) };
}

/** The largest 1–2–5 value at most `value`. */
function ladderBelow(value: number): number {
  const decade = 10 ** Math.floor(Math.log10(value));
  const mantissa = value / decade;
  return (mantissa >= 5 ? 5 : mantissa >= 2 ? 2 : 1) * decade;
}

/** The levels a spectrum is drawn against: the top of the screen in dB of the channel's unit, and the dB a division holds. */
export interface SpectrumRange {
  top: number;
  decibelsPerDivision: number;
}

/** +20 dBV down to −60 dBV over eight divisions. */
export const DEFAULT_SPECTRUM_RANGE: SpectrumRange = { top: 20, decibelsPerDivision: 10 };

/** The dB a division may hold, as a spectrum analyser offers them. */
export const SPECTRUM_DECIBELS_PER_DIVISION = [2, 5, 10, 20] as const;

/**
 * The range that shows every channel's strongest component just under the top and as much as it can below: the top at
 * the next ten decibels above the highest peak.
 */
export function fittedSpectrumRange(spectra: readonly (Spectrum | null)[], current: SpectrumRange): SpectrumRange {
  const peaks = spectra.filter((spectrum): spectrum is Spectrum => spectrum !== null).map((spectrum) => spectrumPeak(spectrum).level);
  if (!peaks.length) {
    return current;
  }
  return { ...current, top: Math.ceil((Math.max(...peaks) + 1) / 10) * 10 };
}

/** In place, radix 2: `real` and `imaginary` of a length that is a power of two. */
function transform(real: Float64Array, imaginary: Float64Array) {
  const size = real.length;
  for (let index = 1, swapped = 0; index < size; index++) {
    let bit = size >> 1;
    for (; swapped & bit; bit >>= 1) {
      swapped ^= bit;
    }
    swapped ^= bit;
    if (index < swapped) {
      [real[index], real[swapped]] = [real[swapped], real[index]];
      [imaginary[index], imaginary[swapped]] = [imaginary[swapped], imaginary[index]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let offset = 0; offset < length / 2; offset++) {
        const even = start + offset;
        const odd = even + length / 2;
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
        const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
}

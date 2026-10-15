/** Grid steps and the numbers written on axes and readouts — one rule for every canvas. */

/** The grid step for a scale: 1, 2 or 5 times a power of ten, at least `minimumPixels` apart on screen. */
export function gridStep(pixelsPerUnit: number, minimumPixels = 72): { major: number; minor: number } {
  const raw = minimumPixels / pixelsPerUnit;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const multiplier = [1, 2, 5, 10].find((candidate) => candidate * power >= raw) ?? 10;
  const major = multiplier * power;
  return { major, minor: major / (multiplier === 2 ? 4 : 5) };
}

/** Every multiple of `step` from `minimum` to `maximum`, with zero written as exactly zero. */
export function steps(minimum: number, maximum: number, step: number): number[] {
  const values: number[] = [];
  if (!(step > 0) || !Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    return values;
  }
  const first = Math.ceil(minimum / step);
  const count = Math.floor(maximum / step + 1e-9) - first + 1;
  // Far from zero at a fine step the indices pass what a double counts exactly; a grid there is no grid at all.
  if (!Number.isFinite(count) || count > 2000 || !Number.isSafeInteger(first)) {
    return values;
  }
  for (let offset = 0; offset < count; offset++) {
    const value = (first + offset) * step;
    values.push(Math.abs(value) < step * 1e-9 ? 0 : value);
  }
  return values;
}

/** A tick label: as few digits as the step needs, a true minus sign, exponents only far from one. */
export function formatTick(value: number, step: number): string {
  if (Math.abs(value) < step * 1e-9) {
    return "0";
  }
  const magnitude = Math.abs(value);
  const text = magnitude >= 1e6 || magnitude < 1e-4
    ? value.toExponential(Math.max(0, Math.min(6, Math.floor(Math.log10(magnitude)) - Math.floor(Math.log10(step)))))
    : value.toFixed(Math.max(0, Math.min(10, -Math.floor(Math.log10(step) + 1e-9))));
  return text.replace("-", "−");
}

/** A read-out point, to the precision the current scale can resolve. */
export function formatReadout(value: number, pixelsPerUnit: number): string {
  const digits = Math.max(0, Math.min(8, Math.ceil(Math.log10(pixelsPerUnit)) + 1));
  return Math.abs(value) >= 1e6 ? value.toExponential(4).replace("-", "−") : value.toFixed(digits).replace("-", "−");
}

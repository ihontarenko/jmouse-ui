/** Colours as the drawing code mixes them: three channels, 0–255. CSS strings go straight to the canvas. */
export type Rgb = readonly [number, number, number];

const FALLBACK: Rgb = [90, 92, 138];

/** `#rgb`, `#rrggbb`, `#rrggbbaa` or `rgb(…)`; anything else is the fallback, never an exception. */
export function parseColor(color: string, fallback: Rgb = FALLBACK): Rgb {
  const value = color.trim();
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i.exec(value);
  if (long) {
    return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)];
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return [parseInt(short[1] + short[1], 16), parseInt(short[2] + short[2], 16), parseInt(short[3] + short[3], 16)];
  }
  const functional = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(value);
  if (functional) {
    return [Number(functional[1]), Number(functional[2]), Number(functional[3])];
  }
  return fallback;
}

export function mix(first: Rgb, second: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((index) => Math.round(first[index] + (second[index] - first[index]) * amount)) as unknown as Rgb;
}

export function css(color: Rgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${color[0]},${color[1]},${color[2]})` : `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

export function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const [red, green, blue] =
    sector < 1 ? [chroma, second, 0] : sector < 2 ? [second, chroma, 0] : sector < 3 ? [0, chroma, second]
      : sector < 4 ? [0, second, chroma] : sector < 5 ? [second, 0, chroma] : [chroma, 0, second];
  const offset = lightness - chroma / 2;
  return [Math.round((red + offset) * 255), Math.round((green + offset) * 255), Math.round((blue + offset) * 255)];
}

/** The sequential ramp every value-coloured layer uses: from the background, through the accent, to a light accent. */
export const RAMP_STEPS = 24;

export function buildRamp(background: Rgb, secondary: Rgb, accent: Rgb, light: boolean): Rgb[] {
  const low = mix(background, secondary, 0.35);
  const high = mix(accent, light ? [20, 24, 40] : [255, 255, 255], 0.55);
  return Array.from({ length: RAMP_STEPS }, (_, index) => {
    const amount = index / (RAMP_STEPS - 1);
    return amount < 0.6 ? mix(low, accent, amount / 0.6) : mix(accent, high, (amount - 0.6) / 0.4);
  });
}

/** The ramp step of a value between two bounds; a bound-less or non-finite value takes the first step. */
export function rampIndex(value: number, minimum: number, maximum: number): number {
  const amount = maximum > minimum ? (value - minimum) / (maximum - minimum) : 0.5;
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.max(0, Math.min(RAMP_STEPS - 1, Math.round(amount * (RAMP_STEPS - 1))));
}

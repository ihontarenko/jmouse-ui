import { buildRamp, parseColor, type Rgb } from "./color";

/**
 * Everything a drawing takes from the page: one theme for every canvas, so a curve on an object page, on the graph
 * and in a scene wear the same grid, the same ink and the same series colours.
 */
export interface VisualTheme {
  background: Rgb;
  /** Strokes, as CSS colours: the canvas takes them as they are, alpha included. */
  minorGrid: string;
  majorGrid: string;
  axis: string;
  label: string;
  ink: Rgb;
  muted: Rgb;
  accent: Rgb;
  /** Distinct colours for distinct things on one canvas: the graph's lines, a series' columns. */
  series: Rgb[];
  ramp: Rgb[];
  labelFont: string;
  light: boolean;
}

export const SERIES_COUNT = 6;

/**
 * What a canvas is drawn on: the page's `sheet`, or an instrument's `screen` — dark in both themes unless the reader
 * chose paper — with its own grid and text tokens.
 */
export type Surface = "sheet" | "screen";

/**
 * The theme read from the CSS tokens visible at an element: `--parallax-sheet` (or `--parallax-screen`), `--parallax-sheet-grid`, `--parallax-line`,
 * `--parallax-line-strong`, `--parallax-ink`, `--parallax-muted`, `--parallax-accent`, `--parallax-series-1…6`, `--parallax-font-technical`. A token that is missing
 * falls back to a light theme.
 */
export function readTheme(element: Element, surface: Surface = "sheet"): VisualTheme {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const screen = surface === "screen";
  const background = parseColor(token(screen ? "--parallax-screen" : "--parallax-sheet", "#ffffff"), [255, 255, 255]);
  const accent = parseColor(token("--parallax-accent", "#5a5c8a"));
  const muted = parseColor(token("--parallax-muted", "#646c7b"));
  const light = (background[0] + background[1] + background[2]) / 3 > 128;
  const seriesFallback = ["#2f6fb0", "#c2412d", "#2f8a5a", "#7d4fb8", "#b5740b", "#1d8585"];
  return {
    background,
    minorGrid: token(screen ? "--parallax-screen-grid" : "--parallax-sheet-grid", "#14182114"),
    majorGrid: token(screen ? "--parallax-screen-grid-strong" : "--parallax-line", "#dcdfe6"),
    axis: token(screen ? "--parallax-screen-grid-strong" : "--parallax-line-strong", "#a9b0bd"),
    label: token(screen ? "--parallax-screen-text" : "--parallax-muted", "#646c7b"),
    ink: parseColor(token(screen ? "--parallax-screen-text" : "--parallax-ink", "#141821")),
    muted,
    accent,
    series: seriesFallback.map((fallback, index) => parseColor(token(`--parallax-series-${index + 1}`, fallback))),
    ramp: buildRamp(background, muted, accent, light),
    labelFont: `${Math.round(11 * (parseFloat(token("--parallax-ui-scale", "1")) || 1))}px ${token("--parallax-font-technical", "system-ui, sans-serif")}`,
    light,
  };
}

/**
 * A layer's colour, written as a CSS colour or as `var(--token)`, resolved against the element's styles. A document
 * names a token without the library's namespace (`var(--accent)`), so a token the host does not define is looked up
 * again as the library's own, `--parallax-accent`.
 */
export function resolveColor(element: Element, color: string | undefined, fallback: Rgb): Rgb {
  if (!color) {
    return fallback;
  }
  const token = /^var\(--([\w-]+)\)$/.exec(color.trim());
  const value = token ? resolveToken(getComputedStyle(element), token[1]) : color;
  return value ? parseColor(value, fallback) : fallback;
}

function resolveToken(style: CSSStyleDeclaration, name: string): string {
  const own = style.getPropertyValue(`--${name}`).trim();
  if (own || name.startsWith("parallax-")) {
    return own;
  }
  return style.getPropertyValue(`--parallax-${name}`).trim();
}

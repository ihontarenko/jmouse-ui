import type { CurrentColor, CurrentStyle, SimulatorAppearance } from "../transport/wire";
import type { RopeBounds, RopeOptions } from "../tether/rope";

/*
 * How the simulator draws current, as the reader chose it (Appearance → Simulator): the colours, the brightness against the
 * default, and how far apart the lights travel. What is not chosen is drawn as it always was.
 */

export const DEFAULT_SIMULATOR_APPEARANCE: SimulatorAppearance = { currentColor: "ACCENT", currentStyle: "LIGHT", alternatingColor: "AMBER", alternatingReturnColor: "CYAN", alternatingThreshold: 2.5, takingColor: "AMBER", givingColor: "CYAN",
  leadMode: "HANGING", leadSag: 1, currentIntensity: 1, lightSpacing: 24, scopeTrails: 8, scopeTrailIntensity: 0.5 };

/** Each choice as the sheet paints it: the palette's accent, or one of the probe colours, which follow the theme. */
export const CURRENT_COLORS: { value: CurrentColor; label: string; token: string }[] = [
  { value: "ACCENT", label: "Accent", token: "var(--parallax-accent)" },
  { value: "AMBER", label: "Amber", token: "var(--parallax-current-amber)" },
  { value: "CYAN", label: "Cyan", token: "var(--parallax-current-cyan)" },
  { value: "GREEN", label: "Green", token: "var(--parallax-current-green)" },
  { value: "PINK", label: "Pink", token: "var(--parallax-current-pink)" },
  { value: "WHITE", label: "Neutral", token: "var(--parallax-current-white)" },
];

/**
 * How the leads' ropes move, as the reader set it: insulated copper either way — heavy, slow to swing and quick to
 * settle, so a lead hangs or lies as wire does and never dances as a chain. Hanging, it falls under gravity as deep as
 * its slack lets it — the sag is the slack, linear: 0 taut, 1 a tenth and a half longer than the line, 2 three
 * tenths. On the table nothing pulls it down and the table holds it: it lies where it was put and slides only as far
 * as it is pulled. Either way it stays on the sheet (`bounds`).
 */
export function ropeOptionsOf(appearance: SimulatorAppearance, bounds?: RopeBounds): RopeOptions {
  const slack = 1 + 0.15 * appearance.leadSag;
  return appearance.leadMode === "TABLE"
    ? { gravity: 0, damping: 0.5, slack, bounds }
    : { gravity: 2400, damping: 0.86, slack, bounds };
}

/** A leader from a text to its part: the same rope, drawn taut — no slack, no weight, no swing. */
export function leaderOptionsOf(bounds?: RopeBounds): RopeOptions {
  return { slack: 1, gravity: 0, damping: 0.3, bounds };
}

/** The ways current can be drawn, as the appearance offers them. */
export const CURRENT_STYLES: { value: CurrentStyle; label: string; title: string }[] = [
  { value: "LIGHT", label: "Lights", title: "Lights running through a frosted tube" },
  { value: "ELECTRONS", label: "Electrons", title: "Fine specks drifting in the tube, scattered at random — the more current, the more of them" },
];

/** A light's glow and its core along one spacing: the glow a little under half of it, the core a sixth. */
export function lightDashes(spacing: number): { glow: string; core: string } {
  const glow = spacing * 5 / 12;
  const core = spacing / 6;
  return { glow: `${glow} ${spacing - glow}`, core: `${core} ${spacing - core}` };
}

/** How many layers of electrons a wire carries: the first lit by any current, the last only near the run's largest. */
export const ELECTRON_LAYERS = 4;

/** How long one layer's scatter is before it repeats, in spacings: long enough that the eye finds no pattern. */
const ELECTRON_SCATTER_SPACINGS = 6;

/**
 * One layer of a wire's electrons as a dash pattern: specks a hair long at random gaps, about two a spacing, the scatter
 * seeded by the wire's id and the layer so it stays the same frame after frame. The pattern's length is returned with it —
 * the distance the layer repeats after —, which the placement wraps its offset by.
 */
export function electronDashes(seedText: string, layer: number, spacing: number): { dashes: string; length: number } {
  let seed = layer * 7919 + 1;
  for (let index = 0; index < seedText.length; index++) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0;
  }
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const length = spacing * ELECTRON_SCATTER_SPACINGS;
  const speck = 0.01;
  const gaps: number[] = [];
  let used = 0;
  while (used < length - spacing / 2) {
    const gap = spacing * (0.12 + 0.88 * random());
    gaps.push(gap);
    used += speck + gap;
  }
  const scale = (length - gaps.length * speck) / gaps.reduce((sum, gap) => sum + gap, 0);
  return { dashes: gaps.map((gap) => `${speck} ${(gap * scale).toFixed(2)}`).join(" "), length };
}

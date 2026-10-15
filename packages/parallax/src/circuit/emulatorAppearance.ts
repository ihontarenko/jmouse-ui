import type { CurrentColor, EmulatorAppearance } from "../transport/wire";
import type { RopeBounds, RopeOptions } from "../tether/rope";

/*
 * How the emulator draws current, as the reader chose it (Appearance → Emulator): the colours, the brightness against the
 * default, and how far apart the lights travel. What is not chosen is drawn as it always was.
 */

export const DEFAULT_EMULATOR_APPEARANCE: EmulatorAppearance = { currentColor: "ACCENT", alternatingColor: "AMBER", alternatingReturnColor: "CYAN", alternatingThreshold: 2.5, takingColor: "AMBER", givingColor: "CYAN",
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
export function ropeOptionsOf(appearance: EmulatorAppearance, bounds?: RopeBounds): RopeOptions {
  const slack = 1 + 0.15 * appearance.leadSag;
  return appearance.leadMode === "TABLE"
    ? { gravity: 0, damping: 0.5, slack, bounds }
    : { gravity: 2400, damping: 0.86, slack, bounds };
}

/** A leader from a text to its part: the same rope, drawn taut — no slack, no weight, no swing. */
export function leaderOptionsOf(bounds?: RopeBounds): RopeOptions {
  return { slack: 1, gravity: 0, damping: 0.3, bounds };
}

/** A light's glow and its core along one spacing: the glow a little under half of it, the core a sixth. */
export function lightDashes(spacing: number): { glow: string; core: string } {
  const glow = spacing * 5 / 12;
  const core = spacing / 6;
  return { glow: `${glow} ${spacing - glow}`, core: `${core} ${spacing - core}` };
}

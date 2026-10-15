/**
 * Current along a wire as light travelling through a frosted tube. The light is never moved on its own: a clock places
 * it where the charge that has passed along the wire puts it, so it stands when the clock stands, runs back when the
 * current reverses — a bridge's half-waves, a PWM — and moves exactly as far as the circuit's time moved. The same
 * placement serves a computed transient played on the Graph and a live run played on the bench.
 */

/** One light every this many sheet units along a wire, unless the reader chose another spacing. */
export const LIGHT_PERIOD = 24;

/**
 * A wire's light: its tube, which shows how large the current is, and the glow and core that move along it — and a
 * second glow and core that run back against them when the current alternates too fast to be shown moving.
 */
export interface PlacedLight {
  tube: SVGPathElement;
  glow: SVGPathElement;
  core: SVGPathElement;
  returnGlow: SVGPathElement;
  returnCore: SVGPathElement;
}

/** The narrowest and the widest a wire's light is drawn, sheet units: a trickle and the run's largest current. */
const NARROWEST = 3;
const WIDEST = 11;

/** How fast the two rows of an alternating wire run against each other, sheet units a second of wall time: calm. */
const ALTERNATING_SPEED = 22;

/**
 * Puts a wire's light `distance` sheet units along its path (negative runs against it) and draws it for its `share`
 * of the run's largest current, 0…1: brighter and wider in proportion, so a branch carrying twice the current looks
 * twice as strong — a tenth still visible, a leakage dark —, times the reader's `intensity`; its lights are `period`
 * apart. Under reduced motion the tube still shows where the current runs and how much; nothing moves along it.
 */
export function placeLight(light: PlacedLight, distance: number, share: number, period = LIGHT_PERIOD, intensity = 1) {
  const brightness = drawTube(light, share, intensity);
  hideRow(light.returnGlow, light.returnCore);
  placeRow(light.glow, light.core, distance, brightness, period);
}

/**
 * A wire whose current reverses faster than a light can follow: the same neon as a flowing one — tube, glow and core,
 * as wide and as bright for its RMS `share` —, in two rows running calmly against each other, one spacing apart, by
 * the wall clock `seconds`. Its colours are the alternating ones, set on the wire by its class.
 */
export function placeAlternatingLight(light: PlacedLight, seconds: number, share: number, period = LIGHT_PERIOD, intensity = 1) {
  const brightness = drawTube(light, share, intensity);
  const distance = seconds * ALTERNATING_SPEED;
  placeRow(light.glow, light.core, distance, brightness, period);
  placeRow(light.returnGlow, light.returnCore, -distance + period / 2, brightness, period);
}

/** The tube for a share of the largest current, and the row's brightness: what both placements share. */
function drawTube(light: PlacedLight, share: number, intensity: number): number {
  const visible = share > 0.002;
  const brightness = visible ? Math.min(1, (0.18 + 0.82 * share) * intensity) : 0;
  const width = NARROWEST + (WIDEST - NARROWEST) * Math.min(1, share);
  light.tube.style.opacity = String(0.5 * brightness);
  light.tube.style.strokeWidth = String(width);
  light.glow.style.strokeWidth = String(width * 0.85);
  light.returnGlow.style.strokeWidth = String(width * 0.85);
  return brightness;
}

/** One row of lights — a glow and the core in its middle — `distance` along the wire. */
function placeRow(glow: SVGPathElement, core: SVGPathElement, distance: number, brightness: number, period: number) {
  if (reducedMotion()) {
    hideRow(glow, core);
    return;
  }
  const offset = -distance % period;
  glow.style.strokeDashoffset = String(offset);
  // The core sits in the middle of its glow: half the difference of their dashes (5/12 and 1/6 of the period).
  core.style.strokeDashoffset = String(offset - period / 8);
  glow.style.opacity = String(0.75 * brightness);
  core.style.opacity = String(brightness);
}

function hideRow(glow: SVGPathElement, core: SVGPathElement) {
  glow.style.opacity = "0";
  core.style.opacity = "0";
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

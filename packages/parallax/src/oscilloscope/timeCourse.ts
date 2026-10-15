/**
 * The course virtual time takes through a replayed stretch, in two independent parts: the ORDER of the passes — once
 * (abc), round and round (abcabc), there and back (abccbaabc) — and a CURVE laid over the linear time of each pass,
 * `u → f(u)` on [0, 1] with f(0) = 0 and f(1) = 1: where a pass lingers and where it hurries, its mean pace unchanged.
 * Both are data: a new curve is an entry in {@link TIME_CURVES}, never a branch in the player.
 */

export type ReplayOrder = "once" | "loop" | "bounce";

export const REPLAY_ORDERS: readonly { id: ReplayOrder; label: string; title: string }[] = [
  { id: "once", label: "Once", title: "a → b, once, and stop at the end" },
  { id: "loop", label: "Loop", title: "a → b, a → b, … — round and round" },
  { id: "bounce", label: "Bounce", title: "a → b → a → b … — there and back, so nothing jumps" },
];

export interface TimeCurve {
  id: string;
  label: string;
  title: string;
  /** The share of the pass reached at the share `u` of its time; increasing, from 0 to 1. */
  at: (u: number) => number;
}

export const TIME_CURVES: readonly TimeCurve[] = [
  { id: "linear", label: "Linear", title: "Time as it was: every moment of the stretch takes as long", at: (u) => u },
  { id: "ease", label: "Ease", title: "Gathers pace from the start and slows into the end — the ends are seen longest", at: (u) => u * u * (3 - 2 * u) },
  { id: "ease-in", label: "Ease in", title: "Starts slowly and gathers pace — the start is seen longest", at: (u) => u * u },
  { id: "ease-out", label: "Ease out", title: "Starts quickly and slows down — the end is seen longest", at: (u) => 1 - (1 - u) * (1 - u) },
  {
    // A quarter linear, three quarters a cubic flat at the middle: four times slower there, never stopped.
    id: "middle", label: "Middle", title: "Hurries through the ends and lingers in the middle, four times slower — for an event placed between the cursors",
    at: (u) => 0.25 * u + 0.75 * (0.5 + 4 * (u - 0.5) ** 3),
  },
];

export function timeCurve(id: string): TimeCurve {
  return TIME_CURVES.find((curve) => curve.id === id) ?? TIME_CURVES[0];
}

/**
 * The share of the stretch shown at `phase` — passes counted from 0, the fraction of the current one after the point —
 * in this order and on this curve. «Once» stays at the end past its first pass.
 */
export function shareAt(phase: number, order: ReplayOrder, curve: TimeCurve): number {
  if (order === "once" && phase >= 1) {
    return 1;
  }
  const pass = Math.floor(phase);
  const fraction = phase - pass;
  const backwards = order === "bounce" && pass % 2 === 1;
  return curve.at(backwards ? 1 - fraction : fraction);
}

/**
 * The phase within the pass `pass` that shows the share `share` — the curve's inverse, by halving, since a curve is only
 * known to increase.
 */
export function phaseOf(share: number, pass: number, order: ReplayOrder, curve: TimeCurve): number {
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 40; iteration++) {
    const middle = (low + high) / 2;
    if (curve.at(middle) < share) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const fraction = (low + high) / 2;
  const backwards = order === "bounce" && pass % 2 === 1;
  return pass + (backwards ? 1 - fraction : fraction);
}

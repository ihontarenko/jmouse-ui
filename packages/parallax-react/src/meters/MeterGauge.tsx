import { useRef } from "react";
import { formatQuantity } from "@jmouse/parallax/quantities";
import { gaugeMarks, gaugeScale, type GaugeScale, type Meter } from "@jmouse/parallax/meters";

/**
 * The dial: a needle over an arc of this many degrees either side of upright, its pivot below the face's lower edge
 * as on a panel meter — so the face is all scale, and the needle at rest lies along the zero rather than across it.
 */
const SWEEP_DEGREES = 48;
const PIVOT = { x: 120, y: 156 };
const RADIUS = 112;
/** How far past either end a needle that is off the scale rests against its stop. */
const STOP_DEGREES = 3;

/**
 * An analog display for any instrument: a needle on an arc, its scale picked from the reading as a range switch picks
 * it (`gaugeScale` — 1, 2, 5 a decade, zero in the middle for a figure that goes negative). It knows only the figure
 * and its unit, so every instrument — a custom one too — has it without a line written for it. The needle swings to a
 * new reading with a meter movement's inertia; for a reader who asks for reduced motion it jumps.
 */
export function MeterGauge({ meter, value, label }: { meter: Meter; value: number | null; label: string }) {
  const scale = useRef<GaugeScale | null>(null);
  if (value !== null && Number.isFinite(value)) {
    scale.current = gaugeScale(value, scale.current);
  }
  const shown = scale.current ?? { minimum: 0, maximum: 1 };
  const span = shown.maximum - shown.minimum;
  const share = value === null || !Number.isFinite(value) ? 0 : (value - shown.minimum) / span;
  const angle = Math.max(-SWEEP_DEGREES - STOP_DEGREES, Math.min(SWEEP_DEGREES + STOP_DEGREES, -SWEEP_DEGREES + share * 2 * SWEEP_DEGREES));
  const { major, minor } = gaugeMarks(shown);
  const at = (mark: number, radius: number) => {
    const turn = ((-SWEEP_DEGREES + ((mark - shown.minimum) / span) * 2 * SWEEP_DEGREES) * Math.PI) / 180;
    return { x: PIVOT.x + radius * Math.sin(turn), y: PIVOT.y - radius * Math.cos(turn) };
  };
  const arcStart = at(shown.minimum, RADIUS);
  const arcEnd = at(shown.maximum, RADIUS);
  return (
    <figure data-parallax-part="meter-gauge" className="parallax-meter-gauge">
      <svg viewBox="0 14 240 124" role="img" aria-label={label}>
        <path className="parallax-meter-gauge-arc" d={`M${arcStart.x} ${arcStart.y}A${RADIUS} ${RADIUS} 0 0 1 ${arcEnd.x} ${arcEnd.y}`} />
        {minor.map((mark) => {
          const inner = at(mark, RADIUS - 6);
          const outer = at(mark, RADIUS);
          return <line key={`minor-${mark}`} className="parallax-meter-gauge-tick" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
        })}
        {major.map((mark) => {
          const inner = at(mark, RADIUS - 12);
          const outer = at(mark, RADIUS);
          const text = at(mark, RADIUS + 12);
          return <g key={`major-${mark}`}>
            <line className="parallax-meter-gauge-tick parallax-major" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />
            <text className="parallax-meter-gauge-number" x={text.x} y={text.y} textAnchor="middle" dominantBaseline="middle">{markText(mark, shown)}</text>
          </g>;
        })}
        <text className="parallax-meter-gauge-unit" x={12} y={132}>{unitOf(shown, meter.unit)}</text>
        <line className="parallax-meter-gauge-needle" x1={PIVOT.x} y1={PIVOT.y - 30} x2={PIVOT.x} y2={PIVOT.y - RADIUS + 2}
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px` }} />

      </svg>
    </figure>
  );
}

/**
 * The prefix a scale is numbered in — a 200 mV scale reads 0 … 200 in mV, not 0 … 0.2 in V —, from its full scale.
 * The numbers are the value in that unit, without the unit: the dial names it once.
 */
function markText(mark: number, scale: GaugeScale): string {
  const { factor } = prefixOf(scale);
  const value = mark / factor;
  return Number.isInteger(Math.round(value * 100) / 100) ? String(Math.round(value)) : String(Math.round(value * 100) / 100);
}

function unitOf(scale: GaugeScale, unit: string): string {
  return `${prefixOf(scale).prefix}${unit}`;
}

/** The SI prefix the full scale is written in: what `formatQuantity` would write it with, without its number. */
function prefixOf(scale: GaugeScale): { prefix: string; factor: number } {
  const written = formatQuantity(scale.maximum, "");
  const match = /([a-zA-Zµ]?)\s*$/.exec(written.trim());
  const prefix = match?.[1] ?? "";
  const factors: Record<string, number> = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, "": 1, k: 1e3, M: 1e6, G: 1e9 };
  return prefix in factors ? { prefix, factor: factors[prefix] } : { prefix: "", factor: 1 };
}

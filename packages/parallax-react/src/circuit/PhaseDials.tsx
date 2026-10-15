import { useEffect, useRef } from "react";
import { bodyOf, type SchematicDocument } from "@jmouse/parallax/circuit";
import { useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";

/** One part's voltage across it and current through it at the dial's frequency, as phasors. */
export interface PartPhasor {
  voltage: { real: number; imaginary: number };
  current: { real: number; imaginary: number };
  /** A source: its current is shown as what it delivers, out of its first terminal. */
  source: boolean;
}

/** The dials' data: every part's phasors, and the turn the whole picture stands at now (radians), for a rotation. */
export interface PhaseDialsData {
  phasors: Record<string, PartPhasor>;
  /** The common turn, read every animation frame: ωt in slow motion, 0 when a turn would be a blur. */
  turn: () => number;
}

/** The dial's radius, and how far it stands from the part's body. */
const RADIUS = 15;
const GAP = 10;

/**
 * A dial by every part of the sheet: two arrows from its centre, the part's voltage (U) and its current (I), at the
 * circuit's frequency, each as long as it is against the largest of its kind on the sheet, and the angle between them
 * written under it in words — «I lags 90°» on a coil, «I leads 90°» on a capacitor, «U, I in phase» on a resistor. All turn together with the
 * circuit's time when it plays slowly enough to see it; faster, they stand still, as a stroboscope would leave them.
 */
export function PhaseDials({ document, dials }: { document: SchematicDocument; dials: PhaseDialsData }) {
  const library = useParallaxPartLibrary();
  const turning = useRef<(SVGGElement | null)[]>([]);
  const turn = useRef(dials.turn);
  turn.current = dials.turn;
  useEffect(() => {
    let frame = 0;
    const spin = () => {
      const degrees = (-turn.current() * 180) / Math.PI;
      turning.current.forEach((element) => element?.setAttribute("transform", `rotate(${degrees.toFixed(2)})`));
      frame = requestAnimationFrame(spin);
    };
    frame = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(frame);
  }, []);
  const entries = document.items.map((item) => ({ item, phasor: dials.phasors[item.id] })).filter((entry) => entry.phasor);
  const largestVoltage = Math.max(1e-12, ...entries.map(({ phasor }) => Math.hypot(phasor.voltage.real, phasor.voltage.imaginary)));
  const largestCurrent = Math.max(1e-12, ...entries.map(({ phasor }) => Math.hypot(phasor.current.real, phasor.current.imaginary)));
  turning.current = [];
  return (
    <g className="parallax-phase-dials" aria-hidden="true">
      {entries.map(({ item, phasor }, index) => {
        const { halfWidth, halfHeight } = bodyOf(library, item);
        const vertical = item.rotation % 180 !== 0;
        const across = vertical ? halfHeight : halfWidth;
        const up = vertical ? halfWidth : halfHeight;
        const x = item.x + across + GAP + RADIUS;
        // Below and to the right of the body: a part's name stands above it, its readings above and right, its value
        // below its middle — the corner below right is the one a sheet leaves free.
        const y = item.y + up + GAP + RADIUS;
        const current = phasor.source ? { real: -phasor.current.real, imaginary: -phasor.current.imaginary } : phasor.current;
        const voltageLength = (RADIUS - 2) * Math.hypot(phasor.voltage.real, phasor.voltage.imaginary) / largestVoltage;
        const currentLength = (RADIUS - 2) * Math.hypot(current.real, current.imaginary) / largestCurrent;
        const voltageAngle = Math.atan2(phasor.voltage.imaginary, phasor.voltage.real);
        const currentAngle = Math.atan2(current.imaginary, current.real);
        const lag = Math.atan2(Math.sin(currentAngle - voltageAngle), Math.cos(currentAngle - voltageAngle)) * 180 / Math.PI;
        return (
          <g key={item.id} transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}>
            <circle className="parallax-phase-dial-face" r={RADIUS} />
            <g ref={(element) => { turning.current[index] = element; }}>
              <Arrow className="parallax-phase-dial-voltage" angle={voltageAngle} length={voltageLength} />
              <Arrow className="parallax-phase-dial-current" angle={currentAngle} length={currentLength} />
            </g>
            <text className="parallax-phase-dial-text" y={RADIUS + 10} textAnchor="middle">
              {Math.abs(lag) < 0.5 ? "U, I in phase" : `I ${lag > 0 ? "leads" : "lags"} ${Math.abs(lag).toFixed(0)}°`}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** An arrow from the dial's centre: its angle counter-clockwise from the right, as a phasor's; the sheet's y runs down. */
function Arrow({ className, angle, length }: { className: string; angle: number; length: number }) {
  if (!(length > 0.5)) {
    return null;
  }
  const tipX = length * Math.cos(angle);
  const tipY = -length * Math.sin(angle);
  const head = Math.min(4, length * 0.4);
  const left = angle + Math.PI - 0.5;
  const right = angle + Math.PI + 0.5;
  return (
    <path className={className}
      d={`M0 0L${tipX.toFixed(2)} ${tipY.toFixed(2)}M${tipX.toFixed(2)} ${tipY.toFixed(2)}L${(tipX + head * Math.cos(left)).toFixed(2)} ${(tipY - head * Math.sin(left)).toFixed(2)}M${tipX.toFixed(2)} ${tipY.toFixed(2)}L${(tipX + head * Math.cos(right)).toFixed(2)} ${(tipY - head * Math.sin(right)).toFixed(2)}`} />
  );
}

import type { PartLibraryView } from "@jmouse/parallax/schematic";
import { useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import { useEffect, useId, useRef } from "react";
import type { PartLoad } from "@jmouse/parallax";
import { formatQuantity } from "@jmouse/parallax/quantities";
import {
  bodyOf, largestTerminalCurrent, loadState, partRole, type PartRole, type PlacedLight, type SchematicDocument,
} from "@jmouse/parallax/circuit";
import { glowStyle, useEmulatorAppearance } from "./useEmulatorAppearance";

/**
 * What a running circuit's parts are doing, drawn on its sheet: current moving along the wires, a part glowing by the
 * power it takes, and what it takes and how warm it gets, beside it and in a table. Everything here comes from the
 * engine (`PartLoad`); nothing is computed but where to draw it.
 */

/**
 * A wire's current as light moving through a frosted tube. The element only holds the paths; a clock places the light
 * and sets how bright it is (`placeLight`), every screen frame, without React.
 */
export function CurrentFlow({ d, tether, filter, dashes, onPlaced }: {
  /** A lead's id: its shape is its rope's, written into these paths while it swings. */
  d: string; tether?: string; filter: string; dashes: { glow: string; core: string }; onPlaced: (light: PlacedLight | null) => void;
}) {
  const tube = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const core = useRef<SVGPathElement>(null);
  const returnGlow = useRef<SVGPathElement>(null);
  const returnCore = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (!tube.current || !glow.current || !core.current || !returnGlow.current || !returnCore.current) {
      return;
    }
    onPlaced({ tube: tube.current, glow: glow.current, core: core.current, returnGlow: returnGlow.current, returnCore: returnCore.current });
    return () => onPlaced(null);
  }, []);
  return <g className="parallax-circuit-diagram-flow" aria-hidden="true">
    <path ref={tube} className="parallax-circuit-diagram-flow-tube" d={d} data-tether={tether} style={{ opacity: 0 }} />
    <path ref={glow} className="parallax-circuit-diagram-flow-glow" d={d} data-tether={tether} filter={`url(#${filter})`} style={{ strokeDasharray: dashes.glow }} />
    <path ref={core} className="parallax-circuit-diagram-flow-core" d={d} data-tether={tether} style={{ strokeDasharray: dashes.core }} />
    <path ref={returnGlow} className="parallax-circuit-diagram-flow-glow parallax-circuit-diagram-flow-return" d={d} data-tether={tether} filter={`url(#${filter})`} style={{ strokeDasharray: dashes.glow }} />
    <path ref={returnCore} className="parallax-circuit-diagram-flow-core parallax-circuit-diagram-flow-return" d={d} data-tether={tether} style={{ strokeDasharray: dashes.core }} />
  </g>;
}

/**
 * How hard each part works, drawn as a soft glow behind its body — physics, not a frame's figure, so nothing on the
 * sheet blinks:
 *
 * - a part that turns power into heat glows by how warm it is against how warm it may get — temperature moves at the
 *   part's own thermal pace —, or by its share of its rated power, or of the busiest such part's;
 * - a source glows in its own colour by what it delivers — a source by what it is, never by the sign of one frame's
 *   power, which flips with every half-wave and made the sheet blink like a traffic light;
 * - a capacitor, an inductor or an instrument does not glow: an ideal one turns nothing into heat.
 *
 * A part past its limits is outlined, and says so in its readings; the outline comes once the state has held for half
 * a second, so a power hovering at its rating does not flash it. Brightness moves over 600 ms; not with reduced motion.
 */
export function PartHeatLayer({ document, loads }: { document: SchematicDocument; loads: Record<string, PartLoad> }) {
  const library = useParallaxPartLibrary();
  const appearance = useEmulatorAppearance();
  const filter = `heat-${useId().replace(/:/g, "")}`;
  // The power a glow without limits of its own is measured against: the largest seen, forgotten slowly, so one part
  // growing does not dim every other in a single update.
  const reference = useRef({ source: 0, heat: 0 });
  const states = useRef(new Map<string, { state: string; since: number; shown: string }>());
  const roles = document.items.map((item) => ({ item, role: partRole(library, item), load: loads[item.id] }));
  const busiest = (role: PartRole) => Math.max(0, ...roles.filter((entry) => entry.role === role).map((entry) => Math.abs(entry.load?.power ?? 0)));
  reference.current.source = Math.max(reference.current.source * REFERENCE_KEPT, busiest("source"));
  reference.current.heat = Math.max(reference.current.heat * REFERENCE_KEPT, busiest("dissipating"));
  const now = performance.now();
  return <g className="parallax-circuit-diagram-heat" aria-hidden="true" style={glowStyle(appearance)}>
    <defs><filter id={filter} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter></defs>
    {roles.map(({ item, role, load }) => {
      if (!load || role === "storing" || role === "instrument") {
        return null;
      }
      const glow = role === "source" ? share(Math.abs(load.power ?? 0), reference.current.source) : heatOf(load, reference.current.heat);
      const state = steadyState(states.current, item.id, loadState(load), now);
      if (glow < 0.02 && state === "within") {
        return null;
      }
      const box = bodyBox(library, item);
      return <g key={item.id} className={`parallax-circuit-diagram-heat-${state} parallax-heat-${role}`}>
        <rect className="parallax-circuit-diagram-glow" x={box.left} y={box.top} width={box.right - box.left} height={box.bottom - box.top}
          filter={`url(#${filter})`} style={{ opacity: GLOW_STRENGTH * glow }} />
        {state !== "within" ? <rect className="parallax-circuit-diagram-limit" x={box.left} y={box.top}
          width={box.right - box.left} height={box.bottom - box.top} /> : null}
      </g>;
    })}
  </g>;
}

/** How bright the brightest glow is. */
const GLOW_STRENGTH = 0.55;
/** What a reference keeps of itself each update — five a second: a surge is forgotten over seconds. */
const REFERENCE_KEPT = 0.97;
/** How long a part's state has to hold before the sheet shows it, in milliseconds. */
const STATE_HOLD_MILLISECONDS = 500;
/** How far the glow reaches past the part's body, in sheet units. */
const GLOW_PADDING = 6;

function share(value: number, reference: number): number {
  return reference > 0 ? Math.min(1, value / reference) : 0;
}

/**
 * How warm a part is, 0…1: its temperature between the bench's and the most it may reach, when its component says;
 * else its power against its rating; else against the busiest part that turns power into heat.
 */
function heatOf(load: PartLoad, reference: number): number {
  const power = Math.abs(load.power ?? 0);
  if (load.temperature !== null && load.maximum != null && load.maximum > BENCH_TEMPERATURE) {
    return Math.max(0, Math.min(1, (load.temperature - BENCH_TEMPERATURE) / (load.maximum - BENCH_TEMPERATURE)));
  }
  if (load.rating != null && load.rating > 0) {
    return Math.min(1, power / load.rating);
  }
  return share(power, reference);
}

/** The bench temperature a part warms up from, °C — the nominal one; a warmer bench only starts every part higher. */
const BENCH_TEMPERATURE = 25;

/** The state the sheet shows for a part: a new one once it has held for {@link STATE_HOLD_MILLISECONDS}. */
function steadyState(states: Map<string, { state: string; since: number; shown: string }>, part: string, state: string, now: number): string {
  const known = states.get(part);
  if (!known) {
    states.set(part, { state, since: now, shown: state });
    return state;
  }
  if (known.state !== state) {
    known.state = state;
    known.since = now;
  }
  // A burnt part is shown at once: it does not come back.
  if (known.shown !== state && (state === "burnt" || now - known.since >= STATE_HOLD_MILLISECONDS)) {
    known.shown = state;
  }
  return known.shown;
}

/** The part's body with room around it — not its labels: a glow over the text washed it out. */
function bodyBox(library: PartLibraryView, item: SchematicDocument["items"][number]) {
  const { halfWidth, halfHeight } = bodyOf(library, item);
  const vertical = item.rotation % 180 !== 0;
  const across = (vertical ? halfHeight : halfWidth) + GLOW_PADDING;
  const up = (vertical ? halfWidth : halfHeight) + GLOW_PADDING;
  return { left: item.x - across, right: item.x + across, top: item.y - up, bottom: item.y + up };
}


/** Who takes the power and who gives it, the hottest first; a source's negative power is what it delivers. */
export function PartLoadTable({ loads }: { loads: Record<string, PartLoad> }) {
  const rows = Object.entries(loads).filter(([, load]) => load.power !== null && Math.abs(load.power) > 1e-9)
    .sort(([, first], [, second]) => (second.power ?? 0) - (first.power ?? 0));
  if (rows.length === 0) {
    return null;
  }
  return <details data-parallax-part="part-load" className="parallax-part-load" open>
    <summary>Power by part <span>average over the last frame · temperature: where it would settle</span></summary>
    <table className="parallax-part-load-table" aria-label="Power by part">
    <thead><tr><th scope="col">Part</th><th scope="col">Power</th><th scope="col" title="A two-terminal part's current; an IC's busiest pin">Current</th><th scope="col">Temperature</th></tr></thead>
    <tbody>
      {rows.map(([part, load]) => <tr key={part}>
        <th scope="row"><code>{part}</code></th>
        <td>{(load.power ?? 0) < 0 ? `delivers ${formatQuantity(-(load.power ?? 0), "W")}` : formatQuantity(load.power ?? 0, "W")}</td>
        <td>{formatQuantity(largestTerminalCurrent(load) ?? Number.NaN, "A")}</td>
        <td>{load.temperature !== null ? `${load.temperature.toFixed(1)} °C` : "—"}</td>
      </tr>)}
    </tbody>
  </table></details>;
}

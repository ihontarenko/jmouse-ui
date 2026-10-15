import { useEffect, useMemo, useState } from "react";
import type { StageBars } from "@jmouse/parallax/visual";
import { VisualView } from "../viewers/VisualView";
import type { PaneClock } from "./CircuitPane";
import { labelValueAt, type LabelSource } from "@jmouse/parallax/graph";

/**
 * Values as bars on one zero line, moved by the graph's clock — the energies of a pendulum, the currents of a bridge.
 * The stage draws them; the ruler is the largest value any bar reaches over the whole clock, so a playing bar grows and
 * shrinks against a fixed scale instead of the scale jumping under it.
 */
export function ValuesPane({ bars, clock }: { bars: readonly LabelSource[]; clock: PaneClock | null }) {
  const [clockValue, setClockValue] = useState<number | null>(clock?.value ?? null);
  useEffect(() => setClockValue(clock?.value ?? null), [clock?.value]);
  useEffect(() => (clock?.subscribe ? clock.subscribe(setClockValue) : undefined), [clock?.subscribe]);

  const everyValue = bars.flatMap((bar) => [bar.values[0]?.now ?? 0, ...(bar.values[0]?.frames ?? [])].map((value) => value ?? 0));
  const reach = Math.max(1e-12, ...everyValue.map(Math.abs));
  const signed = everyValue.some((value) => value < 0);
  const shown = bars.map((bar) => ({ id: bar.id, name: bar.bar?.name ?? "", value: labelValueAt(bar, 0, clockValue), colorIndex: bar.colorIndex }));
  const shownKey = JSON.stringify(shown);
  const stageBars = useMemo<StageBars>(() => ({
    bars: shown.map((bar) => ({ id: bar.id, name: bar.name, value: bar.value, color: `var(--parallax-series-${(bar.colorIndex % 6) + 1})` })),
    reach,
    signed,
  }), [shownKey, reach, signed]);

  if (bars.length === 0) {
    return <p className="parallax-graph-pane-later parallax-muted">Put a value here with “in” and this pane’s name: <code className="parallax-inline">energy  m g h  in …</code></p>;
  }
  const described = shown.map((bar) => `${bar.name} ${bar.value === null ? "not yet computed" : Number(bar.value.toPrecision(4))}`).join(", ");
  return (
    <VisualView layers={NO_LAYERS} bars={stageBars} grid={false} axes={false} interactive={false} readout={false}
      title={`Values: ${described}`} />
  );
}

const NO_LAYERS: never[] = [];

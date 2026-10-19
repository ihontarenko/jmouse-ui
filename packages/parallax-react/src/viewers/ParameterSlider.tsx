import type { CSSProperties } from "react";
import type { ParameterDefinition } from "@jmouse/parallax";

/**
 * One parameter as a slider (Parallax-UI `.parameter`): its symbol and label, the value in the unit it is written in,
 * the track, and the bounds under it. The one way a parameter is set — on the simulator's bench, on an object's stand,
 * in a scene.
 */
export function ParameterSlider({ parameter, value, onChange, idPrefix = "parameter", bounds = true }: {
  parameter: ParameterDefinition;
  value: number;
  onChange: (value: number) => void;
  idPrefix?: string;
  bounds?: boolean;
}) {
  const scale = parameter.scale ?? 1;
  const shown = (amount: number) => Number((amount / scale).toPrecision(12));
  const id = `${idPrefix}-${parameter.name}`;
  const label = parameter.label && parameter.label !== parameter.name ? withoutUnit(parameter.label, parameter.unit) : null;
  const span = parameter.maximum - parameter.minimum;
  const fill = span > 0 ? Math.min(100, Math.max(0, ((value - parameter.minimum) / span) * 100)) : 0;
  const unit = parameter.unit ? ` ${parameter.unit}` : "";
  return (
    <div className="parallax-parameter">
      <label htmlFor={id} title={parameter.label}>
        <span className="parallax-symbol">{parameter.name}</span>
        {label ? <span className="parallax-ellipsis">{label}</span> : null}
        {parameter.unit ? <span className="parallax-unit">{parameter.unit}</span> : null}
      </label>
      <output htmlFor={id}>{Number(shown(value).toPrecision(4))}{unit}</output>
      <input id={id} className="parallax-range" type="range" min={shown(parameter.minimum)} max={shown(parameter.maximum)} step={shown(parameter.step)} value={shown(value)}
        style={{ "--parallax-fill": `${fill}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value) * scale)} />
      {bounds ? (
        <span className="parallax-limits">
          <span>{Number(shown(parameter.minimum).toPrecision(4))}</span>
          <span>{Number(shown(parameter.maximum).toPrecision(4))}</span>
        </span>
      ) : null}
    </div>
  );
}

/** A label that already ends in its unit ("Supply voltage, V") loses it: the unit is shown beside it once. */
function withoutUnit(label: string, unit: string | null | undefined): string {
  if (!unit) {
    return label;
  }
  for (const ending of [`, ${unit}`, ` (${unit})`, `, ${unit}.`]) {
    if (label.endsWith(ending)) {
      return label.slice(0, -ending.length);
    }
  }
  return label;
}

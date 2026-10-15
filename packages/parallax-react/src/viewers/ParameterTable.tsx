import type { ParameterDefinition } from "@jmouse/parallax";
import { humanize } from "../support/humanize";
import { ParallaxIcon } from "../icons/ParallaxIcon";

const NUMBERS = ["defaultValue", "minimum", "maximum", "step"] as const;

/** The parameters of an object as a dense table (`.table.dense`): label, default and range of each slider. */
export function ParameterTable({ parameters, onChange, onRemove }: { parameters: readonly ParameterDefinition[]; onChange: (index: number, changes: Partial<ParameterDefinition>) => void; onRemove?: (index: number) => void }) {
  if (parameters.length === 0) {
    return null;
  }
  return (
    <div data-parallax-part="field" className="parallax-field">
      <span className="parallax-field-label">Parameters</span>
      <div className="parallax-table-scroll parallax-panel">
        <table className="parallax-table parallax-dense">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Label</th>
              {NUMBERS.map((field) => <th key={field} scope="col" className="parallax-numeric">{field === "defaultValue" ? "Default" : humanize(field)}</th>)}
              {onRemove ? <th scope="col"><span className="parallax-screen-reader-only">Remove</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {parameters.map((parameter, index) => (
              <tr key={parameter.name}>
                <td className="parallax-monospace">{parameter.name}</td>
                <td><input data-parallax-part="input" className="parallax-input parallax-small" aria-label={`Label of ${parameter.name}`} value={parameter.label} onChange={(event) => onChange(index, { label: event.target.value })} /></td>
                {NUMBERS.map((field) => (
                  <td key={field} className="parallax-numeric">
                    <input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" aria-label={`${humanize(field)} of ${parameter.name}`} type="number" step="any" value={parameter[field]}
                      onChange={(event) => onChange(index, { [field]: Number(event.target.value) })} />
                  </td>
                ))}
                {onRemove ? (
                  <td>
                    <button type="button" data-parallax-part="button" className="parallax-button parallax-quiet parallax-icon-only parallax-small" aria-label={`Remove ${parameter.name}`} onClick={() => onRemove(index)}><ParallaxIcon name="trash" /></button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useParallaxTransport, useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import { useMemo, useState, type ReactNode } from "react";
import type { Category, ObjectDetail, ParameterDefinition } from "@jmouse/parallax";
import { useAsync } from "../support/useAsync";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { Tool } from "../controls/BenchControls";
import {
  type CircuitElement, circuitFromDrawing, componentReferenceOf, type DrawingItem, elementTypes, GRID, isCircuit, isNetName, itemKindOf, portsOf, snap, waveforms,
} from "@jmouse/parallax/circuit";
import type { SheetEditing } from "../circuit/useSheetEditing";

/** What a circuit says about itself beside its parts: the fields of its document. */
export interface CircuitDetails {
  title: string;
  slug: string;
  category: string;
  summary: string;
  /** The simulation window in seconds, as typed. */
  duration: string;
  parameters: ParameterDefinition[];
}

export function circuitDetailsOf(detail: ObjectDetail): CircuitDetails {
  return {
    title: detail.summary.title, slug: detail.summary.slug, category: detail.summary.category, summary: detail.summary.summary,
    duration: isCircuit(detail.definition) ? String(detail.definition.time.maximum) : "0.01", parameters: detail.parameters,
  };
}

/** What is wrong with the details as typed, field by field; empty when they can be saved. */
export function circuitDetailsProblems(details: CircuitDetails): Partial<Record<"title" | "duration", string>> {
  const problems: Partial<Record<"title" | "duration", string>> = {};
  if (!details.title.trim()) {
    problems.title = "Give the circuit a title.";
  }
  if (!(Number(details.duration) > 0)) {
    problems.duration = "Choose a positive simulation window.";
  }
  return problems;
}

/** The part chosen on the sheet: where it stands, how it is drawn, its value, its pins and its model's values. */
/**
 * A net label's name, written in place: the name is what joins it — every label of one name is one net. A name being
 * typed that cannot be a net's is shown as such and not applied, so the sheet never holds a half-written net.
 */
function NetField({ item, editing }: { item: DrawingItem; editing: SheetEditing }) {
  const [draft, setDraft] = useState(item.net ?? "");
  const valid = isNetName(draft);
  return <div className="parallax-field-inline"><label htmlFor="label-net">Net</label>
    <div className="parallax-stack-tight">
      <input id="label-net" data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" value={draft} spellCheck={false}
        aria-invalid={!valid} aria-describedby={valid ? undefined : "label-net-problem"}
        onChange={(event) => {
          setDraft(event.target.value);
          if (isNetName(event.target.value)) {
            editing.changeItem({ net: event.target.value });
          }
        }} />
      {valid ? null : <span id="label-net-problem" className="parallax-diagnostic parallax-danger">A net's name is a letter or _, then letters, digits and _.</span>}
    </div>
  </div>;
}

export function PartProperties({ item, editing, onElementChange, onOpenComponent }: {
  item: DrawingItem;
  editing: SheetEditing;
  /** Opens the component this part is drawn from, to read or change it; absent where the bench cannot. */
  onOpenComponent?: (reference: string) => void;
  /** A change of what the part is — its value, its model's values —, besides where it stands. */
  onElementChange: (changes: Partial<CircuitElement>) => void;
}) {
  const transport = useParallaxTransport();
  const library = useParallaxPartLibrary();
  const reference = componentReferenceOf(item);
  const symbolVariants = (reference ? library.componentModelOf(reference)?.symbolVariants : null) ?? [];
  const model = useAsync((signal) => transport.components.model(item.element?.component ?? "", signal),
    [item.element?.component], !!item.element?.component && item.type === "MODEL");
  const element = item.element;
  // A pin's net is what the sheet wires it to — read from the circuit the sheet makes, not from the part alone.
  const nets = useMemo(() => circuitFromDrawing(library, editing.document).find((candidate) => candidate.id === item.id)?.pins ?? {},
    [editing.document, item.id]);
  const changeElement = (changes: Partial<CircuitElement>) => {
    editing.changeItem({}, changes);
    onElementChange(changes);
  };
  return <>
    <div data-parallax-part="panel-head" className="parallax-panel-head">
      <div data-parallax-part="inspector-title" className="parallax-inspector-title">
        <h2>{item.id} · {itemKindOf(item).toLowerCase()}</h2>
        <span className="parallax-technical">{item.type === "GROUND" ? `net ${item.net ?? "0"}` : item.type === "JUNCTION" ? "a branch of its wires" : element?.component ?? "part"}</span>
      </div>
    </div>
    {element?.component && onOpenComponent ? (
      <div data-parallax-part="inspector-group" className="parallax-inspector-group">
        <h3>Component</h3>
        <p className="parallax-hint">This part is drawn from <span className="parallax-monospace">{element.component}</span>. Open it to read its jMX, change
          its symbol or which port is which pin, export it as SPICE — a save makes a new revision this sheet moves to.</p>
        <Tool onClick={() => onOpenComponent(element.component!)}><ParallaxIcon name="edit" />Open component</Tool>
      </div>
    ) : null}
    <div data-parallax-part="inspector-group" className="parallax-inspector-group">
      <h3>Part</h3>
      <div className="parallax-field-inline"><label htmlFor="part-x">Position</label><div className="parallax-row">
        <div data-parallax-part="quantity" className="parallax-quantity"><input id="part-x" data-parallax-part="input" className="parallax-input parallax-small" type="number" step={GRID} value={item.x} aria-label="X"
          onChange={(event) => editing.moveItem(item.id, snap(Number(event.target.value)), item.y)} /><span className="parallax-addon">x</span></div>
        <div data-parallax-part="quantity" className="parallax-quantity"><input data-parallax-part="input" className="parallax-input parallax-small" type="number" step={GRID} value={item.y} aria-label="Y"
          onChange={(event) => editing.moveItem(item.id, item.x, snap(Number(event.target.value)))} /><span className="parallax-addon">y</span></div>
      </div></div>
      <div className="parallax-field-inline"><label>Rotation</label>
        <div data-parallax-part="segmented" className="parallax-segmented parallax-small parallax-stretch" role="group" aria-label="Rotation">{[0, 90, 180, 270].map((angle) => (
          <button key={angle} type="button" aria-pressed={item.rotation === angle} onClick={() => editing.changeItem({ rotation: angle })}>{angle}°</button>
        ))}</div>
      </div>
      {symbolVariants.length > 1 && element ? <div className="parallax-field-inline"><label htmlFor="part-symbol">Symbol</label>
        <select id="part-symbol" data-parallax-part="input" className="parallax-input parallax-small" value={element.symbol ?? symbolVariants[0]}
          onChange={(event) => changeElement({ symbol: event.target.value === symbolVariants[0] ? null : event.target.value })}>
          {symbolVariants.map((variant, position) => <option key={variant} value={variant}>{variant}{position === 0 ? " (default)" : ""}</option>)}
        </select></div> : null}
      {element && item.type !== "MODEL" ? <div className="parallax-field-inline"><label htmlFor="part-value">Value</label>
        <div data-parallax-part="quantity" className="parallax-quantity"><input id="part-value" data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" value={element.value ?? ""}
          onChange={(event) => changeElement({ value: event.target.value })} /><span className="parallax-addon">{elementTypes[element.type].unit.split(",")[0]}</span></div>
      </div> : null}
      {element && elementTypes[element.type].source ? <div className="parallax-field-inline"><label htmlFor="part-waveform">Waveform</label>
        <select id="part-waveform" data-parallax-part="input" className="parallax-input parallax-small" value={element.waveform ?? "DC"} onChange={(event) => changeElement({ waveform: event.target.value as CircuitElement["waveform"] })}>
          {waveforms.map((waveform) => <option key={waveform.value} value={waveform.value}>{waveform.label}</option>)}
        </select></div> : null}
      {item.type === "GROUND" && item.label ? <NetField item={item} editing={editing} /> : null}
      <p className="parallax-hint">{item.type === "JUNCTION" ? "A junction joins every wire attached here. Drag it to move the branch."
        : item.type === "GROUND" && item.label ? "Every label of one name is one net: name two of them alike and they are joined, with no wire drawn."
        : "A value may be a parameter or any jMF expression over the parameters: R * 2."}</p>
    </div>
    {item.type === "MODEL" && element ? <>
      <div data-parallax-part="inspector-group" className="parallax-inspector-group">
        <h3>Pins</h3>
        <table className="parallax-table parallax-dense parallax-pins-table"><thead><tr><th scope="col">Pin</th><th scope="col">Net</th></tr></thead><tbody>
          {portsOf(library, item).map((port) => <tr key={port.name}><td>{port.name}</td><td className="parallax-monospace">{nets[port.name] || "—"}</td></tr>)}
        </tbody></table>
        <p className="parallax-hint">A pin's net is what it is wired to on the sheet.</p>
      </div>
      {model.data?.parameters.length ? <div data-parallax-part="inspector-group" className="parallax-inspector-group">
        <h3>Model values</h3>
        <table className="parallax-table parallax-dense parallax-pins-table"><thead><tr><th scope="col">Name</th><th scope="col">Override</th></tr></thead><tbody>
          {model.data.parameters.map((parameter) => <tr key={parameter.name}><td>{parameter.name}</td><td>
            <input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" aria-label={`${parameter.name} override`} placeholder={String(parameter.value)}
              value={element.overrides?.[parameter.name] ?? ""}
              onChange={(event) => changeElement({ overrides: { ...element.overrides, [parameter.name]: event.target.value } })} />
          </td></tr>)}
        </tbody></table>
      </div> : null}
    </> : null}
  </>;
}

/** The circuit's own fields — title, section, summary, window — and its parameters, each a slider on the bench. */
export function CircuitDetailsForm({ details, onChange, categories, problems = {}, destination }: {
  details: CircuitDetails;
  onChange: (changes: Partial<CircuitDetails>) => void;
  categories: readonly Category[] | null;
  problems?: Partial<Record<"title" | "duration", string>>;
  /** Where a new circuit is kept, when the reader may choose. */
  destination?: ReactNode;
}) {
  const field = (id: string, label: string, control: ReactNode, problem?: string) => <>
    <div className="parallax-field-inline"><label htmlFor={id}>{label}</label>{control}</div>
    {problem ? <span className="parallax-error-text" id={`${id}-error`}><ParallaxIcon name="error" />{problem}</span> : null}
  </>;
  const changeParameter = (index: number, changes: Partial<ParameterDefinition>) => onChange({
    parameters: details.parameters.map((parameter, position) => position === index ? { ...parameter, ...changes } : parameter),
  });
  return <>
    <div data-parallax-part="inspector-group" className="parallax-inspector-group">
      <h3>Circuit</h3>
      {field("circuit-title", "Title", <input id="circuit-title" data-parallax-part="input" className="parallax-input parallax-small" required value={details.title} maxLength={160}
        aria-invalid={problems.title ? true : undefined} aria-describedby={problems.title ? "circuit-title-error" : undefined}
        onChange={(event) => onChange({ title: event.target.value })} />, problems.title)}
      {field("circuit-slug", "Identifier", <input id="circuit-slug" data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" value={details.slug} readOnly />)}
      {field("circuit-category", "Section", <select id="circuit-category" data-parallax-part="input" className="parallax-input parallax-small" value={details.category}
        onChange={(event) => onChange({ category: event.target.value })}>
        {(categories ?? []).map((category) => <option key={category.code} value={category.code}>{category.title}</option>)}</select>)}
      {field("circuit-summary", "Summary", <input id="circuit-summary" data-parallax-part="input" className="parallax-input parallax-small" value={details.summary} maxLength={300}
        onChange={(event) => onChange({ summary: event.target.value })} />)}
      {field("circuit-duration", "Window", <div data-parallax-part="quantity" className="parallax-quantity"><input id="circuit-duration" data-parallax-part="input" className="parallax-input parallax-small" value={details.duration}
        aria-invalid={problems.duration ? true : undefined} aria-describedby={problems.duration ? "circuit-duration-error" : undefined}
        onChange={(event) => onChange({ duration: event.target.value })} /><span className="parallax-addon">s</span></div>, problems.duration)}
      {destination}
    </div>
    <div data-parallax-part="inspector-group" className="parallax-inspector-group">
      <h3>Parameters <span className="parallax-technical">{details.parameters.length}</span></h3>
      {details.parameters.length ? (
        <div className="parallax-list parallax-parameter-list">
          {details.parameters.map((parameter, index) => (
            <details key={parameter.name} data-parallax-part="disclosure" className="parallax-disclosure">
              <summary title={parameter.label}>
                <span className="parallax-monospace">{parameter.name}</span>
                <span className="parallax-numeric parallax-push">{shownNumber(parameter.defaultValue / (parameter.scale ?? 1))}{parameter.unit ? ` ${parameter.unit}` : ""}</span>
                <span className="parallax-technical">{shownNumber(parameter.minimum / (parameter.scale ?? 1))} … {shownNumber(parameter.maximum / (parameter.scale ?? 1))}</span>
                <ParallaxIcon name="chevron-down" className="parallax-chevron" />
              </summary>
              <div className="parallax-disclosure-body">
                {([["defaultValue", "Value"], ["minimum", "From"], ["maximum", "To"], ["step", "Step"]] as const).map(([key, label]) => (
                  <div key={key} className="parallax-field-inline">
                    <label htmlFor={`parameter-${parameter.name}-${key}`}>{label}</label>
                    <input id={`parameter-${parameter.name}-${key}`} data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" type="number" step="any" value={parameter[key]}
                      onChange={(event) => changeParameter(index, { [key]: Number(event.target.value) })} />
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : <p className="parallax-hint">Part values are fixed until one uses a jMF parameter name; each name used becomes a slider.</p>}
    </div>
  </>;
}

/** A parameter's number as the table shows it: short, without the float's noise. */
function shownNumber(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toPrecision(4))) : "—";
}

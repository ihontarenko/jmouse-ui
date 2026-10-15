import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import type { Derived, ObjectDetail, ParameterDefinition } from "@jmouse/parallax";
import type { FormField, StatementForm } from "@jmouse/parallax";
import { DatasetFacts } from "../viewers/DatasetFacts";
import { describeLayers, partition, type Dataset } from "@jmouse/parallax/visual";
import { ParameterSlider } from "../viewers/ParameterSlider";
import { type ComputationTarget, representationLabel } from "@jmouse/parallax/computation";
import { Presentation } from "./presentations";

/**
 * The object page's stand (Parallax-UI `.stand`): the set on the left — parameters, inputs, state —, the object in the
 * middle with the representation chips over it and "How it is computed and shown" under it, the outputs on the right.
 * One layout for every kind: what it shows comes from the explanation the backend derived, never from the kind.
 */
export function Stand({ detail, target, saved, values, onValues, onShowLine, inspector }: {
  detail: ObjectDetail;
  target: ComputationTarget;
  saved: boolean;
  values: Record<string, number>;
  onValues: (values: Record<string, number>) => void;
  /** Shows a line of the source the explanation follows from. */
  onShowLine?: (line: number) => void;
  /** More inspector panels under the outputs: what the page knows about the object. */
  inspector?: ReactNode;
}) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const reportDataset = useCallback((computed: Dataset | null) => setDataset(computed), []);
  const representations = detail.applicableRepresentations;
  const [representation, setRepresentation] = useState(detail.summary.primaryRepresentation);
  const structure = detail.explanation?.structure ?? [];
  const block = (word: string) => structure.find((statement) => statement.word === word) ?? null;
  const outputs = block("outputs");
  const drawn = dataset === null || dataset.canvas !== "NONE";
  const numericValues = dataset && drawn && partition(dataset).panels.length > 0 ? dataset : null;

  return (
    <div data-parallax-part="stand" className="parallax-stand">
      <aside data-parallax-part="panel" className="parallax-panel" aria-label="The set">
        <SetPanel detail={detail} statement={block("parameters")} inputs={block("inputs")} state={block("state")} values={values} onValues={onValues} />
      </aside>

      <div data-parallax-part="stand-stage" className="parallax-stand-stage">
        {representations.length > 1 ? (
          <div className="parallax-representations" role="group" aria-label="Representation">
            {representations.map((kind) => (
              <button key={kind} type="button" className="parallax-chip" aria-pressed={kind === representation} onClick={() => setRepresentation(kind)}>
                {representationLabel(kind)}
              </button>
            ))}
          </div>
        ) : null}
        <Presentation detail={detail} target={target} values={values} saved={saved} representation={representation ?? undefined} onDataset={reportDataset} />
        {dataset && !drawn ? (
          <section data-parallax-part="panel" className="parallax-panel" aria-label="Numeric results">
            <div data-parallax-part="panel-head" className="parallax-panel-head"><h2>Values</h2><span className="parallax-technical parallax-push">{describeLayers(dataset)}</span></div>
            <div data-parallax-part="panel-body" className="parallax-panel-body"><DatasetFacts dataset={dataset} /></div>
          </section>
        ) : null}
        {detail.explanation ? <Explanation detail={detail} dataset={dataset} onShowLine={onShowLine} /> : null}
      </div>

      <aside data-parallax-part="inspector" className="parallax-inspector" aria-label="Outputs">
        <div data-parallax-part="panel" className="parallax-panel">
          <div data-parallax-part="panel-head" className="parallax-panel-head">
            <h2>Outputs</h2>
            {detail.parameters.length > 0 ? <span className="parallax-technical parallax-push">at {detail.parameters.map((parameter) => `${parameter.name} = ${formatValue(values[parameter.name] ?? parameter.defaultValue)}`).join(", ")}</span> : null}
          </div>
          {outputs && outputs.lines.length > 0 ? (
            <div data-parallax-part="inspector-group" className="parallax-inspector-group">
              <h3>What it gives</h3>
              <ul className="parallax-structure-lines">{outputs.lines.map((line) => <li key={line.index}><OutputLine fields={line.fields} /></li>)}</ul>
            </div>
          ) : null}
          {numericValues ? (
            <div data-parallax-part="inspector-group" className="parallax-inspector-group">
              <h3>Values</h3>
              <DatasetFacts dataset={numericValues} />
            </div>
          ) : null}
          {!outputs?.lines.length && !numericValues ? (
            <div data-parallax-part="inspector-group" className="parallax-inspector-group">
              <p className="parallax-small parallax-muted">{dataset ? `${describeLayers(dataset)}, drawn in the view.` : "Computing what it gives…"}</p>
            </div>
          ) : null}
        </div>
        {inspector}
      </aside>
    </div>
  );
}

function formatValue(value: number): string {
  return String(Number(value.toPrecision(4)));
}

// ─── the set ──────────────────────────────────────────────────────────────────────────────────────

const valueOf = (fields: readonly FormField[], name: string) => fields.find((field) => field.schema.name === name)?.value ?? "";

/**
 * Parameters as sliders, in the unit their value is written in, a fixed value as written; then the inputs and the
 * state. The sliders change this page's values, never the saved object.
 */
function SetPanel({ detail, statement, inputs, state, values, onValues }: {
  detail: ObjectDetail; statement: StatementForm | null; inputs: StatementForm | null; state: StatementForm | null;
  values: Record<string, number>; onValues: (values: Record<string, number>) => void;
}) {
  const parameters: readonly ParameterDefinition[] = detail.parameters;
  const fixed = (statement?.lines ?? []).filter((line) => !parameters.some((parameter) => parameter.name === valueOf(line.fields, "name")));
  const empty = parameters.length === 0 && fixed.length === 0 && !inputs?.lines.length && !state?.lines.length;
  return (
    <>
      <div data-parallax-part="panel-head" className="parallax-panel-head">
        <h2>Set</h2>
        {parameters.length ? (
          <div className="parallax-actions">
            <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-quiet" onClick={() => onValues(Object.fromEntries(parameters.map((parameter) => [parameter.name, parameter.defaultValue])))}>Reset</button>
          </div>
        ) : null}
      </div>
      <div data-parallax-part="panel-body" className="parallax-panel-body parallax-stack">
        {empty ? <p className="parallax-small parallax-muted">Nothing to set: the object is computed once, as it is written.</p> : null}
        {parameters.map((parameter) => <ParameterSlider key={parameter.name} parameter={parameter} idPrefix="stand" value={values[parameter.name] ?? parameter.defaultValue}
          onChange={(value) => onValues({ ...values, [parameter.name]: value })} />)}
        {fixed.length ? (
          <StructureGroup title="Fixed">
            {fixed.map((line) => <li key={line.index}>
              <code className="parallax-structure-name">{valueOf(line.fields, "name")}</code>
              <code className="parallax-structure-expression">= {valueOf(line.fields, "value")}</code>
              {valueOf(line.fields, "description") ? <span className="parallax-structure-note">{valueOf(line.fields, "description")}</span> : null}
            </li>)}
          </StructureGroup>
        ) : null}
        {inputs?.lines.length ? <StructureGroup title="Inputs">{inputs.lines.map((line) => <li key={line.index}><InputLine fields={line.fields} /></li>)}</StructureGroup> : null}
        {state?.lines.length ? <StructureGroup title="State">{state.lines.map((line) => <li key={line.index}><StateLine fields={line.fields} /></li>)}</StructureGroup> : null}
      </div>
      <div className="parallax-panel-foot">Changes compute at once; nothing is saved until you choose to.</div>
    </>
  );
}

function StructureGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div data-parallax-part="field" className="parallax-field">
      <span className="parallax-field-label">{title}</span>
      <ul className="parallax-structure-lines">{children}</ul>
    </div>
  );
}

function InputLine({ fields }: { fields: readonly FormField[] }) {
  const minimum = valueOf(fields, "minimum");
  const maximum = valueOf(fields, "maximum");
  const names = valueOf(fields, "flags").includes("complex") ? `(${valueOf(fields, "names")})` : valueOf(fields, "names");
  return <>
    <code className="parallax-structure-name">{names}</code>
    {minimum || maximum ? <span className="parallax-structure-value">∈ {minimum} … {maximum}</span> : null}
    <Flags written={valueOf(fields, "flags")} step={valueOf(fields, "step")} />
    {valueOf(fields, "description") ? <span className="parallax-structure-note">{valueOf(fields, "description")}</span> : null}
  </>;
}

function StateLine({ fields }: { fields: readonly FormField[] }) {
  return <>
    <code className="parallax-structure-name">{valueOf(fields, "name")}</code>
    <span className="parallax-structure-value">from {valueOf(fields, "start")}</span>
    {valueOf(fields, "nature") ? <span className="parallax-kind">{valueOf(fields, "nature")}</span> : null}
    {valueOf(fields, "description") ? <span className="parallax-structure-note">{valueOf(fields, "description")}</span> : null}
  </>;
}

function OutputLine({ fields }: { fields: readonly FormField[] }) {
  const expression = valueOf(fields, "expression");
  const condition = valueOf(fields, "condition");
  return <>
    <code className="parallax-structure-name">{valueOf(fields, "name")}</code>
    {valueOf(fields, "type") ? <span className="parallax-kind">{valueOf(fields, "type")}</span> : null}
    {expression ? <code className="parallax-structure-expression">= {expression}</code> : condition ? <code className="parallax-structure-expression">where {condition}</code>
      : <span className="parallax-structure-note">written by the engine</span>}
    {valueOf(fields, "description") ? <span className="parallax-structure-note">{valueOf(fields, "description")}</span> : null}
  </>;
}

function Flags({ written, step }: { written: string; step?: string }) {
  const flags = written.includes("per unit") ? [...written.replace("per unit", "").split(/\s+/).filter(Boolean), "per unit"] : written.split(/\s+/).filter(Boolean);
  return <>{step ? <span className="parallax-kind">step {step}</span> : null}{flags.map((flag) => <span key={flag} className="parallax-kind">{flag}</span>)}</>;
}

// ─── how it is computed and shown ─────────────────────────────────────────────────────────────────

/**
 * How it is computed and shown (Parallax-UI `.explanation`): the engine, what came out — every layer with its size —,
 * where it is drawn and why, and what it can do; each with the line it follows from. Not editable: changing the
 * structure changes these.
 */
export function Explanation({ detail, dataset, onShowLine }: { detail: ObjectDetail; dataset: Dataset | null; onShowLine?: (line: number) => void }) {
  const explanation = detail.explanation!;
  const columns: [string, Derived | null][] = [["Engine", explanation.engine]];
  if (dataset) {
    columns.push(["Data", { value: dataset.shape, label: describeLayers(dataset), because: explanation.view.because, line: explanation.view.line }]);
    columns.push(["Drawn", drawnWhere(dataset, explanation.space, explanation.view)]);
  } else {
    columns.push(["Shown as", explanation.presentation]);
  }
  // Folded by default: the object comes first, how the engine got there is one click away.
  return (
    <details data-parallax-part="disclosure" className="parallax-disclosure parallax-panel parallax-stand-explanation">
      <summary>
        <h2>How it is computed and shown</h2>
        <span className="parallax-metadata">{explanation.engine?.label ?? ""}</span>
        <svg className="parallax-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </summary>
      <div className="parallax-disclosure-body">
      <p className="parallax-small parallax-muted">Each line follows from the source; change the structure to change these.</p>
      <div className="parallax-explanation">
        {columns.map(([title, derived]) => (
          <div key={title}>
            <h3>{title}</h3>
            <p>{derived?.label}</p>
            {derived ? <Because derived={derived} onShowLine={onShowLine} /> : null}
          </div>
        ))}
        <div>
          <h3>Capabilities</h3>
          {explanation.capabilities.length === 0 ? <p>Nothing beyond its parameters: it is computed once for their values.</p>
            : <ul className="parallax-stack-tight">{explanation.capabilities.map((capability) => <li key={capability.value}>
              <p>{capability.label}</p><Because derived={capability} onShowLine={onShowLine} /></li>)}</ul>}
        </div>
      </div>
      </div>
    </details>
  );
}

/**
 * Where the data is drawn and why: in Space for three dimensions, on the Plane for two, named by the structure that
 * makes them; a view that flattens more dimensions onto the Plane — a time series of a 3-variable state — says so.
 */
function drawnWhere(dataset: Dataset, space: Derived, view: Derived): Derived {
  const dimensions = Number(space.value);
  if (dataset.canvas === "SPACE") {
    return { ...space, label: `In Space — ${space.label}` };
  }
  if (dataset.canvas === "PLANE") {
    return dimensions <= 2 ? { ...space, label: `On the Plane — ${space.label}` }
      : { ...view, label: `On the Plane — the view draws ${space.label.split(" (")[0]} against one axis` };
  }
  return { value: "NONE", label: "As numbers, without a canvas — the result is a value, not a picture", because: "", line: 0 };
}

function Because({ derived, onShowLine }: { derived: Derived; onShowLine?: (line: number) => void }) {
  if (!derived.because) {
    return null;
  }
  return <span className="parallax-from">because <code>{derived.because}</code>{derived.line ? <> · <LineLink line={derived.line} onShowLine={onShowLine} /></> : null}</span>;
}

function LineLink({ line, onShowLine }: { line: number; onShowLine?: (line: number) => void }) {
  if (!onShowLine) {
    return <span>line {line}</span>;
  }
  const show = (event: MouseEvent) => {
    event.preventDefault();
    onShowLine(line);
  };
  return <a href="#source" onClick={show} aria-label={`Show line ${line} in the source`}>line {line}</a>;
}

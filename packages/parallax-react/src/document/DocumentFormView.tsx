import { useEffect, useState, type ReactNode } from "react";
import { valuesOf, type ParallaxTransport, type DocumentForm, type FieldSchema, type FormEdit, type FormField, type LanguageSchema, type LineForm, type StatementForm } from "@jmouse/parallax";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { humanize } from "../support/humanize";
import { Tool } from "../controls/BenchControls";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { CodeSourceEditor } from "../viewers/CodeSourceEditor";
import { FieldWidget } from "./FieldWidget";

/** Each transport's language schema, read once. */
const schemaRequests = new WeakMap<ParallaxTransport, Promise<LanguageSchema>>();

/** The language schema, read once per transport: what a new line of each block is made of. */
function useLanguageSchema(): LanguageSchema | null {
  const transport = useParallaxTransport();
  const [schema, setSchema] = useState<LanguageSchema | null>(null);
  useEffect(() => {
    let request = schemaRequests.get(transport);
    if (!request) {
      request = transport.documents.schema();
      schemaRequests.set(transport, request);
    }
    let current = true;
    request
      .then((loaded) => {
        if (current) {
          setSchema(loaded);
        }
      })
      .catch(() => {
        schemaRequests.delete(transport);
      });
    return () => {
      current = false;
    };
  }, [transport]);
  return schema;
}

/** The language a body between braces is written in. */
const BODY_LANGUAGES: Record<string, "jMF" | "jMS"> = { formulas: "jMF", behaviour: "jMS", run: "jMS" };

/**
 * A document as its generated form, drawn as the template's property sheet: the title, then every statement in the
 * order written as a disclosure (`.disclosure`), each shown the way its block is edited — lines through their fields,
 * a body as code, a schematic or a drawing on its canvas, a one-line statement through its fields. Nothing here
 * knows a kind of document.
 */
export function DocumentFormView({ form, onEdit, canvas }: {
  form: DocumentForm;
  onEdit: (edit: FormEdit) => void;
  canvas?: (editor: "SCHEMATIC" | "DRAWING") => ReactNode;
}) {
  const schema = useLanguageSchema();
  const refusalLine = form.refusal?.line ?? -1;
  const drawing = form.statements.filter((statement) => statement.editor === "DRAWING" && statement.lines.length === 0);
  return <div data-parallax-part="document-sheet" className="parallax-document-sheet">
    <div className="parallax-side-group">
      <h3>{humanize(form.kind)}<span className="parallax-push">line 1</span></h3>
      <FieldWidget id="document-title" field={{ schema: { name: "title", label: "Title", type: "TEXT", required: true, words: [], kinds: [] }, value: form.title }}
        onCommit={(text) => onEdit({ action: "SET_TITLE", text })} />
    </div>
    {drawing.length ? <details data-parallax-part="disclosure" className="parallax-disclosure" open>
      <summary>Drawing <span className="parallax-metadata">line {drawing[0].line}</span><ParallaxIcon name="chevron-down" className="parallax-chevron" /></summary>
      <div className="parallax-disclosure-body">
        {canvas?.("DRAWING")}
        {drawing.map((statement) => <OneLine key={statement.index} statement={statement} onEdit={onEdit} refused={statement.line === refusalLine ? form.refusal!.message : null} />)}
      </div>
    </details> : null}
    {form.statements.filter((statement) => !drawing.includes(statement)).map((statement) =>
      <Statement key={`${statement.index}-${statement.word}`} statement={statement} onEdit={onEdit}
        refusal={form.refusal} canvas={canvas} />)}
    <AddStatement addable={form.addable} schema={schema} onEdit={onEdit} />
  </div>;
}

function Statement({ statement, onEdit, refusal, canvas }: {
  statement: StatementForm;
  onEdit: (edit: FormEdit) => void;
  refusal: DocumentForm["refusal"];
  canvas?: (editor: "SCHEMATIC" | "DRAWING") => ReactNode;
}) {
  const lastLine = statement.lines.at(-1)?.line ?? statement.line;
  const refusedHere = refusal && refusal.line >= statement.line && refusal.line <= lastLine + 1 ? refusal : null;
  const meta = statement.editor === "LINES" || statement.editor === "SCHEMATIC"
    ? `line ${statement.line} · ${statement.lines.length} ${statement.lines.length === 1 ? "line" : "lines"}`
    : `line ${statement.line}`;
  return <details data-parallax-part="disclosure" className="parallax-disclosure" open>
    <summary>
      {humanize(statement.word)}
      <span className="parallax-metadata">{meta}</span>
      {refusedHere || statement.problem ? <span className="parallax-badge parallax-danger">refused</span> : null}
      <ParallaxIcon name="chevron-down" className="parallax-chevron" />
    </summary>
    <div className="parallax-disclosure-body">
      {statement.editor === "SCHEMATIC" || statement.editor === "DRAWING" ? canvas?.(statement.editor) : null}
      {statement.editor === "STATEMENT"
        ? <OneLine statement={statement} onEdit={onEdit} refused={refusedHere?.line === statement.line ? refusedHere.message : null} />
        : <>
          {statement.header.length ? <div className="parallax-sheet-line">
            {statement.header.map((field) => <FieldWidget key={field.schema.name} id={`document-statement-${statement.index}-header-${field.schema.name}`} field={field}
              error={statement.problem}
              onCommit={(value) => onEdit({ action: "SET_HEADER", statement: statement.index, values: { ...valuesOf(statement.header), [field.schema.name]: value } })} />)}
          </div> : null}
          {statement.editor === "BODY"
            ? <Body statement={statement} onEdit={onEdit} />
            : <>
              {statement.lines.length === 0 ? <p className="parallax-small parallax-muted">No lines yet.</p> : null}
              <ol className="parallax-sheet-lines">
                {statement.lines.map((line) => <Line key={line.index} statement={statement} line={line} onEdit={onEdit}
                  refused={refusedHere?.line === line.line ? refusedHere.message : null} />)}
              </ol>
              <NewLine statement={statement} onEdit={onEdit} />
            </>}
        </>}
      <div className="parallax-row">
        <button type="button" data-parallax-part="button" className="parallax-button parallax-quiet parallax-small" onClick={() => onEdit({ action: "REMOVE_STATEMENT", statement: statement.index })}>
          <ParallaxIcon name="trash" />Remove {statement.word}
        </button>
      </div>
    </div>
  </details>;
}

function Line({ statement, line, onEdit, refused }: { statement: StatementForm; line: LineForm; onEdit: (edit: FormEdit) => void; refused: string | null }) {
  const id = `document-${statement.index}-${line.index}`;
  const problem = line.problem ?? refused;
  return <li className="parallax-sheet-line" aria-label={`Line ${line.line}`}>
    <div className="parallax-spread">
      <span className="parallax-technical">line {line.line}</span>
      <button type="button" data-parallax-part="button" className="parallax-button parallax-quiet parallax-icon-only parallax-small" aria-label={`Remove line ${line.line}`}
        onClick={() => onEdit({ action: "REMOVE_LINE", statement: statement.index, line: line.index })}><ParallaxIcon name="trash" /></button>
    </div>
    {line.fields.map((field, position) => <FieldWidget key={field.schema.name} id={`${id}-${field.schema.name}`} field={field}
      error={position === 0 ? problem : null}
      onCommit={(value) => onEdit({ action: "SET_LINE", statement: statement.index, line: line.index, values: { ...valuesOf(line.fields), [field.schema.name]: value } })} />)}
  </li>;
}

function OneLine({ statement, onEdit, refused }: { statement: StatementForm; onEdit: (edit: FormEdit) => void; refused: string | null }) {
  const id = `document-${statement.index}`;
  return <div className="parallax-sheet-line">
    {statement.header.map((field, position) => <FieldWidget key={field.schema.name} id={`${id}-${field.schema.name}`} field={field}
      error={position === 0 ? statement.problem ?? refused : null}
      onCommit={(value) => onEdit({ action: "SET_STATEMENT", statement: statement.index, values: { ...valuesOf(statement.header), [field.schema.name]: value } })} />)}
  </div>;
}

/** A body in another language, applied as a whole when the reader says so. */
function Body({ statement, onEdit }: { statement: StatementForm; onEdit: (edit: FormEdit) => void }) {
  const [draft, setDraft] = useState(statement.body ?? "");
  useEffect(() => setDraft(statement.body ?? ""), [statement.body]);
  const language = BODY_LANGUAGES[statement.word] ?? "jMS";
  return <div className="parallax-stack-tight">
    <CodeSourceEditor id={`document-body-${statement.index}`} label={humanize(statement.word)} language={language} value={draft} onChange={setDraft} minHeight={120} />
    <div className="parallax-row">
      <Tool disabled={draft === (statement.body ?? "")} onClick={() => setDraft(statement.body ?? "")}>Revert</Tool>
      <Tool tone="primary" disabled={draft === (statement.body ?? "")} onClick={() => onEdit({ action: "SET_BODY", statement: statement.index, text: draft })}>Apply</Tool>
    </div>
  </div>;
}

/**
 * A line to add, made of the block's own fields from the schema. A keyed block (its first field is `key`) lets the key
 * choose which value field follows: `summary` a text, `category` a section, a free field a value and a label.
 */
function NewLine({ statement, onEdit }: { statement: StatementForm; onEdit: (edit: FormEdit) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const fields = fieldsToFill(statement.fields, values);
  if (!open) {
    return <div className="parallax-row"><Tool onClick={() => setOpen(true)}><ParallaxIcon name="plus" />Add a line</Tool></div>;
  }
  const submit = () => {
    onEdit({ action: "ADD_LINE", statement: statement.index, values: Object.fromEntries(fields.map((field) => [field.name, values[field.name] ?? ""])) });
    setValues({});
    setOpen(false);
  };
  return <div className="parallax-sheet-line parallax-sheet-line-new" role="group" aria-label={`New line in ${statement.word}`}>
    {fields.map((field) => <FieldWidget key={field.name} id={`document-new-${statement.index}-${field.name}`} field={{ schema: field, value: values[field.name] ?? "" }}
      onCommit={(value) => setValues((current) => ({ ...current, [field.name]: value }))} />)}
    <div className="parallax-row"><Tool onClick={() => { setValues({}); setOpen(false); }}>Cancel</Tool><Tool tone="primary" onClick={submit}>Add</Tool></div>
  </div>;
}

/** The fields of a new line: for a keyed block the key, then the value field its key has, or a free field's value and label. */
function fieldsToFill(line: readonly FieldSchema[], values: Record<string, string>): FieldSchema[] {
  if (line[0]?.name !== "key") {
    return [...line];
  }
  const keys = line.slice(1).filter((field) => field.name !== "value" && field.name !== "label");
  const key: FieldSchema = { ...line[0], type: "WORD", words: [...keys.map((field) => field.name), "other"] };
  const chosen = values.key ?? "";
  const known = keys.find((field) => field.name === chosen);
  if (known) {
    return [key, { ...known, name: "value" }];
  }
  if (chosen === "other" || (chosen && !known)) {
    return [{ ...line[0], label: "Field name" }, ...line.filter((field) => field.name === "value" || field.name === "label")];
  }
  return [key];
}

/** A block the kind allows and the document does not have yet, or a declaration. */
function AddStatement({ addable, schema, onEdit }: { addable: readonly string[]; schema: LanguageSchema | null; onEdit: (edit: FormEdit) => void }) {
  const [word, setWord] = useState("");
  const [value, setValue] = useState("");
  if (addable.length === 0) {
    return null;
  }
  const declaration: FormField["schema"] | undefined = schema?.declarations.find((field) => field.name === word);
  const symbolHeader = schema?.blocks.find((block) => block.name === word)?.header[0];
  const asks = declaration ?? symbolHeader;
  return <div className="parallax-side-group">
    <h3 id="document-add-statement">Add to the document</h3>
    <div className="parallax-field-inline"><label htmlFor="document-add-word">Block</label>
      <select id="document-add-word" data-parallax-part="input" className="parallax-input parallax-small" value={word} onChange={(event) => { setWord(event.target.value); setValue(""); }}>
        <option value="">Choose…</option>
        {addable.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
      </select></div>
    {asks ? <FieldWidget id="document-add-value" field={{ schema: asks, value }} onCommit={setValue} /> : null}
    <div className="parallax-row"><Tool tone="primary" disabled={!word || (Boolean(asks) && !value.trim())}
      onClick={() => { onEdit({ action: "ADD_STATEMENT", text: word, values: asks ? { [asks.name]: value } : {} }); setWord(""); setValue(""); }}><ParallaxIcon name="plus" />Add</Tool></div>
  </div>;
}

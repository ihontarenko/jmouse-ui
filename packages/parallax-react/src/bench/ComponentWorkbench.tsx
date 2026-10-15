import { useEffect, useMemo, useRef, useState } from "react";
import { ApiProblem, draftOf, type DocumentForm, type ObjectDetail, type ObjectDraft, type Refusal, type SymbolView } from "@jmouse/parallax";
import { readSymbolDrawing, type SymbolDrawingDocument } from "@jmouse/parallax/schematic";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { useAsync } from "../support/useAsync";
import { SourceFormats } from "../viewers/SourceFormats";
import { SymbolPicture } from "../symbols/SymbolDrawing";
import { Tool } from "../controls/BenchControls";
import { BenchGrid } from "../controls/BenchGrid";
import { ParallaxIcon } from "../icons/ParallaxIcon";

/**
 * What the product decides about components, which a library cannot: whether the reader may change a saved one, and
 * where a new one — a copy, an import — is kept.
 */
export interface ComponentHost {
  editable(detail: ObjectDetail): boolean;
  create(draft: ObjectDraft): Promise<ObjectDetail>;
}

/** What the workbench opens on: a saved component by its reference, or a text of its own — a SPICE import, a file. */
export type ComponentSubject =
  | { kind: "saved"; reference: string }
  | { kind: "text"; source: string; title: string; notes?: string[] };

/** What a new component starts as: a part between two pins with one equation, drawn as a box until a symbol is chosen. */
export const NEW_COMPONENT_SOURCE = `component "New component" as new-component type part {
    meta {
        designator U
        summary "What it is, in one line"
        category circuits
    }
    parameters {
        R = 1 kOhm "what it resists with"
    }
    pins {
        a analog 1 "first terminal"
        b analog 2 "second terminal"
    }
    equations {
        current a -> b = (a - b) / R
    }
}
`;

/** A component pin as its text writes it. */
interface ComponentPin {
  name: string;
  description: string;
}

/** The symbol a component's text draws it with, and which of the symbol's ports is which pin. */
interface SymbolBinding {
  symbol: string;
  ports: { port: string; pin: string }[];
}

/**
 * A component being worked on — everything its editor holds and does, apart from where its panels stand: a dialog on
 * the bench and the Components page are the same editor, laid out twice.
 */
export interface ComponentEditing {
  subject: ComponentSubject;
  title: string;
  slug: string | null;
  detail: ObjectDetail | null;
  /** Whether a save writes a new revision — the reader's own, or theirs to curate —, rather than a copy. */
  editable: boolean;
  host?: ComponentHost;
  source: string;
  setSource: (source: string) => void;
  /** What a SPICE import or export could not say in the other language. */
  notes: string[];
  form: DocumentForm | null;
  refusal: Refusal | null;
  pins: ComponentPin[];
  binding: SymbolBinding | null;
  symbols: readonly SymbolView[];
  symbolDrawing: SymbolDrawingDocument | null;
  busy: boolean;
  problem: string | null;
  message: string | null;
  chooseSymbol: (view: SymbolView) => Promise<void>;
  changePort: (line: number, port: string, pin: string) => Promise<void>;
  save: (asCopy: boolean) => Promise<void>;
  exportSpice: () => Promise<void>;
  importFile: (file: File) => Promise<void>;
  downloadSource: () => void;
}

/**
 * A component's editing: its jMX text, checked as it is typed; the symbol it is drawn with and which of the symbol's
 * ports is which of its pins — written into the text by the language's own editor, so a comment beside the line
 * survives —; and its exchanges: a file or a SPICE netlist read in, jMX or SPICE written out. A save makes a new
 * revision, or — for a component the reader may not change — a copy of their own.
 */
export function useComponentEditing(subject: ComponentSubject, host: ComponentHost | undefined,
  onSaved: (reference: string, detail: ObjectDetail) => void): ComponentEditing {
  const transport = useParallaxTransport();
  const slug = subject.kind === "saved" ? subject.reference.split("@")[0] : null;
  const saved = useAsync((signal) => transport.catalogue.object(slug!, signal), [slug], slug !== null);
  const symbols = useAsync((signal) => transport.components.symbols(signal), []);
  const [source, setSource] = useState(subject.kind === "text" ? subject.source : "");
  const [notes, setNotes] = useState<string[]>(subject.kind === "text" ? subject.notes ?? [] : []);
  const [form, setForm] = useState<DocumentForm | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const detail = saved.data ?? null;

  useEffect(() => {
    if (detail && detail.definition.kind === "COMPONENT" && "source" in detail.definition) {
      setSource(String(detail.definition.source));
    }
  }, [detail]);

  // The text is read as it is typed, a moment after the keys stop: what it refuses, where, and its form.
  useEffect(() => {
    if (!source.trim()) {
      setForm(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      transport.documents.form(source, controller.signal).then((edited) => setForm(edited.form)).catch(() => undefined);
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [source]);

  const refusal = form?.refusal ?? null;
  const pins = useMemo(() => pinsOf(form), [form]);
  const binding = useMemo(() => bindingOf(form), [form]);
  const symbolDrawing = useMemo(() => {
    const view = symbols.data?.find((symbol) => symbol.slug === binding?.symbol);
    return view ? readSymbolDrawing(view.drawing) : null;
  }, [symbols.data, binding?.symbol]);
  const editable = detail ? host?.editable(detail) ?? false : false;
  const title = detail?.summary.title ?? (subject.kind === "text" ? subject.title : "Component");

  /** One edit of the text by the language's editor; the text and its form follow it. */
  // The text each edit is made to: the last one's result at once, not the state of the render that started a chain —
  // a symbol chosen is several edits in a row, and each took the text as it was before the first.
  const latest = useRef(source);
  latest.current = source;
  const edit = async (change: Parameters<typeof transport.documents.edit>[1]) => {
    const edited = await transport.documents.edit(latest.current, change);
    latest.current = edited.source;
    setSource(edited.source);
    setForm(edited.form);
    return edited;
  };

  /** The symbol a component is drawn with, and its ports matched to the pins: by name, else in order. */
  const chooseSymbol = async (view: SymbolView) => {
    const drawing = readSymbolDrawing(view.drawing);
    const ports = (drawing?.pins ?? []).map((pin) => pin.name);
    const pinNames = pins.map((pin) => pin.name);
    const mapping = ports.map((port, index) => ({ port, pin: pinNames.includes(port) ? port : pinNames[index] ?? pinNames[0] ?? port }));
    setBusy(true);
    setProblem(null);
    try {
      let current = form;
      let statement = current?.statements.find((candidate) => candidate.word === "symbol");
      // A component drawn as a box has no `symbol` block yet: one is added, its header naming the symbol.
      current = statement
        ? (await edit({ action: "SET_HEADER", statement: statement.index, values: { uses: view.slug } })).form
        : (await edit({ action: "ADD_STATEMENT", text: "symbol", values: { uses: view.slug } })).form;
      statement = current.statements.find((candidate) => candidate.word === "symbol")!;
      for (let line = statement.lines.length - 1; line >= 0; line--) {
        current = (await edit({ action: "REMOVE_LINE", statement: statement.index, line })).form;
      }
      for (const entry of mapping) {
        current = (await edit({ action: "ADD_LINE", statement: statement.index, values: { port: entry.port, pin: entry.pin } })).form;
      }
    } catch (failure) {
      setProblem(failure instanceof ApiProblem ? failure.detail : "The symbol could not be written into the text.");
    } finally {
      setBusy(false);
    }
  };

  const changePort = async (line: number, port: string, pin: string) => {
    const statement = form?.statements.find((candidate) => candidate.word === "symbol");
    if (!statement) {
      return;
    }
    try {
      await edit({ action: "SET_LINE", statement: statement.index, line, values: { port, pin } });
    } catch (failure) {
      setProblem(failure instanceof ApiProblem ? failure.detail : "The port could not be written into the text.");
    }
  };

  const save = async (asCopy: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      // What the text is — a component, or a whole circuit a SPICE netlist became — is the text's own word.
      const definition = { kind: (form?.kind ?? "component").toUpperCase(), source } as ObjectDraft["definition"];
      const result = detail && !asCopy
        ? await transport.catalogue.update(detail.summary.id, detail.version, { ...draftOf(detail), definition })
        : await host!.create(detail
          ? { ...draftOf(detail), slug: `${detail.summary.slug}-copy`, title: `${detail.summary.title} (my copy)`, definition, relations: [] }
          : { title, slug: slugOf(title), category: "CIRCUITS", summary: title, definition, representations: [], properties: [] });
      const reference = `${result.summary.slug}@${result.definitionRevision}`;
      setMessage(`Saved as ${reference}`);
      onSaved(reference, result);
    } catch (failure) {
      setProblem(failure instanceof ApiProblem ? failure.detail : "The component was not saved.");
    } finally {
      setBusy(false);
    }
  };

  const exportSpice = async () => {
    try {
      const written = await transport.documents.spiceExport(source);
      download(`${slug ?? slugOf(title)}.cir`, written.text);
      setNotes(written.notes);
      setMessage(written.notes.length ? "Written as SPICE — see what SPICE cannot say" : "Written as SPICE");
    } catch (failure) {
      setProblem(failure instanceof ApiProblem ? failure.detail : "The component could not be written as SPICE.");
    }
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    if (/\.jmx$/i.test(file.name)) {
      setSource(text);
      setNotes([]);
      setMessage(`Read ${file.name}`);
      return;
    }
    try {
      const imported = await transport.documents.spiceImport(text, file.name.replace(/\.[^.]+$/, ""));
      setSource(imported.source);
      setNotes(imported.notes);
      setMessage(`Converted ${file.name} from SPICE${imported.notes.length ? ` — ${imported.notes.length} thing(s) to look at` : ""}`);
    } catch (failure) {
      setProblem(failure instanceof ApiProblem ? failure.detail : `${file.name} could not be read as SPICE.`);
    }
  };

  return {
    subject, title, slug, detail, editable, host, source, setSource, notes, form, refusal, pins, binding,
    symbols: symbols.data ?? [], symbolDrawing, busy, problem, message,
    chooseSymbol, changePort, save, exportSpice, importFile,
    downloadSource: () => download(`${slug ?? slugOf(title)}.jmx`, source),
  };
}

/** The component's text, in jMX and as SPICE, its refusal marked where it is. */
export function ComponentSourcePanel({ editing, minHeight = 420 }: { editing: ComponentEditing; minHeight?: number }) {
  const { refusal } = editing;
  return <section aria-label="The component's text" className="parallax-component-workbench-code">
    <SourceFormats id="component-source" value={editing.source} onChange={editing.setSource} minHeight={minHeight}
      error={refusal ? `Line ${refusal.line}, column ${refusal.column}: ${refusal.message}` : undefined} focusLine={refusal?.line ?? null} />
  </section>;
}

/** How the component is drawn: its symbol, which of the symbol's ports is which pin. */
export function ComponentDrawingPanel({ editing }: { editing: ComponentEditing }) {
  const { binding, pins, busy } = editing;
  return <>
    <h3>Drawn as</h3>
    <div className="parallax-component-workbench-preview">
      {/* The pins without their names: drawn at the symbol's scale they ran over each other in a narrow column, and the
          table under it says which port is which pin. */}
      {editing.symbolDrawing ? <SymbolPicture drawing={editing.symbolDrawing} showPins namePins={false} label={`${editing.title} as drawn`} margin={8} />
        : <p className="parallax-hint">{binding ? `Symbol ${binding.symbol} is not in the library.` : "Drawn as a box from its pins — choose a symbol."}</p>}
    </div>
    {binding?.ports.length ? (
      <table className="parallax-table parallax-dense" aria-label="Symbol ports and component pins">
        <thead><tr><th scope="col">Symbol port</th><th scope="col">Component pin</th></tr></thead>
        <tbody>
          {binding.ports.map((entry, line) => (
            <tr key={entry.port}>
              <td className="parallax-monospace">{entry.port}</td>
              <td>
                <select data-parallax-part="input" className="parallax-input parallax-small" aria-label={`Pin for port ${entry.port}`} value={entry.pin}
                  disabled={busy} onChange={(event) => void editing.changePort(line, entry.port, event.target.value)}>
                  {pins.map((pin) => <option key={pin.name} value={pin.name}>{pin.name}{pin.description ? ` — ${pin.description}` : ""}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : null}
  </>;
}

/** The symbols to draw the component with, the chosen one marked. */
export function ComponentSymbolChooser({ editing }: { editing: ComponentEditing }) {
  return <SymbolChooser symbols={editing.symbols} chosen={editing.binding?.symbol ?? null}
    disabled={editing.busy || !editing.form || Boolean(editing.refusal)} onChoose={(view) => void editing.chooseSymbol(view)} />;
}

/** What a SPICE import or export could not say, when there is something. */
export function ComponentNotes({ editing }: { editing: ComponentEditing }) {
  return editing.notes.length ? (
    <div className="parallax-component-workbench-notes" role="note">
      <strong>From SPICE — look at these</strong>
      <ul>{editing.notes.map((note) => <li key={note}>{note}</li>)}</ul>
    </div>
  ) : null;
}

/** Whether the text reads, what the last action did, or why it failed. */
export function ComponentStatus({ editing }: { editing: ComponentEditing }) {
  const { problem, refusal, form, message, pins } = editing;
  return <span className="parallax-component-workbench-status" role="status">
    {problem ? <span className="parallax-diagnostic parallax-danger"><ParallaxIcon name="error" />{problem}</span>
      : refusal ? <span className="parallax-diagnostic parallax-danger"><ParallaxIcon name="error" />The text does not read — line {refusal.line}</span>
        : form ? <span className="parallax-diagnostic parallax-good"><ParallaxIcon name="check" />{message ?? `Reads · ${pins.length} pins`}</span>
          : <span className="parallax-hint">Reading…</span>}
  </span>;
}

/** The component's exchanges and its save: read a file in, write jMX or SPICE out, keep it. */
export function ComponentActions({ editing }: { editing: ComponentEditing }) {
  const { detail, editable, host, busy, form, refusal, source } = editing;
  const reads = Boolean(form) && !refusal;
  return <>
    <label className="parallax-button parallax-small">
      <ParallaxIcon name="upload" />Import jMX or SPICE…
      <input type="file" accept=".jmx,.cir,.sp,.spice,.net,.lib,.sub,.txt" className="parallax-screen-reader-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void editing.importFile(file);
          }
        }} />
    </label>
    <Tool onClick={editing.downloadSource} disabled={!source.trim()}><ParallaxIcon name="download" />jMX</Tool>
    <Tool onClick={() => void editing.exportSpice()} disabled={!reads}><ParallaxIcon name="download" />SPICE</Tool>
    {detail && editable ? <Tool tone="primary" busy={busy} disabled={!reads} onClick={() => void editing.save(false)}><ParallaxIcon name="save" />Save revision</Tool> : null}
    {host && (!detail || !editable) ? <Tool tone="primary" busy={busy} disabled={!reads} onClick={() => void editing.save(true)}>
      <ParallaxIcon name="save" />{detail ? "Save as my copy" : "Save to my library"}</Tool> : null}
  </>;
}

/** Where the component comes from and whether a save changes it, as one line. */
function provenanceOf(editing: ComponentEditing): string {
  const { subject, detail, editable } = editing;
  return `${subject.kind === "saved" ? subject.reference : "not saved yet"}`
    + `${detail ? ` · ${detail.summary.origin === "OWNED" ? "mine" : detail.summary.origin.toLowerCase()}` : ""}`
    + `${detail && !editable ? " · read only — save makes your copy" : ""}`;
}

/** A component on the bench, worked on where it is used, in a dialog over the bench. */
export function ComponentWorkbench({ subject, host, onClose, onSaved }: {
  subject: ComponentSubject;
  host?: ComponentHost;
  onClose: () => void;
  /** A revision saved: the reference parts of it should be drawn from now. */
  onSaved: (reference: string, detail: ObjectDetail) => void;
}) {
  const editing = useComponentEditing(subject, host, onSaved);
  const dialog = useRef<HTMLDialogElement>(null);
  // Closed by Escape, the close button or the backdrop: told through the element's own event, which a React prop on a
  // dialog did not deliver — the panel stayed mounted, closed, and the same component could not be opened again.
  const closed = useRef(onClose);
  closed.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    const close = () => closed.current();
    element?.addEventListener("close", close);
    // Run twice in development: a second showModal on an open dialog throws, and the listener above must be in place.
    if (element && !element.open) {
      element.showModal();
    }
    return () => element?.removeEventListener("close", close);
  }, []);
  return (
    <dialog ref={dialog} data-parallax-part="component-workbench" className="parallax-component-workbench" aria-labelledby="component-workbench-title">
      <header className="parallax-component-workbench-head">
        <div>
          <h2 id="component-workbench-title">{editing.title}</h2>
          <span className="parallax-technical">{provenanceOf(editing)}</span>
        </div>
        <button type="button" className="parallax-hotkeys-close" aria-label="Close" onClick={() => { dialog.current?.close(); onClose(); }}>Esc</button>
      </header>
      <div className="parallax-component-workbench-body">
        <ComponentSourcePanel editing={editing} />
        <aside aria-label="How it is drawn" className="parallax-component-workbench-side">
          <ComponentDrawingPanel editing={editing} />
          <ComponentSymbolChooser editing={editing} />
        </aside>
      </div>
      <ComponentNotes editing={editing} />
      <footer className="parallax-component-workbench-foot">
        <ComponentStatus editing={editing} />
        <ComponentActions editing={editing} />
      </footer>
    </dialog>
  );
}

/**
 * The same editor as a page of the workbench, laid out as the Symbol editor is: the symbols to draw it with on the left,
 * its text in the middle, how it is drawn and its exchanges on the right.
 */
export function ComponentEditorSurface({ subject, host, onSaved }: {
  subject: ComponentSubject;
  host?: ComponentHost;
  onSaved: (reference: string, detail: ObjectDetail) => void;
}) {
  const editing = useComponentEditing(subject, host, onSaved);
  const side = <div className="parallax-side-group parallax-flush"><ComponentSymbolChooser editing={editing} /></div>;
  const stage = <>
    <div data-parallax-part="stage-toolbar" className="parallax-stage-toolbar">
      <span className="parallax-title">{editing.title}</span><span className="parallax-technical">{provenanceOf(editing)}</span>
    </div>
    <div data-parallax-part="stage-body" className="parallax-stage-body parallax-component-editor-body">
      <ComponentSourcePanel editing={editing} minHeight={560} />
      <ComponentNotes editing={editing} />
    </div>
    <div data-parallax-part="stage-foot" className="parallax-stage-foot"><ComponentStatus editing={editing} /></div>
  </>;
  const inspector = <>
    <div data-parallax-part="panel-head" className="parallax-panel-head">
      <div data-parallax-part="inspector-title" className="parallax-inspector-title"><h2>{editing.slug ?? editing.title}</h2>
        <span className="parallax-technical">component{editing.detail ? ` · r${editing.detail.definitionRevision}` : " · not saved yet"}</span></div>
    </div>
    <div data-parallax-part="inspector-group" className="parallax-inspector-group"><ComponentDrawingPanel editing={editing} /></div>
    <div data-parallax-part="inspector-group" className="parallax-inspector-group parallax-component-editor-actions"><ComponentActions editing={editing} /></div>
  </>;
  return <BenchGrid storageKey="component-editor" sideLabel="Symbols" side={side} stage={stage} inspectorLabel="How it is drawn" inspectorClassName="parallax-inspector" inspector={inspector} />;
}

/** The symbols to draw a component with, searched by name, each as its picture. */
function SymbolChooser({ symbols, chosen, disabled, onChoose }: {
  symbols: readonly SymbolView[]; chosen: string | null; disabled: boolean; onChoose: (symbol: SymbolView) => void;
}) {
  const [search, setSearch] = useState("");
  const wanted = search.trim().toLowerCase();
  const shown = symbols.filter((symbol) => `${symbol.title} ${symbol.slug}`.toLowerCase().includes(wanted)).slice(0, 48);
  return (
    <div className="parallax-component-workbench-symbols">
      <h3>Symbol</h3>
      <input data-parallax-part="input" className="parallax-input parallax-small" type="search" placeholder="Find a symbol" aria-label="Find a symbol"
        value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="parallax-component-workbench-symbol-grid" role="listbox" aria-label="Symbols">
        {shown.map((symbol) => {
          const drawing = readSymbolDrawing(symbol.drawing);
          return (
            <button key={symbol.slug} type="button" role="option" aria-selected={symbol.slug === chosen} disabled={disabled}
              title={`${symbol.title} · ${symbol.slug}`} onClick={() => onChoose(symbol)}>
              {drawing ? <SymbolPicture drawing={drawing} margin={4} /> : null}
              <span>{symbol.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A component's pins as its text writes them: the first word of each `pins` line, and what it says of the pin. */
function pinsOf(form: DocumentForm | null): ComponentPin[] {
  const statement = form?.statements.find((candidate) => candidate.word === "pins");
  return (statement?.lines ?? []).map((line) => {
    const text = line.fields.map((field) => field.value).join(" ").trim();
    return { name: text.split(/\s+/)[0] ?? "", description: text.match(/"([^"]*)"/)?.[1] ?? "" };
  }).filter((pin) => pin.name);
}

/** The symbol the text draws the component with and its ports' pins; null when it draws a box. */
function bindingOf(form: DocumentForm | null): SymbolBinding | null {
  const statement = form?.statements.find((candidate) => candidate.word === "symbol");
  const uses = statement?.header.find((field) => field.schema.name === "uses")?.value?.trim();
  if (!statement || !uses) {
    return null;
  }
  return {
    symbol: uses.split(/[\s,]+/)[0],
    ports: statement.lines.map((line) => ({
      port: line.fields.find((field) => field.schema.name === "port")?.value ?? "",
      pin: line.fields.find((field) => field.schema.name === "pin")?.value ?? "",
    })).filter((entry) => entry.port),
  };
}

function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "component";
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

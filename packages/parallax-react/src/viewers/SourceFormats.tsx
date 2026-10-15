import { useEffect, useRef, useState } from "react";
import { ApiProblem } from "@jmouse/parallax";
import { planSpiceMerge } from "@jmouse/parallax/document";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { Segments, Tool } from "../controls/BenchControls";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { CodeSourceEditor } from "./CodeSourceEditor";

/** How long the text rests before its SPICE is written again: a netlist per keystroke is a request per keystroke. */
const EXPORT_PAUSE_MILLISECONDS = 400;

/**
 * One document in both its notations: jMX, which is the truth and is what is saved, and SPICE, written from it on the
 * server and highlighted as SPICE — with what SPICE cannot say named under it. The SPICE side may be edited too: an edit
 * is read back on the server and MERGED into the jMX as edits of it (`planSpiceMerge`) — values into the lines they came
 * from, the drawing, probes, ranges and ids untouched; a part added or taken away rewrites it whole, says so, and can be
 * undone. Neither notation is kept beside the other, so they never disagree.
 */
export function SourceFormats({ id, value, onChange, error, focusLine, minHeight = 420, readOnly = false }: {
  id: string;
  /** The jMX text. */
  value: string;
  onChange?: (source: string) => void;
  /** A problem with the jMX — the reader's refusal, a run that failed —, shown under it. The SPICE side asks the server itself. */
  error?: string;
  focusLine?: number | null;
  minHeight?: number;
  readOnly?: boolean;
}) {
  const transport = useParallaxTransport();
  const [format, setFormat] = useState<"jmx" | "spice">("jmx");
  const [spice, setSpice] = useState<{ written: string; notes: string[]; for: string } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  /** What the last apply did: the changes it carried, what it could not carry, the text before it (to undo). */
  const [applied, setApplied] = useState<{ changes: string[]; notes: string[]; structural: string[]; before: string } | null>(null);
  const request = useRef(0);

  // The SPICE of the jMX as it stands, written while the SPICE side is open and the text has rested.
  useEffect(() => {
    if (format !== "spice" || spice?.for === value) {
      return;
    }
    const asked = ++request.current;
    const timer = window.setTimeout(() => {
      transport.documents.spiceExport(value).then((written) => {
        if (asked === request.current) {
          setSpice({ written: written.text, notes: written.notes, for: value });
          setDraft(null);
          setProblem(null);
        }
      }).catch((failure) => {
        if (asked === request.current) {
          setProblem(failure instanceof ApiProblem ? failure.detail : "This text could not be written as SPICE.");
        }
      });
    }, EXPORT_PAUSE_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [format, value, spice?.for, transport]);

  const edited = draft !== null && draft !== spice?.written;
  const apply = async () => {
    if (draft === null) {
      return;
    }
    setApplying(true);
    try {
      const before = value;
      const imported = await transport.documents.spiceImport(draft, null);
      const [original, readBack] = await Promise.all([transport.documents.form(before), transport.documents.form(imported.source)]);
      const plan = planSpiceMerge(original.form, readBack.form);
      let merged = before;
      if (plan.structural.length) {
        // A part added or taken away is a new drawing, which SPICE does not have: written whole, and said so.
        merged = imported.source;
      } else {
        for (const change of plan.edits) {
          merged = (await transport.documents.edit(merged, change)).source;
        }
      }
      // What the import could not read is said whether or not the edits carry the rest: a part of SPICE nobody saw land
      // was dropped without a word.
      setApplied({ changes: plan.changes, notes: imported.notes, structural: plan.structural, before });
      setDraft(null);
      onChange?.(merged);
      setFormat("jmx");
    } catch (failure) {
      setProblem(failure instanceof ApiProblem ? failure.detail : "The SPICE could not be read back.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div data-parallax-part="source-formats" className="parallax-source-formats">
      <div className="parallax-source-formats-head">
        <Segments label="Notation" value={format} onChange={setFormat}
          options={[{ value: "jmx", label: "jMX", title: "The document itself — what is saved" },
            { value: "spice", label: "SPICE", title: "The same circuit as a SPICE netlist, written from the jMX" }]} />
        <span className="parallax-hint">
          {format === "jmx" ? "jMX is the document; SPICE is written from it." : edited ? "Edited — apply to rewrite the jMX from this SPICE." : "Written from the jMX; edit it and apply to read it back."}
        </span>
        {format === "spice" && edited && !readOnly ? (
          <Tool tone="primary" busy={applying} onClick={() => void apply()} title="Read this SPICE back into jMX: what does not convert is named">
            <ParallaxIcon name="upload" />Apply to jMX
          </Tool>
        ) : null}
        {format === "spice" && edited ? <Tool onClick={() => setDraft(null)}>Discard</Tool> : null}
      </div>
      {format === "jmx" ? (
        <CodeSourceEditor id={id} label="jMX text" language="jMX" value={value} onChange={onChange} minHeight={minHeight} readOnly={readOnly}
          error={error} focusLine={focusLine} bare />
      ) : problem && !spice ? (
        <p className="parallax-hint parallax-source-formats-blocked" role="alert">{problem}</p>
      ) : (
        <CodeSourceEditor id={`${id}-spice`} label="SPICE netlist" language="SPICE" value={draft ?? spice?.written ?? ""} readOnly={readOnly}
          onChange={(text) => setDraft(text)} minHeight={minHeight} error={problem ?? undefined} bare />
      )}
      {format === "spice" && spice?.notes.length ? (
        <div className="parallax-source-formats-notes" role="note">
          <strong>What SPICE cannot say</strong>
          <ul>{spice.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      ) : null}
      {format === "jmx" && applied ? (
        <div className="parallax-source-formats-notes" role="note">
          <strong>{applied.structural.length ? "Written from SPICE whole — the drawing, the probes and the ranges are rebuilt"
            : applied.changes.length ? "Carried from SPICE into the jMX" : "SPICE said nothing new"}</strong>
          <ul>
            {applied.structural.map((reason) => <li key={reason}>{reason}</li>)}
            {applied.changes.map((change) => <li key={change} className="parallax-monospace">{change}</li>)}
            {applied.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
          {!readOnly ? <Tool onClick={() => { onChange?.(applied.before); setApplied(null); }}>Undo</Tool> : null}
        </div>
      ) : null}
    </div>
  );
}

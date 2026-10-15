import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import type { FormField } from "@jmouse/parallax";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { classNames } from "../support/classNames";
import type { ReferenceOption } from "@jmouse/parallax/document";
import { useReferenceOptions } from "./useReferences";

/**
 * One field of a jMX line, edited by the widget its type asks for — never by the kind of document it sits in. A typed
 * value is committed when the field is left or Enter is pressed; a choice is committed at once. The value is text, as
 * the line writes it: names and references separated by commas, flags by spaces.
 *
 * Drawn as a row of the template's property sheet (`.field-inline`: the name, then the control); a long text, a body
 * of code and a list of references take the full width (`.field`) instead.
 */
export function FieldWidget({ id, field, onCommit, error }: {
  id: string;
  field: FormField;
  onCommit: (value: string) => void;
  error?: string | null;
}) {
  const { schema } = field;
  const label = <label htmlFor={id} title={schema.label}>{schema.label}{schema.required ? <span className="parallax-screen-reader-only"> (required)</span> : null}</label>;
  const describedBy = error ? `${id}-error` : undefined;
  const problem = error ? <span className="parallax-error-text parallax-sheet-error" id={`${id}-error`}><ParallaxIcon name="error" />{error}</span> : null;
  switch (schema.type) {
    case "WORD":
      return <div className="parallax-field-inline">{label}
        <select id={id} data-parallax-part="input" className="parallax-input parallax-small" value={field.value} aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(event) => onCommit(event.target.value)}>
          {schema.required && field.value ? null : <option value="">—</option>}
          {schema.words.map((word) => <option key={word} value={word}>{word}</option>)}
        </select>{problem}</div>;
    case "FLAGS":
      return <Flags id={id} field={field} onCommit={onCommit} />;
    case "REFERENCE":
      return <Reference id={id} field={field} onCommit={onCommit} label={label} problem={problem} />;
    case "REFERENCES":
      return <References id={id} field={field} onCommit={onCommit} />;
    case "LONG_TEXT":
      return <TypedText id={id} field={field} onCommit={onCommit} label={label} problem={problem} multiline />;
    default:
      return <TypedText id={id} field={field} onCommit={onCommit} label={label} problem={problem}
        technical={schema.type !== "TEXT"} full={schema.type === "CODE"} />;
  }
}

/** A value typed in full: committed when the reader leaves the field or presses Enter, reverted with Escape. */
function TypedText({ id, field, onCommit, label, problem, multiline = false, technical = false, full = false }: {
  id: string; field: FormField; onCommit: (value: string) => void; label: ReactNode; problem: ReactNode;
  multiline?: boolean; technical?: boolean; full?: boolean;
}) {
  const [draft, setDraft] = useState(field.value);
  useEffect(() => setDraft(field.value), [field.value]);
  const commit = () => {
    if (draft !== field.value) {
      onCommit(draft);
    }
  };
  const keys = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !multiline) {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      setDraft(field.value);
    }
  };
  const invalid = problem ? true : undefined;
  if (multiline || full) {
    return <div data-parallax-part="field" className="parallax-field">{label}
      <textarea id={id} data-parallax-part="input" className={classNames("parallax-input", technical && "parallax-code")} rows={multiline ? 4 : 3} value={draft} aria-invalid={invalid}
        onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={keys} />
      {problem}</div>;
  }
  return <div className="parallax-field-inline">{label}
    <input id={id} data-parallax-part="input" className={classNames("parallax-input parallax-small", technical && "parallax-monospace")} value={draft} spellCheck={!technical} autoComplete="off" aria-invalid={invalid}
      onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={keys} />
    {problem}</div>;
}

/** Flags as filter chips (`.chip[aria-pressed]`): each one on or off, written back in the schema's order. */
function Flags({ id, field, onCommit }: { id: string; field: FormField; onCommit: (value: string) => void }) {
  const chosen = new Set(field.value.includes("per unit")
    ? [...field.value.replace("per unit", "").split(/\s+/).filter(Boolean), "per unit"]
    : field.value.split(/\s+/).filter(Boolean));
  const toggle = (word: string) => {
    const next = new Set(chosen);
    if (next.has(word)) {
      next.delete(word);
    } else {
      next.add(word);
    }
    onCommit(field.schema.words.filter((candidate) => next.has(candidate)).join(" "));
  };
  return <div className="parallax-field-inline" role="group" aria-labelledby={`${id}-label`} id={id}>
    <span id={`${id}-label`} className="parallax-sheet-label">{field.schema.label}</span>
    <div className="parallax-chips">{field.schema.words.map((word) => (
      <button key={word} type="button" className="parallax-chip" aria-pressed={chosen.has(word)} onClick={() => toggle(word)}>{word}</button>
    ))}</div>
  </div>;
}

/** One document named by its slug: a list of the documents of the allowed kinds, or the slug typed when there is none. */
function Reference({ id, field, onCommit, label, problem }: {
  id: string; field: FormField; onCommit: (value: string) => void; label: ReactNode; problem: ReactNode;
}) {
  const options = useReferenceOptions(field.schema.kinds);
  if (!options) {
    return <TypedText id={id} field={field} onCommit={onCommit} label={label} problem={problem} technical />;
  }
  const known = options.some((option) => option.value === field.value);
  return <div className="parallax-field-inline">{label}
    <select id={id} data-parallax-part="input" className="parallax-input parallax-small" value={field.value} onChange={(event) => onCommit(event.target.value)}>
      {field.value && !known ? <option value={field.value}>{field.value} (not found)</option> : null}
      {!field.value ? <option value="">—</option> : null}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>{problem}</div>;
}

/**
 * Several documents in order, the first the default — a component's symbols. Each can be made the default or taken
 * out, and another of the allowed kinds added.
 */
function References({ id, field, onCommit }: { id: string; field: FormField; onCommit: (value: string) => void }) {
  const options = useReferenceOptions(field.schema.kinds);
  const chosen = field.value.split(",").map((slug) => slug.trim()).filter(Boolean);
  const [adding, setAdding] = useState("");
  if (!options) {
    return <TypedText id={id} field={field} onCommit={onCommit} label={<label htmlFor={id}>{field.schema.label}</label>} problem={null} technical />;
  }
  const titleOf = (slug: string) => options.find((option) => option.value === slug)?.label ?? slug;
  const write = (slugs: readonly string[]) => onCommit(slugs.join(", "));
  const available: ReferenceOption[] = options.filter((option) => !chosen.includes(option.value));
  return <div data-parallax-part="field" className="parallax-field">
    <span className="parallax-field-label" id={`${id}-label`}>{field.schema.label}</span>
    <ol className="parallax-list parallax-dense" aria-labelledby={`${id}-label`}>
      {chosen.map((slug, position) => <li key={slug} className="parallax-list-item">
        <span className="parallax-ellipsis parallax-grow">{titleOf(slug)} <span className="parallax-technical">{slug}</span></span>
        {position === 0 ? <span className="parallax-badge parallax-accent">default</span>
          : <button type="button" data-parallax-part="button" className="parallax-button parallax-quiet parallax-small" onClick={() => write([slug, ...chosen.filter((other) => other !== slug)])}>Make default</button>}
        {chosen.length > 1 ? <button type="button" data-parallax-part="button" className="parallax-button parallax-quiet parallax-icon-only parallax-small" aria-label={`Remove ${slug}`}
          onClick={() => write(chosen.filter((other) => other !== slug))}><ParallaxIcon name="trash" /></button> : null}
      </li>)}
    </ol>
    {available.length ? <div className="parallax-input-group">
      <label className="parallax-screen-reader-only" htmlFor={id}>Add to {field.schema.label.toLowerCase()}</label>
      <select id={id} data-parallax-part="input" className="parallax-input parallax-small" value={adding} onChange={(event) => setAdding(event.target.value)}>
        <option value="">Add…</option>
        {available.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.value})</option>)}
      </select>
      <button type="button" data-parallax-part="button" className="parallax-button parallax-small" disabled={!adding} onClick={() => { write([...chosen, adding]); setAdding(""); }}>Add</button>
    </div> : null}
  </div>;
}

import type { DocumentForm, FormEdit, LineForm, StatementForm } from "../transport/wire";

/*
 * A SPICE edit brought back into the jMX it was written from, as edits of that jMX — never as a new document. SPICE
 * holds values and parts; the jMX holds those and also the drawing, the probes, the parameters' ranges and words, the
 * ids as the author wrote them. Read back whole, a changed value cost all of that: the circuit lost its layout, its
 * probes and its id, and G1 came back as VG1. So the read-back text is compared with the jMX, form against form, and
 * only what SPICE says differently is written — through the document editor, which keeps comments and order.
 */

export interface SpiceMergePlan {
  /** The edits that carry SPICE's changes into the jMX, in order. */
  edits: FormEdit[];
  /** What changed: one sentence each, for the reader. */
  changes: string[];
  /**
   * Why the edits cannot carry it — a part added or taken away changes the drawing, which SPICE does not have —; the
   * jMX is then written from SPICE whole, and this says what is lost. Empty when the edits carry everything.
   */
  structural: string[];
}

const fieldsOf = (line: LineForm): Record<string, string> =>
  Object.fromEntries(line.fields.map((field) => [field.schema.name, field.value]));

const statementOf = (form: DocumentForm, word: string): StatementForm | undefined =>
  form.statements.find((statement) => statement.word === word);

/** A value as SPICE and jMX both may write it — `160 Hz`, `1 kOhm`, `1e-6` — in SI; null when it is an expression. */
function siOf(text: string): number | null {
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([fpnuµμmkMGT]?)(?:Ohm|Ω|Hz|V|A|F|H|s|W)?\s*$/i.exec(text);
  if (!match) {
    return null;
  }
  const prefixes: Record<string, number> = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, "μ": 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };
  return Number(match[1]) * (match[2] ? prefixes[match[2]] ?? 1 : 1);
}

/** A new value written the way the old one was — its prefix and unit kept: 2200 into `1 kOhm` is `2.2 kOhm`. */
function writtenLike(old: string, value: number): string {
  const number = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(.*)$/.exec(old);
  const before = number ? Number(number[1]) : Number.NaN;
  const was = siOf(old);
  const scale = was !== null && before !== 0 && Number.isFinite(before) ? was / before : 1;
  const shown = Number((value / scale).toPrecision(6));
  const unit = number?.[2]?.trim() ?? "";
  return unit ? `${shown} ${unit}` : String(shown);
}

/** A part's id as SPICE spelled it, back to the jMX's: SPICE puts a part's letter first, so G1 went out as VG1. */
function originalId(spiceId: string, ids: readonly string[]): string | null {
  if (ids.includes(spiceId)) {
    return spiceId;
  }
  const stripped = spiceId.slice(1);
  return ids.includes(stripped) ? stripped : null;
}

const idOf = (partLine: string): string => partLine.trim().split(/\s+/)[0] ?? "";

/** What it takes to carry the read-back document's values into the original one. */
export function planSpiceMerge(original: DocumentForm, readBack: DocumentForm): SpiceMergePlan {
  const edits: FormEdit[] = [];
  const changes: string[] = [];
  const structural: string[] = [];

  // Parameters by name: a new value goes into the old line in the old unit, its range widened if it left it; one SPICE
  // added is added with what SPICE gave.
  const parameters = statementOf(original, "parameters");
  const parametersBack = statementOf(readBack, "parameters");
  if (parametersBack) {
    const byName = new Map((parameters?.lines ?? []).map((line) => [fieldsOf(line).name, line]));
    for (const line of parametersBack.lines) {
      const back = fieldsOf(line);
      const kept = byName.get(back.name);
      if (!kept) {
        if (parameters) {
          edits.push({ action: "ADD_LINE", statement: parameters.index, values: back });
          changes.push(`parameter ${back.name} added`);
        } else {
          structural.push(`the parameters block is new (${back.name})`);
        }
        continue;
      }
      const fields = fieldsOf(kept);
      const was = siOf(fields.value);
      const now = siOf(back.value);
      if (now === null || was === null || Math.abs(now - was) <= 1e-9 * Math.max(Math.abs(now), Math.abs(was))) {
        continue;
      }
      const values: Record<string, string> = { ...fields, value: writtenLike(fields.value, now) };
      const shown = Number(values.value.split(/\s+/)[0]);
      if (fields.minimum && Number(fields.minimum) > shown) {
        values.minimum = String(shown);
      }
      if (fields.maximum && Number(fields.maximum) < shown) {
        values.maximum = String(shown);
      }
      edits.push({ action: "SET_LINE", statement: parameters!.index, line: kept.index, values });
      changes.push(`${back.name}: ${fields.value} → ${values.value}`);
    }
  }

  // Parts by id: a changed line is written back under the jMX's own id; a part added or taken away is a new drawing.
  const parts = statementOf(original, "parts");
  const partsBack = statementOf(readBack, "parts");
  if (parts && partsBack) {
    const lines = parts.lines.map((line) => fieldsOf(line).line ?? "");
    const ids = lines.map(idOf);
    const matched = new Set<string>();
    for (const line of partsBack.lines) {
      const text = fieldsOf(line).line ?? "";
      const spiceId = idOf(text);
      const id = originalId(spiceId, ids);
      if (id === null) {
        structural.push(`part ${spiceId} is new`);
        continue;
      }
      matched.add(id);
      const index = ids.indexOf(id);
      const written = id + text.trim().slice(spiceId.length);
      if (written.replace(/\s+/g, " ") !== lines[index].trim().replace(/\s+/g, " ")) {
        edits.push({ action: "SET_LINE", statement: parts.index, line: parts.lines[index].index, values: { line: written } });
        changes.push(`${id}: ${written.slice(id.length).trim()}`);
      }
    }
    ids.filter((id) => !matched.has(id)).forEach((id) => structural.push(`part ${id} is gone`));
  }
  return { edits, changes, structural };
}

import { CodeSourceEditor } from "../viewers/CodeSourceEditor";
import { TextAreaField } from "../support/fields";

/** A program's text as it is being edited: its jMF formulas, its jMS program and its exact integer inputs. */
export interface ProgramText {
  formulas: string;
  program: string;
  /** One `name = decimal integer` per line. */
  integerInputsText: string;
}

/**
 * The text of the PROGRAM kind, edited: formulas in jMF, their processing in jMS, and the exact integers it reads.
 * Controlled; the host keeps the text with the program's identity and parameters, and saves it.
 */
export function ProgramSurface({ value, onChange, errors = {} }: {
  value: ProgramText;
  onChange: (next: ProgramText) => void;
  /** Why the program or its integer inputs were refused. */
  errors?: { program?: string; integerInputs?: string };
}) {
  return (
    <div className="parallax-stack">
      <CodeSourceEditor
        id="program-formulas"
        label="Formulas (jMF)"
        language="jMF"
        value={value.formulas}
        onChange={(formulas) => onChange({ ...value, formulas })}
      />
      <TextAreaField id="program-integer-inputs" label="Exact integer inputs" code rows={3}
        value={value.integerInputsText} error={errors.integerInputs}
        onChange={(event) => onChange({ ...value, integerInputsText: event.target.value })} />
      <p className="parallax-hint">One name = decimal integer per line. Stored as text without rounding, and available to jMS as a BigInteger. The computation API may override these names through integerValues.</p>
      <p className="parallax-hint">One definition per line, such as f(x) = x^2 - a. If a call supplies a BigInteger, the formula uses exact integer arithmetic for floor, division, mod and power.</p>
      <CodeSourceEditor
        id="program-source"
        label="Program (jMS, required)"
        language="jMS"
        minHeight={340}
        value={value.program}
        error={errors.program}
        onChange={(program) => onChange({ ...value, program })}
      />
      <p className="parallax-hint">
        The parameters are its variables. Return a number, a series, points, or a map of columns. Return {`{"bitmap": rows}`} for a discrete image: rows is a list of equally wide lists of 0/1 values. A whole literal beyond long range stays exact; append(list, value) adds to a list.
      </p>
    </div>
  );
}

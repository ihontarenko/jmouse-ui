import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { classNames } from "./classNames";

/* The fields the package draws its own forms with (settings, a program's text): `.field` holds a label, an `.input`, a `.hint` and an `.error-text` bound to the control. */

interface FieldFrame {
  label: ReactNode;
  /** Shown under the control and announced with it; the control is marked invalid. */
  error?: string | null;
  hint?: ReactNode;
  className?: string;
}

function describedBy(errorId: string, hintId: string, error?: string | null, hint?: ReactNode) {
  return [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
}

function FieldMessages({ controlId, error, hint }: { controlId: string; error?: string | null; hint?: ReactNode }) {
  return (
    <>
      {error ? (
        <span className="parallax-error-text" id={`${controlId}-error`}>
          {error}
        </span>
      ) : null}
      {hint ? (
        <span className="parallax-hint" id={`${controlId}-hint`}>
          {hint}
        </span>
      ) : null}
    </>
  );
}

type TextFieldProperties = FieldFrame & Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { ref?: Ref<HTMLInputElement>; inputClassName?: string };

export function TextField({ label, error, hint, className, inputClassName, id, ref, ...input }: TextFieldProperties) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <div data-parallax-part="field" className={classNames("parallax-field", className)}>
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={ref}
        id={inputId}
        data-parallax-part="input" className={classNames("parallax-input", inputClassName)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${inputId}-error`, `${inputId}-hint`, error, hint)}
        {...input}
      />
      <FieldMessages controlId={inputId} error={error} hint={hint} />
    </div>
  );
}

type TextAreaFieldProperties = FieldFrame & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { code?: boolean };

export function TextAreaField({ label, error, hint, className, code = false, id, ...textarea }: TextAreaFieldProperties) {
  const generated = useId();
  const textareaId = id || generated;
  return (
    <div data-parallax-part="field" className={classNames("parallax-field", className)}>
      <label htmlFor={textareaId}>{label}</label>
      <textarea
        id={textareaId}
        data-parallax-part="input" className={classNames("parallax-input", code && "parallax-code")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${textareaId}-error`, `${textareaId}-hint`, error, hint)}
        {...textarea}
      />
      <FieldMessages controlId={textareaId} error={error} hint={hint} />
    </div>
  );
}

type SelectFieldProperties = FieldFrame &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
    options: readonly { value: string; label: string }[];
    /** Label beside the control (`.field-inline`) rather than above it. */
    inline?: boolean;
    small?: boolean;
  };

export function SelectField({ label, error, hint, options, className, id, inline = false, small = false, ...select }: SelectFieldProperties) {
  const generated = useId();
  const selectId = id || generated;
  return (
    <div className={classNames(inline ? "parallax-field-inline" : "parallax-field", className)}>
      <label htmlFor={selectId}>{label}</label>
      <select
        id={selectId}
        data-parallax-part="input" className={classNames("parallax-input", small && "parallax-small")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${selectId}-error`, `${selectId}-hint`, error, hint)}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {inline ? null : <FieldMessages controlId={selectId} error={error} hint={hint} />}
    </div>
  );
}

interface ParameterFieldProperties {
  id?: string;
  label: ReactNode;
  /** The unit beside the name, as the template's `.parameter > label .unit`. */
  unit?: ReactNode;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  onChange: (value: number) => void;
  /** The min / max line under the track. */
  bounds?: boolean;
  disabled?: boolean;
  /**
   * How many units of `value` one shown unit is: a capacitance in farads shown in microfarads has a scale of 1e-6.
   * Value, bounds and step stay in the caller's units; only what the reader sees and drags is scaled.
   */
  scale?: number;
}

/** A slider with its name, unit and value — the template's `.parameter`, the bench's bread and butter. */
export function ParameterField({ id, label, unit, value, minimum, maximum, step, onChange, bounds = true, disabled, scale = 1 }: ParameterFieldProperties) {
  const generated = useId();
  const inputId = id || generated;
  const shown = (amount: number) => Number((amount / scale).toPrecision(12));
  const span = maximum - minimum;
  const fill = span > 0 ? ((value - minimum) / span) * 100 : 0;
  return (
    <div className="parallax-parameter">
      <label htmlFor={inputId}>
        <span className="parallax-symbol">{label}</span>
        {unit ? <span className="parallax-unit">{unit}</span> : null}
      </label>
      <output htmlFor={inputId}>{formatValue(shown(value))}</output>
      <input
        id={inputId}
        className="parallax-range"
        type="range"
        min={shown(minimum)}
        max={shown(maximum)}
        step={shown(step)}
        value={shown(value)}
        disabled={disabled}
        style={{ "--parallax-fill": `${Math.min(100, Math.max(0, fill))}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value) * scale)}
      />
      {bounds ? (
        <div className="parallax-limits">
          <span>{formatValue(shown(minimum))}</span>
          <span>{formatValue(shown(maximum))}</span>
        </div>
      ) : null}
    </div>
  );
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

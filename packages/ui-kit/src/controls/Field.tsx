import { createContext, useContext, useId, type AriaAttributes, type HTMLAttributes, type ReactNode } from "react"
import { Icon } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"

interface FieldWiring {
  controlId: string
  describedBy: string | undefined
  invalid: boolean
  required: boolean
}

const FieldContext = createContext<FieldWiring | null>(null)

/**
 * What a control inside a {@link Field} wears: its id (so the label points at it), what describes it (the hint and
 * the error), and its validity. A control outside a field gets nothing and keeps its own attributes.
 */
export function useFieldControl(own: { id?: string; "aria-describedby"?: string; "aria-invalid"?: AriaAttributes["aria-invalid"]; required?: boolean }) {
  const wiring = useContext(FieldContext)
  if (!wiring) {
    return own
  }
  const describedBy = [own["aria-describedby"], wiring.describedBy].filter(Boolean).join(" ") || undefined
  return {
    id: own.id ?? wiring.controlId,
    "aria-describedby": describedBy,
    "aria-invalid": own["aria-invalid"] ?? (wiring.invalid || undefined),
    required: own.required ?? (wiring.required || undefined),
  }
}

export interface FieldProperties extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: ReactNode
  /** Says what the value is for or what shape it takes; always visible, never a placeholder's job. */
  hint?: ReactNode
  /** The problem with the current value, in words. Its presence makes the control invalid. */
  error?: ReactNode
  /** Written next to the label as a word ("required"), never as a lone red star. */
  required?: boolean
  /** Written next to the label when most of a form is required and this one is not. */
  optional?: boolean
  /** Label beside the control instead of above it — a settings row, an inspector. */
  layout?: "stacked" | "inline"
  /** The control's id when the caller needs to know it; otherwise one is made. */
  controlId?: string
  requiredText?: string
  optionalText?: string
  /**
   * The control. A function receives what the control must wear — Innoventa's shape, `({ id, "aria-describedby" }) =>
   * <input … />` — for a control the kit does not draw; a kit control placed directly is wired through context.
   */
  children: ReactNode | ((controlProperties: { id: string; "aria-describedby": string | undefined }) => ReactNode)
  /** Spans both columns of a {@link FormGrid}. */
  wide?: boolean
}

/**
 * A label, a control, a hint and an error, wired together: the label names the control, the hint and the error
 * describe it, and an error marks it invalid. The control is any kit control placed as the child.
 */
export function Field({ label, hint, error, required = false, optional = false, layout = "stacked", controlId, requiredText = "required", optionalText = "optional", wide, className, children, ...rest }: FieldProperties) {
  const generated = useId()
  const id = controlId ?? `${generated}-control`
  const hintId = hint ? `${generated}-hint` : undefined
  const errorId = error ? `${generated}-error` : undefined
  const wiring: FieldWiring = {
    controlId: id,
    describedBy: [errorId, hintId].filter(Boolean).join(" ") || undefined,
    invalid: Boolean(error),
    required,
  }
  return (
    <div className={joinClassNames("kit-field", className)} data-layout={layout === "inline" ? "inline" : undefined} data-wide={wide ? "" : undefined} {...rest}>
      <label className="kit-field-label" htmlFor={id}>
        <span>{label}</span>
        {required && <span className="kit-field-requirement">{requiredText}</span>}
        {!required && optional && <span className="kit-field-requirement">{optionalText}</span>}
      </label>
      <FieldContext.Provider value={wiring}>{typeof children === "function" ? children({ id, "aria-describedby": wiring.describedBy }) : children}</FieldContext.Provider>
      {error && (
        <p className="kit-field-error" id={errorId}>
          <Icon name="danger" size="small" />
          {error}
        </p>
      )}
      {hint && <p className="kit-field-hint" id={hintId}>{hint}</p>}
    </div>
  )
}

/** Fields side by side that fold to one column when the room runs out. */
export function FieldRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClassNames("kit-field-row", className)} {...rest} />
}

/** The two-column grid fields live in. A form never chooses its own columns. */
export function FormGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={joinClassNames("kit-form-grid", className)}>{children}</div>
}

/** A titled band of fields inside a document, separated from the next by a rule, never by a card. */
export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="kit-form-section">
      <header className="kit-form-section-head">
        <h3>{title}</h3>
        {hint === undefined ? null : <p>{hint}</p>}
      </header>
      {children}
    </section>
  )
}

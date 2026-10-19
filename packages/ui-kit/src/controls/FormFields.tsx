import type { ReactNode } from "react"
import { joinClassNames } from "../lib/classNames"
import { DateRangeField, type DateRange } from "../data/Collections"
import { Checkbox, RadioGroup, Segmented, Stepper, Switch } from "./Choices"
import { Field } from "./Field"
import { Input, QuantityField, Select, TextArea } from "./Inputs"
import { ChipInput } from "./Labels"

/**
 * What a field is, as data: the one description the field builder edits, its preview draws and the live form fills.
 * One renderer serves all three (jMUI's `App.control(field)`), so a preview can never drift from what a respondent sees.
 *
 * ⚠️ The kit draws fields; it does not decide them. Whether a field is shown, what its options are, whether its value
 * is valid — conditions, option sources, virtual fields — are the product's form engine's. The engine hands the
 * outcome in (`hidden`, `options`, `errors`); nothing here evaluates an expression.
 */
export type FieldDefinition =
  | (FieldBase & { kind: "text"; technical?: boolean; placeholder?: string })
  | (FieldBase & { kind: "multiline"; rows?: number })
  | (FieldBase & { kind: "number"; unit?: string; minimum?: number; maximum?: number; step?: number })
  | (FieldBase & { kind: "stepper"; steps?: number[]; minimum?: number; maximum?: number; step?: number; unit?: string })
  | (FieldBase & { kind: "choice"; options: FieldChoice[]; presentation?: "select" | "segmented" | "radio" })
  | (FieldBase & { kind: "flag"; presentation?: "checkbox" | "switch"; text?: string })
  | (FieldBase & { kind: "date" })
  | (FieldBase & { kind: "date-range" })
  | (FieldBase & { kind: "list"; placeholder?: string })
  | (FieldBase & { kind: "custom"; render(value: unknown, change: (value: unknown) => void): ReactNode })

interface FieldBase {
  /** The value's key in the form's values. */
  name: string
  label: string
  hint?: string
  required?: boolean
  /** The engine decided the field is not shown now. */
  hidden?: boolean
  disabled?: boolean
  /** Spans the whole row of a two-column form. */
  wide?: boolean
}

/** One option of a choice field. Plain text: a form description is data, stored and sent, never markup. */
export interface FieldChoice {
  value: string
  label: string
  description?: string
}

export interface FormFieldsSection {
  title?: string
  description?: string
  fields: FieldDefinition[]
}

export type FormValues = Record<string, unknown>

export interface FormFieldsProperties {
  sections: FormFieldsSection[]
  values: FormValues
  onValuesChange(values: FormValues): void
  /** The engine's verdicts, by field name, in words. */
  errors?: Record<string, string | undefined>
  /** columns: two per row where there is room · stacked: one · inline: label beside the control (settings). */
  layout?: "columns" | "stacked" | "inline"
}

/** Draws one field from its description. Exported so a builder's preview of a single field uses the very same code. */
export function FieldFromDefinition({ field, value, onChange, error, layout = "stacked" }: { field: FieldDefinition; value: unknown; onChange(value: unknown): void; error?: string; layout?: "stacked" | "inline" }) {
  if (field.hidden) {
    return null
  }
  if (field.kind === "flag") {
    const Control = field.presentation === "switch" ? Switch : Checkbox
    return (
      <div className="kit-form-field" data-wide={field.wide ? "" : undefined}>
        <Control label={field.text ?? field.label} description={error ?? field.hint} checked={Boolean(value)} disabled={field.disabled} aria-invalid={error ? true : undefined} onChange={(event) => onChange(event.target.checked)} />
      </div>
    )
  }
  if (field.kind === "choice" && field.presentation === "radio") {
    return (
      <div className="kit-form-field" data-wide={field.wide ? "" : undefined}>
        <RadioGroup legend={field.label} options={field.options} value={String(value ?? "")} onValueChange={onChange} disabled={field.disabled} />
        {error && <p className="kit-field-error">{error}</p>}
      </div>
    )
  }
  return (
    <Field className="kit-form-field" data-wide={field.wide ? "" : undefined} label={field.label} hint={field.hint} error={error} required={field.required} layout={layout}>
      {controlFor(field, value, onChange)}
    </Field>
  )
}

function controlFor(field: FieldDefinition, value: unknown, onChange: (value: unknown) => void): ReactNode {
  switch (field.kind) {
    case "text":
      return <Input value={String(value ?? "")} technical={field.technical} placeholder={field.placeholder} disabled={field.disabled} onChange={(event) => onChange(event.target.value)} />
    case "multiline":
      return <TextArea value={String(value ?? "")} rows={field.rows} disabled={field.disabled} onChange={(event) => onChange(event.target.value)} />
    case "number":
      return field.unit ? (
        <QuantityField unit={field.unit} value={value === undefined || value === null ? "" : String(value)} min={field.minimum} max={field.maximum} step={field.step} disabled={field.disabled} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} />
      ) : (
        <Input type="number" technical value={value === undefined || value === null ? "" : String(value)} min={field.minimum} max={field.maximum} step={field.step} disabled={field.disabled} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} />
      )
    case "stepper":
      return <Stepper label={field.label} value={Number(value ?? field.minimum ?? 0)} onValueChange={onChange} steps={field.steps} step={field.step} minimum={field.minimum} maximum={field.maximum} format={(number) => (field.unit ? `${number} ${field.unit}` : String(number))} />
    case "choice":
      if (field.presentation === "segmented") {
        return <Segmented label={field.label} value={String(value ?? "")} onValueChange={onChange} options={field.options} />
      }
      return <Select value={String(value ?? "")} disabled={field.disabled} onChange={(event) => onChange(event.target.value)} options={[...(field.required ? [] : [{ value: "", label: "—" }]), ...field.options]} />
    case "date":
      return <Input type="date" technical value={String(value ?? "")} disabled={field.disabled} onChange={(event) => onChange(event.target.value)} />
    case "date-range":
      return <DateRangeField value={(value as DateRange | undefined) ?? { from: "", to: "" }} onValueChange={onChange} />
    case "list":
      return <ChipInput values={(value as string[] | undefined) ?? []} onValuesChange={onChange} placeholder={field.placeholder} />
    case "custom":
      return field.render(value, onChange)
    default:
      return null
  }
}

/**
 * A form drawn from its description: sections with a heading, fields two to a row where there is room (a wide field
 * takes the row), each with its label, hint and the engine's error. The form's own buttons stay the page's.
 */
export function FormFields({ sections, values, onValuesChange, errors = {}, layout = "columns" }: FormFieldsProperties) {
  return (
    <div className="kit-form" data-layout={layout}>
      {sections.map((section, index) => {
        const visible = section.fields.filter((field) => !field.hidden)
        if (visible.length === 0) {
          return null
        }
        return (
          <section key={section.title ?? index} className={joinClassNames("kit-form-section")}>
            {section.title && (
              <header className="kit-form-section-head">
                <h3>{section.title}</h3>
                {section.description && <p>{section.description}</p>}
              </header>
            )}
            <div className="kit-form-grid">
              {visible.map((field) => (
                <FieldFromDefinition
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  error={errors[field.name]}
                  layout={layout === "inline" ? "inline" : "stacked"}
                  onChange={(value) => onValuesChange({ ...values, [field.name]: value })}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

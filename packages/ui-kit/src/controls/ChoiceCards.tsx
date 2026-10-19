import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { joinClassNames } from "../lib/classNames"
import { useFieldControl } from "./Field"
import type { ButtonSize, ButtonVariant } from "./Button"

/*
 * Choices drawn as more than a box with words beside it — taken from Innoventa's `controls.tsx` and `FilePicker.tsx`
 * with the same names and properties. Every one keeps a REAL input (hidden where the label takes the paint), so the
 * keys, the checked state and the grouping a screen reader needs are the platform's own.
 */

interface ChoiceProperties extends Omit<ComponentPropsWithoutRef<"input">, "type"> {
  children?: ReactNode
}

/** A radio with its words beside it. A group of them is a {@link RadioGroup} when the options are data. */
export function Radio({ className, children, ...rest }: ChoiceProperties) {
  const wiring = useFieldControl(rest)
  const input = <input type="radio" className={joinClassNames("kit-check", children ? undefined : className)} {...rest} {...wiring} />
  if (!children) {
    return input
  }
  return (
    <label className={joinClassNames("kit-choice", className)}>
      {input}
      <span>{children}</span>
    </label>
  )
}

/**
 * One choice drawn as a bordered chip. Selected is a border, a ground AND a weight — never colour alone. Square, per
 * the geometry: a rounded chip would be the one pill in the interface.
 */
export function ChoiceChip({ kind, className, children, ...rest }: ChoiceProperties & { kind: "radio" | "checkbox" }) {
  return (
    <label className={joinClassNames("kit-choice-chip", className)}>
      <input type={kind} className="kit-visually-hidden" {...rest} />
      {children}
    </label>
  )
}

export interface RadioCardProperties extends Omit<ComponentPropsWithoutRef<"input">, "type"> {
  title: string
  hint?: string
}

/** One option of a choice that needs a sentence to explain it: a title and the hint under it, the radio beside. */
export function RadioCard({ title, hint, className, ...rest }: RadioCardProperties) {
  return (
    <label className={joinClassNames("kit-radio-card", className)}>
      <input type="radio" className="kit-check" {...rest} />
      <span className="kit-radio-card-text">
        <b>{title}</b>
        {hint === undefined ? null : <small>{hint}</small>}
      </span>
    </label>
  )
}

export type SwatchColours = readonly [string, string, string, string]

export interface SwatchOption<Value extends string> {
  value: Value
  /** The whole meaning of the swatch, as words — its accessible name and its tooltip. */
  description: string
  colours: SwatchColours
  /** Attributes the swatch wears so it previews itself — `data-theme`, a scope for its own variables. */
  preview?: Record<string, string>
}

export interface SwatchPickerProperties<Value extends string> {
  label: string
  value: Value
  options: readonly SwatchOption<Value>[]
  onChange(next: Value): void
  className?: string
}

/** A choice among palettes, each drawn as four quadrants of its colours; the words are its name, never the colours. */
export function SwatchPicker<Value extends string>({ label, value, options, onChange, className }: SwatchPickerProperties<Value>) {
  return (
    <span role="group" aria-label={label} className={joinClassNames("kit-swatch-picker", className)}>
      {options.map((option) => (
        <button key={option.value} type="button" className="kit-swatch" aria-pressed={value === option.value} title={option.description} onClick={() => onChange(option.value)} {...option.preview}>
          {option.colours.map((colour, quadrant) => (
            <i key={quadrant} aria-hidden="true" style={{ background: colour }} />
          ))}
          <span className="kit-visually-hidden">{option.description}</span>
        </button>
      ))}
    </span>
  )
}

export interface FilePickerProperties extends Pick<ComponentPropsWithoutRef<"label">, "title"> {
  children: ReactNode
  accept?: string
  /** On a phone: open the camera, facing the user or away. */
  capture?: "user" | "environment"
  multiple?: boolean
  disabled?: boolean
  /** The files picked. ⚠️ The input is cleared after every pick, so picking the same file again still reports it. */
  onPick(files: File[]): void
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  "aria-label"?: string
}

/** Choosing files, drawn as a button in every way a person can tell — the button's own variants and sizes. */
export function FilePicker({ children, accept, capture, multiple = false, disabled = false, onPick, variant, size, className, ...rest }: FilePickerProperties) {
  const kitVariant = variant === "accent" ? "primary" : variant === "ghost" ? "quiet" : variant === "danger" ? "soft" : variant
  return (
    <label
      className={joinClassNames("kit-button", className)}
      data-variant={kitVariant === "default" ? undefined : kitVariant}
      data-tone={variant === "danger" ? "danger" : undefined}
      data-size={size === "small" || size === "iconSmall" ? "small" : undefined}
      data-icon-only={size === "icon" || size === "iconSmall" ? "" : undefined}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {children}
      <input
        type="file"
        className="kit-visually-hidden"
        accept={accept}
        capture={capture}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? [])
          event.target.value = ""
          if (picked.length > 0) {
            onPick(picked)
          }
        }}
      />
    </label>
  )
}

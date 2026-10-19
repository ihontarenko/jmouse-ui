import { useEffect, useId, useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react"
import { Icon } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"
import { useFieldControl } from "./Field"

export interface CheckboxProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** The words beside the box. Without them the box needs an aria-label. */
  label?: ReactNode
  description?: ReactNode
  /** Some of the things it stands for are checked — a folder whose files are half selected. */
  indeterminate?: boolean
}

export function Checkbox({ label: labelGiven, description, indeterminate = false, className, children, ...rest }: CheckboxProperties) {
  // Innoventa passes the words as children; the kit as `label`. Both are taken.
  const label = labelGiven ?? children
  const reference = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (reference.current) {
      reference.current.indeterminate = indeterminate
    }
  }, [indeterminate])
  const wiring = useFieldControl(rest)
  const box = <input ref={reference} type="checkbox" className={joinClassNames("kit-check", label ? undefined : className)} {...rest} {...wiring} />
  if (!label) {
    return box
  }
  return (
    <label className={joinClassNames("kit-choice", className)}>
      {box}
      <span>
        {label}
        {description && <span className="kit-choice-description">{description}</span>}
      </span>
    </label>
  )
}

export interface SwitchProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> {
  label?: ReactNode
  description?: ReactNode
}

/** A setting that takes effect the moment it is flipped. A choice confirmed by a button is a {@link Checkbox}. */
export function Switch({ label: labelGiven, description, className, children, ...rest }: SwitchProperties) {
  const label = labelGiven ?? children
  const wiring = useFieldControl(rest)
  const control = <input type="checkbox" role="switch" className={joinClassNames("kit-switch", label ? undefined : className)} {...rest} {...wiring} />
  if (!label) {
    return control
  }
  return (
    <label className={joinClassNames("kit-choice", className)}>
      {control}
      <span>
        {label}
        {description && <span className="kit-choice-description">{description}</span>}
      </span>
    </label>
  )
}

export interface ChoiceOption<Value extends string = string> {
  value: Value
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export interface RadioGroupProperties<Value extends string> {
  legend: ReactNode
  options: ChoiceOption<Value>[]
  value: Value
  onValueChange(value: Value): void
  orientation?: "vertical" | "horizontal"
  name?: string
  disabled?: boolean
  className?: string
}

/** One choice among several, all visible with their explanations. A strip of short options is a {@link Segmented}. */
export function RadioGroup<Value extends string>({ legend, options, value, onValueChange, orientation = "vertical", name, disabled, className }: RadioGroupProperties<Value>) {
  const generated = useId()
  const groupName = name ?? generated
  return (
    <fieldset className={joinClassNames("kit-choice-group", className)} data-orientation={orientation} disabled={disabled}>
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="kit-choice">
          <input
            type="radio"
            className="kit-check"
            name={groupName}
            value={option.value}
            checked={option.value === value}
            disabled={option.disabled}
            onChange={() => onValueChange(option.value)}
          />
          <span>
            {option.label}
            {option.description && <span className="kit-choice-description">{option.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export interface SegmentedProperties<Value extends string> {
  /** What is being chosen — the strip's accessible name. */
  label: string
  options: Array<ChoiceOption<Value> & { swatch?: string }>
  value: Value
  onValueChange(value: Value): void
  size?: "regular" | "small"
  /** The chosen option filled with the accent rather than lifted onto the surface. */
  tone?: "accent"
  stretch?: boolean
  className?: string
}

/**
 * One choice among a few, shown as a strip: a radio group with arrow keys, one tab stop, and the choice taking effect
 * as it moves — the WAI-ARIA radio-group pattern drawn as segments.
 */
export function Segmented<Value extends string>({ label, options, value, onValueChange, size = "regular", tone, stretch, className }: SegmentedProperties<Value>) {
  const reference = useRef<HTMLDivElement>(null)
  const enabled = options.filter((option) => !option.disabled)

  function moveBy(step: number) {
    const index = enabled.findIndex((option) => option.value === value)
    const next = enabled[(index + step + enabled.length) % enabled.length]
    onValueChange(next.value)
    reference.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      moveBy(1)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      moveBy(-1)
    }
  }

  return (
    <div
      ref={reference}
      role="radiogroup"
      aria-label={label}
      className={joinClassNames("kit-segmented", className)}
      data-size={size === "regular" ? undefined : size}
      data-tone={tone}
      data-stretch={stretch ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={option.disabled}
            data-value={option.value}
            onClick={() => onValueChange(option.value)}
          >
            {option.swatch && <span className="kit-swatch-dot" style={{ ["--kit-swatch" as string]: option.swatch }} aria-hidden="true" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export interface StepperProperties {
  label: string
  value: number
  onValueChange(value: number): void
  /** Every value the stepper may land on, in order — 1·2·5 decades, a set of standard values. */
  steps?: number[]
  step?: number
  minimum?: number
  maximum?: number
  format?(value: number): ReactNode
  decreaseLabel?: string
  increaseLabel?: string
}

/** A value nudged a step at a time — by a fixed step, or along a list of the only values it may take. */
export function Stepper({ label, value, onValueChange, steps, step = 1, minimum = -Infinity, maximum = Infinity, format = String, decreaseLabel = "Decrease", increaseLabel = "Increase" }: StepperProperties) {
  function neighbour(direction: 1 | -1): number | undefined {
    if (steps) {
      // The first step at or above the value; past the last step the value sits beyond the list.
      const found = steps.findIndex((candidate) => candidate >= value)
      const index = found === -1 ? steps.length : found
      if (steps[index] === value) {
        return steps[index + direction]
      }
      return steps[direction > 0 ? index : index - 1]
    }
    const next = value + direction * step
    return next < minimum || next > maximum ? undefined : next
  }
  const lower = neighbour(-1)
  const higher = neighbour(1)
  return (
    <div className="kit-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={decreaseLabel} disabled={lower === undefined} onClick={() => lower !== undefined && onValueChange(lower)}>
        <Icon name="minus" size="small" />
      </button>
      <output aria-live="polite">{format(value)}</output>
      <button type="button" aria-label={increaseLabel} disabled={higher === undefined} onClick={() => higher !== undefined && onValueChange(higher)}>
        <Icon name="plus" size="small" />
      </button>
    </div>
  )
}

export interface RangeProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> {
  value: number
  onValueChange(value: number): void
  minimum: number
  maximum: number
}

/** A slider whose filled part shows where the value sits between its limits. */
export function Range({ value, onValueChange, minimum, maximum, className, style, ...rest }: RangeProperties) {
  const fill = maximum === minimum ? 0 : ((value - minimum) / (maximum - minimum)) * 100
  const wiring = useFieldControl(rest)
  return (
    <input
      type="range"
      className={joinClassNames("kit-range", className)}
      min={minimum}
      max={maximum}
      value={value}
      onChange={(event) => onValueChange(Number(event.target.value))}
      style={{ ...style, ["--kit-fill" as string]: `${fill}%` }}
      {...rest}
      {...wiring}
    />
  )
}

export interface ParameterProperties extends Omit<RangeProperties, "id"> {
  /** The parameter's name or symbol. */
  label: ReactNode
  unit?: ReactNode
  format?(value: number): ReactNode
  /** Print the limits under the slider. */
  showLimits?: boolean
}

/** A slider with its name, unit, current value and limits — the workbench's bread and butter. */
export function Parameter({ label, unit, format = String, showLimits, ...rangeProperties }: ParameterProperties) {
  const id = useId()
  return (
    <div className="kit-parameter">
      <label htmlFor={id}>
        <span>{label}</span>
        {unit && <span className="kit-parameter-unit">{unit}</span>}
      </label>
      <output htmlFor={id}>{format(rangeProperties.value)}</output>
      <Range id={id} {...rangeProperties} />
      {showLimits && (
        <span className="kit-parameter-limits" aria-hidden="true">
          <span>{format(rangeProperties.minimum)}</span>
          <span>{format(rangeProperties.maximum)}</span>
        </span>
      )}
    </div>
  )
}

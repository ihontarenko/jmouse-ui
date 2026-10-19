import { useRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react"
import { Icon } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"
import { IconButton } from "./Button"
import { useFieldControl } from "./Field"

export interface InputProperties extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "regular" | "small"
  /** Set in the data face with tabular figures — an identifier, a value with a unit, a path. */
  technical?: boolean
  ref?: Ref<HTMLInputElement>
}

export function Input({ size = "regular", technical, className, ...rest }: InputProperties) {
  const wiring = useFieldControl(rest)
  return (
    <input
      className={joinClassNames("kit-input", className)}
      data-size={size === "regular" ? undefined : size}
      data-technical={technical ? "" : undefined}
      {...rest}
      {...wiring}
    />
  )
}

export interface TextAreaProperties extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  technical?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

export function TextArea({ technical, className, ...rest }: TextAreaProperties) {
  const wiring = useFieldControl(rest)
  return <textarea className={joinClassNames("kit-input", className)} data-technical={technical ? "" : undefined} {...rest} {...wiring} />
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProperties extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options?: SelectOption[]
  size?: "regular" | "small"
  ref?: Ref<HTMLSelectElement>
}

/** The native select, drawn in the kit's chrome: its list is the platform's, which is what keyboards and phones expect. */
export function Select({ options, size = "regular", className, children, ...rest }: SelectProperties) {
  const wiring = useFieldControl(rest)
  return (
    <select className={joinClassNames("kit-input", className)} data-size={size === "regular" ? undefined : size} {...rest} {...wiring}>
      {options?.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
      ))}
      {children}
    </select>
  )
}

/** A control with addons that share its border: a unit after a number, a prefix before an address, a button. */
export function InputGroup({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClassNames("kit-input-group", className)} {...rest} />
}

/** A fixed piece of text inside an {@link InputGroup}. */
export function Addon({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={joinClassNames("kit-addon", className)} {...rest} />
}

export interface QuantityFieldProperties extends Omit<InputProperties, "technical"> {
  /** The engineering unit: Ω, µF, V, ms. */
  unit: ReactNode
}

/** A number with its unit, right-aligned in the data face. */
export function QuantityField({ unit, ...rest }: QuantityFieldProperties) {
  return (
    <div className="kit-input-group" data-quantity="">
      <Input inputMode="decimal" technical {...rest} />
      <span className="kit-addon">{unit}</span>
    </div>
  )
}

export interface SearchFieldProperties extends Omit<InputProperties, "type" | "onChange"> {
  value: string
  onValueChange(value: string): void
  /** A shortcut that focuses the field from anywhere, printed at its end while it is empty. */
  shortcut?: string
  /** The accessible name when no visible label names the field. */
  label?: string
  clearLabel?: string
}

/** A search box: an icon inside, a printed shortcut while empty, a clear button once there is something to clear. */
export function SearchField({ value, onValueChange, shortcut, label, clearLabel = "Clear search", className, ...rest }: SearchFieldProperties) {
  const inputReference = useRef<HTMLInputElement>(null)
  return (
    <div className={joinClassNames("kit-search", className)}>
      <Icon name="search" />
      <Input
        ref={inputReference}
        type="search"
        value={value}
        aria-label={label}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.stopPropagation()
            onValueChange("")
          }
        }}
        {...rest}
      />
      {value ? (
        <IconButton
          className="kit-search-clear"
          icon="close"
          size="small"
          label={clearLabel}
          onClick={() => {
            onValueChange("")
            inputReference.current?.focus()
          }}
        />
      ) : (
        shortcut && <kbd>{shortcut}</kbd>
      )}
    </div>
  )
}

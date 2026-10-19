import type { FormEvent, HTMLAttributes, ReactNode } from "react"
import { Icon, type IconSource } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"

export interface ToolbarProperties extends Omit<HTMLAttributes<HTMLElement>, "onSubmit"> {
  /** What the toolbar acts on, for assistive technology. */
  label?: string
  /** Controls pressed together, for a tool window's head or an editor's top. */
  dense?: boolean
  /**
   * Innoventa's toolbar is a FORM, so Enter in its search never reloads the page; given (or when there is no label, the
   * Innoventa shape), the toolbar renders as one, and a submit without a handler is simply held.
   */
  onSubmit?(event: FormEvent<HTMLFormElement>): void
}

/** A row of controls over the thing they act on. Push the rest to the end with {@link ToolbarPush}. */
export function Toolbar({ label, dense, onSubmit, className, ...rest }: ToolbarProperties) {
  const classes = joinClassNames("kit-toolbar", className)
  if (onSubmit || label === undefined) {
    return <form className={classes} data-dense={dense ? "" : undefined} aria-label={label} onSubmit={onSubmit ?? ((event) => event.preventDefault())} {...rest} />
  }
  return <div role="group" aria-label={label} className={classes} data-dense={dense ? "" : undefined} {...rest} />
}

export function ToolbarSeparator() {
  return <span className="kit-toolbar-separator" role="separator" aria-orientation="vertical" />
}

/** Everything after it sits at the toolbar's end. */
export function ToolbarPush() {
  return <span className="kit-toolbar-push" aria-hidden="true" />
}

/** Innoventa's name for {@link ToolbarPush}. */
export const ToolbarSpacer = ToolbarPush

export interface SearchInlineProperties {
  value: string
  onValueChange(value: string): void
  label: string
  placeholder?: string
  className?: string
  clearLabel?: string
}

/**
 * The search a listing's toolbar carries: the field draws the chrome, and it clears ITSELF — so a search and a filter
 * never grow two "Clear" buttons side by side. The browser's own ✕ is suppressed: it exists in one browser and not
 * another.
 */
export function SearchInline({ value, onValueChange, label, placeholder, className, clearLabel = `Clear ${label.toLowerCase()}` }: SearchInlineProperties) {
  return (
    <div className={joinClassNames("kit-search-inline", className)}>
      <Icon name="search" />
      <input type="search" value={value} onChange={(event) => onValueChange(event.target.value)} aria-label={label} placeholder={placeholder} autoComplete="off" />
      {value === "" ? null : (
        <button type="button" onClick={() => onValueChange("")} aria-label={clearLabel}>
          <Icon name="close" size="small" />
        </button>
      )}
    </div>
  )
}

/** A filter that is on, as a removable chip in the toolbar. */
export function FilterChip({ children, onRemove, removeLabel = "Remove filter" }: { children: ReactNode; onRemove(): void; removeLabel?: string }) {
  return (
    <span className="kit-filter-chip">
      {children}
      <button type="button" onClick={onRemove} aria-label={removeLabel}>
        <Icon name="close" size="small" />
      </button>
    </span>
  )
}

export interface SegmentedControlProperties<Value extends string> {
  label: string
  value: Value
  options: Array<{ value: Value; label: string; icon?: IconSource }>
  onChange(value: Value): void
}

/**
 * Innoventa's view switch — table or tiles, a period — as pressed buttons sharing one border. A choice that is part of
 * a form, with arrow keys between its options, is the kit's {@link Segmented}.
 */
export function SegmentedControl<Value extends string>({ label, value, options, onChange }: SegmentedControlProperties<Value>) {
  return (
    <span role="group" aria-label={label} className="kit-segmented-control">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} title={option.label} onClick={() => onChange(option.value)}>
          {option.icon && <Icon name={option.icon} size="small" />}
          {option.label}
        </button>
      ))}
    </span>
  )
}

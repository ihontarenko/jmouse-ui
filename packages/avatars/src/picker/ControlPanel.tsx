import { ChevronDown } from "lucide-react"
import { cn } from "@jmouse/ui"

import { flagOf, numberOf, textOf } from "../strategies/read"
import type { AvatarParameters, Control, RangeControl, SelectControl, TextControl, ToggleControl } from "../strategies/types"

/**
 * The controls for whichever strategy is selected.
 *
 * ⚠️ **Nothing here knows what a hairstyle is.** It walks the strategy's own `controls` declaration and
 * renders four widget shapes. That is the single design decision worth protecting in this package: a
 * ninth strategy is one file in `src/strategies/`, and this panel grows its controls for free.
 *
 * ⚠️ **Toggles are pulled out and drawn as chips, rather than left in the grid.** A boolean in a
 * labelled field-shaped box is a field-sized hole for one bit, and a strategy with three of them spent
 * half the panel saying almost nothing. As a row of chips they read at a glance, wrap on their own, and
 * leave the grid to the controls that actually carry a value.
 */

export interface ControlPanelProperties {
  controls: readonly Control[]
  parameters: AvatarParameters
  onChange: (key: string, value: string | number | boolean) => void
  className?: string
}

export function ControlPanel({ controls, parameters, onChange, className }: ControlPanelProperties) {
  if (controls.length === 0) {
    return null
  }

  const toggles = controls.filter((control): control is ToggleControl => control.kind === "toggle")
  const fields = controls.filter((control) => control.kind !== "toggle")

  return (
    <div className={cn("space-y-2.5", className)}>
      {fields.length > 0 && (
        // ⚠️ One column until there is room for two. The dialog is full-width on a phone, and a
        // two-column grid there gives every select about eleven characters of usable space.
        <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
          {fields.map((control) => (
            <Field key={control.key} control={control} parameters={parameters} onChange={onChange} />
          ))}
        </div>
      )}

      {toggles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {toggles.map((control) => (
            <ToggleChip key={control.key} control={control} parameters={parameters} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  )
}

interface FieldProperties {
  control: Exclude<Control, ToggleControl>
  parameters: AvatarParameters
  onChange: (key: string, value: string | number | boolean) => void
}

function Field({ control, parameters, onChange }: FieldProperties) {
  const identifier = `avatar-control-${control.key}`

  if (control.kind === "range") {
    return <RangeField identifier={identifier} control={control} parameters={parameters} onChange={onChange} />
  }

  if (control.kind === "text") {
    return <TextField identifier={identifier} control={control} parameters={parameters} onChange={onChange} />
  }

  return <SelectField identifier={identifier} control={control} parameters={parameters} onChange={onChange} />
}

/** The one label treatment every field shares: small, quiet, and never competing with the value. */
function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block truncate text-[11px] leading-none font-medium text-muted-foreground">
      {children}
    </label>
  )
}

const FIELD_SHELL =
  "h-8 w-full rounded-md border border-transparent bg-muted/60 px-2 text-xs text-foreground transition " +
  "hover:bg-muted focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] " +
  "focus-visible:ring-ring/40 focus-visible:outline-none"

function SelectField({
  identifier,
  control,
  parameters,
  onChange,
}: FieldProperties & { identifier: string; control: SelectControl }) {
  const value = textOf(parameters, control.key, control.fallback)

  return (
    <div className="min-w-0 space-y-1">
      <FieldLabel htmlFor={identifier}>{control.label}</FieldLabel>

      {/*
        ⚠️ A native select, not the Radix one. This panel lives inside a dialog, and a portalled listbox
        over a modal is the pairing that has already cost this workspace real time. `appearance-none`
        plus our own chevron is what stops it looking native while still behaving native.
      */}
      <div className="relative">
        <select
          id={identifier}
          className={cn(FIELD_SHELL, "cursor-pointer appearance-none pr-7 capitalize")}
          value={value}
          onChange={(event) => onChange(control.key, event.target.value)}
        >
          {control.options.map((option) => (
            <option key={option} value={option} className="capitalize">
              {option}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  )
}

function TextField({
  identifier,
  control,
  parameters,
  onChange,
}: FieldProperties & { identifier: string; control: TextControl }) {
  const value = textOf(parameters, control.key, control.fallback)

  return (
    <div className="min-w-0 space-y-1">
      <FieldLabel htmlFor={identifier}>{control.label}</FieldLabel>
      <input
        id={identifier}
        type="text"
        className={FIELD_SHELL}
        value={value}
        onChange={(event) => onChange(control.key, event.target.value)}
      />
    </div>
  )
}

function RangeField({
  identifier,
  control,
  parameters,
  onChange,
}: FieldProperties & { identifier: string; control: RangeControl }) {
  const value = numberOf(parameters, control.key, control.fallback)

  // How far along the track the thumb sits, so the filled part can be painted behind it.
  const travelled = ((value - control.minimum) / (control.maximum - control.minimum)) * 100

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel htmlFor={identifier}>{control.label}</FieldLabel>
        <span className="text-[11px] leading-none font-semibold tabular-nums text-foreground">{value}</span>
      </div>

      {/*
        ⚠️ A native range, styled, rather than a component. `@jmouse/ui` has no Slider yet and inventing
        one here would put the twelfth shared control in the wrong package — this swaps to a real Slider
        in one line the day there is one. The filled track is a gradient rather than a second element,
        because a range input has no child to paint.
      */}
      <input
        id={identifier}
        type="range"
        className={cn(
          "h-1.5 w-full cursor-pointer appearance-none rounded-full",
          "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
          "[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
          "[&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-transform",
          "[&::-webkit-slider-thumb]:hover:scale-110",
          "[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:border-0",
          "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary",
        )}
        style={{
          background: `linear-gradient(to right, var(--primary) ${travelled}%, var(--muted) ${travelled}%)`,
        }}
        min={control.minimum}
        max={control.maximum}
        step={control.step}
        value={value}
        onChange={(event) => onChange(control.key, Number(event.target.value))}
      />
    </div>
  )
}

function ToggleChip({
  control,
  parameters,
  onChange,
}: {
  control: ToggleControl
  parameters: AvatarParameters
  onChange: (key: string, value: boolean) => void
}) {
  const checked = flagOf(parameters, control.key, control.fallback)

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(control.key, !checked)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        checked
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/40",
        )}
      />
      {control.label}
    </button>
  )
}

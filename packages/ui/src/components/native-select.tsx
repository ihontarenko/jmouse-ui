import * as React from "react"

import { cn } from "../lib/helpers"

/**
 * A `<select>` that is genuinely native, wearing the toolkit's field.
 *
 * ## ⚠️ Why a native listbox at all, next to `Select`
 *
 * `Select` (Radix) is the right control for anything that needs a search box, an icon per row or a
 * grouped panel. A native one is the right control everywhere else, and there are two reasons a product
 * keeps reaching for it: it opens **above a dialog** without a portal, and on a phone it is the
 * platform's own wheel rather than a list somebody re-implemented. Neither is a thing to talk a caller
 * out of, so the toolkit ships both.
 *
 * ## ⚠️ THE OPTION LIST IS PAINTED FROM THIS ELEMENT'S OWN `background-color`
 *
 * That is the whole reason this file exists rather than a class string copied per call site. Chromium
 * draws the dropdown from the select's computed background — **not** from the page's, and **not** from
 * `color-scheme`, which the base layer already sets and which cannot override an author colour. Give a
 * select the field look everything else here wears — `bg-transparent`, the way {@link Input} does — and
 * the popup drops back to white while its options inherit the theme's light `--foreground`. On every
 * dark theme that is white text on a white sheet, and there is nothing in the rendered page to show for
 * it: the trigger looks perfect and only the open list is unreadable, so it survives every screenshot.
 *
 * So the surface here is opaque and named. `styles.css` names the option rows as well, for the selects a
 * product hand-rolled before this existed.
 *
 * ## ⚠️ The platform arrow stays
 *
 * `appearance-none` plus a drawn chevron is the usual trick, and it costs a wrapper element — which
 * changes how every call site lays out, for an arrow the browser already paints in the right colour the
 * moment `color-scheme` is set. This is a drop-in replacement for a bare `<select>`: same element, same
 * `className`, same box.
 */
const SIZES = {
  default: "h-[34px] text-[12.5px]",
  sm: "h-[30px] text-[12.5px]",
} as const

function NativeSelect({
  className,
  size = "default",
  children,
  ...properties
}: Omit<React.ComponentProps<"select">, "size"> & {
  /** Match whatever the controls beside it use — `sm` for a dense row, `default` otherwise. */
  size?: keyof typeof SIZES
}) {
  return (
    <select
      data-slot="native-select"
      data-size={size}
      className={cn(
        "min-w-0 cursor-pointer rounded-md border border-input bg-background px-2 text-foreground shadow-xs transition-[color,box-shadow] outline-none",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        SIZES[size],
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...properties}
    >
      {children}
    </select>
  )
}

export { NativeSelect }

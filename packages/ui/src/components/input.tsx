import * as React from "react"

import { cn } from "../lib/helpers"

/**
 * A single-line field, at one of the toolkit's two control heights.
 *
 * ## ⚠️ `size` exists so nothing has to guess `h-8`
 *
 * `Button` and `SelectTrigger` have always had `default` (34px) and `sm` (30px), and this did not — so
 * every dense row that wanted a shorter field wrote its own `className="h-8 text-sm"`. Thirty-two
 * pixels is neither of the two real heights and `text-sm` is neither of the two real sizes, which is why
 * a header holding a field, a chip and a button read as three controls from three different toolkits.
 *
 * The knob missing here is what made that inevitable, so it is here rather than in a rule nobody can
 * enforce: put a field beside a button, give both the same `size`, and they line up.
 */
const SIZES = {
  default: "h-[34px] text-[12.5px]",
  sm: "h-[30px] text-[12.5px]",
} as const

function Input({
  className,
  type,
  size = "default",
  ...properties
}: Omit<React.ComponentProps<"input">, "size"> & {
  /** Match whatever the controls beside it use — `sm` for a dense row, `default` otherwise. */
  size?: keyof typeof SIZES
}) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-[12.5px] file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        SIZES[size],
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...properties}
    />
  )
}

export { Input }

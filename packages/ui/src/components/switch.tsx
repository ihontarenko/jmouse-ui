import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "../lib/helpers"

/**
 * A two-state control.
 *
 * <h2>⚠️ It used to be the only control in this library that shouted</h2>
 *
 * <p>Everything else here is bordered and quiet — `Input` is `border-input` over `bg-transparent`,
 * `Button variant="outline"` is a border over the background, and a product's own chips follow them.
 * The switch was `border-transparent` over a solid `bg-primary`, which made it the single most
 * saturated object on any screen it appeared on: a settings page of soft outlined rows with one green
 * slab in the middle of it, drawing the eye to whichever preference happened to be on.
 *
 * <p>So the ON state is now **a primary tint inside a primary border, with a primary thumb** rather
 * than white-on-solid-primary. It still reads unambiguously — the colour, the border and the thumb's
 * position all say the same thing three times — it just says it at the volume the rest of the library
 * speaks at.
 *
 * <p>⚠️ **The pill is kept**, deliberately, though every other control here is `rounded-md`: the shape
 * is what makes a switch legible as a switch rather than as a very small segmented control. The fix
 * for *belonging* is the border and the fill, not the radius.
 *
 * <p>⚠️ **The tint is `/15`, and it has to stay a tint of `primary`.** All 27 palettes drive this from
 * one token, so a hard-coded colour would be right in one theme and wrong in the other twenty-six —
 * which is exactly what an `emerald` here would have been.
 */
function Switch({
  className,
  size = "default",
  ...properties
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        "data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6",
        // OFF: the same border and the same near-transparent fill an Input has, so an unset preference
        // looks like an empty field rather than like a disabled control.
        "border-input data-[state=unchecked]:bg-transparent dark:data-[state=unchecked]:bg-input/30",
        // ON: tinted, not filled.
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary/15",
        className
      )}
      {...properties}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
          "data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
          // ⚠️ The thumb carries the colour now that the track only tints. On a `/15` track a white
          // thumb would be the lower-contrast half of the pair, which reads as OFF at a glance.
          "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/60",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

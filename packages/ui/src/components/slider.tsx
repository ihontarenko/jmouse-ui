import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "../lib/helpers"

/**
 * A value dragged along a line.
 *
 * ⚠️ **A thumb per value, derived from the value itself** rather than from a count property: a range
 * with two ends and a plain slider are the same component here, and asking a caller to keep a number
 * in step with the length of an array is a way of getting one thumb over a two-ended range.
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...properties
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = React.useMemo(() => {
    if (Array.isArray(value)) {
      return value
    }

    if (Array.isArray(defaultValue)) {
      return defaultValue
    }

    return [min, max]
  }, [value, defaultValue, min, max])

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...properties}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full bg-muted",
          "data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute bg-primary",
            "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>

      {values.map((_, position) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={position}
          className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm transition-[color,box-shadow] hover:ring-4 hover:ring-ring/50 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }

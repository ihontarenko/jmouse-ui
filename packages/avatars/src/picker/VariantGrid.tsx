/**
 * A grid of the same strategy over different seeds.
 *
 * ⚠️ **Selecting is not saving.** A click marks a seed and nothing more. Faces are cheap to render but
 * a choice is not cheap to undo once fourteen other screens are showing it, and an accidental click
 * while scanning a grid of thirty-two is exactly what a grid of thirty-two invites.
 */

import { ScrollArea, cn } from "@jmouse/ui"

import type { AvatarParameters } from "../strategies/types"
import { Avatar } from "./Avatar"

export interface VariantGridProperties {
  strategy: string
  parameters: AvatarParameters
  seeds: readonly string[]
  value: string
  onChange: (seed: string) => void
  className?: string
}

export function VariantGrid({
  strategy,
  parameters,
  seeds,
  value,
  onChange,
  className,
}: VariantGridProperties) {
  return (
    /*
      ⚠️ `max-h-*` belongs on the viewport, never on the root — on the root a Radix ScrollArea clips
      silently instead of scrolling.
    */
    <ScrollArea viewportClassName="max-h-64" className={className}>
      {/*
        ⚠️ The padding is load-bearing, not decoration. Both the hover scale and the selection ring are
        painted OUTSIDE a button's box, and a scrolling box counts that as overflow. Without room to
        grow, hovering a face summons a scrollbar, the scrollbar reflows the grid out from under the
        cursor, the hover ends, the scrollbar leaves — a flicker loop.
      */}
      <div className="grid w-full grid-cols-5 gap-2 p-1.5 sm:grid-cols-8">
        {seeds.map((seed) => (
          <button
            key={seed}
            type="button"
            title={seed}
            onClick={() => onChange(seed)}
            aria-pressed={seed === value}
            className={cn(
              "aspect-square overflow-hidden rounded-full ring-2 ring-transparent transition",
              "hover:scale-105 focus-visible:ring-ring focus-visible:outline-none",
              seed === value && "ring-primary",
            )}
          >
            <Avatar
              source={{ strategy, seed, parameters }}
              size={null}
              className="block size-full [&>svg]:size-full"
            />
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

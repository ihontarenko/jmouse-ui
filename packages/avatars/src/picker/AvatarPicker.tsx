/**
 * Choosing a generated avatar: a style, a seed, and that style's own controls.
 *
 * Controlled on a **token**, not on a descriptor. A token is what the caller stores and what the
 * backend validates, so making it the value means nothing between this component and the database has
 * to agree about a shape — the descriptor exists only inside this file.
 */

import { useEffect, useMemo, useState } from "react"
import { Button, cn } from "@jmouse/ui"

import { decodeToken, encodeToken, type AvatarDescriptor } from "../descriptor"
import { defaultParametersOf, findStrategy, STRATEGIES } from "../strategies"
import { PRESET_SEEDS } from "../strategies/pixelClassic"
import { Avatar } from "./Avatar"
import { ControlPanel } from "./ControlPanel"
import { OPENING_SEED_COUNT, rollSeeds } from "./seeds"
import { StrategyStrip } from "./StrategyStrip"
import { VariantGrid } from "./VariantGrid"

export interface AvatarPickerProperties {
  /** The token currently chosen, or `null` for nothing chosen yet. */
  value: string | null
  onChange: (token: string) => void
  /**
   * What to draw before anything is chosen — a name, a username, an address.
   *
   * ⚠️ The `initials` strategy reads it as text, so passing something meaningful is the difference
   * between a person seeing their own initials on opening this and seeing two letters of a word list.
   */
  seedHint?: string
  className?: string
}

/** What a picker opens on when there is nothing stored and no hint either. */
const FALLBACK_SEED = PRESET_SEEDS[0]

export function AvatarPicker({ value, onChange, seedHint, className }: AvatarPickerProperties) {
  const descriptor = useMemo(() => readDescriptor(value, seedHint), [value, seedHint])

  const [extraSeeds, setExtraSeeds] = useState<string[]>([])

  const strategy = findStrategy(descriptor.strategy) ?? STRATEGIES[0]

  // The chosen seed always appears in the grid, wherever it came from — a stored one that is not in the
  // curated list would otherwise be invisible in the very grid that is meant to show what is selected.
  const seeds = useMemo(() => {
    const offered = [...PRESET_SEEDS.slice(0, OPENING_SEED_COUNT), ...extraSeeds]

    return offered.includes(descriptor.seed) ? offered : [descriptor.seed, ...offered]
  }, [extraSeeds, descriptor.seed])

  const emit = (next: AvatarDescriptor) => onChange(encodeToken(next))

  /*
    ⚠️ **Somebody who has never chosen a face still sees one, so that face has to be savable.** With
    nothing stored, `readDescriptor` falls back to a real descriptor and the grid rings its seed — and
    without this the caller holds `null`, so the dialog shows a selected face above a dead Save button.
    A picker that highlights a choice and then refuses it is the dialog lying about its own state.

    Reporting it upward rather than holding a second copy of the descriptor here: the token is the value,
    and two places deciding what is selected is how they come to disagree.
  */
  useEffect(() => {
    if (value === null) {
      onChange(encodeToken(descriptor))
    }
    // Runs once per "nothing chosen yet"; `descriptor` is derived from `value` and would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const chooseStrategy = (strategyId: string) => {
    const chosen = findStrategy(strategyId)

    if (!chosen) {
      return
    }

    // ⚠️ Parameters reset to the new strategy's defaults rather than carrying over. Keys collide
    // across strategies — `eyes` is a select in one and a count in another — and a carried-over value
    // of the wrong type is a control that looks set and does nothing.
    emit({ strategy: chosen.id, seed: descriptor.seed, parameters: defaultParametersOf(chosen) })
  }

  return (
    <div className={cn("space-y-3", className)}>
      <StrategyStrip seed={descriptor.seed} value={strategy.id} onChange={chooseStrategy} />

      {/*
        ⚠️ Stacked until there is room to sit side by side. The dialog is full-width on a phone, and a
        preview holding 96px of that leaves the controls beside it too narrow to read — while a strategy
        with no controls at all (the classic one) would leave a lone square hugging the left edge.
      */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
        <Avatar
          source={descriptor}
          size={null}
          className="block size-24 shrink-0 overflow-hidden rounded-lg border [&>svg]:size-full"
        />

        <ControlPanel
          className="w-full min-w-0 sm:flex-1"
          controls={strategy.controls}
          parameters={descriptor.parameters}
          onChange={(key, next) =>
            emit({ ...descriptor, parameters: { ...descriptor.parameters, [key]: next } })
          }
        />
      </div>

      <VariantGrid
        strategy={strategy.id}
        parameters={descriptor.parameters}
        seeds={seeds}
        value={descriptor.seed}
        onChange={(seed) => emit({ ...descriptor, seed })}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setExtraSeeds((existing) => [...existing, ...rollSeeds()])}
      >
        Roll more
      </Button>
    </div>
  )
}

/**
 * The token as a descriptor, with everything filled in.
 *
 * ⚠️ An unreadable stored value opens the picker on a fresh face rather than throwing. Somebody whose
 * row is malformed is exactly the person who came here to fix it.
 */
function readDescriptor(value: string | null, seedHint?: string): AvatarDescriptor {
  const seed = seedHint?.trim() || FALLBACK_SEED

  if (value) {
    try {
      const decoded = decodeToken(value)
      const strategy = findStrategy(decoded.strategy)

      if (strategy) {
        return { ...decoded, parameters: { ...defaultParametersOf(strategy), ...decoded.parameters } }
      }
    } catch {
      // Falls through to a fresh descriptor below.
    }
  }

  return { strategy: STRATEGIES[0].id, seed, parameters: defaultParametersOf(STRATEGIES[0]) }
}

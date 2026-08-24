/**
 * The row of strategy chips, each showing what it draws.
 *
 * ⚠️ **Every chip is a live thumbnail of the current seed**, not a static icon. Choosing between eight
 * abstract names is a guess; choosing between eight pictures of your own face is a decision.
 */

import { cn } from "@jmouse/ui"

import { STRATEGIES } from "../strategies"
import { Avatar } from "./Avatar"

export interface StrategyStripProperties {
  seed: string
  value: string
  onChange: (strategyId: string) => void
  className?: string
}

export function StrategyStrip({ seed, value, onChange, className }: StrategyStripProperties) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)} role="radiogroup" aria-label="Avatar style">
      {STRATEGIES.map((strategy) => (
        <button
          key={strategy.id}
          type="button"
          role="radio"
          aria-checked={strategy.id === value}
          title={strategy.tag}
          onClick={() => onChange(strategy.id)}
          className={cn(
            "flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-lg border p-1.5 text-center transition",
            "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
            strategy.id === value
              ? "border-primary/40 bg-primary/10"
              : "border-transparent hover:bg-muted/60",
          )}
        >
          <Avatar
            source={{ strategy: strategy.id, seed, parameters: {} }}
            size={null}
            className="block size-10 overflow-hidden rounded-md [&>svg]:size-full"
          />
          <span
            className={cn(
              "text-[10px] leading-tight font-medium",
              strategy.id === value ? "text-primary" : "text-muted-foreground",
            )}
          >
            {strategy.name}
          </span>
        </button>
      ))}
    </div>
  )
}

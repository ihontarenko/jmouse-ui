import * as React from "react"
import { Smile } from "lucide-react"

import { cn } from "../../lib/helpers"
import { Popover, PopoverContent, PopoverTrigger } from "../popover"
import { EmojiPicker, type EmojiPickerLabels } from "./emoji-picker"

/**
 * The control a form actually places: a square showing the chosen emoji, and the picker under it.
 *
 * <h2>⚠️ The emoji IS the trigger, rather than sitting beside one</h2>
 *
 * The shape every product had before this was a text field plus a palette of a dozen presets — which
 * makes the current value editable as text, and makes choosing one a decision about which of two
 * controls to use. Here there is one control: it shows what is set, and pressing it changes it.
 * Somebody's own character is still reachable, by pasting into the picker's search box.
 *
 * ⚠️ **The value is a string and nothing here narrows it.** Whether it is a single grapheme is the
 * server's question — a cluster count is not worth two implementations, and the refusal a backend
 * sends says exactly what is wrong. This will render whatever it is handed.
 */

const TRIGGER_SIZES = {
  sm: "size-8 text-base",
  default: "size-9 text-lg",
  lg: "size-11 text-2xl",
}

const GLYPH_SIZES = {
  sm: "size-4",
  default: "size-4.5",
  lg: "size-5",
}

export interface EmojiPickerButtonProperties {
  /** The chosen emoji, or null/empty for none. */
  value?: string | null
  /** Called with the emoji, or with null when it is cleared. */
  onChange: (emoji: string | null) => void
  /**
   * Whether clearing is offered. On by default — an emoji is decoration nearly everywhere it is used,
   * and a decoration somebody cannot take off is a trap.
   */
  clearable?: boolean
  disabled?: boolean
  size?: keyof typeof TRIGGER_SIZES
  /** What the trigger shows with nothing chosen. Defaults to a neutral face outline. */
  fallback?: React.ReactNode
  /**
   * Whether the trigger draws the chosen emoji, or stays a constant handle.
   *
   * ⚠️ **Off is for a picker docked to a field that already shows the value** — Innoventa's glyph input,
   * where the character is typeable as well as pickable. Two copies of one character sitting side by
   * side read as a rendering fault rather than as a control. The value is still passed either way: it is
   * what marks the current one in the grid.
   */
  showValue?: boolean
  labels?: EmojiPickerLabels & { open?: string }
  /** Where this product keeps its recently-used list. Unset means no recents row and nothing stored. */
  recentStorageKey?: string
  className?: string
  id?: string
}

export function EmojiPickerButton({
  value,
  onChange,
  clearable = true,
  disabled = false,
  size = "default",
  fallback,
  showValue = true,
  labels,
  recentStorageKey,
  className,
  id,
}: EmojiPickerButtonProperties) {
  const [open, setOpen] = React.useState(false)
  const chosen = value !== null && value !== undefined && value.length > 0 ? value : null

  const close = React.useCallback(() => setOpen(false), [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        disabled={disabled}
        aria-label={labels?.open ?? "Choose an emoji"}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border border-input bg-transparent leading-none shadow-xs transition-colors",
          "hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-50",
          "data-[state=open]:border-ring data-[state=open]:bg-accent",
          TRIGGER_SIZES[size],
          className,
        )}
      >
        {chosen !== null && showValue ? (
          <span aria-hidden>{chosen}</span>
        ) : (
          (fallback ?? <Smile aria-hidden className={cn("text-muted-foreground", GLYPH_SIZES[size])} />)
        )}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-2">
        <EmojiPicker
          value={chosen}
          labels={labels}
          recentStorageKey={recentStorageKey}
          onSelect={(emoji) => {
            onChange(emoji)
            close()
          }}
          // ⚠️ Offered only when something is set: a "clear" control under an empty field is a button
          // that does nothing, and it reads as one that failed.
          onClear={
            clearable && chosen !== null
              ? () => {
                  onChange(null)
                  close()
                }
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  )
}

"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { cn } from "../lib/helpers"
import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog"
import { Input } from "./input"
import { PageState } from "./page-state"
import { useListKeyboard } from "../hooks/use-list-keyboard"

/**
 * Choosing a record from a list, in a dialog rather than in a dropdown.
 *
 * <h2>⚠️ A dropdown is for a handful of options; this is for a catalogue</h2>
 *
 * <p>A select works while the answer is one of six things somebody already knows. It stops working when
 * the answer is one of two thousand records that have to be narrowed before they can be recognised —
 * there is no room for a facet rail, no room for the second line that tells two similar rows apart, and
 * the list closes every time the pointer leaves it. Past that size the honest control is a dialog: room
 * to search, room to narrow, room to read.
 *
 * <h2>⚠️ The trigger reads as the CHOSEN RECORD, never as an instruction</h2>
 *
 * <p>A button that still says *Choose a part* after a part was chosen is a control that has forgotten
 * what it holds — and the value behind it is an identifier, so the alternative failure is worse: the
 * button reads `UT9qbvRJmqFaaiSQ`. The label comes from the caller, which is the only place that knows
 * how to resolve a stored id into something a person recognises.
 *
 * <h2>⚠️ Facets are optional and the caller's</h2>
 *
 * <p>This component has no idea what a facet means — a component type, a category, a state. It draws
 * the rail when it is given one and gives the whole width to the rows when it is not, which is the
 * ordinary case for a field whose choices are a flat list.
 *
 * <h2>⚠️ Keyboard is not an extra here</h2>
 *
 * <p>The dialog exists because the list is long, and a long list is one somebody arrows through. It
 * uses the same {@link useListKeyboard} every other list in these products uses, so `j`/`k`, the arrows
 * and `Enter` mean here exactly what they mean everywhere else.
 */

export interface RecordPickerItem {
  value: string
  label: string
  /** A second line — what tells two rows with similar names apart. */
  detail?: string
  /** Drawn before the label: a glyph, a swatch, a thumbnail. */
  leading?: React.ReactNode
}

export interface RecordPickerFacet {
  key: string
  label: string
  count?: number
  icon?: React.ReactNode
}

export function RecordPicker({
  value,
  items,
  multiple = false,
  labelOf,
  onChange,
  title,
  description,
  triggerLabel = "Choose…",
  facets,
  activeFacet,
  onFacet,
  search,
  onSearch,
  searchLabel = "Search…",
  loading = false,
  empty,
  footer,
  disabled = false,
  className,
}: {
  /** One stored value, or several when {@link multiple}. */
  value: string | string[]
  items: RecordPickerItem[]
  multiple?: boolean
  /**
   * What a stored value reads as on the trigger.
   *
   * ⚠️ **Required, and the caller's job.** The picker holds identifiers; only the screen that stored one
   * knows how to turn it back into a name, and a picker that guessed would print the identifier.
   */
  labelOf: (value: string) => string
  onChange: (value: string) => void
  title: string
  description?: string
  /** What the button says while nothing is chosen. */
  triggerLabel?: string
  /** Omit for a flat list — the rows then take the whole width. */
  facets?: RecordPickerFacet[]
  activeFacet?: string | null
  onFacet?: (facet: string | null) => void
  /** Omit to draw no search box — a short list does not need one. */
  search?: string
  onSearch?: (search: string) => void
  searchLabel?: string
  loading?: boolean
  empty?: { title: string; text?: string }
  /** A sentence under the list — "showing 25 of 2000", say. */
  footer?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)

  const chosen = React.useMemo(
    () => (Array.isArray(value) ? value : value ? value.split(",").map((one) => one.trim()).filter(Boolean) : []),
    [value],
  )

  const keyboard = useListKeyboard<RecordPickerItem>({
    rows: items,
    identify: (item) => item.value,
    onOpen: (item) => choose(item.value),
  })

  function choose(picked: string) {
    if (!multiple) {
      onChange(picked)
      setOpen(false)
      return
    }

    // ⚠️ Toggling, and the dialog stays open. Picking five things is one visit, not five.
    const next = chosen.includes(picked) ? chosen.filter((one) => one !== picked) : [...chosen, picked]

    onChange(next.join(","))
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        // ⚠️ Full width and left-aligned: it stands where a select stood, and a chosen record's name is
        // read rather than clicked at. A centred label in a shrink-to-fit button makes the control jump
        // width every time the choice changes.
        className={cn("h-8 w-full justify-between gap-2 px-2.5 text-left font-normal", className)}
      >
        <span className={cn("truncate", chosen.length === 0 && "text-muted-foreground")}>
          {chosen.length === 0
            ? triggerLabel
            : chosen.length === 1
              ? labelOf(chosen[0])
              : `${labelOf(chosen[0])} and ${chosen.length - 1} more`}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* ⚠️ A fixed height rather than one that follows the content. A dialog that grows and shrinks as
            somebody types is a dialog whose rows move under the pointer between one keystroke and the
            next. */}
        <DialogContent className="flex h-[70vh] max-w-3xl flex-col gap-3 overflow-hidden">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          {onSearch && (
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                autoFocus
                size="sm"
                className="pl-8"
                value={search ?? ""}
                placeholder={searchLabel}
                onChange={(event) => onSearch(event.target.value)}
              />
            </div>
          )}

          <div
            className={cn(
              "grid min-h-0 flex-1 gap-3",
              facets && facets.length > 0 ? "grid-cols-[minmax(0,12rem)_minmax(0,1fr)]" : "grid-cols-1",
            )}
          >
            {facets && facets.length > 0 && (
              <nav aria-label="Narrow the list" className="min-h-0 overflow-y-auto border-r pr-2">
                <FacetRow active={activeFacet == null} onClick={() => onFacet?.(null)}>
                  Everything
                </FacetRow>
                {facets.map((facet) => (
                  <FacetRow
                    key={facet.key}
                    active={activeFacet === facet.key}
                    count={facet.count}
                    onClick={() => onFacet?.(facet.key)}
                  >
                    {facet.icon}
                    {facet.label}
                  </FacetRow>
                ))}
              </nav>
            )}

            <div className="min-h-0 overflow-y-auto">
              {loading ? (
                <PageState kind="loading" rows={8} />
              ) : items.length === 0 ? (
                <PageState
                  kind="empty"
                  title={empty?.title ?? "Nothing to choose from"}
                  text={empty?.text}
                />
              ) : (
                <ul className="flex flex-col">
                  {items.map((item) => {
                    const picked = chosen.includes(item.value)

                    return (
                      <li key={item.value}>
                        <button
                          type="button"
                          {...keyboard.rowProperties(item)}
                          onClick={() => choose(item.value)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left",
                            "hover:bg-accent transition-colors duration-[120ms]",
                            "focus-visible:outline-none data-[active]:ring-ring data-[active]:ring-2 data-[active]:ring-inset",
                            picked && "bg-accent/60",
                          )}
                        >
                          {item.leading}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px]">{item.label}</span>
                            {item.detail && (
                              <span className="text-muted-foreground block truncate text-[11px]">
                                {item.detail}
                              </span>
                            )}
                          </span>
                          {picked && <Check className="text-primary size-3.5 shrink-0" aria-hidden="true" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {footer && <p className="text-muted-foreground text-[11px]">{footer}</p>}

          {/* ⚠️ A Done button only where choosing is repeated. Single choice closes on the pick, and a
              dialog that needed confirming after one click would be one click too many. */}
          {multiple && (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function FacetRow({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-[2px] px-2 py-1 text-left text-[12.5px]",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && <span className="shrink-0 text-[11px] opacity-70">{count}</span>}
    </button>
  )
}

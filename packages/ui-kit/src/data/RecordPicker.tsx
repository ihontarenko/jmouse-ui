import { useState, type ReactNode } from "react"
import { Button, IconButton } from "../controls/Button"
import { Micro } from "../controls/Text"
import { Dialog } from "../containers/Dialog"
import { EmptyState, type EmptyStateProperties } from "../feedback/Feedback"
import { Icon } from "../icons/Icon"

export interface RecordPickerItem {
  value: string
  label: string
  hint?: string
}

export interface RecordPickerProperties {
  /** The chosen value — several joined by commas when `multiple`. */
  value: string
  items: RecordPickerItem[]
  multiple?: boolean
  loading?: boolean
  disabled?: boolean
  title: string
  description?: string
  /** What the closed button says while nothing is chosen. */
  triggerLabel: string
  search?: string
  onSearch?(search: string): void
  searchLabel?: string
  empty?: EmptyStateProperties
  footer?: ReactNode
  labelOf(value: string): string
  onChange(value: string): void
  /** Told when it opens — a picker over a server catalogue queries only then. */
  onOpenChange?(open: boolean): void
  clearLabel?: string
  doneLabel?: string
  cancelLabel?: string
}

/**
 * Choosing one record (or several) from a catalogue too long for a select: a button that names the choice, opening a
 * dialog with a search and the list. Innoventa's `RecordPicker`, same properties.
 */
export function RecordPicker({ value, items, multiple = false, loading = false, disabled = false, title, description, triggerLabel, search, onSearch, searchLabel, empty, footer, labelOf, onChange, onOpenChange, clearLabel = "Clear", doneLabel = "Done", cancelLabel = "Cancel" }: RecordPickerProperties) {
  const [open, setOpenState] = useState(false)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const chosen = value === "" ? [] : value.split(",").map((one) => one.trim()).filter(Boolean)
  const pick = (candidate: string) => {
    if (!multiple) {
      onChange(candidate)
      setOpen(false)
      return
    }
    onChange((chosen.includes(candidate) ? chosen.filter((one) => one !== candidate) : [...chosen, candidate]).join(","))
  }
  return (
    <>
      <div className="kit-record-picker">
        <button type="button" className="kit-record-picker-trigger" disabled={disabled} onClick={() => setOpen(true)}>
          <span data-placeholder={chosen.length === 0 ? "" : undefined}>{chosen.length === 0 ? triggerLabel : chosen.map(labelOf).join(", ")}</span>
          <Icon name="chevron-down" size="small" />
        </button>
        {chosen.length === 0 ? null : <IconButton icon="close" label={clearLabel} size="small" disabled={disabled} onClick={() => onChange("")} />}
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        footNote={footer === undefined ? undefined : <Micro>{footer}</Micro>}
        footer={<Button onClick={() => setOpen(false)}>{multiple ? doneLabel : cancelLabel}</Button>}
      >
        {onSearch === undefined ? null : (
          <div className="kit-search-inline" data-stretch="">
            <Icon name="search" />
            <input autoFocus data-autofocus="" type="search" value={search ?? ""} onChange={(event) => onSearch(event.target.value)} aria-label={searchLabel ?? "Search"} placeholder={searchLabel ?? "Search…"} />
          </div>
        )}
        <div className="kit-record-picker-list">
          {items.length === 0 ? (
            <EmptyState flush title={empty?.title ?? (loading ? "Reading…" : "Nothing to choose from")} text={empty?.text} icon={empty?.icon} />
          ) : (
            items.map((item) => (
              <button key={item.value} type="button" className="kit-record-picker-item" aria-pressed={chosen.includes(item.value)} onClick={() => pick(item.value)}>
                <span className="kit-identity" data-technical="sub">
                  <span className="kit-identity-name">{item.label}</span>
                  {item.hint === undefined ? null : <span className="kit-identity-sub">{item.hint}</span>}
                </span>
                {chosen.includes(item.value) ? <Icon name="check" /> : null}
              </button>
            ))
          )}
        </div>
      </Dialog>
    </>
  )
}

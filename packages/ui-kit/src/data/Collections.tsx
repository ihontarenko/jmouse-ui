import { useState, type ReactNode } from "react"
import { Button } from "../controls/Button"
import { Input } from "../controls/Inputs"
import { useFieldControl } from "../controls/Field"
import { Icon } from "../icons/Icon"
import type { IconName } from "../icons/iconPaths"
import type { IconSource } from "../icons/Icon"
import { useAnchoredPopover, type PopoverAlignment } from "../lib/anchoredPopover"
import type { MenuTriggerProperties } from "../navigation/Menu"

/* ===================== popover: a panel under a button ===================== */

export interface PopoverProperties {
  /** The panel's accessible name. */
  label: string
  /** Renders the trigger with the properties it must wear (as a Menu's does, with aria-haspopup "dialog"). */
  trigger(triggerProperties: Omit<MenuTriggerProperties, "aria-haspopup"> & { "aria-haspopup": "dialog" }): ReactNode
  alignment?: PopoverAlignment
  /** Renders the content; `close` hides it and returns focus to the trigger. */
  children(close: () => void): ReactNode
}

/**
 * A small panel of controls under its button — a filter, a column chooser, a colour picker. Not a menu (its content is
 * not a list of actions) and not a dialog (it does not block the page). Escape and a click outside close it.
 */
export function Popover({ label, trigger, alignment = "start", children }: PopoverProperties) {
  const { popoverId, anchorReference, popoverReference, open, close } = useAnchoredPopover(alignment)
  return (
    <>
      {trigger({ ref: anchorReference, popoverTarget: popoverId, "aria-haspopup": "dialog", "aria-expanded": open, "aria-controls": popoverId })}
      <div ref={popoverReference} id={popoverId} popover="auto" className="kit-popover" data-padded="" role="dialog" aria-label={label}>
        {open && children(() => close())}
      </div>
    </>
  )
}

/* ===================== facet checklist: facets with counts, chosen in place ===================== */

export interface FacetOption {
  value: string
  label: ReactNode
  count?: number
}

export interface Facet {
  id: string
  label: string
  options: FacetOption[]
  /** Options shown before "Show all"; the rest fold away. */
  visible?: number
}

export interface FacetChecklistProperties {
  label: string
  facets: Facet[]
  /** The chosen values of every facet. */
  selected: Record<string, string[]>
  onSelectedChange(selected: Record<string, string[]>): void
  clearLabel?: string
  showAllLabel?(hidden: number): string
}

/**
 * A rail of facets — kind, package, state — each a list of checkable options with their counts, the way Innoventa's
 * catalogue and Kitsu's library narrow a list. A facet with choices says how many and can be cleared on its own.
 */
export function FacetChecklist({ label, facets, selected, onSelectedChange, clearLabel = "Clear", showAllLabel = (hidden) => `Show ${hidden} more` }: FacetChecklistProperties) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function toggle(facetId: string, value: string) {
    const current = selected[facetId] ?? []
    const next = current.includes(value) ? current.filter((candidate) => candidate !== value) : [...current, value]
    onSelectedChange({ ...selected, [facetId]: next })
  }

  return (
    <nav className="kit-filter-rail" aria-label={label}>
      {facets.map((facet) => {
        const chosen = selected[facet.id] ?? []
        const limit = facet.visible ?? 6
        const hidden = facet.options.length - limit
        const options = expanded[facet.id] || hidden <= 0 ? facet.options : facet.options.slice(0, limit)
        return (
          <fieldset key={facet.id} className="kit-facet">
            <legend className="kit-facet-head">
              <span className="kit-micro-label">{facet.label}</span>
              {chosen.length > 0 && (
                <button type="button" className="kit-facet-clear" onClick={() => onSelectedChange({ ...selected, [facet.id]: [] })}>
                  {clearLabel} {chosen.length}
                </button>
              )}
            </legend>
            {options.map((option) => (
              <label key={option.value} className="kit-facet-option">
                <input type="checkbox" className="kit-check" checked={chosen.includes(option.value)} onChange={() => toggle(facet.id, option.value)} />
                <span className="kit-facet-label">{option.label}</span>
                {option.count !== undefined && <span className="kit-facet-count">{option.count}</span>}
              </label>
            ))}
            {hidden > 0 && !expanded[facet.id] && (
              <button type="button" className="kit-facet-more" onClick={() => setExpanded({ ...expanded, [facet.id]: true })}>
                {showAllLabel(hidden)}
              </button>
            )}
          </fieldset>
        )
      })}
    </nav>
  )
}

/* ===================== date range ===================== */

export interface DateRange {
  /** ISO dates, yyyy-mm-dd; empty means open on that side. */
  from: string
  to: string
}

export interface DateRangePreset {
  label: string
  range(): DateRange
}

export interface DateRangeFieldProperties {
  value: DateRange
  onValueChange(value: DateRange): void
  presets?: DateRangePreset[]
  fromLabel?: string
  toLabel?: string
  id?: string
  "aria-describedby"?: string
}

/** Two dates and the shortcuts people actually use. The end before the start is said in the field, not silently swapped. */
export function DateRangeField({ value, onValueChange, presets = [], fromLabel = "From", toLabel = "To", ...rest }: DateRangeFieldProperties) {
  const wiring = useFieldControl(rest)
  const reversed = Boolean(value.from && value.to && value.to < value.from)
  return (
    <div className="kit-date-range">
      <div className="kit-input-group">
        <Input type="date" aria-label={fromLabel} value={value.from} max={value.to || undefined} onChange={(event) => onValueChange({ ...value, from: event.target.value })} id={wiring.id} aria-describedby={wiring["aria-describedby"]} aria-invalid={reversed || undefined} technical />
        <span className="kit-addon" aria-hidden="true">–</span>
        <Input type="date" aria-label={toLabel} value={value.to} min={value.from || undefined} onChange={(event) => onValueChange({ ...value, to: event.target.value })} aria-invalid={reversed || undefined} technical />
      </div>
      {presets.length > 0 && (
        <div className="kit-chips">
          {presets.map((preset) => (
            <Button key={preset.label} size="small" variant="quiet" onClick={() => onValueChange(preset.range())}>{preset.label}</Button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ===================== activity: what happened, newest first ===================== */

export interface ActivityEntry {
  id: string
  /** Who or what did it — a person's name, an agent, a job. */
  actor: ReactNode
  /** What they did, as a sentence fragment: "renamed the pins of", "imported". */
  action: ReactNode
  /** What it was done to — usually a link. */
  subject?: ReactNode
  /** When, already formatted — "2 min ago", "14:02". Put the exact time in `title`. */
  when: string
  title?: string
  icon?: IconSource
  tone?: "good" | "warn" | "danger"
}

/** A stream of what happened — a project's activity, a part's history, a job's log at the level of people. */
export function ActivityList({ entries, label }: { entries: ActivityEntry[]; label: string }) {
  return (
    <ol className="kit-activity" aria-label={label}>
      {entries.map((entry) => (
        <li key={entry.id} className="kit-activity-entry" data-tone={entry.tone}>
          <span className="kit-activity-mark" aria-hidden="true">
            <Icon name={entry.icon ?? "activity"} size="small" />
          </span>
          <p>
            <strong>{entry.actor}</strong> {entry.action} {entry.subject}
          </p>
          <time className="kit-activity-when" title={entry.title}>{entry.when}</time>
        </li>
      ))}
    </ol>
  )
}

/* ===================== steps: a pipeline's stages ===================== */

export type StepState = "done" | "current" | "waiting" | "failed" | "skipped"

export interface Step {
  id: string
  label: ReactNode
  state: StepState
  /** Under the label — a duration, a count, the reason it failed. */
  detail?: ReactNode
}

const stepIcons: Record<StepState, IconName> = { done: "check", current: "refresh", waiting: "clock", failed: "danger", skipped: "minus" }

/**
 * The stages of a run — fetched, parsed, indexed, embedded — each with its state in an icon AND a word, so the state
 * never rests on colour. The current stage is announced; a failed one carries its reason.
 */
export function Steps({ steps, label, stateLabels = { done: "done", current: "in progress", waiting: "waiting", failed: "failed", skipped: "skipped" } }: { steps: Step[]; label: string; stateLabels?: Record<StepState, string> }) {
  return (
    <ol className="kit-steps" aria-label={label}>
      {steps.map((step) => (
        <li key={step.id} className="kit-step" data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
          <span className="kit-step-mark" aria-hidden="true"><Icon name={stepIcons[step.state]} size="small" /></span>
          <span className="kit-step-text">
            <span className="kit-step-label">{step.label}</span>
            <span className="kit-step-detail">{stateLabels[step.state]}{step.detail ? <> · {step.detail}</> : null}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

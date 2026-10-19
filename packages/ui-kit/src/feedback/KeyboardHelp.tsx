import { Dialog } from "../containers/Dialog"
import { KeySequence, Micro } from "../controls/Text"

export interface ShortcutRow {
  label: string
  keys: string
}

export interface ShortcutGroup {
  title: string
  rows: ShortcutRow[]
}

export interface KeyboardHelpProperties {
  open: boolean
  onOpenChange(open: boolean): void
  /** The jumps this installation offers — from the navigation, gated by what the account may reach, never hard-coded. */
  destinations: ShortcutRow[]
  /** The keys that work everywhere, in a table, on a record. Innoventa's set when left out. */
  groups?: ShortcutGroup[]
  title?: string
  destinationsTitle?: string
}

const innoventaGroups: ShortcutGroup[] = [
  { title: "Everywhere", rows: [{ label: "Search", keys: "/" }, { label: "This help", keys: "?" }, { label: "Light or dark theme", keys: "Shift T" }, { label: "The screen's main action", keys: "n" }, { label: "Close a panel or a dialog", keys: "Esc" }] },
  { title: "In a table", rows: [{ label: "Row down / up", keys: "j k" }, { label: "The same", keys: "↓ ↑" }, { label: "Open the row", keys: "Enter" }, { label: "Select without opening", keys: "Space" }, { label: "First / last row", keys: "Home End" }] },
  { title: "On a record", rows: [{ label: "Edit this record", keys: "e" }, { label: "Save what is open", keys: "Ctrl S" }] },
]

/** What the keyboard does, in one dialog behind `?`. */
export function KeyboardHelp({ open, onOpenChange, destinations, groups = innoventaGroups, title = "Keyboard", destinationsTitle = "Go to" }: KeyboardHelpProperties) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} wide>
      <div className="kit-keyboard-help">
        <div className="kit-keyboard-help-column">
          {groups.map((group) => (
            <ShortcutList key={group.title} title={group.title} rows={group.rows} />
          ))}
        </div>
        <ShortcutList title={destinationsTitle} rows={destinations} />
      </div>
    </Dialog>
  )
}

function ShortcutList({ title, rows }: ShortcutGroup) {
  return (
    <section className="kit-keyboard-help-group">
      <Micro>{title}</Micro>
      {rows.map((row) => (
        <div key={row.label} className="kit-keyboard-help-row">
          <span>{row.label}</span>
          <KeySequence keys={row.keys} />
        </div>
      ))}
    </section>
  )
}

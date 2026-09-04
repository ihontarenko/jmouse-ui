import { useId } from "react"
import { Ban, X } from "lucide-react"
import { Button, Input, NativeSelect, cn } from "@jmouse/ui"
import { Caption } from "./Caption"
import type { ValidationLabels } from "./labels"
import type { CheckDraft, OfferedCheck } from "./types"

/**
 * The columns every check in a document is laid out on. 📐
 *
 * ## ⚠️ This one string is the whole difference between a form and an instrument
 *
 * The checks used to be `flex-wrap`, so each control was as wide as its own content: `notBlank`'s
 * message began at x=615, `size`'s at x=850 because two arguments pushed it along, and the next
 * field's began somewhere else again. Nothing lined up with anything, and a reader comparing forty
 * rules down a page had no column to run an eye down — which is what made a screen full of correct
 * information unreadable.
 *
 * Fixed tracks fix that: the check, its arguments and its message start at the same x on **every** row
 * of the document, so the arguments read as an arguments column and the messages as a messages column.
 * The argument cell is fixed rather than content-sized precisely so that `size(2, 160)` and `notBlank`
 * do not push their neighbours to different places.
 *
 * ⚠️ **Shared by the header row and the check rows**, so a caption is above the column it names by
 * construction rather than by two numbers that agree today.
 */
export const CHECK_GRID = "grid grid-cols-[9rem_15rem_minmax(0,1fr)_auto_auto] items-center gap-x-3"

/**
 * What the columns are called — one row per field, above its checks.
 *
 * ⚠️ **Once per field, not once per check.** Repeating `MESSAGE` on every line is the caption competing
 * with the value it names; a column heading says it once and the rows below are then pure data. It is
 * also what gives the message box a visible label, which a bare column would not have.
 */
export function CheckColumns({ labels }: { labels: ValidationLabels }) {
  return (
    <div className={cn(CHECK_GRID, "border-border/50 border-t pt-2 pb-1")}>
      <Caption>{labels.checks}</Caption>
      <Caption>{labels.arguments}</Caption>
      <Caption>{labels.checkMessage}</Caption>
      <Caption className="w-[30px] text-center">{labels.stopColumn}</Caption>
      <span className="w-[30px]" />
    </div>
  )
}

/**
 * One check, on one line of the grid. 🎛️
 *
 * ## ⚠️ This is the whole reason the language chose named calls
 *
 * `size(3, 32)` draws as two boxes captioned *min* and *max* because the catalogue says which position
 * is which property. A raw boolean — `value.length >= 3` — could only ever be drawn as a text field
 * with a name beside it, which is the editor with extra steps. Everything below is that table being
 * spent.
 *
 * ## ⚠️ A variadic check is one list, not N boxes
 *
 * `oneOf('SMD', 'THT')` takes as many as somebody wants, so it gets a single field of comma-separated
 * values rather than a growing row of inputs. ⚠️ The split is on the **comma between values**, not on
 * quotes: every value here is an expression as written, and re-quoting it would be the browser deciding
 * what a rule means.
 */
export function CheckRow({
  value,
  offered,
  labels,
  disabled,
  className,
  onChange,
  onRemove,
}: {
  value: CheckDraft
  /** What this product offers — where the captions come from. */
  offered: OfferedCheck[]
  labels: ValidationLabels
  disabled?: boolean
  className?: string
  onChange: (check: CheckDraft) => void
  onRemove: () => void
}) {
  const rowId = useId()
  const signature = offered.find((one) => one.check === value.check) ?? null
  const parameters = signature?.parameters ?? []

  return (
    <div className={cn(CHECK_GRID, "py-1", className)}>
      <NativeSelect
        aria-label={labels.checks}
        value={value.check}
        disabled={disabled}
        size="sm"
        className="font-mono"
        onChange={(event) => onChange(retypedAs(value, event.target.value, offered))}
      >
        {offered.map((one) => (
          <option key={one.check} value={one.check}>
            {one.check}
          </option>
        ))}
      </NativeSelect>

      {/* ⚠️ The cell keeps its width whether it holds two arguments or none, which is what stops the
          message column zig-zagging down the page. A check that takes nothing says so with a dash
          rather than leaving a hole a reader has to interpret. */}
      <div className="flex min-w-0 items-center gap-x-2">
        {parameters.length === 0 ? (
          <span className="text-muted-foreground/60 text-xs">—</span>
        ) : signature?.variadic ? (
          <Argument
            id={`${rowId}-values`}
            caption={parameters[0]}
            value={value.positional.join(", ")}
            disabled={disabled}
            className="flex-1"
            onChange={(written) => onChange({ ...value, positional: splitValues(written) })}
          />
        ) : (
          parameters.map((parameter, index) => (
            <Argument
              key={parameter}
              id={`${rowId}-${parameter}`}
              caption={parameter}
              value={value.positional[index] ?? ""}
              disabled={disabled}
              className="w-[4.75rem]"
              onChange={(written) => onChange(withArgument(value, index, written))}
            />
          ))
        )}
      </div>

      <Input
        aria-label={labels.checkMessage}
        value={value.message ?? ""}
        placeholder="—"
        disabled={disabled}
        size="sm"
        onChange={(event) => onChange({ ...value, message: blankToNull(event.target.value) })}
      />

      {/* ⚠️ A toggle button rather than a switch with a sentence beside it. "Stop here on failure" is
          ~140px of every row spent on a flag that is off almost everywhere, and it wrapped every
          three-argument check onto a second line. The sentence survives as the accessible name and as
          the tooltip; the column heading carries the short form. */}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-pressed={value.stop}
        aria-label={labels.stop}
        title={labels.stop}
        disabled={disabled}
        className={cn(
          "shrink-0",
          value.stop && "text-destructive bg-destructive/10 hover:bg-destructive/15",
        )}
        onClick={() => onChange({ ...value, stop: !value.stop })}
      >
        <Ban className="size-3.5" />
      </Button>

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={disabled}
        className="text-muted-foreground hover:text-destructive shrink-0"
        onClick={onRemove}
      >
        <X className="size-3.5" />
        <span className="sr-only">{labels.removeRow}</span>
      </Button>
    </div>
  )
}

/** One argument: the property it fills, then the expression filling it. */
function Argument({
  id,
  caption,
  value,
  disabled,
  className,
  onChange,
}: {
  id: string
  caption: string
  value: string
  disabled?: boolean
  className: string
  onChange: (written: string) => void
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Caption htmlFor={id}>{caption}</Caption>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        size="sm"
        className="flex-1 font-mono"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

/**
 * The same check under a different name, keeping what still fits.
 *
 * ⚠️ Arguments beyond the new check's arity are **dropped**, not carried invisibly. A hidden argument
 * would travel to the server, be rendered into the document, and appear in the text tab as something
 * nobody can see in the form — which is the one state this builder is arranged to make impossible.
 */
function retypedAs(value: CheckDraft, check: string, offered: OfferedCheck[]): CheckDraft {
  const signature = offered.find((one) => one.check === check) ?? null
  const arity = signature === null ? 0 : signature.variadic ? Infinity : signature.parameters.length

  return { ...value, check, positional: value.positional.slice(0, arity) }
}

/**
 * One positional argument replaced.
 *
 * ⚠️ Gaps are filled with empty strings rather than left sparse. A form where somebody typed the second
 * box first would otherwise post an array with a hole in it, and a hole is not a value the server can
 * render.
 */
function withArgument(value: CheckDraft, index: number, written: string): CheckDraft {
  const positional = [...value.positional]

  while (positional.length <= index) {
    positional.push("")
  }

  positional[index] = written

  return { ...value, positional }
}

function splitValues(written: string): string[] {
  return written
    .split(",")
    .map((one) => one.trim())
    .filter((one) => one !== "")
}

/** ⚠️ An empty box means *no message*, never a message that is the empty string. */
function blankToNull(written: string): string | null {
  return written.trim() === "" ? null : written
}

import { useState, type ReactNode } from "react"
import { Ban, Plus } from "lucide-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@jmouse/ui"
import { StatementDialog } from "./StatementDialog"
import { blankItem, summarise } from "./drafts"
import type { ValidationLabels } from "./labels"
import type { CheckDraft, ItemDraft, ItemKind, OfferedCheck } from "./types"

/**
 * The rules tab — the document, read. 📜
 *
 * ## ⚠️ A document you READ, with the form one click away
 *
 * This tab used to draw every control of every statement at once. A document judging forty-four forms
 * came out as several screens of selects and text boxes, and the question a person actually arrives
 * with — *what is asked of `vendor`?* — had to be reconstructed from the widgets that edit it. Controls
 * are a promise that something is about to change; forty statements' worth of them make that promise
 * about everything simultaneously, which is why the screen read as noise rather than as rules.
 *
 * So a statement is now **a line of the document**: the field, what is asked of it, and the message it
 * falls back to — set in the same tracks on every row, so an eye runs down a column. Opening one puts
 * exactly that statement's piece of the form in a dialog ({@link StatementDialog}), which is the only
 * place an input exists on this tab.
 *
 * ## ⚠️ Nested, because the language is
 *
 * jMV says `when a { when b { … } }` and `when a and b { … }` are the same document and neither is
 * canonical. Drawing only the flat form would refuse a file the language calls idiomatic; flattening on
 * the way in would rewrite somebody's file for them. So a guard renders its branch, and a branch may
 * hold another guard, all the way down.
 *
 * ## ⚠️ Nesting is a SPINE, never a card inside a card
 *
 * A hairline down the left of a branch and an indent — the way an outline is drawn. `rules/design.md`
 * forbids nested cards outright, and a check inside a field inside a `when` inside an `always` is four
 * levels deep: four borders and four paddings would be sixty pixels of chrome around one line of
 * meaning. A block or a guard is a **header line**, not a container.
 *
 * ## ⚠️ A branch owns appending to itself
 *
 * Each level is handed its whole list and a setter for it, so adding a statement is
 * `onChange([...items, made])` right here — and so is opening the dialog on what was just added, since
 * the new statement's index is simply the old length. No path of indices is walked down from the root.
 */
export function ValidationRows({
  items,
  offered,
  labels,
  disabled,
  depth = 0,
  className,
  onChange,
}: {
  items: ItemDraft[]
  offered: OfferedCheck[]
  labels: ValidationLabels
  disabled?: boolean
  /** How deep this branch sits. ⚠️ Only decides which statements are worth offering — see `AddStatement`. */
  depth?: number
  className?: string
  /** ⚠️ Always given this branch's WHOLE list — this component owns nothing. */
  onChange: (items: ItemDraft[]) => void
}) {
  // ⚠️ An index into THIS branch's list, held by the branch that draws it. A single dialog state at
  // the root would need the path addressing the rows deliberately do not have.
  //
  // ⚠️ `added` travels with it because **cancelling a statement that was just added has to remove
  // it**. A new statement arrives blank — no field name, no condition — so a cancel that merely closed
  // would leave a line in the document saying nothing that nobody chose to write. Only the branch
  // knows which case this is; the dialog cannot tell a new statement from an empty old one.
  const [opened, setOpened] = useState<{ index: number; added: boolean } | null>(null)

  const replace = (index: number, changed: ItemDraft) =>
    onChange(items.map((one, at) => (at === index ? changed : one)))

  const remove = (index: number) => onChange(items.filter((_, at) => at !== index))

  const open = opened === null ? null : (items[opened.index] ?? null)

  return (
    <div className={cn("flex flex-col", className)}>
      {items.length === 0 ? (
        <p className="text-muted-foreground py-2 text-xs">{labels.empty}</p>
      ) : (
        items.map((item, index) => (
          <Statement
            key={index}
            item={item}
            offered={offered}
            labels={labels}
            disabled={disabled}
            depth={depth}
            onChange={(changed) => replace(index, changed)}
            onOpen={() => setOpened({ index, added: false })}
          />
        ))
      )}

      <AddStatement
        labels={labels}
        disabled={disabled}
        depth={depth}
        onAdd={(added) => {
          onChange([...items, added])
          setOpened({ index: items.length, added: true })
        }}
      />

      {open !== null && opened !== null && (
        // ⚠️ Keyed by index so opening a different statement mounts a fresh dialog. Its draft is
        // seeded once from this property, and a reused instance would keep the previous statement's.
        <StatementDialog
          key={opened.index}
          item={open}
          offered={offered}
          labels={labels}
          disabled={disabled}
          onApply={(changed) => {
            replace(opened.index, changed)
            setOpened(null)
          }}
          onRemove={() => {
            remove(opened.index)
            setOpened(null)
          }}
          onCancel={() => {
            if (opened.added) {
              remove(opened.index)
            }

            setOpened(null)
          }}
        />
      )}
    </div>
  )
}

/** One statement: its line, and whatever hangs under it. */
function Statement({
  item,
  offered,
  labels,
  disabled,
  depth,
  onChange,
  onOpen,
}: {
  item: ItemDraft
  offered: OfferedCheck[]
  labels: ValidationLabels
  disabled?: boolean
  depth: number
  onChange: (item: ItemDraft) => void
  onOpen: () => void
}) {
  return (
    <div className="border-border/50 border-t py-0.5 first:border-t-0 first:pt-0">
      <Comments comments={item.comments} />

      <OpenRow labels={labels} disabled={disabled} onOpen={onOpen}>
        {item.kind === "BLOCK" && <BlockLine item={item} labels={labels} />}
        {item.kind === "GUARD" && <GuardLine item={item} labels={labels} />}
        {item.kind === "LINE" && <FieldLine item={item} labels={labels} />}
        {item.kind === "INVARIANT" && <InvariantLine item={item} labels={labels} />}
      </OpenRow>

      {(item.kind === "BLOCK" || item.kind === "GUARD") && (
        <Branch>
          <ValidationRows
            items={item.items}
            offered={offered}
            labels={labels}
            disabled={disabled}
            depth={depth + 1}
            onChange={(items) => onChange({ ...item, items })}
          />
        </Branch>
      )}

      {item.kind === "GUARD" && item.otherwise !== null && (
        <>
          {/* ⚠️ Not a control. The branch exists or it does not, and that decision is the guard's —
              made in the guard's own dialog, because `null` and `[]` are different documents. */}
          <div className="flex items-center gap-2 px-2 py-1">
            <Keyword tone="flow">{labels.otherwise}</Keyword>
          </div>

          <Branch>
            <ValidationRows
              items={item.otherwise}
              offered={offered}
              labels={labels}
              disabled={disabled}
              depth={depth + 1}
              onChange={(otherwise) => onChange({ ...item, otherwise })}
            />
          </Branch>
        </>
      )}
    </div>
  )
}

/**
 * A statement's line, as a control. 🖱️
 *
 * ⚠️ **A real `<button>`, full width, with a focus ring** — a row that opens something is a control
 * whatever it looks like, and `rules/accessibility.md` wants it reachable by `Tab` and named. The
 * ground appears on hover and focus rather than being painted always, so a page of forty of these is
 * still a document rather than a list of buttons.
 *
 * ⚠️ **The word is a prefix, not an `aria-label`.** A label would *replace* the row's content as the
 * accessible name, so forty statements would announce as forty buttons all called "Open" — the row's
 * own text is the only thing that tells them apart. Prefixing it says what the click does and keeps
 * the field name that follows.
 */
function OpenRow({
  labels,
  disabled,
  onOpen,
  children,
}: {
  labels: ValidationLabels
  disabled?: boolean
  onOpen: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "hover:bg-muted/50 focus-visible:ring-ring/50 focus-visible:border-ring w-full cursor-pointer",
        "border border-transparent px-2 py-1 text-left transition-colors outline-none",
        "focus-visible:ring-[3px] disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent",
      )}
      onClick={onOpen}
    >
      <span className="sr-only">{labels.openStatement}</span>
      {children}
    </button>
  )
}

/** `always { … }` or `gate { … }` — the keyword, and why the gate is different. */
function BlockLine({ item, labels }: { item: ItemDraft; labels: ValidationLabels }) {
  const gate = item.block === "gate"

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Keyword tone={gate ? "gate" : "flow"}>{gate ? labels.gateKeyword : labels.alwaysKeyword}</Keyword>
      {gate && <span className="text-muted-foreground truncate text-xs">{labels.gateHint}</span>}
    </span>
  )
}

/** `when <condition>` — the keyword and the expression, as written. */
function GuardLine({ item, labels }: { item: ItemDraft; labels: ValidationLabels }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Keyword tone="flow">{labels.guard}</Keyword>
      <Expression value={item.condition} />
    </span>
  )
}

/** `invariant <assertion> : '<message>'` — one line, because that is what it is in the file. */
function InvariantLine({ item, labels }: { item: ItemDraft; labels: ValidationLabels }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <Keyword tone="flow">{labels.invariantKeyword}</Keyword>
      <Expression value={item.condition} />
      <Message value={item.message} />
    </span>
  )
}

/**
 * One field and everything asked of it, on one line. 📏
 *
 * ## ⚠️ The tracks are the point
 *
 * The field, its checks and its message begin at the same x on every line of the document, so forty
 * rules read as three columns rather than as forty ragged sentences. It is the same reasoning
 * `CHECK_GRID` is built on, one level up: fixed tracks are what turn correct information into
 * information somebody can compare.
 *
 * ## ⚠️ A check is summarised, not spelled out
 *
 * `size(2, 120)` is what the file says and what a reader recognises; the boxes that make it are in the
 * dialog. A check that stops the rest is marked, because that is the one property of a check which
 * changes what the *other* checks on the line mean.
 */
function FieldLine({ item, labels }: { item: ItemDraft; labels: ValidationLabels }) {
  const named = (item.field ?? "").trim()

  return (
    <span className={LINE_GRID}>
      <span
        className={cn(
          "truncate font-mono text-sm font-semibold",
          named === "" && "text-muted-foreground font-normal italic",
        )}
      >
        {named === "" ? labels.unnamedField : named}
      </span>

      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {item.checks.length === 0 ? (
          <span className="text-muted-foreground/70 text-xs">{labels.noChecks}</span>
        ) : (
          item.checks.map((check, at) => (
            <span key={at} className="flex min-w-0 items-baseline gap-x-2">
              {at > 0 && <span className="text-muted-foreground/40 text-xs">·</span>}
              <Check check={check} labels={labels} />
            </span>
          ))
        )}
      </span>

      <Message value={item.message} />
    </span>
  )
}

/**
 * The tracks every field line is laid out on.
 *
 * ⚠️ Stacked below `sm`, where three columns in the width of a phone would each be too narrow to read —
 * `rules/html.md` asks a breakpoint to change the structure rather than only the type size.
 */
const LINE_GRID = cn(
  "flex min-w-0 flex-col gap-0.5",
  "sm:grid sm:grid-cols-[13rem_minmax(0,1fr)_minmax(0,15rem)] sm:items-baseline sm:gap-x-3 sm:gap-y-0",
)

/**
 * One check, the way the file writes it. ⚠️ Marked when a failure here silences the rest.
 *
 * ## ⚠️ Its message rides with it, and that is where the information went
 *
 * The line first had a messages column of its own and it was empty on every row — because a message
 * belongs to a **check**, not to a field, and a field's own message is only the fallback the checks
 * without one take. A column that is blank on forty rows is not a quiet column, it is a column that
 * was measuring the wrong thing. So the message sits beside the check it belongs to, which is also
 * exactly how `size(2, 160) : '…'` reads in the file this is a view of.
 */
function Check({ check, labels }: { check: CheckDraft; labels: ValidationLabels }) {
  const stop = check.stop
  const message = (check.message ?? "").trim()

  return (
    <span className="flex min-w-0 items-baseline gap-x-1.5">
      <span
        title={stop ? labels.stop : undefined}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 font-mono text-xs",
          stop ? "text-destructive" : "text-foreground/90",
        )}
      >
        {stop && <Ban aria-hidden="true" className="size-3 self-center" />}
        {summarise(check)}
      </span>
      {message !== "" && <span className="text-muted-foreground truncate text-xs">{message}</span>}
    </span>
  )
}

/** An expression as somebody wrote it, or a mark that they have not written it yet. */
function Expression({ value }: { value: string | null }) {
  const written = (value ?? "").trim()

  return written === "" ? (
    <span className="text-muted-foreground/60 text-xs">—</span>
  ) : (
    <span className="text-foreground/90 truncate font-mono text-xs">{written}</span>
  )
}

/** What a person is told when it fails. ⚠️ Quiet: it is prose, and the rule is what is being scanned. */
function Message({ value }: { value: string | null }) {
  const written = (value ?? "").trim()

  if (written === "") {
    return <span className="hidden sm:block" />
  }

  return <span className="text-muted-foreground truncate text-xs">{written}</span>
}

/**
 * What a statement can be followed by, here.
 *
 * ⚠️ **`gate` and `always` are offered at the top level only.** The language permits them anywhere, but
 * a gate inside a gate is a statement nobody has had a use for and every extra item in this menu is one
 * more thing to read past on every branch of every document. A file that already contains one round
 * trips through the document tab untouched — the menu decides what is easy to write, never what is
 * allowed to exist.
 *
 * ⚠️ **What it adds opens immediately.** A statement arrives with no field name and no condition, which
 * is a line of the document saying nothing; handing over the form for it is the difference between
 * adding a rule and adding a blank.
 */
function AddStatement({
  labels,
  disabled,
  depth,
  onAdd,
}: {
  labels: ValidationLabels
  disabled?: boolean
  depth: number
  onAdd: (item: ItemDraft) => void
}) {
  const offered: { kind: ItemKind; label: string; make: () => ItemDraft }[] = [
    { kind: "LINE", label: labels.addLine, make: () => blankItem("LINE", { field: "", checks: [] }) },
    { kind: "GUARD", label: labels.addGuard, make: () => blankItem("GUARD", { condition: "" }) },
    { kind: "INVARIANT", label: labels.addInvariant, make: () => blankItem("INVARIANT", { condition: "" }) },
    ...(depth === 0
      ? [
          { kind: "BLOCK" as ItemKind, label: labels.addAlways, make: () => blankItem("BLOCK", { block: "always" }) },
          { kind: "BLOCK" as ItemKind, label: labels.addGate, make: () => blankItem("BLOCK", { block: "gate" }) },
        ]
      : []),
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          className="text-muted-foreground mt-1 h-7 w-fit rounded-none px-2 text-xs"
        >
          <Plus className="size-3.5" />
          {labels.addStatement}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {offered.map((one) => (
          <DropdownMenuItem key={one.label} className="text-xs" onSelect={() => onAdd(one.make())}>
            {one.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The indent under a statement that has one.
 *
 * ⚠️ A hairline and 12 pixels — the whole of what a bordered, padded, rounded box per level would be.
 */
function Branch({ children }: { children: ReactNode }) {
  return <div className="border-border ml-2 border-l pt-0.5 pl-3">{children}</div>
}

/**
 * A word the language actually writes, drawn as one.
 *
 * ⚠️ Square and monospaced, because it *is* the token in the file — `gate`, `when`, `otherwise`. A
 * rounded pill would read as a status chip, which is a different kind of thing and the wrong promise.
 */
function Keyword({ tone, children }: { tone: "gate" | "flow"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "shrink-0 border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase",
        tone === "gate"
          ? "border-destructive/40 text-destructive bg-destructive/10"
          : "border-border text-muted-foreground bg-muted",
      )}
    >
      {children}
    </span>
  )
}

/**
 * What somebody wrote above a statement.
 *
 * ⚠️ Shown rather than hidden, and **not editable** — here or in the dialog. They travel through the
 * form untouched, so saving cannot lose them; letting the form rewrite prose is a separate decision,
 * and one nobody has asked for. A builder that showed nothing would read as though they were gone.
 */
function Comments({ comments }: { comments: string[] }) {
  const written = comments.filter((line) => line.trim() !== "")

  if (written.length === 0) {
    return null
  }

  return (
    <p className="text-muted-foreground/80 mt-1.5 px-2 font-mono text-[11px] leading-snug whitespace-pre-line">
      {written.join("\n")}
    </p>
  )
}

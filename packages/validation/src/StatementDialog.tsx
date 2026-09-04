import { useId, useState, type ReactNode } from "react"
import { CornerDownRight, Plus, Trash2 } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
} from "@jmouse/ui"
import { CheckColumns, CheckRow } from "./CheckRow"
import { blankCheck } from "./drafts"
import type { ValidationLabels } from "./labels"
import type { ItemDraft, OfferedCheck } from "./types"

/**
 * One statement, opened. 🪟
 *
 * ## ⚠️ The form is HERE, and nowhere else on the rules tab
 *
 * The tab used to draw every input of every statement at once: a document judging forty-four forms
 * became several screens of selects and boxes, where the one question a reader arrives with — *what is
 * asked of `vendor`?* — had to be reconstructed from the controls that edit it. A control is a promise
 * that you are about to change something, and forty fields' worth of them promise it about everything
 * simultaneously. So the tab is now a document you read, and this is the form you open when you mean to
 * change one line of it.
 *
 * ## ⚠️ It buffers, and *Cancel* is the reason
 *
 * The statement is copied on open and edited here; **the document sees nothing until *Apply***. That is
 * a second unsaved state stacked under the screen's own Save, which is a real cost — the mitigation is
 * that this one is small, visible and always resolved by closing the dialog, so the two can never be
 * confused for long. What it buys is the thing a form without it cannot offer: a way to try a change to
 * a rule that forty-four forms are judged by, look at it, and put it back.
 *
 * ⚠️ **So closing IS cancelling** — `Esc`, the close button and *Cancel* are one thing, and none of them
 * writes. Outside-click dismissal stays off (`DialogContent`'s default), because a stray click on the
 * page is not a decision to discard.
 *
 * ⚠️ **Cancelling a statement that was just added removes it**, and the branch is what does that — see
 * `ValidationRows`. A new statement arrives blank, so a cancel that merely closed would leave a line in
 * the document that says nothing and that nobody chose to write.
 *
 * ⚠️ ***Remove* is not a draft edit.** It applies at once and closes, because deleting the thing you
 * are editing has nothing left to apply.
 *
 * ## ⚠️ Removing a statement lives here rather than on the row
 *
 * A delete control on every row is forty-four destructive buttons down a page you are trying to read,
 * and on a touch pointer it cannot be hover-hidden. Opening the thing you mean to delete first is one
 * extra click and the only reading of the page that stays calm.
 */
export function StatementDialog({
  item,
  offered,
  labels,
  disabled,
  onApply,
  onRemove,
  onCancel,
}: {
  item: ItemDraft
  offered: OfferedCheck[]
  labels: ValidationLabels
  disabled?: boolean
  /** Writes the edited statement back to the branch. ⚠️ Called only by *Apply*. */
  onApply: (item: ItemDraft) => void
  onRemove: () => void
  /** Closes without writing. ⚠️ The branch removes the statement here when it was just added. */
  onCancel: () => void
}) {
  // ⚠️ Seeded once, deliberately. The dialog is modal, so nothing behind it can change the statement
  // while it is open — and re-seeding from the property would throw away what somebody is typing the
  // moment anything upstream re-rendered. The branch keys this component by index, so opening a
  // different statement mounts a fresh one rather than reusing this state.
  const [draft, setDraft] = useState(item)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
    >
      {/* ⚠️ Wider than the default `sm:max-w-lg`, because a check line is five controls on fixed tracks
          and 32rem cuts the message column off. The body scrolls; the header and footer do not. */}
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          {/* ⚠️ The title follows the draft, not the property — renaming a field and watching the
              heading still say the old name reads as the edit not having registered. */}
          <DialogTitle>{titleFor(draft, labels)}</DialogTitle>
          <DialogDescription>{labels.dialogHint}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] min-h-0 flex-col gap-4 overflow-y-auto">
          <Written comments={draft.comments} labels={labels} />

          {draft.kind === "LINE" && (
            <FieldForm
              item={draft}
              offered={offered}
              labels={labels}
              disabled={disabled}
              onChange={setDraft}
            />
          )}

          {draft.kind === "GUARD" && (
            <GuardForm item={draft} labels={labels} disabled={disabled} onChange={setDraft} />
          )}

          {draft.kind === "INVARIANT" && (
            <InvariantForm item={draft} labels={labels} disabled={disabled} onChange={setDraft} />
          )}

          {draft.kind === "BLOCK" && (
            <BlockForm item={draft} labels={labels} disabled={disabled} onChange={setDraft} />
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
            {labels.removeRow}
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {labels.cancel}
            </Button>
            <Button type="button" disabled={disabled} onClick={() => onApply(draft)}>
              {labels.apply}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** What the dialog is about, in the words the language uses for it. */
function titleFor(item: ItemDraft, labels: ValidationLabels): string {
  if (item.kind === "LINE") {
    const field = (item.field ?? "").trim()

    return field === "" ? labels.fieldTitle : `${labels.fieldTitle} · ${field}`
  }

  if (item.kind === "GUARD") {
    return labels.guardTitle
  }

  if (item.kind === "INVARIANT") {
    return labels.invariantTitle
  }

  return labels.blockTitle
}

/**
 * One field, its fallback message, and everything asked of it.
 *
 * ⚠️ **The checks keep the grid they always had.** `CheckColumns` and `CheckRow` are unchanged and
 * still line their arguments and messages up on fixed tracks — that table was never the problem, the
 * problem was drawing forty of them at once on a page nobody was editing.
 */
function FieldForm({
  item,
  offered,
  labels,
  disabled,
  onChange,
}: {
  item: ItemDraft
  offered: OfferedCheck[]
  labels: ValidationLabels
  disabled?: boolean
  onChange: (item: ItemDraft) => void
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[16rem_minmax(0,1fr)]">
        <Stacked label={labels.field}>
          {(id) => (
            <Input
              id={id}
              value={item.field ?? ""}
              disabled={disabled}
              className="font-mono"
              onChange={(event) => onChange({ ...item, field: event.target.value })}
            />
          )}
        </Stacked>

        {/* ⚠️ Captioned *default*, not *message*. A check with no message of its own takes this one, so
            calling both boxes "Message" put one word on two things, one of which is the other's
            fallback. */}
        <Stacked label={labels.lineMessage}>
          {(id) => (
            <Input
              id={id}
              value={item.message ?? ""}
              placeholder="—"
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...item, message: event.target.value.trim() === "" ? null : event.target.value })
              }
            />
          )}
        </Stacked>
      </div>

      <section className="flex flex-col">
        {item.checks.length === 0 ? (
          <p className="text-muted-foreground border-border/70 border-t py-2 text-xs">{labels.noChecks}</p>
        ) : (
          <>
            <CheckColumns labels={labels} />
            {item.checks.map((check, at) => (
              <CheckRow
                key={at}
                value={check}
                offered={offered}
                labels={labels}
                disabled={disabled}
                onChange={(changed) =>
                  onChange({
                    ...item,
                    checks: item.checks.map((one, index) => (index === at ? changed : one)),
                  })
                }
                onRemove={() =>
                  onChange({ ...item, checks: item.checks.filter((_, index) => index !== at) })
                }
              />
            ))}
          </>
        )}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || offered.length === 0}
          className="text-muted-foreground mt-1 h-7 w-fit rounded-none px-2 text-xs"
          onClick={() =>
            onChange({ ...item, checks: [...item.checks, blankCheck(offered[0]?.check ?? "required")] })
          }
        >
          <Plus className="size-3.5" />
          {labels.addCheck}
        </Button>
      </section>
    </>
  )
}

/**
 * `when <condition> { … }`, and whether the other branch exists.
 *
 * ⚠️ **`otherwise` is brought into being and taken away deliberately, because `null` and `[]` are
 * different documents.** `otherwise { }` says somebody considered the other case and decided nothing
 * applies; drawing an empty branch for a null would write that sentence into a file nobody wrote it in.
 * What the branch *contains* is edited on the page behind, where it is drawn — this only decides
 * whether it is there at all.
 */
function GuardForm({
  item,
  labels,
  disabled,
  onChange,
}: {
  item: ItemDraft
  labels: ValidationLabels
  disabled?: boolean
  onChange: (item: ItemDraft) => void
}) {
  return (
    <>
      <Stacked label={labels.condition}>
        {(id) => (
          <Input
            id={id}
            value={item.condition ?? ""}
            disabled={disabled}
            className="font-mono"
            onChange={(event) => onChange({ ...item, condition: event.target.value })}
          />
        )}
      </Stacked>

      {item.otherwise === null ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="w-fit rounded-none"
          onClick={() => onChange({ ...item, otherwise: [] })}
        >
          <CornerDownRight className="size-3.5" />
          {labels.addOtherwise}
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="text-muted-foreground hover:text-destructive w-fit rounded-none"
          onClick={() => onChange({ ...item, otherwise: null })}
        >
          <Trash2 className="size-3.5" />
          {labels.removeOtherwise}
        </Button>
      )}
    </>
  )
}

/** `invariant <assertion> : '<message>'` — the two halves of the one line it is in the file. */
function InvariantForm({
  item,
  labels,
  disabled,
  onChange,
}: {
  item: ItemDraft
  labels: ValidationLabels
  disabled?: boolean
  onChange: (item: ItemDraft) => void
}) {
  return (
    <div className="grid gap-4">
      <Stacked label={labels.invariant}>
        {(id) => (
          <Input
            id={id}
            value={item.condition ?? ""}
            disabled={disabled}
            className="font-mono"
            onChange={(event) => onChange({ ...item, condition: event.target.value })}
          />
        )}
      </Stacked>

      <Stacked label={labels.checkMessage}>
        {(id) => (
          <Input
            id={id}
            value={item.message ?? ""}
            placeholder="—"
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...item, message: event.target.value.trim() === "" ? null : event.target.value })
            }
          />
        )}
      </Stacked>
    </div>
  )
}

/**
 * `always { … }` or `gate { … }`.
 *
 * ⚠️ **Switching between them was not possible at all before**, in the form or anywhere else — a block
 * was drawn with its keyword and no way to change it, so turning an `always` into a `gate` meant typing
 * on the document tab. The consequence is written beside the choice, because "gate" alone says nothing
 * about why it differs from "always" and that difference is the only reason to reach for one.
 */
function BlockForm({
  item,
  labels,
  disabled,
  onChange,
}: {
  item: ItemDraft
  labels: ValidationLabels
  disabled?: boolean
  onChange: (item: ItemDraft) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Stacked label={labels.blockKind}>
        {(id) => (
          <NativeSelect
            id={id}
            value={item.block === "gate" ? "gate" : "always"}
            disabled={disabled}
            className="w-48 font-mono"
            onChange={(event) => onChange({ ...item, block: event.target.value })}
          >
            <option value="always">{labels.alwaysKeyword}</option>
            <option value="gate">{labels.gateKeyword}</option>
          </NativeSelect>
        )}
      </Stacked>

      {item.block === "gate" && <p className="text-muted-foreground text-xs">{labels.gateHint}</p>}
    </div>
  )
}

/**
 * A label above its control.
 *
 * ⚠️ Stacked here and beside the input everywhere else, and that is not an inconsistency: the rules tab
 * spends its height on forty statements, this dialog spends it on one. The control is handed the id
 * rather than the wrapper guessing at one, so the `<label for>` binding is real and not decorative.
 */
function Stacked({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase"
      >
        {label}
      </Label>
      {children(id)}
    </div>
  )
}

/** What somebody wrote above the statement. ⚠️ Shown so saving cannot look like it lost them. */
function Written({ comments, labels }: { comments: string[]; labels: ValidationLabels }) {
  const written = comments.filter((line) => line.trim() !== "")

  if (written.length === 0) {
    return null
  }

  return (
    <div className="border-border/70 flex flex-col gap-1 border-l-2 pl-3">
      <span className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
        {labels.written}
      </span>
      <p className="text-muted-foreground font-mono text-[11px] leading-snug whitespace-pre-line">
        {written.join("\n")}
      </p>
    </div>
  )
}

import { useEffect, useState, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@jmouse/ui"
import { ValidationDocument } from "./ValidationDocument"
import { ValidationRows } from "./ValidationRows"
import { DEFAULT_LABELS, type ValidationLabels } from "./labels"
import { useOfferedChecks, useParsedValidation, useRenderedValidation } from "./hooks"
import type { ValidationDraft } from "./types"

/**
 * A validation built from rows, with the `.jmv` it is beside it. 🧷
 *
 * ## ⚠️ Two tabs over ONE thing, not a form and a preview of one
 *
 * The document tab is not a rendering of something that will be produced later — it **is** the
 * document, and it is what gets saved. Every change in the rows is sent and comes back as text from the
 * server's own writer, which is the same call an editor's save goes through. So there is no version of
 * the file that only the browser knows how to write.
 *
 * ## ⚠️ The one rule to check in a review
 *
 * **No `.jmv` is assembled in this package.** Not a colon, not a brace, not a quoted literal. Rows go
 * out and text comes back; text goes out and rows come back. A browser that wrote the language would be
 * a second implementation of it, and the two would disagree the first time somebody wrote a message
 * containing an apostrophe.
 *
 * ## ⚠️ It brings no chrome of its own
 *
 * No title, no dialog, no save button. A product mounts it wherever it means to and owns the frame, the
 * heading and what saving means. A shared component that drew its own dialog would be one every product
 * had to fight.
 *
 * ## ⚠️ `fill` is about the box around it, and both answers are needed
 *
 * Mounted on a screen the builder should take the height it is given and scroll inside itself, so the
 * tab strip stays put while a long document moves. Mounted inside something that already scrolls — a
 * dialog's body — the same arrangement collapses to nothing, because a flex child with `min-h-0` inside
 * an auto-height parent has no height to divide. So the flowing shape is the default and filling is
 * asked for.
 */
export function ValidationBuilder({
  value,
  labels: given,
  className,
  fill = false,
  toolbar,
  onChange,
  onDocument,
}: {
  /** The validation being edited. ⚠️ Controlled — a builder that owned this could not be saved. */
  value: ValidationDraft
  labels?: Partial<ValidationLabels>
  className?: string
  /** Take the height of the box and scroll inside, rather than growing to fit. */
  fill?: boolean
  /** Rendered on the tab strip's own line, at the right — where a product puts Save. */
  toolbar?: ReactNode
  onChange: (draft: ValidationDraft) => void
  /** The document as it now stands, so a product can save it. */
  onDocument?: (text: string) => void
}) {
  const labels = { ...DEFAULT_LABELS, ...given }

  // ⚠️ `null` while the rows are what the document is made from. A string means somebody typed in the
  // document tab, and until that is read back or discarded the two halves genuinely differ — which the
  // panel says outright rather than picking a winner.
  const [edited, setEdited] = useState<string | null>(null)

  const offered = useOfferedChecks()
  const rendered = useRenderedValidation(value, edited === null)
  const parsed = useParsedValidation(edited ?? "", edited !== null)

  const document = edited ?? rendered.data?.text ?? ""
  const refusal = edited === null ? null : (parsed.data?.refusal ?? null)
  const settled = edited === null ? (rendered.data?.text ?? null) : null

  // ⚠️ In an effect rather than in the body: a product's `onDocument` will set state, and calling it
  // while rendering makes the render itself a side effect — which React warns about on a good day and
  // loops on a bad one. And only the SETTLED document is handed over, never text somebody is still
  // typing into the other tab.
  useEffect(() => {
    if (settled !== null) {
      onDocument?.(settled)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled])

  return (
    <Tabs defaultValue="form" className={cn("gap-0", fill && "min-h-0 flex-1", className)}>
      {/* The strip is a rule across the whole width with the tabs sitting on it, and whatever the
          product puts at the right sitting on the same line. Two stacked bars — tabs, then a toolbar —
          spend twice the height saying one thing about where you are. */}
      <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-0">
        <TabsList variant="line" className="h-8">
          <TabsTrigger value="form" className="px-1 text-xs">
            {labels.formTab}
          </TabsTrigger>
          <TabsTrigger value="document" className="px-1 text-xs">
            {labels.documentTab}
          </TabsTrigger>
        </TabsList>
        {toolbar && <div className="ml-auto flex items-center gap-2 pb-1">{toolbar}</div>}
      </div>

      <TabsContent value="form" className={cn("pt-3", fill && "min-h-0 flex-1 overflow-y-auto")}>
        {edited !== null && (
          <p className="text-muted-foreground border-border/70 mb-3 flex items-start gap-2 border-l-2 py-1 pl-3 text-xs">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {labels.unreadChanges}
          </p>
        )}

        <ValidationRows
          items={value.items}
          offered={offered.data ?? []}
          labels={labels}
          // ⚠️ Locked while the document tab holds unread text. Editing both ends of one thing at once
          // is the state where one of the two edits has to be silently thrown away.
          disabled={edited !== null}
          onChange={(items) => onChange({ ...value, items })}
        />
      </TabsContent>

      {/* ⚠️ `flex` rather than a scroller: the code surface does its own scrolling, and a second one
          around it gives a long document two scrollbars and a footer nobody can reach. */}
      <TabsContent value="document" className={cn("pt-3", fill && "flex min-h-0 flex-1 flex-col")}>
        <ValidationDocument
          text={document}
          // ⚠️ The editor takes the pane's height where the pane has one, and a fixed 60vh where the
          // box around it grows to fit — a percentage inside an auto-height parent resolves to nothing.
          height={fill ? "100%" : "60vh"}
          edited={edited !== null}
          refusal={refusal}
          unreachable={edited !== null && parsed.isError}
          readable={parsed.data?.draft != null}
          labels={labels}
          onEdit={setEdited}
          onRevert={() => setEdited(null)}
          onApply={() => {
            const draft = parsed.data?.draft

            if (draft == null) {
              return
            }

            onChange(draft)
            setEdited(null)
          }}
        />
      </TabsContent>
    </Tabs>
  )
}

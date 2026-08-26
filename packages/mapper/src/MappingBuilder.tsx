import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@jmouse/ui"
import { MappingDocument } from "./MappingDocument"
import { MappingForm } from "./MappingForm"
import { DEFAULT_LABELS, type MapperLabels } from "./labels"
import { draftOf, formOf, type MappingFormModel } from "./naming"
import { useMappableTypes, useParsedMapping, useRenderedMapping } from "./hooks"

/**
 * A mapping built from a form, with the `.jmm` it is beside it. 🧷
 *
 * ## ⚠️ Two tabs over ONE thing, not a form and a preview of one
 *
 * The document tab is not a rendering of something that will be produced later — it **is** the document,
 * and it is what gets saved. Every keystroke in the form is sent as rows and comes back as text from the
 * server's own translator, which is the same call an editor's save goes through. So there is no version
 * of the file that only the browser knows how to write.
 *
 * ## ⚠️ The one rule to check in a review
 *
 * **No `.jmm` is assembled in this package.** Not a colon, not a pipe, not a quoted literal. Rows go out
 * and text comes back; text goes out and rows come back. A browser that wrote the language would be a
 * second implementation of it, and the two would disagree the first time somebody mapped a value
 * containing a quote.
 *
 * ## ⚠️ And a document the form cannot show goes read-only, by name
 *
 * A `fragment`, an `include`, a `let`, a `refuse` block or a whole-pair conversion has no row. The panel
 * says which one and stops offering the form. It never shows what it understood and leaves the rest out
 * of view — that form saves, and the save deletes what it never showed.
 */
export function MappingBuilder({
  value,
  labels: given,
  className,
  onChange,
  onDocument,
}: {
  /** The mapping being edited. ⚠️ Controlled — a builder that owned this could not be saved. */
  value: MappingFormModel
  labels?: Partial<MapperLabels>
  className?: string
  onChange: (form: MappingFormModel) => void
  /** The document as it now stands, so a product can save it. */
  onDocument?: (text: string) => void
}) {
  const labels = { ...DEFAULT_LABELS, ...given }

  // ⚠️ `null` while the form is what the document is made from. A string means somebody typed in the
  // document tab, and until that is read back or discarded the two halves genuinely differ — which the
  // panel says outright rather than picking a winner.
  const [edited, setEdited] = useState<string | null>(null)

  const offered = useMappableTypes()
  const rendered = useRenderedMapping(draftOf(value), edited === null)
  const parsed = useParsedMapping(edited ?? "", edited !== null)

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
    <Tabs defaultValue="form" className={cn("space-y-4", className)}>
      <TabsList>
        <TabsTrigger value="form">{labels.formTab}</TabsTrigger>
        <TabsTrigger value="document">{labels.documentTab}</TabsTrigger>
      </TabsList>

      <TabsContent value="form" className="space-y-4">
        {edited === null ? null : (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>{labels.unreadChanges}</AlertDescription>
          </Alert>
        )}

        <MappingForm
          form={value}
          offered={offered.data ?? []}
          labels={labels}
          // ⚠️ Locked while the document tab holds unread text. Editing both ends of one thing at once
          // is the state where one of the two edits has to be silently thrown away.
          disabled={edited !== null}
          onChange={onChange}
        />
      </TabsContent>

      <TabsContent value="document">
        <MappingDocument
          text={document}
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

            onChange(formOf(draft))
            setEdited(null)
          }}
        />
      </TabsContent>
    </Tabs>
  )
}

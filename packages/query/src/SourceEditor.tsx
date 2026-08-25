import { useEffect, useMemo, useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { AlertTriangle, Check, Lock, RotateCcw, Table2 } from "lucide-react"
import { Badge, Button, cn } from "@jmouse/ui"
import { jmqSyntax } from "@jmouse/codemirror"
import { useCodeThemeExtensions } from "@jmouse/codemirror/react"
import { JmqCode } from "./JmqCode"
import { useSourceActions, useSourceDeclaration, useSourceVerdict } from "./hooks"
import type { QueryLabels } from "./labels"
import type { QuerySubject } from "./types"

/**
 * The declaration itself — read where it is derived, written where it is a document.
 *
 * ## ⚠️ Two origins, and the screen never blurs them
 *
 * A **derived** source has no author: what a query may name follows from fields somebody put on a form,
 * so there is nothing to write and the editor says so rather than offering a disabled box. An
 * **authored** source is a document, and this is where it is written.
 *
 * Showing a greyed editor for the first case would invite the question *why can I not edit this*, whose
 * answer is not *you lack a permission* but *there is nothing here to edit*. Those are different
 * sentences and only one of them is true.
 *
 * ## ⚠️ Every judgement on this screen is the SERVER's
 *
 * Whether the text parses, whether its mapping may reach the tables it names, and whether this person
 * may save it at all are three answers that arrive from the backend. A browser deciding any of them
 * would be a second implementation — of the grammar, of the allow-list, of the gate — and the three
 * disagree the day one is changed.
 *
 * ## ⚠️ Saving the first time is not an edit
 *
 * The editor opens on what the product currently runs, projected. So the first save turns a declaration
 * that lived in code into a row, and the button says as much — *Take over* rather than *Save* — because
 * that is a decision with consequences rather than a keystroke being persisted.
 */
export function SourceEditor({
  subject,
  labels,
}: {
  subject: QuerySubject
  labels: QueryLabels
}) {
  const { data: declaration, isLoading, error } = useSourceDeclaration(subject)
  const actions = useSourceActions(subject)
  const theme = useCodeThemeExtensions()

  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)

  // ⚠️ Seeded ONCE per incoming declaration, never on every render: the editor owns the text while
  // somebody is typing, and re-seeding from the query would replace their work mid-word.
  useEffect(() => {
    setDraft(declaration?.body ?? "")
    setTouched(false)
  }, [declaration?.body])

  const verdict = useSourceVerdict(subject, draft, touched)

  const extensions = useMemo(() => [jmqSyntax(), EditorView.lineWrapping, ...theme], [theme])

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted/40" />
  }

  /*
    ⚠️ **A FAILED request and a declining subject are two different sentences.**

    They were one: both fell through to "this subject does not show its declaration", which is a claim
    about the product rather than about the request. It sent the reader looking for a reason in the
    backend's design when the actual answer was a 404 — the route was mounted without its prefix, and the
    screen calmly explained that entries are built from forms.

    An empty state standing in for an error is the most expensive kind of wrong, because nobody reports
    it: it reads as the product working.
  */
  if (error) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-dashed border-destructive/40 p-3 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>{labels.manager.declarationFailed}</span>
      </p>
    )
  }

  if (!declaration || declaration.body === null) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>{labels.manager.noProjection}</span>
      </p>
    )
  }

  if (!declaration.writable) {
    return (
      <div className="space-y-2">
        <Standing declaration={declaration} labels={labels} />
        <JmqCode value={declaration.body} lineNumbers />
      </div>
    )
  }

  const changed = draft !== declaration.body
  const refused = verdict.data?.readable === false

  return (
    <div className="space-y-2">
      <Standing declaration={declaration} labels={labels} />

      <div className="overflow-hidden rounded-lg border border-border/60">
        <CodeMirror
          value={draft}
          extensions={extensions}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
          onChange={(value) => {
            setDraft(value)
            setTouched(true)
          }}
        />
      </div>

      {/* ⚠️ Silent until somebody has typed. A refusal under an untouched editor reads as an accusation
          about text the person did not write. */}
      {touched && verdict.data ? (
        <p
          className={cn(
            "flex items-start gap-2 text-xs",
            refused ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {refused ? (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <Check className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>{verdict.data.message}</span>
        </p>
      ) : null}

      {/* ⚠️ The tables this declaration reaches, listed because they are the thing that is guarded. A
          person rewriting a mapping is choosing tables whether or not the screen admits it. */}
      {verdict.data?.tables.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Table2 className="size-3.5 text-muted-foreground" />
          {verdict.data.tables.map((table) => (
            <Badge key={table} variant="outline" className="font-normal text-muted-foreground">
              {table}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || !changed || refused}
          onClick={() => {
            setBusy(true)
            void actions.rewrite(draft).finally(() => setBusy(false))
          }}
        >
          {declaration.authored ? labels.manager.saveChanges : labels.manager.takeOver}
        </Button>

        {changed ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(declaration.body ?? "")
              setTouched(false)
            }}
          >
            {labels.manager.cancel}
          </Button>
        ) : null}

        {/* ⚠️ Only where a row exists, and it restores the declaration the product ships rather than
            leaving the source undefined — which is why it is not the destructive act it looks like. */}
        {declaration.authored ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void actions.revert().finally(() => setBusy(false))
            }}
          >
            <RotateCcw className="mr-1 size-3.5" />
            {labels.manager.revert}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Where this declaration came from, in one line.
 *
 * ⚠️ It says why something cannot be edited, rather than leaving the absence of a button to imply it.
 * *Derived*, *nobody has published a table*, and *you may not* are three different reasons and a reader
 * acts differently on each.
 */
function Standing({
  declaration,
  labels,
}: {
  declaration: { origin: string; authored: boolean; writable: boolean; publishesTables: boolean }
  labels: QueryLabels
}) {
  const words = declaration.origin === "DERIVED"
    ? labels.manager.derivedNote
    : declaration.authored
      ? labels.manager.authoredNote
      : !declaration.publishesTables
        ? labels.manager.nothingPublished
        : declaration.writable
          ? labels.manager.shippedNote
          : labels.manager.notYours

  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      {declaration.writable ? null : <Lock className="mt-0.5 size-3.5 shrink-0" />}
      <span>{words}</span>
    </p>
  )
}

import { useState } from "react"
import { Check, Globe, Lock, Pencil, SquarePen, Trash2, User, X } from "lucide-react"
import { Badge, Button, Input } from "@jmouse/ui"
import { JmqCode } from "./JmqCode"
import { QueryEditor } from "./QueryEditor"
import { useSavedQueryActions, useSavedQueryViews, useTranslation } from "./hooks"
import type { QueryLabels } from "./labels"
import type { AppliedQuery } from "./QueryPanel"
import type { SavedQueryView } from "./transport"
import type { QuerySubject } from "./types"

/**
 * Every view kept against one subject, in full — read, renamed, rewritten, discarded.
 *
 * ## ⚠️ Not the row from the panel, and the difference is the job
 *
 * The panel's row is for *picking* one while composing, so it is chips and its controls hide until
 * hovered. This is for *managing* them, so every view shows its query and every control is present
 * without hovering — a control revealed by hover does not exist on a touch screen, and a management
 * screen is exactly where somebody goes to fix something on a tablet.
 *
 * ## ⚠️ `editable` is the SERVER's answer, and a preset is not a second kind of thing
 *
 * A ready-made question is a view owned by the installation. It lists here beside the ones somebody kept
 * themselves, marked as everyone's and read-only — which is what makes it renameable by whoever may, and
 * needs no mechanism of its own. Nothing here derives that from an author id: a screen working out who
 * may edit is a second implementation of a permission, and the two disagree the day one is changed.
 */
export function SavedQueryLibrary({
  subject,
  labels,
  onOpen,
}: {
  subject: QuerySubject
  labels: QueryLabels
  /** Given, each view offers to open the screen it belongs to. Omitted, none do. */
  onOpen?: (subject: QuerySubject, query: AppliedQuery) => void
}) {
  const { data: views = [], isLoading } = useSavedQueryViews(subject)
  const actions = useSavedQueryActions(subject)

  if (!actions.supported) {
    return <p className="text-xs text-muted-foreground">{labels.manager.noStore}</p>
  }

  if (isLoading) {
    return <div className="h-20 animate-pulse rounded-lg bg-muted/40" />
  }

  if (views.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
        {labels.manager.noViews}
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {views.map((view) => (
        <SavedQueryCard
          key={view.id}
          view={view}
          subject={subject}
          labels={labels}
          onOpen={onOpen}
        />
      ))}
    </ul>
  )
}

/**
 * One kept question.
 *
 * ⚠️ **Its own component, so its own edit state.** Held on the list, opening one editor would leave the
 * previous one's half-typed text sitting in the next — which reads as a query mysteriously rewriting
 * itself.
 */

function SavedQueryCard({
  view,
  subject,
  labels,
  onOpen,
}: {
  view: SavedQueryView
  subject: QuerySubject
  labels: QueryLabels
  onOpen?: (subject: QuerySubject, query: AppliedQuery) => void
}) {
  const actions = useSavedQueryActions(subject)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(view.name)
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(view.filter ?? "")
  const [discarding, setDiscarding] = useState(false)
  const [busy, setBusy] = useState(false)

  // ⚠️ The SERVER's verdict on what is being typed, exactly as the panel's editor gets it. A rule about
  // what makes a query valid, written here, would be a second grammar that agrees for about a month.
  const { data: translated } = useTranslation(subject, { filter: body }, editing && body.trim() !== "")
  const editable = view.editable !== false

  async function commit(draft: { name?: string; filter?: string | null }) {
    setBusy(true)
    try {
      await actions.update(view.id, {
        name: (draft.name ?? view.name).trim(),
        description: view.description ?? null,
        filter: draft.filter === undefined ? view.filter : draft.filter,
        order: view.order ?? null,
        shared: view.shared,
      })
      setRenaming(false)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="space-y-2 rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <>
            <Input
              autoFocus
              value={name}
              disabled={busy}
              size="sm"
              className="w-56"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim() !== "") {
                  void commit({ name })
                }
                if (event.key === "Escape") {
                  setRenaming(false)
                  setName(view.name)
                }
              }}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={busy || name.trim() === ""}
              title={labels.manager.saveChanges}
              onClick={() => void commit({ name })}
            >
              <Check className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title={labels.manager.cancel}
              onClick={() => {
                setRenaming(false)
                setName(view.name)
              }}
            >
              <X className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">{view.name}</span>
            <Marker icon={view.shared ? Globe : User}>
              {view.shared ? labels.manager.everyone : labels.manager.mine}
            </Marker>
            {editable ? null : <Marker icon={Lock}>{labels.manager.readOnly}</Marker>}
            <span className="ml-auto flex items-center gap-1">
              {onOpen === undefined ? null : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onOpen(subject, { filter: view.filter, order: view.order ?? null })}
                >
                  {labels.manager.open}
                </Button>
              )}
              {editable ? (
                <>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title={labels.renameView}
                    onClick={() => setRenaming(true)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    title={labels.manager.editBody}
                    onClick={() => setEditing((open) => !open)}
                  >
                    <SquarePen className="size-3.5" />
                  </Button>
                  {/*
                    ⚠️ The second click confirms, and the confirming button says what it will DO rather
                    than "Yes" — a button labelled Yes beside a list of saved work is the one people
                    press by muscle memory.
                  */}
                  {discarding ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void actions.remove(view.id)}
                    >
                      {labels.discardView}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title={labels.discardView}
                      onClick={() => setDiscarding(true)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </>
              ) : null}
            </span>
          </>
        )}
      </div>
      {view.description ? (
        <p className="text-xs text-muted-foreground">{view.description}</p>
      ) : null}
      {editing ? (
        <div className="space-y-2">
          <QueryEditor value={body} translated={translated} labels={labels} onChange={setBody} />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || translated?.readable === false}
              onClick={() => void commit({ filter: body.trim() === "" ? null : body })}
            >
              {labels.manager.saveChanges}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setBody(view.filter ?? "")
              }}
            >
              {labels.manager.cancel}
            </Button>
          </div>
        </div>
      ) : view.filter ? (
        <JmqCode value={view.filter} />
      ) : null}
    </li>
  )
}

/**
 * ⚠️ The toolkit's `Badge`, not a span shaped like one.
 *
 * This was a hand-rolled pill — its own radius, its own border, its own 11px face. Which happened to
 * agree with `Badge` and would have stopped agreeing the first time `Badge` changed, silently and only
 * on this screen. A badge is not a control and does not take a control's shape; what shape it does take
 * is the toolkit's decision, and copying that decision is how a copy drifts from it.
 */

function Marker({ icon: Icon, children }: { icon: typeof Globe; children: React.ReactNode }) {

  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      <Icon className="size-3" />
      {children}
    </Badge>
  )
}

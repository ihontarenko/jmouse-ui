import { useState } from "react"
import { Bookmark, Check, Pencil, Trash2, X } from "lucide-react"
import { Button, Input } from "@jmouse/ui"
import { useSavedQueryActions, useSavedQueryViews } from "./hooks"
import type { QueryLabels } from "./labels"
import type { AppliedQuery } from "./QueryPanel"
import type { QuerySubject } from "./types"

/**
 * The questions somebody kept — listed, applied, renamed and discarded, in one row.
 *
 * ## ⚠️ It renders NOTHING where the product wired no store
 *
 * Not an empty shelf, not a disabled button. A shelf that can never fill reads as *you have saved
 * nothing* rather than as *this product does not keep these*, and the first is a lie somebody acts on.
 *
 * ## ⚠️ Renaming happens in the row, and discarding asks once
 *
 * A dialog for a name is three interactions for one word. A confirmation for a delete is one
 * interaction for something unrecoverable — so the row asks in place, and the second click is the
 * confirmation. ⚠️ Which is also why the confirming button says what it will do rather than *Yes*: a
 * button labelled *Yes* beside a list of saved work is the button people press by muscle memory.
 *
 * ## ⚠️ `editable` is the SERVER's answer
 *
 * Never derived from an author id here. A screen working out who may edit is a second implementation of
 * a permission, and two implementations disagree the day one is changed.
 */
export function SavedQueries({
  subject,
  current,
  labels,
  onApply,
}: {
  subject: QuerySubject
  current: AppliedQuery
  labels: QueryLabels
  onApply: (query: AppliedQuery) => void
}) {
  const { data: views = [] } = useSavedQueryViews(subject)
  const actions = useSavedQueryActions(subject)

  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")
  const [renaming, setRenaming] = useState<string | null>(null)
  const [discarding, setDiscarding] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!actions.supported) {
    return null
  }

  // ⚠️ Nothing to keep is not the same as nothing kept: a panel with an empty query offers no Save,
  // because a view that narrows nothing is a view that does nothing.
  const keepable = Boolean(current.filter || current.order)

  async function keep() {
    if (!name.trim()) {
      return
    }

    setBusy(true)

    try {
      await actions.save({ name: name.trim(), filter: current.filter ?? null, order: current.order ?? null })
      setNaming(false)
      setName("")
    } finally {
      setBusy(false)
    }
  }

  async function rename(id: string, view: { filter: string | null; order?: string | null }) {
    if (!name.trim()) {
      return
    }

    setBusy(true)

    try {
      await actions.update(id, { name: name.trim(), filter: view.filter, order: view.order ?? null })
      setRenaming(null)
      setName("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Bookmark className="size-3.5" />
        {labels.savedViews}
      </span>

      {views.map((view) =>
        renaming === view.id ? (
          <span key={view.id} className="inline-flex items-center gap-1">
            <Input
              autoFocus
              value={name}
              disabled={busy}
              className="h-7 w-40 text-xs"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void rename(view.id, view)
                }
                if (event.key === "Escape") {
                  setRenaming(null)
                }
              }}
            />
            <Button type="button" size="icon" variant="ghost" className="size-7" disabled={busy}
                    title={labels.saveView} onClick={() => void rename(view.id, view)}>
              <Check className="size-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-7"
                    title={labels.reset} onClick={() => setRenaming(null)}>
              <X className="size-3.5" />
            </Button>
          </span>
        ) : (
          <span key={view.id} className="group inline-flex items-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              title={view.description ?? undefined}
              className="h-7 rounded-full px-3 text-xs font-normal"
              onClick={() => onApply({ filter: view.filter, order: view.order ?? null })}
            >
              {view.name}
              {view.shared ? <span className="ml-1.5 text-muted-foreground">◆</span> : null}
            </Button>

            {view.editable === false ? null : (
              <span className="ml-0.5 hidden items-center group-hover:inline-flex focus-within:inline-flex">
                <Button type="button" size="icon" variant="ghost" className="size-6"
                        title={labels.renameView}
                        onClick={() => {
                          setRenaming(view.id)
                          setName(view.name)
                          setDiscarding(null)
                        }}>
                  <Pencil className="size-3" />
                </Button>

                {/* ⚠️ Two clicks, and the second one SAYS what it does — see the class note. */}
                {discarding === view.id ? (
                  <Button type="button" size="sm" variant="ghost" disabled={busy}
                          className="h-6 px-2 text-xs text-destructive"
                          onClick={() => {
                            setBusy(true)
                            void actions.remove(view.id).finally(() => {
                              setBusy(false)
                              setDiscarding(null)
                            })
                          }}>
                    {labels.discardView}
                  </Button>
                ) : (
                  <Button type="button" size="icon" variant="ghost" className="size-6"
                          title={labels.discardView} onClick={() => setDiscarding(view.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </span>
            )}
          </span>
        ),
      )}

      {naming ? (
        <span className="inline-flex items-center gap-1">
          <Input
            autoFocus
            value={name}
            disabled={busy}
            placeholder={labels.viewName}
            className="h-7 w-44 text-xs"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void keep()
              }
              if (event.key === "Escape") {
                setNaming(false)
              }
            }}
          />
          <Button type="button" size="icon" variant="ghost" className="size-7" disabled={busy}
                  title={labels.saveView} onClick={() => void keep()}>
            <Check className="size-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-7"
                  title={labels.reset} onClick={() => setNaming(false)}>
            <X className="size-3.5" />
          </Button>
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!keepable}
          title={keepable ? undefined : labels.nothingToSave}
          className="h-7 px-2 text-xs font-normal"
          onClick={() => {
            setNaming(true)
            setName("")
          }}
        >
          <Bookmark className="mr-1 size-3.5" />
          {labels.saveView}
        </Button>
      )}
    </div>
  )
}

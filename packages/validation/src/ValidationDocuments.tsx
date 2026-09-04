import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, FilePlus2, Search, Trash2, Unlink } from "lucide-react"
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PageState,
  cn,
} from "@jmouse/ui"
import { ValidationBuilder } from "./ValidationBuilder"
import { emptyDraft } from "./drafts"
import { useValidationTransport, type StoredDocument } from "./transport"
import type { ValidationDraft } from "./types"

/**
 * Who points at a document, as the product knows it. 🔗
 *
 * ⚠️ **The library cannot answer this and must not try.** `validation_documents` has no foreign key
 * into anything — deliberately, because one into a `jmouse-*` table needs its collation pinned and
 * orders two migration histories against each other. So what points at a document is knowledge
 * belonging to whatever keeps the pointer, and the screen asks the product for it.
 */
export interface DocumentUsage {
  /** What is bound — a form's name, as a person would recognise it. */
  label: string
  /** Its identifier, for the detach call. */
  id: string
}

/**
 * Every validation document, and what a person may do with them. 🗂️
 *
 * ## ⚠️ A LIST BESIDE A DOCUMENT, not a table with a window over it
 *
 * This screen used to be a four-column table, and editing opened a modal. Two things were wrong with
 * that and both were structural. The document being edited is the rules for — in this installation —
 * forty-four forms, written across several screens of `.jmv`; a dialog gives it a fixed 4xl box with a
 * scrollbar inside a scrollbar, and buries the list of what it judges above the editor so the editor
 * starts below the fold. And a table of documents compares nothing down a column: a name, a count and
 * a date are one subject's three facts, not three columns worth ranking.
 *
 * So the list is a rail and the document is the page. Selecting is navigation, editing is in place, and
 * the height on screen is the height available.
 *
 * ## ⚠️ A document is SHARED, and the screen is built around that
 *
 * Several forms may point at one document — that is the point of the design, not a corner case. So
 * every row says how many things use it, the editor says plainly that saving changes all of them, and
 * deleting one that is still used is **refused here** rather than left to a foreign key that does not
 * exist.
 *
 * ## ⚠️ `usage` and `onDetach` are optional, and the screen is honest when they are absent
 *
 * A product that keeps no references passes neither, and the screen simply does not claim to know. What
 * it never does is show "0 uses" for a product it did not ask — a count nobody computed reads exactly
 * like a document nothing depends on, and that is the one wrong answer that gets a document deleted.
 */
export function ValidationDocuments({
  usage,
  onDetach,
  labels = DEFAULT_LABELS,
  className,
}: {
  /** Who points at a document. Omitted where the product keeps no references. */
  usage?: (document: StoredDocument) => Promise<DocumentUsage[]>
  /** Detaches one user from a document. Required for the detach control to appear. */
  onDetach?: (document: StoredDocument, user: DocumentUsage) => Promise<void>
  labels?: DocumentsLabels
  className?: string
}) {
  const transport = useValidationTransport()

  const [documents, setDocuments] = useState<StoredDocument[] | null>(null)
  const [uses, setUses] = useState<Record<string, DocumentUsage[]>>({})
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [written, setWritten] = useState("")
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<StoredDocument | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [unreadable, setUnreadable] = useState<string | null>(null)

  const reload = async (): Promise<StoredDocument[]> => {
    const listed = await transport.documents()

    setDocuments(listed)

    if (usage === undefined) {
      return listed
    }

    // ⚠️ Sequential rather than a fan-out. A listing of forty documents would otherwise open forty
    // connections at once, and the answer is a hint beside a row — not something anybody is waiting on.
    const collected: Record<string, DocumentUsage[]> = {}

    // ⚠️ **A failure here is NOT an empty list.** Swallowing it printed "used by nothing" against a
    // document forty-four forms were bound to, and "nothing" is precisely the answer that gets a
    // document deleted. It surfaces, and the counts stay unknown rather than wrong.
    for (const document of listed) {
      collected[document.id] = await usage(document)
    }

    setUses(collected)

    return listed
  }

  /**
   * ⚠️ **The first document opens itself, and that is not a convenience.** A rail beside an empty pane
   * is a screen whose only content is an instruction to click the one row on it — and this installation
   * has exactly one document, so *every* visit began on that dead step. It opens only when nothing is
   * open, so it never argues with a choice somebody has made.
   */
  const openFirst = (listed: StoredDocument[]) =>
    setOpenedId((was) => was ?? listed[0]?.id ?? null)

  const refresh = () => reload().catch((error) => setFailure(messageOf(error)))

  useEffect(() => {
    // ⚠️ The first read is the one that decides whether the screen exists at all, so its failure is the
    // whole screen rather than a line on it — see `unreadable` below.
    reload()
      .then(openFirst)
      .catch((error) => setUnreadable(messageOf(error)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const opened = documents?.find((document) => document.id === openedId) ?? null

  const listed = useMemo(() => {
    if (documents === null) {
      return []
    }

    const wanted = written.trim().toLowerCase()

    return wanted === ""
      ? documents
      : documents.filter((document) => document.name.toLowerCase().includes(wanted))
  }, [documents, written])

  if (unreadable !== null) {
    return <PageState kind="error" title={labels.unreadable} text={unreadable} className={className} />
  }

  if (documents === null) {
    return <PageState kind="loading" rows={6} className={className} />
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {failure !== null && (
        <p className="text-destructive border-destructive/50 bg-destructive/5 flex items-start gap-2 border-b border-l-2 px-4 py-1.5 text-xs">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {failure}
        </p>
      )}

      {/* ⚠️ **The breakpoint rearranges rather than narrows.** Below `lg` there is no width at which a
          19rem rail and a document both read, so one of the two is on screen at a time and the header
          carries the way back. Hiding the rail and leaving the document at 320px would be the same
          screen, cramped. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside
          aria-label={labels.title}
          className={cn("min-h-0 flex-col lg:flex lg:border-r", opened === null ? "flex" : "hidden")}
        >
          <div className="border-border flex items-center gap-2 border-b px-3 py-2">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
              {labels.title}
            </span>
            <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
              {documents.length}
            </span>
            <Button
              size="icon"
              variant="ghost"
              title={labels.create}
              className="size-7 shrink-0"
              onClick={() => setCreating(true)}
            >
              <FilePlus2 className="size-4" />
              <span className="sr-only">{labels.create}</span>
            </Button>
          </div>

          {/* ⚠️ Only once a list is long enough to search. A filter box above three rows is furniture
              that says the screen expects more than it has. */}
          {documents.length > 6 && (
            <div className="border-border relative border-b">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <Input
                value={written}
                placeholder={labels.filter}
                aria-label={labels.filter}
                className="h-9 rounded-none border-0 pl-8 font-mono text-xs focus-visible:ring-0"
                onChange={(event) => setWritten(event.target.value)}
              />
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {documents.length === 0 ? (
              <PageState
                kind="empty"
                title={labels.empty}
                text={labels.emptyHint}
                actions={[{ label: labels.create, primary: true, onClick: () => setCreating(true) }]}
              />
            ) : listed.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-xs">{labels.noMatch}</p>
            ) : (
              listed.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  users={uses[document.id]}
                  knownUsage={usage !== undefined}
                  active={document.id === openedId}
                  labels={labels}
                  onOpen={() => setOpenedId(document.id)}
                />
              ))
            )}
          </div>
        </aside>

        <section className={cn("min-h-0 flex-col lg:flex", opened === null ? "hidden" : "flex")}>
          {opened === null ? (
            <PageState kind="empty" title={labels.nothingOpen} text={labels.nothingOpenHint} />
          ) : (
            <OpenDocument
              // ⚠️ Keyed, so switching documents remounts rather than reuses. A builder carrying the
              // previous document's draft is one Save away from writing those rules over this one.
              key={opened.id}
              document={opened}
              users={uses[opened.id] ?? []}
              knownUsage={usage !== undefined}
              labels={labels}
              onDetach={onDetach}
              onBack={() => setOpenedId(null)}
              onRemove={() => setRemoving(opened)}
              onSaved={refresh}
              onFailure={setFailure}
            />
          )}
        </section>
      </div>

      <DocumentCreator
        open={creating}
        labels={labels}
        onClose={() => setCreating(false)}
        onCreated={(name) => {
          setCreating(false)
          reload()
            .then((all) => setOpenedId(all.find((one) => one.name === name)?.id ?? null))
            .catch((error) => setFailure(messageOf(error)))
        }}
      />

      <DocumentRemover
        document={removing}
        users={removing === null ? [] : (uses[removing.id] ?? [])}
        knownUsage={usage !== undefined}
        labels={labels}
        onClose={() => setRemoving(null)}
        onRemoved={() => {
          // ⚠️ The selection goes with it. A rail highlighting a row that no longer exists leaves the
          // pane showing a document the store has forgotten, and the next Save recreates it.
          setOpenedId((was) => (was === removing?.id ? null : was))
          setRemoving(null)
          reload()
            .then(openFirst)
            .catch((error) => setFailure(messageOf(error)))
        }}
      />
    </div>
  )
}

/** One document in the rail: its name, and the two facts worth knowing before opening it. */
function DocumentRow({
  document,
  users,
  knownUsage,
  active,
  labels,
  onOpen,
}: {
  document: StoredDocument
  users: DocumentUsage[] | undefined
  knownUsage: boolean
  active: boolean
  labels: DocumentsLabels
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      className={cn(
        "border-border/60 flex w-full flex-col gap-0.5 border-b border-l-2 px-3 py-2 text-left",
        "transition-colors duration-[120ms]",
        active
          ? "border-l-primary bg-muted"
          : "hover:bg-muted/50 border-l-transparent",
      )}
      onClick={onOpen}
    >
      <span className="truncate font-mono text-xs font-medium">{document.name}</span>
      <span className="text-muted-foreground text-[11px] tabular-nums">
        {usageWord(users, knownUsage, labels)} · {shortDate(document.updatedAt)}
      </span>
    </button>
  )
}

/**
 * How many things point at a document, in a rail's worth of room.
 *
 * ⚠️ Three states, not two. "Nothing uses this" and "nobody asked" look the same as a zero and mean
 * opposite things when somebody is deciding whether to delete it.
 */
function usageWord(
  users: DocumentUsage[] | undefined,
  known: boolean,
  labels: DocumentsLabels,
): string {
  if (!known) {
    return labels.usageUnknown
  }

  if (users === undefined) {
    return "…"
  }

  return users.length === 0 ? labels.usedByNothing : labels.counted(users.length)
}

/**
 * The document that is open — what it is, what it judges, and the builder over it.
 *
 * ⚠️ **It says out loud that saving changes every form pointing at it.** A pane that looked like a
 * per-form editor while editing a shared document is how somebody tightens one form's rules and refuses
 * records on forty-three others.
 */
function OpenDocument({
  document,
  users,
  knownUsage,
  labels,
  onDetach,
  onBack,
  onRemove,
  onSaved,
  onFailure,
}: {
  document: StoredDocument
  users: DocumentUsage[]
  knownUsage: boolean
  labels: DocumentsLabels
  onDetach?: (document: StoredDocument, user: DocumentUsage) => Promise<void>
  onBack: () => void
  onRemove: () => void
  onSaved: () => void
  onFailure: (message: string) => void
}) {
  const transport = useValidationTransport()

  const [draft, setDraft] = useState<ValidationDraft | null>(null)
  const [rendered, setRendered] = useState("")
  /**
   * ⚠️ The document as the round trip first produced it — the thing "changed" is measured against.
   *
   * Not the stored source: the server's writer normalises, so a document that was hand-typed comes back
   * differing in whitespace from what is on disk, and comparing against disk would arm Save on every
   * document the moment it opened. The first settled render is what the rows *are*; anything after it
   * is somebody's edit.
   */
  const [baseline, setBaseline] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [detached, setDetached] = useState<string[]>([])
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    transport
      .document(document.id)
      .then((full) => transport.parse(full.source ?? ""))
      .then(setDraft)
      .catch((error) => setFailure(messageOf(error)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id])

  const remaining = users.filter((user) => !detached.includes(user.id))
  const changed = baseline !== null && rendered !== "" && rendered !== baseline

  const save = async () => {
    setSaving(true)

    try {
      await transport.rewrite(document.id, rendered)
      setBaseline(rendered)
      onSaved()
    } catch (error) {
      setFailure(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="border-border border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="-ml-1 size-7 shrink-0 lg:hidden"
            onClick={onBack}
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">{labels.back}</span>
          </Button>

          <h2 className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{document.name}</h2>

          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive h-7 shrink-0 px-2"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only sm:not-sr-only sm:ml-1 sm:text-xs">{labels.remove}</span>
          </Button>
        </div>

        <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
          {knownUsage ? labels.judges(remaining.length) : labels.usageUnknownLong} ·{" "}
          {labels.changed} {new Date(document.updatedAt).toLocaleString()}
        </p>
      </header>

      {knownUsage && remaining.length > 1 && (
        <p className="text-destructive border-destructive/50 bg-destructive/5 flex items-center gap-2 border-b border-l-2 px-4 py-1.5 text-xs">
          <AlertTriangle className="size-3.5 shrink-0" />
          {labels.editingShared(remaining.length)}
        </p>
      )}

      {failure !== null && (
        <p className="text-destructive flex items-start gap-2 border-b px-4 py-1.5 text-xs">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {failure}
        </p>
      )}

      {knownUsage && remaining.length > 0 && (
        <BoundTo
          document={document}
          users={remaining}
          labels={labels}
          onDetach={onDetach}
          onDetached={(id) => setDetached((was) => [...was, id])}
          onFailure={(message) => {
            setFailure(message)
            onFailure(message)
          }}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-2 pb-4">
        {draft === null ? (
          <PageState kind="loading" rows={5} />
        ) : (
          <ValidationBuilder
            fill
            value={draft}
            onChange={setDraft}
            onDocument={(text) => {
              setRendered(text)
              setBaseline((was) => was ?? text)
            }}
            toolbar={
              <Button size="sm" className="h-7 px-3 text-xs" disabled={!changed || saving} onClick={save}>
                {saving ? labels.saving : labels.save}
              </Button>
            }
          />
        )}
      </div>
    </>
  )
}

/**
 * What the open document judges, folded away.
 *
 * ⚠️ **Folded, because forty-four names are not the subject of this screen.** They were rendered open
 * above the editor and took more vertical room than the rules did, so the thing somebody came here to
 * edit began below the fold. The count is always visible — that is the fact that matters — and the
 * names are one click away for when somebody is detaching one.
 */
function BoundTo({
  document,
  users,
  labels,
  onDetach,
  onDetached,
  onFailure,
}: {
  document: StoredDocument
  users: DocumentUsage[]
  labels: DocumentsLabels
  onDetach?: (document: StoredDocument, user: DocumentUsage) => Promise<void>
  onDetached: (id: string) => void
  onFailure: (message: string) => void
}) {
  return (
    <Collapsible className="border-border group/bound border-b">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-4 py-1.5 text-xs">
        <ChevronRight className="size-3.5 shrink-0 transition-transform duration-[120ms] group-data-[state=open]/bound:rotate-90" />
        {labels.boundTo}
        <span className="tabular-nums">{users.length}</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="flex flex-wrap gap-1 px-4 pt-1 pb-2.5">
          {users.map((user) => (
            <span
              key={user.id}
              className="border-border bg-muted/60 flex items-center gap-1 border px-1.5 py-0.5 text-[11px]"
            >
              {user.label}
              {onDetach !== undefined && (
                <button
                  type="button"
                  title={labels.detach}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    onDetach(document, user)
                      .then(() => onDetached(user.id))
                      .catch((error) => onFailure(messageOf(error)))
                  }
                >
                  <Unlink className="size-3" />
                  <span className="sr-only">
                    {labels.detach} — {user.label}
                  </span>
                </button>
              )}
            </span>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * A new document.
 *
 * ⚠️ The name is asked for and never generated. It is the address the language itself uses —
 * `validation "innoventa/common-fields"` — so a machine-made one would be a second identifier nobody
 * could read in a file.
 */
function DocumentCreator({
  open,
  labels,
  onClose,
  onCreated,
}: {
  open: boolean
  labels: DocumentsLabels
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const transport = useValidationTransport()

  const [name, setName] = useState("")
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    setName("")
    setFailure(null)
  }, [open])

  const create = async () => {
    const wanted = name.trim()

    try {
      // ⚠️ Rendered by the server from an empty draft, never typed here. One writer of the language.
      const { text } = await transport.render(emptyDraft(wanted))

      await transport.write(wanted, text)
      onCreated(wanted)
    } catch (error) {
      setFailure(messageOf(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.create}</DialogTitle>
          <DialogDescription>{labels.createHint}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="validation-document-name">{labels.name}</Label>
          <Input
            id="validation-document-name"
            value={name}
            placeholder="product/what-it-covers"
            className="font-mono text-sm"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {failure !== null && <p className="text-destructive text-sm">{failure}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {labels.close}
          </Button>
          <Button disabled={name.trim() === ""} onClick={create}>
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Deleting one.
 *
 * ⚠️ **Refused while anything still points at it**, here, because nothing else will refuse it. The
 * store has no foreign key by design, so a deleted document leaves every form pointing at it refusing
 * every record — which is loud, but arrives at whoever submits a record rather than at whoever deleted
 * it.
 */
function DocumentRemover({
  document,
  users,
  knownUsage,
  labels,
  onClose,
  onRemoved,
}: {
  document: StoredDocument | null
  users: DocumentUsage[]
  knownUsage: boolean
  labels: DocumentsLabels
  onClose: () => void
  onRemoved: () => void
}) {
  const transport = useValidationTransport()
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => setFailure(null), [document?.id])

  const blocked = knownUsage && users.length > 0

  return (
    <Dialog open={document !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.remove}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{document?.name}</DialogDescription>
        </DialogHeader>

        {blocked ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {labels.stillUsed(users.length)}
            </p>
            <div className="flex flex-wrap gap-1">
              {users.map((user) => (
                <span
                  key={user.id}
                  className="border-border bg-muted/60 border px-1.5 py-0.5 text-[11px]"
                >
                  {user.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm">{knownUsage ? labels.removeSafe : labels.removeUnknown}</p>
        )}

        {failure !== null && <p className="text-destructive text-sm">{failure}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {labels.close}
          </Button>
          <Button
            variant="destructive"
            disabled={blocked || document === null}
            onClick={() =>
              transport
                .remove(document?.name ?? "")
                .then(onRemoved)
                .catch((error) => setFailure(messageOf(error)))
            }
          >
            {labels.remove}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A date in a rail's worth of room.
 *
 * ⚠️ The full stamp is on the open document, where there is room for it. A rail carries the day, which
 * is the resolution somebody scanning a list actually reads at.
 */
function shortDate(stamp: string): string {
  return new Date(stamp).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

/**
 * A refusal's own words, wherever the product's client left them.
 *
 * ⚠️ The server says useful things — which document, which line, which forms still point at it — and a
 * screen that showed "something went wrong" would throw all of it away.
 */
function messageOf(error: unknown): string {
  const body = (error as { body?: unknown })?.body ?? (error as { response?: { data?: unknown } })?.response?.data

  const detail = (body as { detail?: string })?.detail ?? (error as { detail?: string })?.detail

  return detail ?? (error as { message?: string })?.message ?? String(error)
}

/** Every word this screen says, so a product can translate it. */
export interface DocumentsLabels {
  title: string
  filter: string
  noMatch: string
  back: string
  nothingOpen: string
  nothingOpenHint: string
  unreadable: string

  empty: string
  emptyHint: string
  counted: (count: number) => string
  judges: (count: number) => string
  name: string
  usedByNothing: string
  usageUnknown: string
  usageUnknownLong: string
  changed: string
  create: string
  createHint: string
  remove: string
  removeSafe: string
  removeUnknown: string
  stillUsed: (count: number) => string
  editingShared: (count: number) => string
  boundTo: string
  detach: string
  save: string
  saving: string
  close: string
}

export const DEFAULT_LABELS: DocumentsLabels = {
  title: "Documents",
  filter: "Filter by name…",
  noMatch: "No document has that in its name.",
  back: "Back to the documents",
  nothingOpen: "Nothing open",
  nothingOpenHint: "Choose a document to see the rules it holds and what it judges.",
  unreadable: "The documents could not be read.",

  empty: "No validation documents yet.",
  emptyHint: "A document is the rules a record is judged by. One may judge many forms.",
  counted: (count) => `${count} form${count === 1 ? "" : "s"}`,
  judges: (count) =>
    count === 0 ? "judges nothing yet" : `judges ${count} form${count === 1 ? "" : "s"}`,
  name: "Name",
  usedByNothing: "used by nothing",
  usageUnknown: "—",
  usageUnknownLong: "what points at it is not known here",
  changed: "changed",
  create: "New document",
  createHint: "The name is the address the language uses, so it is written into the file itself.",
  remove: "Delete",
  removeSafe: "Nothing points at this document. Deleting it removes it permanently.",
  removeUnknown: "Deleting it removes it permanently. Anything still pointing at it will refuse records.",
  stillUsed: (count) =>
    `This document still judges ${count} form${count === 1 ? "" : "s"}. Detach ${count === 1 ? "it" : "them"} first — a deleted document makes every form pointing at it refuse every record.`,
  editingShared: (count) => `Saving changes the rules for all ${count} forms this document judges.`,
  boundTo: "Bound to",
  detach: "Detach",
  save: "Save",
  saving: "Saving…",
  close: "Close",
}

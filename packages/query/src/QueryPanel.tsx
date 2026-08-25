import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CornerDownRight,
  PenLine,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@jmouse/ui"
import { QueryBuilder } from "./QueryBuilder"
import { SavedQueries } from "./SavedQueries"
import { QueryEditor } from "./QueryEditor"
import { useQueryVocabulary, useSavedQueryActions, useTranslation } from "./hooks"
import { DEFAULT_LABELS, type QueryLabels } from "./labels"
import { offered, type QueryPreset } from "./presets"
import type { ConditionRow, QuerySubject } from "./types"

/** What a listing is filtered by — the two strings a URL and a saved view carry. */
export interface AppliedQuery {
  filter?: string | null
  order?: string | null
}

/**
 * Composing a query — from a ready question, in controls, or in the language itself.
 *
 * ## ⚠️ The language is never written here
 *
 * The builder sends **rows** and gets text back; the editor sends **text** and gets rows back. One call
 * either way, carrying the verdict too. Nothing in this package concatenates or matches jMQ, and nothing
 * in it may start — a browser-side writer and a browser-side reader are two implementations of one
 * grammar, and two implementations drift. They drifted far enough to compare a supplied value against
 * its own name, silently.
 *
 * ## ⚠️ One panel, every subject area
 *
 * Entries, equipment, issues — they differ by a `subject` and a set of presets. Nothing below asks what
 * it is looking at, which is why a new filterable listing costs a `QuerySubject` on the server and a list
 * of presets, rather than a branch in every control.
 *
 * ## ⚠️ Opening a query the builder could not have written
 *
 * The server answers `rows: null` and the panel says so, staying on the text tab. It does **not** draw an
 * approximation: quietly rewriting somebody's expression on save is how an editor loses their trust
 * permanently, and the day it happens is the day nobody hand-edits anything again.
 *
 * ## ⚠️ Nothing is applied until somebody asks
 *
 * A panel that filtered on every keystroke would send a listing request per character over a join, and
 * would make a half-typed condition look like an empty result. A preset obeys the same rule: it **fills
 * the box** and leaves the person to press the button.
 *
 * ## ⚠️ Two bands, and the shelf is one of them
 *
 * **This opens over the list it narrows**, so every row of chrome is a row of answers somebody cannot
 * see while they work. It used to spend three of them before a single condition: ready questions, then
 * saved views, then the tabs. The first two are one offer — *start from something already written* — so
 * they share a band at the top, and everything about composing sits in the band below it.
 *
 * ## ⚠️ The builder shows what it wrote
 *
 * A line of jMQ under the rows, and clicking it opens the text tab on exactly that. The two tabs were
 * otherwise two products: rows on one side, a language on the other, and no way to see that the first
 * produces the second. Nothing here composes that line — it is the server's own answer, the same one the
 * text tab holds.
 */
export function QueryPanel({
  subject,
  query,
  presets = [],
  labels: given,
  placeholder,
  onApply,
}: {
  subject: QuerySubject
  query: AppliedQuery
  presets?: readonly QueryPreset[]
  labels?: Partial<QueryLabels>
  placeholder?: string
  onApply: (query: AppliedQuery) => void
}) {
  const labels = useMemo<QueryLabels>(() => ({ ...DEFAULT_LABELS, ...given }), [given])

  const { data: vocabulary } = useQueryVocabulary(subject)
  const attributes = useMemo(() => vocabulary?.attributes ?? [], [vocabulary])
  const operators = useMemo(() => vocabulary?.operators ?? [], [vocabulary])
  const available = useMemo(() => offered(presets, attributes), [presets, attributes])

  // ⚠️ Asked here as well as inside `SavedQueries`, because the shelf that holds both groups has to
  // know whether it would be empty. It is one memoised answer, not a second request.
  const { supported: keepsViews } = useSavedQueryActions(subject)

  const [tab, setTab] = useState<"builder" | "text">("builder")
  const [rows, setRows] = useState<ConditionRow[]>([])
  const [text, setText] = useState(query.filter ?? "")
  const [sortBy, setSortBy] = useState("")
  const [descending, setDescending] = useState(false)
  const [handWritten, setHandWritten] = useState(false)

  /**
   * ⚠️ **A panel opened over a list that is ALREADY narrowed starts from that query, not from nothing.**
   *
   * The translation goes one way or the other, and the direction used to be decided by the tab alone —
   * so a panel mounting on the builder tab asked the server to translate its own empty set of rows, got
   * an empty filter back, and wrote that over the query the list was actually obeying. Reopening the
   * panel after applying anything therefore showed a blank builder above a filtered list, and the next
   * Apply silently widened it back to everything.
   *
   * Until the rows for an incoming filter have been drawn once, the text is what is sent.
   */
  const [seeded, setSeeded] = useState(() => (query.filter ?? "").trim() === "")

  /**
   * ⚠️ Which direction the translation goes is decided by which tab is in front, not by what changed
   * last. Sending both would leave the server choosing which of two things the person meant, and it
   * would choose wrongly at exactly the moment they disagree.
   */
  const translation = useMemo(
    () =>
      tab === "builder" && !handWritten && seeded
        ? { rows, orderBy: sortBy, descending }
        : { filter: text, orderBy: sortBy, descending },
    [tab, handWritten, seeded, rows, text, sortBy, descending],
  )

  const translated = useTranslation(subject, translation, attributes.length > 0)
  const answer = translated.data

  /**
   * ⚠️ **The two halves are kept in step by the SERVER's answer, never by each other.**
   *
   * Whichever side the person is working on, the answer carries both — so the builder's rows become the
   * text the other tab shows, and written text becomes the rows the builder draws. Neither side ever
   * derives the other, which is the entire point of moving the language out of the browser.
   *
   * Without this the text tab showed its placeholder while the builder held a perfectly good filter —
   * two halves of one query that had never been introduced.
   */
  useEffect(() => {
    if (answer === undefined) {
      return
    }

    if (translation.rows !== undefined) {
      setText(answer.filter)
      return
    }

    // ⚠️ `?? null`, never `=== null`. A backend serialising non-null OMITS the field, so an undrawable
    // query arrives with `rows` undefined — and `rows === null` is then silently always false. That is
    // exactly how `submitter == currentMember` was offered to a builder that cannot write it.
    const drawable = answer.rows ?? null

    setHandWritten(drawable === null)
    setRows(drawable ?? [])
    setSeeded(true)

    if (drawable === null) {
      setTab("text")
    }
  }, [answer, translation.rows])

  // ⚠️ Read ONCE per incoming filter, not on every render: the builder owns its rows while somebody is
  // composing, and re-deriving them from the text it just produced would fight the person typing.
  //
  // ⚠️ And a filter arriving from OUTSIDE — a saved view, a link — is one the builder has never drawn,
  // so it goes back through the server the same way an opening panel's does.
  useEffect(() => {
    setText(query.filter ?? "")
    setSeeded((query.filter ?? "").trim() === "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.filter])

  function take(preset: QueryPreset) {
    setText(preset.filter)
    setTab("text")
    setHandWritten(false)
    setSortBy(preset.sort?.by ?? "")
    setDescending(preset.sort?.descending ?? false)
  }

  const apply = () =>
    onApply({ filter: (answer?.filter ?? "") || null, order: (answer?.order ?? "") || null })

  /**
   * ⚠️ **Whether pressing Apply would change anything**, judged on the server's text rather than on the
   * rows — the rows are one of two ways of arriving at it, and the applied query is only ever text.
   *
   * A panel left open otherwise sits there with a primary button on it suggesting there is something to
   * press, which is how a person ends up re-applying the filter they are already looking at and
   * wondering what they changed.
   */
  const unapplied =
    answer !== undefined &&
    ((answer.filter || null) !== (query.filter || null) || (answer.order || null) !== (query.order || null))

  const hasComposition = rows.length > 0 || text.trim() !== "" || sortBy !== ""
  const narrowed = Boolean(query.filter || query.order)

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/30">
      {/* ── The shelf: everything somebody else already wrote ─────────────────────────────── */}
      {available.length > 0 || keepsViews ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-b border-border/50 bg-muted/30 px-3 py-2">
          {available.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5" />
                {labels.presets}
              </span>

              {available.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  // ⚠️ `xs`, and so is everything else on this band. It is not a pill and not a size of
                  // its own — the whole shelf is one row of shortcuts at one height, which is what lets
                  // two rows become one without it reading as a jumble. The composing controls below
                  // keep the toolkit's `sm`, and the border between the bands is what separates them.
                  size="xs"
                  variant="outline"
                  title={preset.explains}
                  className="px-2.5 font-normal"
                  onClick={() => take(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          ) : null}

          {/*
            ⚠️ Applying a saved view goes through the SAME `onApply` the button uses, so a screen learns
            nothing new about where a query came from. A second path — "restore a view" beside "apply a
            filter" — is two ways of arriving at one state, and they drift the first time one grows a step.
          */}
          <SavedQueries
            subject={subject}
            current={{ filter: answer?.filter ?? text ?? null, order: answer?.order ?? null }}
            labels={labels}
            onApply={(applied) => {
              setText(applied.filter ?? "")
              setHandWritten(false)
              onApply(applied)
            }}
          />
        </div>
      ) : null}

      <div className="p-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as "builder" | "text")}>
          {/*
            ⚠️ ONE row: how the query is written on the left, what is done with it on the right.

            The sort, the direction and the two buttons used to be a bordered footer of their own — a
            fourth storey under the presets, the tabs and the builder, costing about ninety pixels to hold
            two controls and two buttons. A filter panel opens over the list it narrows, so every row it
            takes is a row of answers somebody cannot see while they work; and a person reaching for Apply
            was reaching past the whole builder to get there.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              <TabsTrigger value="builder" disabled={handWritten}>
                <SlidersHorizontal className="size-4" />
                {labels.builderTab}
                {/* What the other tab is holding, so switching to it is never a surprise. */}
                {rows.length > 0 ? (
                  <span className="rounded-full bg-foreground/10 px-1.5 text-[10px] leading-4 font-medium">
                    {rows.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="text">
                <PenLine className="size-4" />
                {labels.textTab}
              </TabsTrigger>
            </TabsList>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Label className="mr-0.5 text-xs text-muted-foreground">{labels.sortBy}</Label>

              {/*
                ⚠️ `size="sm"` rather than a hand-set height. It was `h-8 … text-sm` — thirty-two
                pixels and a fourteen-pixel face, neither of which is a size the toolkit has, so it
                stood two pixels taller and one step larger than the two buttons on its own row.
              */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger size="sm" className="w-[150px]">
                  <SelectValue placeholder={labels.sortDefault} />
                </SelectTrigger>
                <SelectContent>
                  {attributes.map((attribute) => (
                    <SelectItem key={attribute.name} value={attribute.name}>
                      {attribute.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* ⚠️ An arrow rather than a switch and the word *descending* beside it — the same one
                  fact in a fifth of the width, on the one row this panel has for everything that is
                  not a condition. The word survives as the title, where a caption is actually read. */}
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-pressed={descending}
                title={descending ? labels.descending : labels.ascending}
                onClick={() => setDescending((previous) => !previous)}
              >
                {descending ? (
                  <ArrowDownWideNarrow className="size-4" />
                ) : (
                  <ArrowUpNarrowWide className="size-4" />
                )}
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!hasComposition && !narrowed}
                className="text-muted-foreground"
                onClick={() => {
                  setRows([])
                  setText("")
                  setSortBy("")
                  setDescending(false)
                  setHandWritten(false)
                  setTab("builder")
                  onApply({ filter: null, order: null })
                }}
              >
                {labels.reset}
              </Button>

              {/*
                ⚠️ Refused BEFORE it is sent, using the server's own verdict — so the refusal a person sees
                while composing and the one the listing would answer with are the same judgement.
              */}
              <Button
                type="button"
                size="sm"
                variant={unapplied ? "default" : "outline"}
                onClick={apply}
                disabled={answer?.readable === false}
              >
                {labels.apply}
              </Button>
            </div>
          </div>

          <TabsContent value="builder">
            <QueryBuilder
              attributes={attributes}
              operators={operators}
              rows={rows}
              labels={labels}
              onChange={setRows}
            />

            {/* ⚠️ The composed query, and a door into it. Silent while there is nothing composed: a
                caption over an empty string reads as a fault rather than as a blank. */}
            {answer?.filter ? (
              <button
                type="button"
                title={labels.composedOpen}
                onClick={() => setTab("text")}
                className="mt-2 flex w-full min-w-0 items-center gap-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <CornerDownRight className="size-3.5 shrink-0" />
                <span className="shrink-0">{labels.composed}</span>
                <code className="truncate font-mono text-[11px]">{answer.filter}</code>
              </button>
            ) : null}
          </TabsContent>

          <TabsContent value="text" className="space-y-2">
            {handWritten ? <p className="text-xs text-muted-foreground">{labels.handWritten}</p> : null}

            <QueryEditor
              value={text}
              translated={answer}
              labels={labels}
              placeholder={placeholder}
              onChange={(value) => {
                setText(value)
                setHandWritten(false)
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

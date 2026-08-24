import { useEffect, useMemo, useState } from "react"
import { PenLine, SlidersHorizontal, Sparkles } from "lucide-react"
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@jmouse/ui"
import { QueryBuilder } from "./QueryBuilder"
import { QueryEditor } from "./QueryEditor"
import { useQueryVocabulary, useTranslation } from "./hooks"
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

  const [tab, setTab] = useState<"builder" | "text">("builder")
  const [rows, setRows] = useState<ConditionRow[]>([])
  const [text, setText] = useState(query.filter ?? "")
  const [sortBy, setSortBy] = useState("")
  const [descending, setDescending] = useState(false)
  const [handWritten, setHandWritten] = useState(false)

  /**
   * ⚠️ Which direction the translation goes is decided by which tab is in front, not by what changed
   * last. Sending both would leave the server choosing which of two things the person meant, and it
   * would choose wrongly at exactly the moment they disagree.
   */
  const translation = useMemo(
    () =>
      tab === "builder" && !handWritten
        ? { rows, orderBy: sortBy, descending }
        : { filter: text, orderBy: sortBy, descending },
    [tab, handWritten, rows, text, sortBy, descending],
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

    if (drawable === null) {
      setTab("text")
    }
  }, [answer, translation.rows])

  // ⚠️ Read ONCE per incoming filter, not on every render: the builder owns its rows while somebody is
  // composing, and re-deriving them from the text it just produced would fight the person typing.
  useEffect(() => {
    setText(query.filter ?? "")
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

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card/30 p-4">
      {available.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            {labels.presets}
          </span>

          {available.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant="outline"
              title={preset.explains}
              className="h-7 rounded-full px-3 text-xs font-normal"
              onClick={() => take(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as "builder" | "text")}>
        <TabsList>
          <TabsTrigger value="builder" disabled={handWritten}>
            <SlidersHorizontal className="size-4" />
            {labels.builderTab}
          </TabsTrigger>
          <TabsTrigger value="text">
            <PenLine className="size-4" />
            {labels.textTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="pt-4">
          <QueryBuilder
            attributes={attributes}
            operators={operators}
            rows={rows}
            labels={labels}
            onChange={setRows}
          />
        </TabsContent>

        <TabsContent value="text" className="space-y-2 pt-4">
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

      <div className="flex flex-wrap items-end gap-3 border-t border-border/60 pt-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{labels.sortBy}</Label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[220px]">
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
        </div>

        <div className="flex items-center gap-2 pb-2">
          <Switch id="jmq-descending" checked={descending} onCheckedChange={setDescending} />
          <Label htmlFor="jmq-descending" className="text-xs font-normal text-muted-foreground">
            {labels.descending}
          </Label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
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
          <Button type="button" onClick={apply} disabled={answer?.readable === false}>
            {labels.apply}
          </Button>
        </div>
      </div>
    </div>
  )
}

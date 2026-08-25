import { useState } from "react"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@jmouse/ui"
import { JmqCode } from "./JmqCode"
import { useSourceActions, useSourceAttributes, useSourceDeclaration } from "./hooks"
import type { QueryLabels } from "./labels"
import type { SourceAttribute, SourceVerdict } from "./transport"
import type { QuerySubject } from "./types"

/** What may be written after the colon. ⚠️ The language's own list, not a superset invented here. */
const TYPES = ["string", "text", "int", "number", "boolean", "temporal", "unknown"]

/** How a value is reached. ⚠️ `join` is spelled `join`, never `joined` — the reader accepts both and
 *  silently reads the second as `column`, which loses the join and reads the wrong table. */
const ACCESS = ["column", "join", "bag", "collection"]

/**
 * A declaration as a table of attributes.
 *
 * ## ⚠️ It sends ROWS and is handed jMQ back
 *
 * Nothing here concatenates the language. The rows go to the server, the server builds the nodes and its
 * own translator writes them out — the same round trip the query builder makes, for the same reason: a
 * browser-side writer is a second implementation of a grammar, and the one it competes with is the one
 * that decides what actually runs.
 *
 * So the jMQ below the table is not a preview of what will be sent. It **is** what will be sent.
 *
 * ## ⚠️ What this builder deliberately cannot express
 *
 * A join's two columns, a bag's side table, a collection's link — those are `bag { }` and `join { }`
 * blocks, and a table of four fields per row has nowhere to put them. An attribute can be *marked* as
 * reached through one, which is what the access column does, but the block itself is written in the code
 * tab. A builder that silently dropped those blocks on save would delete working joins, so it says which
 * attributes it cannot fully describe rather than pretending it described them.
 */
export function AttributesBuilder({
  subject,
  labels,
}: {
  subject: QuerySubject
  labels: QueryLabels
}) {
  const { data: declaration } = useSourceDeclaration(subject)
  const actions = useSourceActions(subject)

  // ⚠️ Read by the SERVER, never parsed here — and asked as a QUERY rather than fired from an effect.
  // The first attempt used `useEffect` with a `cancelled` flag: in development the effect runs twice,
  // the first answer is discarded, and the table stayed empty with two successful requests in the
  // network log and nothing at all in the console. Rows are a function of the body, which is what a
  // query is for.
  const { data: read } = useSourceAttributes(subject, declaration?.body)

  const [edited, setEdited] = useState<Draft | null>(null)
  const [composed, setComposed] = useState<SourceVerdict | null>(null)
  const [busy, setBusy] = useState(false)

  // ⚠️ What the server read, until somebody changes something — then their draft, whole. Merging the
  // two would mean a row somebody deleted quietly coming back the next time the query refetched.
  const draft: Draft = edited ?? {
    structure: declaration?.subject ?? subject.name,
    table: read?.tables.at(0) ?? "",
    alias: "",
    key: "",
    rows: read?.attributes ?? [],
  }

  const { structure, table, alias, key, rows } = draft
  const touched = edited !== null

  const change = (part: Partial<Draft>) => setEdited({ ...draft, ...part })
  const setStructure = (value: string) => change({ structure: value })
  const setTable = (value: string) => change({ table: value })
  const setAlias = (value: string) => change({ alias: value })
  const setKey = (value: string) => change({ key: value })
  const setRows = (next: (current: SourceAttribute[]) => SourceAttribute[]) =>
    change({ rows: next(rows) })
  // ⚠️ Only ever CLEARS. Marking something as touched is what `change()` already does by storing a
  // draft — a separate flag would have been a second answer to "has this been edited", and the two
  // disagree the first time one of them is forgotten at a call site.
  const forget = () => setEdited(null)

  const writable = declaration?.writable === true

  function edit(index: number, patch: Partial<SourceAttribute>) {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    )
  }

  async function build() {
    setBusy(true)

    try {
      setComposed(
        await actions.compose({
          structure: structure || subject.name,
          table,
          alias: alias || null,
          key: key || null,
          attributes: rows,
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  if (!declaration) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted/40" />
  }

  return (
    <div className="space-y-3">
      {/* ⚠️ The target reads as one sentence rather than four captioned boxes: `from <table> as <alias>
          key <key>` is how the declaration itself says it, and a builder that renamed the parts would
          teach a vocabulary the code tab then contradicts. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2 text-xs">
        <span className="text-muted-foreground">{labels.manager.shapeName}</span>
        <Input
          size="sm"
          disabled={!writable}
          className="w-40"
          value={structure}
          onChange={(event) => {
            setStructure(event.target.value)
          }}
        />
        <span className="text-muted-foreground">from</span>
        <Input
          size="sm"
          disabled={!writable}
          className="w-44"
          value={table}
          placeholder={labels.manager.tableName}
          onChange={(event) => {
            setTable(event.target.value)
          }}
        />
        <span className="text-muted-foreground">as</span>
        <Input
          size="sm"
          disabled={!writable}
          className="w-16"
          value={alias}
          onChange={(event) => {
            setAlias(event.target.value)
          }}
        />
        <span className="text-muted-foreground">key</span>
        <Input
          size="sm"
          disabled={!writable}
          className="w-24"
          value={key}
          onChange={(event) => {
            setKey(event.target.value)
          }}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 pb-1 font-medium">{labels.manager.attributeName}</th>
              <th className="px-2 pb-1 font-medium">{labels.manager.attributeSource}</th>
              <th className="px-2 pb-1 font-medium">{labels.manager.attributeType}</th>
              <th className="px-2 pb-1 font-medium">{labels.manager.attributeAccess}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.name}-${index}`} className="border-t border-border/40">
                <td className="p-1">
                  <Input
                    size="sm"
                    disabled={!writable}
                    value={row.name ?? ""}
                    onChange={(event) => edit(index, { name: event.target.value })}
                  />
                </td>
                <td className="p-1">
                  <Input
                    size="sm"
                    disabled={!writable}
                    value={row.source ?? ""}
                    placeholder={row.name ?? ""}
                    onChange={(event) => edit(index, { source: event.target.value })}
                  />
                </td>
                <td className="p-1">
                  <Chooser
                    value={row.type ?? "unknown"}
                    options={TYPES}
                    disabled={!writable}
                    onChange={(value) => edit(index, { type: value })}
                  />
                </td>
                <td className="p-1">
                  <Chooser
                    value={row.access ?? "column"}
                    options={ACCESS}
                    disabled={!writable}
                    onChange={(value) => edit(index, { access: value })}
                  />
                </td>
                <td className="p-1">
                  {writable ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title={labels.removeCondition}
                      onClick={() => {
                        setRows((current) => current.filter((_, position) => position !== index))
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {writable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setRows((current) => [
                ...current,
                { name: "", source: null, type: "text", access: "column" },
              ])
            }}
          >
            <Plus className="mr-1 size-3.5" />
            {labels.manager.addAttribute}
          </Button>

          <Button type="button" size="sm" disabled={busy || !touched} onClick={() => void build()}>
            {labels.manager.build}
          </Button>

          {/* ⚠️ There was no way back. Once a row was edited the only escape was leaving the tab, which
              is an escape somebody has to guess at — and on a screen that rewrites what a listing IS,
              *I have changed something and cannot undo it* is the worst state to leave a person in. */}
          {touched ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                forget()
                setComposed(null)
              }}
            >
              {labels.manager.cancel}
            </Button>
          ) : null}

          {/* ⚠️ Composing and saving are two presses. A builder that saved on every change would rewrite
              a live declaration while somebody was halfway through renaming a column. */}
          {composed?.readable ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void actions.rewrite(composed.message).finally(() => setBusy(false))
              }}
            >
              {labels.manager.saveChanges}
            </Button>
          ) : null}
        </div>
      ) : null}

      {composed ? (
        composed.readable ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{labels.manager.composed}</p>
            <JmqCode value={composed.message} lineNumbers />
          </div>
        ) : (
          <p className={cn("flex items-start gap-2 text-xs text-destructive")}>
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{composed.message}</span>
          </p>
        )
      ) : null}
    </div>
  )
}

function Chooser({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string
  options: string[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger size="sm" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** What the builder holds while somebody is editing it — the whole shape, never a patch over the read. */
interface Draft {
  structure: string
  table: string
  alias: string
  key: string
  rows: SourceAttribute[]
}

import { useMemo, useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { AlertTriangle, Check, Info, TriangleAlert } from "lucide-react"
import {
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@jmouse/ui"
import { jmqSyntax } from "@jmouse/codemirror"
import { useCodeThemeExtensions } from "@jmouse/codemirror/react"
import { JmqCode } from "./JmqCode"
import { usePlayground, useSettled } from "./hooks"
import type { QueryLabels } from "./labels"
import type { QueryDestination } from "./transport"
import type { QuerySubject } from "./types"

/**
 * Where a tree can be sent, and what each one is for.
 *
 * ⚠️ `rows` produces a **pipeline**, not a document, so it is listed with the rest and shows something
 * different: what that destination can honour. Leaving it out would have hidden the one destination
 * whose answer is not text — and its answer is the interesting one, because a backend over objects
 * cannot group or aggregate and a person writing a query needs to know that before they try.
 */
const DESTINATIONS: Array<{ value: QueryDestination; label: string }> = [
  { value: "sql", label: "SQL" },
  { value: "jmq", label: "jMQ" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
  { value: "rows", label: "Rows" },
]

/** ⚠️ Only what `Dialects` actually speaks. A third entry here would be a control offering a refusal. */
const DIALECTS = [
  { value: "", label: "This installation" },
  { value: "mysql", label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
]

/**
 * Write a query, see what it becomes — in whichever destination is asked for.
 *
 * ## ⚠️ It compiles and does NOT run, and the screen says so rather than implying it
 *
 * Running an arbitrary query needs a scope built from the session, paging and a loader — none of which
 * is the same in two products, so none of which belongs to a shared screen. Compiling needs none of it.
 *
 * And compiling is the half that answers the question somebody actually has while checking a mapping:
 * *did my declaration produce the join I meant?* A row count would not answer that; the `FROM` clause
 * does, immediately.
 *
 * ## ⚠️ The destination picker is the `Translator` seam, made visible
 *
 * The seam's claim is that compiling for a vendor and writing back out as jMQ are one operation with a
 * different destination. This is that claim as a control: one tree, five renderings, and the day one of
 * them costs more than a class it will be obvious here first.
 *
 * ## ⚠️ A dialect that is not this installation's is a PREVIEW, and it is labelled
 *
 * *What would this look like on Postgres* is a real question. Its answer is not what runs here, and the
 * dialects differ in how an interval is written — which is not a syntax error somebody notices, but a
 * query that runs and answers about a different length of time.
 */
export function QueryPlayground({
  subject,
  labels,
}: {
  subject: QuerySubject
  labels: QueryLabels
}) {
  const theme = useCodeThemeExtensions()

  const [filter, setFilter] = useState("")
  const [order, setOrder] = useState("")
  const [destination, setDestination] = useState<QueryDestination>("sql")
  const [dialect, setDialect] = useState("")

  const extensions = useMemo(() => [jmqSyntax(), EditorView.lineWrapping, ...theme], [theme])

  // ⚠️ Settled first, so a long condition is compiled once rather than once per character. The panel's
  // own translation is deliberately NOT debounced — its verdict is what tells somebody they are
  // mid-word — but nobody reads a SQL statement between two keystrokes.
  const settledFilter = useSettled(filter)
  const settledOrder  = useSettled(order)

  // ⚠️ Asked even for an empty filter: "everything" is a real query and its rendering is the one worth
  // reading first — it is the mapping, with nothing else in the way.
  const { data: compiled } = usePlayground(
    subject, settledFilter, settledOrder, destination, dialect, true)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="overflow-hidden rounded-lg border border-border/60">
          <CodeMirror
            value={filter}
            extensions={extensions}
            placeholder={labels.manager.playgroundFilter}
            basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
            onChange={setFilter}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{labels.sortBy}</span>
          <Input
            size="sm"
            className="w-56"
            value={order}
            placeholder={labels.manager.playgroundOrder}
            onChange={(event) => setOrder(event.target.value)}
          />

          <span className="ml-auto text-xs text-muted-foreground">
            {labels.manager.playgroundAs}
          </span>

          <Select
            value={destination}
            onValueChange={(value) => setDestination(value as QueryDestination)}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DESTINATIONS.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ⚠️ Offered only for SQL. A dialect means nothing to a rendering that is not aimed at a
              database, and a control that stays visible while doing nothing teaches people to ignore it. */}
          {destination === "sql" ? (
            <Select value={dialect} onValueChange={setDialect}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIALECTS.map((entry) => (
                  <SelectItem key={entry.value || "own"} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {compiled ? (
        compiled.readable ? (
          <div className="space-y-2">
            <Caveat compiled={compiled} labels={labels} />

            {/* ⚠️ jMQ is painted with the language's own grammar, and everything else is not — because
                everything else is not the language. Colouring JSON with a jMQ highlighter would be a
                small lie that makes a tree look like a query. */}
            {compiled.language === "jmq" && compiled.output ? (
              <JmqCode value={compiled.output} lineNumbers />
            ) : compiled.output ? (
              <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[12px] leading-relaxed">
                {compiled.output}
              </pre>
            ) : null}

            {(compiled.parameters ?? []).length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {labels.manager.playgroundBound}
                </span>
                {(compiled.parameters ?? []).map((parameter, index) => (
                  <Badge
                    key={`${parameter}-${index}`}
                    variant="outline"
                    className="font-mono font-normal text-muted-foreground"
                  >
                    {parameter}
                  </Badge>
                ))}
              </div>
            ) : null}

            {(compiled.capabilities ?? []).length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {labels.manager.playgroundHonours}
                </span>
                {(compiled.capabilities ?? []).map((capability) => (
                  <Badge
                    key={capability}
                    variant="outline"
                    className="font-normal text-muted-foreground"
                  >
                    {capability.toLowerCase()}
                  </Badge>
                ))}
              </div>
            ) : null}

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0" />
              <span>{labels.readable}</span>
            </p>
          </div>
        ) : (
          <p className={cn("flex items-start gap-2 text-xs text-destructive")}>
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{compiled.message}</span>
          </p>
        )
      ) : null}
    </div>
  )
}

/**
 * What this rendering is, and is not.
 *
 * ⚠️ **Above the output, never below it.** A caveat under a code block is read after the reader has
 * already decided what the block means — and the two things being said here are both the kind somebody
 * acts on: *this is not the whole statement*, and *this is not the engine you are pointed at*.
 */
function Caveat({
  compiled,
  labels,
}: {
  compiled: { language: string | null; live: boolean; dialect: string | null }
  labels: QueryLabels
}) {
  if (compiled.language === "sql") {
    return (
      <div className="space-y-1">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>{labels.manager.playgroundScope}</span>
        </p>

        {compiled.live ? null : (
          <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>{labels.manager.playgroundPreview(compiled.dialect ?? "")}</span>
          </p>
        )}
      </div>
    )
  }

  if (compiled.language === "jmq") {
    return (
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{labels.manager.playgroundJmq}</span>
      </p>
    )
  }

  if (compiled.language === "rows") {
    return (
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{labels.manager.playgroundRows}</span>
      </p>
    )
  }

  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>{labels.manager.playgroundShape}</span>
    </p>
  )
}

import { useMemo, useState } from "react"
import { Globe, Search, User } from "lucide-react"
import { Badge, Input } from "@jmouse/ui"
import { JmqCode } from "./JmqCode"
import { useEverySavedQuery } from "./hooks"
import type { QueryLabels } from "./labels"
import type { AppliedQuery } from "./QueryPanel"
import type { ManagedSubject } from "./SavedQueryManager"
import type { QuerySubject } from "./types"

/**
 * Every kept question, across every listing.
 *
 * ## ⚠️ Fanned out over the subjects rather than asked of one endpoint
 *
 * "All saved queries in the installation" sounds like one route and is not: the only honest gate on it
 * is *what each subject already decides*, since somebody who may read entries has no business reading
 * which fields describe the equipment. Asking each listing in turn inherits all of those decisions
 * exactly, and costs no new permission to get wrong.
 *
 * ## ⚠️ Every row names its listing, and that is not decoration
 *
 * Four listings each keep a view called *Mine*. Flattened without the listing, they are four
 * indistinguishable rows — and applying the wrong one is silent, because it applies perfectly well to
 * the wrong list.
 *
 * ## ⚠️ Filtering happens here, on rows already in hand
 *
 * There is no server-side search for this and there should not be: the whole set is what a person keeps,
 * which is tens of rows rather than thousands. A search endpoint would be a second way to ask a question
 * this screen has already asked.
 */
export function EveryQuery({
  subjects,
  labels,
  onOpen,
}: {
  subjects: readonly ManagedSubject[]
  labels: QueryLabels
  onOpen?: (subject: QuerySubject, query: AppliedQuery) => void
}) {
  const [text, setText] = useState("")

  const { supported, loading, entries } = useEverySavedQuery(
    useMemo(() => subjects.map((entry) => entry.subject), [subjects]),
  )

  const titles = useMemo(
    () => new Map(subjects.map((entry) => [entry.subject.name, entry.title])),
    [subjects],
  )

  const shown = useMemo(() => {
    const needle = text.trim().toLowerCase()

    if (needle === "") {
      return entries
    }

    // ⚠️ The BODY is searched as well as the name. Somebody looking for "who still uses currentMember"
    // is asking about the query, and a search that only read names would answer *nothing found* about a
    // set that plainly contains it.
    return entries.filter(({ view }) =>
      `${view.name} ${view.description ?? ""} ${view.filter ?? ""} ${view.order ?? ""}`
        .toLowerCase()
        .includes(needle),
    )
  }, [entries, text])

  if (loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            size="sm"
            className="w-72 pl-8"
            value={text}
            placeholder={labels.manager.searchQueries}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {labels.manager.viewCount(shown.length)}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
          {!supported
            ? labels.manager.noStore
            : entries.length === 0
              ? labels.manager.noQueries
              : labels.manager.nothingMatches}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map(({ subject, view }) => (
            <li
              key={`${subject.name}-${view.id}`}
              className="space-y-2 rounded-lg border border-border/60 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{view.name}</span>

                <Badge variant="outline" className="font-normal text-muted-foreground">
                  {titles.get(subject.name) ?? subject.name}
                </Badge>

                <Badge variant="outline" className="font-normal text-muted-foreground">
                  {view.shared ? <Globe className="size-3" /> : <User className="size-3" />}
                  {view.shared ? labels.manager.everyone : labels.manager.mine}
                </Badge>

                {onOpen === undefined ? null : (
                  <button
                    type="button"
                    className="ml-auto text-xs text-primary hover:underline"
                    onClick={() => onOpen(subject, { filter: view.filter, order: view.order ?? null })}
                  >
                    {labels.manager.open}
                  </button>
                )}
              </div>

              {view.description ? (
                <p className="text-xs text-muted-foreground">{view.description}</p>
              ) : null}

              {view.filter ? <JmqCode value={view.filter} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

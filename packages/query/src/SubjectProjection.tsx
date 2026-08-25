import { FileCode2, Info } from "lucide-react"
import { JmqCode } from "./JmqCode"
import { useQueryProjection } from "./hooks"
import type { QueryLabels } from "./labels"
import type { QuerySubject } from "./types"

/**
 * What a subject IS, written as the declaration nobody typed.
 *
 * ## ⚠️ Derived, and there is nothing here to edit
 *
 * Every product here builds its sources in Java, and for one of them that is not a preference: what a
 * query may name depends on fields somebody creates on a screen, so a file written in advance could not
 * mention them. The declaration therefore exists and is written down nowhere a person can read — this is
 * where it is read.
 *
 * It exists so somebody can see the shape their queries run against rather than infer it from whatever
 * the builder happens to offer, and so a mapping that has quietly drifted from what they remember is
 * visible instead of surprising.
 *
 * ## ⚠️ The server renders it, through the same translator as everything else
 *
 * The text below is not assembled here and not assembled by a helper beside the compiler: it comes from
 * the tree the engine actually runs against, written back out by the one translator whose destination is
 * the language itself. A browser that formatted it would be a second writer for a language that has one,
 * and two writers agree until the day only one of them learns a new spelling.
 *
 * ## ⚠️ An absent half means NOT SHOWN, never NONE
 *
 * A subject may decline — an entry source with no form named has nothing truthful to render — and saying
 * *this has no mapping* would be a different and false statement.
 */
export function SubjectProjection({
  subject,
  labels,
}: {
  subject: QuerySubject
  labels: QueryLabels
}) {
  const { data: projection, isLoading } = useQueryProjection(subject)

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
  }

  const halves = [
    { title: labels.manager.structure, source: projection?.structure },
    { title: labels.manager.mapping, source: projection?.mapping },
  ].filter((half) => Boolean(half.source))

  if (halves.length === 0) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{labels.manager.noProjection}</span>
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {halves.map((half) => (
        <section key={half.title} className="space-y-2">
          <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileCode2 className="size-3.5" />
            {half.title}
          </h4>

          <JmqCode value={half.source!} lineNumbers />
        </section>
      ))}
    </div>
  )
}

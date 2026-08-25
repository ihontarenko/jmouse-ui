import { useMemo, useState } from "react"
import { Bookmark, FileCode2, Layers, Library, Play, Table2 } from "lucide-react"
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@jmouse/ui"
import { AttributesBuilder } from "./AttributesBuilder"
import { EveryQuery } from "./EveryQuery"
import { QueryPlayground } from "./QueryPlayground"
import { SavedQueryLibrary } from "./SavedQueryLibrary"
import { SourceEditor } from "./SourceEditor"
import { useSavedQueryViews, useSourceDeclaration } from "./hooks"
import { DEFAULT_LABELS, type QueryLabels } from "./labels"
import type { AppliedQuery } from "./QueryPanel"
import type { QuerySubject } from "./types"

/** ⚠️ Not an index into `subjects` — see where it is used. */
const EVERYTHING = -1

/** One thing that can be queried, as a person would name it. */
export interface ManagedSubject {
  subject: QuerySubject
  title: string
  description?: string
}

/**
 * Every saved question in one place, beside the declaration each one is written against.
 *
 * ## ⚠️ It lives in the library, not in a product
 *
 * The store is one table shared by every product, the endpoints are the library's, and the language is
 * the same language everywhere. A product building its own screen over that would be a fourth
 * implementation of one list — and the four would drift, because nothing would make them agree.
 *
 * What a product supplies is the only part that is genuinely its own: **which subjects exist and what
 * they are called**. Everything below that is this package's.
 *
 * ## ⚠️ Why the declaration is on the same screen
 *
 * A saved view is a program written against a shape, and the shape was never written down anywhere a
 * person could read — every product here builds its sources in Java. Putting the two side by side is
 * what turns *why does this view not mention my field* from a question for whoever wrote the backend
 * into something visible.
 *
 * ## ⚠️ A column of listings, and tabs WITHIN one — two choices, not one row of buttons
 *
 * The listing is what everything else on the screen is about, so it stays in front as a column:
 * switching it changes what the tabs contain, not which of them you are on. Folding it into the tab row
 * would have made *which listing* and *which aspect of it* look like one choice, and a person switching
 * listing would be thrown back to the first tab every time.
 *
 * ⚠️ **All queries sits in the column and not in the tab row**, for the same reason read the other way:
 * every tab answers a question about the chosen listing, and that one answers a question about all of
 * them. As a tab it would appear to change when somebody picked a different listing. It does not.
 *
 * ## ⚠️ It is a component, not a route
 *
 * Routing, page chrome and where this sits in a menu belong to the product; a library that claimed a URL
 * would be a library deciding what a product's navigation looks like.
 */
export function SavedQueryManager({
  subjects,
  labels: given,
  onOpen,
}: {
  subjects: readonly ManagedSubject[]
  labels?: Partial<QueryLabels>
  /** Given, each view offers to open the screen it belongs to. */
  onOpen?: (subject: QuerySubject, query: AppliedQuery) => void
}) {
  const labels = useMemo<QueryLabels>(() => ({ ...DEFAULT_LABELS, ...given }), [given])
  // ⚠️ `-1` means "every listing", which is deliberately NOT one of the subjects: it is a different
  // question, and giving it an index would make it look like one more listing in the column.
  const [active, setActive] = useState<number>(EVERYTHING)

  if (subjects.length === 0) {
    return null
  }

  const chosen = subjects[active]

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav className="space-y-1" aria-label={labels.manager.subjects}>
        {/*
          ⚠️ **Above the listings and not a tab beside Declaration**, because it is not about the chosen
          listing at all. Every other tab answers a question about *this* subject; this one answers a
          question about all of them, and a person who switched listing would reasonably expect it to
          change with the rest — it would not, and the confusion is silent.
        */}
        <Button
          type="button"
          variant={active === EVERYTHING ? "secondary" : "ghost"}
          className="h-auto w-full justify-start px-2 py-1.5 text-left"
          onClick={() => setActive(EVERYTHING)}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 truncate text-sm">
              <Library className="size-3.5" />
              {labels.manager.queriesTab}
            </span>
            {/* ⚠️ The short word, not the page's sentence. The long one overflowed a 15rem column and
                painted itself across the panel beside it — a caption that has to fit is a different
                string from a caption that has to explain. */}
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {labels.manager.acrossListings}
            </span>
          </span>
        </Button>

        <h3 className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
          {labels.manager.subjects}
        </h3>

        {subjects.map((entry, index) => (
          <SubjectButton
            key={`${entry.subject.name}-${index}`}
            entry={entry}
            labels={labels}
            active={index === active}
            onSelect={() => setActive(index)}
          />
        ))}
      </nav>

      <div className="min-w-0 space-y-4">
        {chosen === undefined ? (
          <>
            <header className="space-y-0.5">
              <h2 className="text-base font-semibold">{labels.manager.queriesTab}</h2>
              <p className="text-xs text-muted-foreground">{labels.manager.everyQuery}</p>
            </header>

            <EveryQuery subjects={subjects} labels={labels} onOpen={onOpen} />
          </>
        ) : (
          <SubjectTabs chosen={chosen} labels={labels} onOpen={onOpen} />
        )}
      </div>
    </div>
  )
}

/**
 * The four questions asked about ONE listing.
 *
 * ⚠️ Its own component so that the manager above stays a router between two unlike things — every
 * listing, or one of them — rather than a component holding both shapes at once.
 */
function SubjectTabs({
  chosen,
  labels,
  onOpen,
}: {
  chosen: ManagedSubject
  labels: QueryLabels
  onOpen?: (subject: QuerySubject, query: AppliedQuery) => void
}) {
  return (
    <>
      <header className="space-y-0.5">
        <h2 className="text-base font-semibold">{chosen.title}</h2>
        {chosen.description ? (
          <p className="text-xs text-muted-foreground">{chosen.description}</p>
        ) : null}
      </header>

      {/*
        ⚠️ Keyed on the subject, so switching listing REMOUNTS the tabs.

        Without the key, an editor holding a half-typed declaration for one subject would still be
        holding it after the reader switched to another — and pressing save would write one listing's
        text over a different listing's declaration. The tab you were on is worth losing to make that
        impossible.
      */}
      <Tabs key={chosen.subject.name} defaultValue="views">
        <TabsList>
          <TabsTrigger value="views">
            <Bookmark className="size-3.5" />
            {labels.manager.views}
          </TabsTrigger>
          <TabsTrigger value="declaration">
            <FileCode2 className="size-3.5" />
            {labels.manager.declarationTab}
          </TabsTrigger>
          <TabsTrigger value="attributes">
            <Table2 className="size-3.5" />
            {labels.manager.attributesTab}
          </TabsTrigger>
          <TabsTrigger value="playground">
            <Play className="size-3.5" />
            {labels.manager.playgroundTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="views" className="pt-3">
          <SavedQueryLibrary subject={chosen.subject} labels={labels} onOpen={onOpen} />
        </TabsContent>

        <TabsContent value="declaration" className="pt-3">
          <SourceEditor subject={chosen.subject} labels={labels} />
        </TabsContent>

        <TabsContent value="attributes" className="pt-3">
          <AttributesBuilder subject={chosen.subject} labels={labels} />
        </TabsContent>

        <TabsContent value="playground" className="pt-3">
          <QueryPlayground subject={chosen.subject} labels={labels} />
        </TabsContent>
      </Tabs>
    </>
  )
}

/**
 * ⚠️ Its own component only so the counts can be asked for.
 *
 * A hook cannot be called in a loop, and what makes this list worth reading rather than a menu of
 * identical words is what each row *has* — how many questions are kept against it, and whether its
 * declaration is something anybody wrote.
 */
function SubjectButton({
  entry,
  labels,
  active,
  onSelect,
}: {
  entry: ManagedSubject
  labels: QueryLabels
  active: boolean
  onSelect: () => void
}) {
  const { data: views } = useSavedQueryViews(entry.subject)
  const { data: declaration } = useSourceDeclaration(entry.subject)

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      className="h-auto w-full justify-start px-2 py-1.5 text-left"
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{entry.title}</span>
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          {views === undefined ? null : <span>{labels.manager.viewCount(views.length)}</span>}
          {/* ⚠️ Marked only where somebody has actually taken a declaration over. A badge on every
              authored-capable subject would say nothing — the useful signal is *this one no longer
              runs what the code says*. */}
          {declaration?.authored ? (
            <>
              <Layers className="size-3" />
              <span>{labels.manager.attributesTab}</span>
            </>
          ) : null}
        </span>
      </span>
    </Button>
  )
}

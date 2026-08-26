import { useEffect, useState } from "react"
import { keepPreviousData, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  useQueryTransport,
  type QueryProjection,
  type SavedQueryDraft,
  type SavedQueryView,
  type SourceComposition,
  type SourceDeclaration,
  type SourceVerdict,
  type CompiledQuery,
  type QueryDestination,
} from "./transport"
import type { QuerySubject, QueryVocabulary, Translated, Translation } from "./types"

/**
 * What a query about this subject may name.
 *
 * ⚠️ **Asked once per subject-and-parameters and cached.** It changes when the form behind it changes,
 * which is a form edit rather than a keystroke — refetching while somebody composes would put a request
 * behind every character for an answer that cannot have moved.
 */
export function useQueryVocabulary(subject: QuerySubject, enabled = true) {
  const transport = useQueryTransport()

  return useQuery<QueryVocabulary>({
    queryKey: ["jmq-schema", subject.name, subject.parameters ?? {}],
    queryFn: () => transport.schema(subject),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The one call a builder makes on every change: rows in and text out, or text in and rows out, with the
 * verdict either way.
 *
 * ## ⚠️ It is a query, not a mutation, and `readable: false` is DATA
 *
 * Half-typed text is the normal state of a box somebody is typing into. A screen treating it as a failure
 * would flash a red toast on every character.
 *
 * ## ⚠️ It costs no extra round trip
 *
 * The panel already had to ask the server whether what somebody wrote makes sense. This is that same
 * call, answering the composed text and the rows as well — so moving the language out of the browser
 * bought correctness for nothing.
 */
export function useTranslation(subject: QuerySubject, translation: Translation, enabled = true) {
  const transport = useQueryTransport()

  return useQuery<Translated>({
    queryKey: [
      "jmq-translate",
      subject.name,
      subject.parameters ?? {},
      translation.rows ?? null,
      translation.filter ?? "",
      translation.orderBy ?? "",
      translation.descending ?? false,
    ],
    queryFn: () => transport.translate(subject, translation),
    enabled,
    // ⚠️ So the message does not disappear and reappear between keystrokes, which reads as flicker
    // rather than as feedback.
    placeholderData: keepPreviousData,
  })
}

/**
 * The subject's declaration, rendered as jMQ by the server.
 *
 * ⚠️ **Cached hard, because it cannot move on its own.** A source changes when somebody edits the form
 * behind it, not while a page is open — and this is the one call on the screen that returns the same
 * answer every time it is asked.
 */
export function useQueryProjection(subject: QuerySubject, enabled = true) {
  const transport = useQueryTransport()

  return useQuery<QueryProjection>({
    queryKey: ["jmq-projection", subject.name, subject.parameters ?? {}],
    queryFn: () => transport.projection!(subject),
    enabled: enabled && Boolean(transport.projection),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The views kept against this subject — what the management row lists.
 *
 * ⚠️ Disabled outright where the product wired no store, so a panel without one makes no request and
 * shows no row rather than showing an empty shelf that can never fill.
 */
export function useSavedQueryViews(subject: QuerySubject) {
  const transport = useQueryTransport()

  return useQuery<SavedQueryView[]>({
    queryKey: ["jmq-views", subject.name, subject.parameters ?? {}],
    queryFn: () => transport.views!.list(subject),
    enabled: Boolean(transport.views),
    staleTime: 30 * 1000,
  })
}

/**
 * Keeping, renaming and discarding a view.
 *
 * ⚠️ **The list is invalidated rather than edited in place.** A row written optimistically is a row
 * whose name, sharing and identifier were all decided in the browser — and the server decides all three,
 * including whether the name collided with one somebody else kept.
 */
export function useSavedQueryActions(subject: QuerySubject) {
  const transport = useQueryTransport()
  const client = useQueryClient()

  const refresh = () => client.invalidateQueries({ queryKey: ["jmq-views", subject.name] })

  return {
    supported: Boolean(transport.views),
    save: async (draft: SavedQueryDraft) => {
      const kept = await transport.views!.save(subject, draft)

      await refresh()

      return kept
    },
    update: async (id: string, draft: SavedQueryDraft) => {
      const kept = await transport.views!.update(subject, id, draft)

      await refresh()

      return kept
    },
    remove: async (id: string) => {
      await transport.views!.remove(subject, id)
      await refresh()
    },
  }
}

/**
 * A subject's declaration, and what may be done to it.
 *
 * ⚠️ Disabled where the product wired no source transport, so a screen without one makes no request and
 * shows no tab — rather than a tab that answers 404 and reads as *this has no declaration*.
 */
export function useSourceDeclaration(subject: QuerySubject, enabled = true) {
  const transport = useQueryTransport()

  return useQuery<SourceDeclaration>({
    queryKey: ["jmq-source", subject.name, subject.parameters ?? {}],
    queryFn: () => transport.sources!.declaration(subject),
    enabled: enabled && Boolean(transport.sources),
    staleTime: 60 * 1000,
  })
}

/**
 * Rewriting a declaration, reverting it, and asking whether a draft would be accepted.
 *
 * ⚠️ **The declaration is invalidated rather than patched in place.** What comes back carries the
 * server's stamp, its author and — crucially — its own answer to *is this authored now*, which flips the
 * first time somebody saves. A row written optimistically would get all three wrong.
 */
export function useSourceActions(subject: QuerySubject) {
  const transport = useQueryTransport()
  const client = useQueryClient()

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["jmq-source", subject.name] }),
      // ⚠️ The vocabulary and the projection are both DERIVED from the declaration, so a rewrite that
      // left them cached would leave the builder offering attributes the source no longer has.
      client.invalidateQueries({ queryKey: ["jmq-schema", subject.name] }),
      client.invalidateQueries({ queryKey: ["jmq-projection", subject.name] }),
    ])

  return {
    supported: Boolean(transport.sources),
    rewrite: async (body: string) => {
      const written = await transport.sources!.rewrite(subject, body)

      await refresh()

      return written
    },
    revert: async () => {
      const reverted = await transport.sources!.revert(subject)

      await refresh()

      return reverted
    },
    validate: (body: string) => transport.sources!.validate(subject, body),
    compose: (composition: SourceComposition) => transport.sources!.compose(subject, composition),
  }
}

/**
 * The server's verdict on a declaration being typed.
 *
 * ⚠️ A query, not a mutation, and `readable: false` is data — the same rule the query editor follows.
 * A screen that raised every keystroke as a failure would flash red at somebody mid-word.
 */
export function useSourceVerdict(subject: QuerySubject, body: string, enabled: boolean) {
  const transport = useQueryTransport()

  return useQuery<SourceVerdict>({
    queryKey: ["jmq-source-verdict", subject.name, subject.parameters ?? {}, body],
    queryFn: () => transport.sources!.validate(subject, body),
    enabled: enabled && Boolean(transport.sources) && body.trim() !== "",
    placeholderData: keepPreviousData,
  })
}

/**
 * The attribute rows behind a declaration, as the SERVER reads them.
 *
 * ⚠️ **A query rather than an effect that fires a promise.** The builder used to seed itself from a
 * `useEffect` holding a `cancelled` flag — which in development runs twice, discards the first answer,
 * and left the table empty with two successful requests in the network log and nothing in the console.
 * The rows are a function of the body; a query is what that is.
 *
 * ⚠️ Nothing here parses jMQ. The rows come back from the same call that validates it.
 */
export function useSourceAttributes(subject: QuerySubject, body: string | null | undefined) {
  const transport = useQueryTransport()

  return useQuery<SourceVerdict>({
    queryKey: ["jmq-source-attributes", subject.name, subject.parameters ?? {}, body ?? ""],
    queryFn: () => transport.sources!.validate(subject, body!),
    enabled: Boolean(transport.sources) && Boolean(body && body.trim() !== ""),
    staleTime: 60 * 1000,
  })
}

/**
 * What a query compiles to, asked as you type.
 *
 * ⚠️ A query rather than a mutation: nothing runs, so asking is free of consequence, and a refusal is
 * an ordinary answer about text that is half written.
 */
export function usePlayground(
  subject: QuerySubject,
  filter: string,
  order: string,
  translator: QueryDestination,
  dialect: string,
  enabled: boolean,
) {
  const transport = useQueryTransport()

  return useQuery<CompiledQuery>({
    queryKey: [
      "jmq-playground", subject.name, subject.parameters ?? {}, filter, order, translator, dialect,
    ],
    queryFn: () => transport.playground!.compile(subject, filter, order, translator, dialect),
    enabled: enabled && Boolean(transport.playground),
    placeholderData: keepPreviousData,
  })
}

/**
 * Every kept question across every listing this screen knows about.
 *
 * ## ⚠️ Fanned out over the SUBJECTS, never asked of one cross-subject endpoint
 *
 * A single "all saved queries" route would need a gate of its own — and the only honest gate is *what
 * each subject already decides*, since one member may read entries and have no business reading which
 * fields describe the equipment. Asking each listing in turn inherits every one of those decisions
 * exactly, for free, and a subject that keeps no views simply contributes nothing.
 *
 * ⚠️ It also means the answer is only ever as wide as the list of subjects the product handed in. That
 * is the correct width: a screen cannot show a listing it was not told about.
 */
export function useEverySavedQuery(subjects: readonly QuerySubject[]) {
  const transport = useQueryTransport()

  /**
   * ⚠️ **One request when the product offers a batch, one per subject when it does not.**
   *
   * A product registers one subject per thing being listed, so a workspace with forty-four component
   * types is forty-four `entries` subjects — and this screen asked each of them separately. Ivan,
   * 2026-08-25: *«краще зробити батч»*.
   *
   * ⚠️ **Both hooks are called every render, and only one is enabled.** React's rules do not allow the
   * batch to be chosen with an `if`, so the fan-out is disabled rather than skipped — which is also what
   * keeps a product with no `listMany` working exactly as it did.
   */
  const batched = useQuery({
    queryKey: ["jmq-views-batch", subjects.map((subject) => [subject.name, subject.parameters ?? {}])],
    queryFn: () => transport.views!.listMany!(subjects),
    enabled: Boolean(transport.views?.listMany) && subjects.length > 0,
    staleTime: 30 * 1000,
  })

  const results = useQueries({
    queries: subjects.map((subject) => ({
      queryKey: ["jmq-views", subject.name, subject.parameters ?? {}],
      queryFn: () => transport.views!.list(subject),
      enabled: Boolean(transport.views) && !transport.views?.listMany,
      staleTime: 30 * 1000,
    })),
  })

  if (transport.views?.listMany) {
    // ⚠️ Matched back by name AND parameters — the name alone does not identify a subject, which is the
    // same fact the row keys had to learn. A refused listing contributes nothing rather than an error:
    // one unreadable listing must not blank a screen showing forty-three readable ones.
    const answers = new Map(
      (batched.data ?? []).map((answer) => [
        `${answer.subject}-${JSON.stringify(answer.parameters ?? {})}`,
        answer,
      ]),
    )

    return {
      supported: Boolean(transport.views),
      loading: batched.isLoading,
      entries: subjects.flatMap((subject) => {
        const answer = answers.get(`${subject.name}-${JSON.stringify(subject.parameters ?? {})}`)

        return (answer?.views ?? []).map((view) => ({
          subject,
          view,
          key: `${subject.name}-${JSON.stringify(subject.parameters ?? {})}-${view.id}`,
        }))
      }),
    }
  }

  return {
    // ⚠️ So an empty list can say WHICH emptiness it is. Without this, a product that wired no store
    // reads as "nothing kept anywhere yet" — which is a lie somebody acts on by going to look for the
    // save button.
    supported: Boolean(transport.views),
    loading: results.some((result) => result.isLoading),
    // ⚠️ Each view carries the subject it belongs to, because a flat list of names from four listings is
    // a list in which two "Mine" rows are indistinguishable — and applying the wrong one is silent.
    //
    // ⚠️ **And a `key`, because the subject's NAME does not identify a subject.** A product registers one
    // subject per *thing being listed*, so forty-four forms are forty-four `entries` subjects differing
    // only in their parameters — and every one of them offers the same ready-made questions. Keyed on
    // `name-viewId`, React saw forty-four children called `entries-preset-entries-mine-this-week` and
    // warned that it may duplicate or omit them. The parameters are what tell two subjects apart, so
    // they are in the key.
    entries: results.flatMap((result, index) =>
      (result.data ?? []).map((view) => ({
        subject: subjects[index],
        view,
        key: `${subjects[index].name}-${JSON.stringify(subjects[index].parameters ?? {})}-${view.id}`,
      })),
    ),
  }
}

/**
 * Every listing's declaration, for a screen that draws them all at once.
 *
 * ⚠️ **This exists so the sidebar stops asking per row.** The manager marks the subjects whose
 * declaration somebody has taken over; asked one at a time that was a request per listing, on top of a
 * request per listing for the counts. Ivan, 2026-08-25: *«краще зробити батч»*.
 *
 * ⚠️ **Keyed by name AND parameters**, because a name does not identify a subject — see
 * `useEverySavedQuery`. Returns a lookup rather than an array so a row can ask for its own without
 * knowing its index.
 */
export function useEveryDeclaration(subjects: readonly QuerySubject[]) {
  const transport = useQueryTransport()

  // ⚠️ Takes the parameters rather than a subject, because the two sides of the match are different
  // shapes: what was asked is a `QuerySubject`, what came back is an answer that echoes the same two
  // facts. One helper over the pair keeps them spelled identically, which is the whole of the match.
  const keyOf = (name: string, parameters?: Record<string, string | undefined>) =>
    `${name}-${JSON.stringify(parameters ?? {})}`

  const batched = useQuery({
    queryKey: ["jmq-source-batch", subjects.map((subject) => [subject.name, subject.parameters ?? {}])],
    queryFn: () => transport.sources!.declarationMany!(subjects),
    enabled: Boolean(transport.sources?.declarationMany) && subjects.length > 0,
    staleTime: 60 * 1000,
  })

  // ⚠️ The fan-out stays for a product whose transport predates the batch, and is disabled rather than
  // skipped — a hook cannot be called conditionally.
  const results = useQueries({
    queries: subjects.map((subject) => ({
      queryKey: ["jmq-source", subject.name, subject.parameters ?? {}],
      queryFn: () => transport.sources!.declaration(subject),
      enabled: Boolean(transport.sources) && !transport.sources?.declarationMany,
      staleTime: 60 * 1000,
    })),
  })

  if (transport.sources?.declarationMany) {
    return new Map(
      (batched.data ?? [])
        .filter((answer) => !answer.refused && answer.declaration)
        .map((answer) => [keyOf(answer.subject, answer.parameters), answer.declaration!]),
    )
  }

  return new Map(
    results.flatMap((result, index) =>
      result.data ? [[keyOf(subjects[index].name, subjects[index].parameters), result.data] as const] : [],
    ),
  )
}

/**
 * A value that stops changing while somebody is typing.
 *
 * ## ⚠️ Here rather than in every screen that needs it
 *
 * Two of them already do, and the third was about to write its own — at which point the interval is a
 * number in three files that nobody keeps in step. It is one hook because the answer is one number.
 *
 * ⚠️ **Not applied to the query panel's own translation.** That one asks the server whether a half-typed
 * condition reads, and the answer is what tells somebody they are mid-word; delaying it would make the
 * verdict arrive after they had already stopped and wondered. Compiling a statement is different work:
 * nobody reads SQL between two keystrokes.
 */
export function useSettled<T>(value: T, delay = 350): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}

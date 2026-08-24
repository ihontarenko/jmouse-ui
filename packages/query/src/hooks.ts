import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useQueryTransport } from "./transport"
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

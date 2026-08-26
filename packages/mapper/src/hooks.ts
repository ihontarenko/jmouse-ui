import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useMapperTransport } from "./transport"
import type { MappableShape, MappableType, MappingDraft, RenderedMapping, UnshowableMapping } from "./types"

/**
 * How long editing has to stop before either direction is asked for.
 *
 * ⚠️ Long enough that typing a word is one request rather than five, short enough that a pause between
 * words already shows the answer. It is a delay before *asking*, never a delay before *believing*: the
 * server remains the only thing that renders or reads the language.
 */
const SETTLE_MS = 250

/**
 * What this product offers in the two selects.
 *
 * ⚠️ **Cached hard, because it cannot move while a page is open.** The answer changes when somebody
 * deploys a class, not when somebody fills a row in.
 */
export function useMappableTypes(enabled = true) {
  const transport = useMapperTransport()

  return useQuery<MappableType[]>({
    queryKey: ["jmm-types"],
    queryFn: () => transport.types(),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * What one chosen type is made of.
 *
 * ⚠️ Asked for a type whether or not the select offered it — the scan is a listing, never a filter on
 * what may be mapped, and a builder that refused an unlisted type would invent a restriction the engine
 * does not have.
 */
export function useMappableShape(qualified: string | null) {
  const transport = useMapperTransport()

  return useQuery<MappableShape>({
    queryKey: ["jmm-shape", qualified],
    queryFn: () => transport.shape(qualified as string),
    enabled: qualified !== null && qualified !== "",
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The rows, as the document they are.
 *
 * ## ⚠️ A query on every change, and that is the whole design
 *
 * The second tab is not a preview of something that will be produced later — it **is** the document, and
 * it is what gets saved. So it is rendered by the one translator on every edit rather than approximated
 * in the browser and reconciled at save time, where the two would silently disagree.
 *
 * ⚠️ `keepPreviousData`, so the document does not blank and return between keystrokes — which reads as
 * flicker rather than as feedback.
 *
 * ⚠️ **One writer and one request per character are different decisions, and only the first is worth
 * having.** The draft settles first, so a burst of typing costs one round trip instead of one per key —
 * and the query cache stops filling with a rendered document per keystroke, each held for minutes.
 */
export function useRenderedMapping(draft: MappingDraft, enabled = true) {
  const transport = useMapperTransport()
  const settled = useSettled(draft)

  return useQuery<RenderedMapping>({
    queryKey: ["jmm-render", settled],
    queryFn: () => transport.render(settled),
    enabled,
    placeholderData: keepPreviousData,
  })
}

/**
 * A document, as the rows it is — or the refusal that says it has none.
 *
 * ## ⚠️ A refusal is DATA here, not a failure
 *
 * A `fragment`, an `include`, a `let`, a `refuse` block or a whole-pair conversion has no row. The form
 * says which one and goes read-only; it never shows what it understood and leaves the rest out of view,
 * because that form saves and the save deletes what it never showed.
 *
 * ⚠️ Half-typed text is also the normal state of an editor, so a parse error is reported the same quiet
 * way rather than as a toast on every character.
 *
 * ## ⚠️ But only a REFUSAL is data — everything else is a failure and has to look like one
 *
 * A refusal is the server saying *this document is fine and this form cannot show it*, and it arrives as
 * a `422` carrying the construct. An expired session, a fault, the network being down are none of those.
 * Folding them all into a refusal told the reader their document used a construct that is not in it, and
 * sent them looking through a file that was never the problem — so anything with no construct in it is
 * rethrown and surfaces as what it is.
 */
export function useParsedMapping(text: string, enabled = true) {
  const transport = useMapperTransport()
  const settled = useSettled(text)

  return useQuery<ParsedMapping>({
    queryKey: ["jmm-parse", settled],
    queryFn: async () => {
      try {
        return { draft: await transport.parse(settled), refusal: null }
      } catch (thrown) {
        const refusal = refusalWithin(thrown)

        if (refusal === null) {
          throw thrown
        }

        return { draft: null, refusal }
      }
    },
    enabled: enabled && settled.trim() !== "",
    placeholderData: keepPreviousData,
  })
}

/**
 * A value as it was once editing paused.
 *
 * ⚠️ Keyed on the value's **content**, not its identity. A draft is rebuilt on every render, so waiting
 * on the object itself would restart the delay whenever anything else on the screen re-rendered — and a
 * document that never settles never renders.
 */
function useSettled<T>(value: T): T {
  const key = JSON.stringify(value)
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), SETTLE_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return settled
}

/** What a parse came back as. Exactly one half is filled. */
export interface ParsedMapping {
  draft: MappingDraft | null
  refusal: UnshowableMapping | null
}

/**
 * The construct out of whatever a product's HTTP client threw.
 *
 * ## ⚠️ Deliberately tolerant, because the error's shape belongs to the product
 *
 * This package brings no HTTP client, so it cannot know whether a refusal arrives as the body itself, as
 * `error.body`, or as `error.response.data`. It looks in all three.
 *
 * ⚠️ **Finding none, it answers `null` — meaning *this was not a refusal*.** It used to invent
 * `construct: "unknown"` instead, which turned every session timeout and every server fault into a
 * sentence about the reader's document. The tolerance about where the construct lives is right; being
 * tolerant about whether there is one at all is how a screen ends up confidently wrong.
 */
function refusalWithin(thrown: unknown): UnshowableMapping | null {
  const candidates = [thrown, within(thrown, "body"), within(thrown, "data"), payloadOf(thrown)]

  for (const candidate of candidates) {
    const construct = within(candidate, "construct")

    if (typeof construct === "string" && construct !== "") {
      const detail = within(candidate, "detail")

      return { construct, detail: typeof detail === "string" ? detail : construct }
    }
  }

  return null
}

function within(subject: unknown, name: string): unknown {
  if (subject === null || typeof subject !== "object") {
    return undefined
  }

  return (subject as Record<string, unknown>)[name]
}

function payloadOf(thrown: unknown): unknown {
  return within(within(thrown, "response"), "data")
}

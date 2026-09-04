import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useValidationTransport } from "./transport"
import type {
  OfferedCheck,
  RenderedValidation,
  UnshowableValidation,
  ValidationDraft,
} from "./types"

/**
 * How long editing has to stop before either direction is asked for.
 *
 * ⚠️ Long enough that typing a word is one request rather than five, short enough that a pause between
 * words already shows the answer. It is a delay before *asking*, never a delay before *believing*: the
 * server remains the only thing that renders or reads the language.
 */
const SETTLE_MS = 250

/**
 * What this product offers as checks.
 *
 * ⚠️ **Cached hard, because it cannot move while a page is open.** The answer changes when somebody
 * deploys a constraint, not when somebody fills a row in.
 */
export function useOfferedChecks(enabled = true) {
  const transport = useValidationTransport()

  return useQuery<OfferedCheck[]>({
    queryKey: ["jmv-checks"],
    queryFn: () => transport.checks(),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The rows, as the document they are.
 *
 * ## ⚠️ A query on every change, and that is the whole design
 *
 * The document tab is not a preview of something produced later — it **is** the document, and it is
 * what gets saved. So it is rendered by the one writer on every edit rather than approximated in the
 * browser and reconciled at save time, where the two would silently disagree.
 *
 * ⚠️ `keepPreviousData`, so the document does not blank and return between keystrokes — which reads as
 * flicker rather than as feedback.
 *
 * ⚠️ **One writer and one request per character are different decisions, and only the first is worth
 * having.** The draft settles first, so a burst of typing costs one round trip instead of one per key.
 */
export function useRenderedValidation(draft: ValidationDraft, enabled = true) {
  const transport = useValidationTransport()
  const settled = useSettled(draft)

  return useQuery<RenderedValidation>({
    queryKey: ["jmv-render", settled],
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
 * The form goes read-only and names what it could not show. It never shows what it understood and
 * leaves the rest out of view, because that form saves and the save deletes what it never showed.
 *
 * ⚠️ Half-typed text is the normal state of an editor, so a parse error is reported the same quiet way
 * rather than as a toast on every character.
 *
 * ## ⚠️ But only a REFUSAL is data — everything else is a failure and has to look like one
 *
 * A refusal is the server saying *this document is fine and this form cannot show it*, and it arrives
 * as a `422` carrying the construct. An expired session, a fault, the network being down are none of
 * those. Folding them all into a refusal tells the reader their document used a construct that is not
 * in it, and sends them looking through a file that was never the problem.
 */
export function useParsedValidation(text: string, enabled = true) {
  const transport = useValidationTransport()
  const settled = useSettled(text)

  return useQuery<ParsedValidation>({
    queryKey: ["jmv-parse", settled],
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
export interface ParsedValidation {
  draft: ValidationDraft | null
  refusal: UnshowableValidation | null
}

/**
 * The construct out of whatever a product's HTTP client threw.
 *
 * ## ⚠️ Deliberately tolerant, because the error's shape belongs to the product
 *
 * This package brings no HTTP client, so it cannot know whether a refusal arrives as the body itself,
 * as `error.body`, or as `error.response.data`. It looks in all three.
 *
 * ⚠️ **Finding none, it answers `null` — meaning *this was not a refusal*.** Inventing a construct
 * instead would turn every session timeout and every server fault into a sentence about the reader's
 * document. Being tolerant about where the construct lives is right; being tolerant about whether there
 * is one at all is how a screen ends up confidently wrong.
 */
function refusalWithin(thrown: unknown): UnshowableValidation | null {
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

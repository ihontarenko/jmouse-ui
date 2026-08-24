import { createContext, useContext } from "react"
import type { QuerySubject, QueryVocabulary, Translated, Translation } from "./types"

/**
 * How this package reaches the server — supplied by the product, never chosen here.
 *
 * ## ⚠️ No HTTP client is imported by this package, deliberately
 *
 * Every product already has one, already wired to its own token refresh, its own workspace header and
 * its own error events. A shared package bringing a second one would mean a request that skips all of
 * that — and the failure is a silent 401 on one screen while every other screen quietly re-authenticates.
 *
 * So the product hands over two functions and this package calls them.
 */
export interface QueryTransport {
  /** `GET {prefix}/{subject}/schema` with the subject's parameters as the query string. */
  schema(subject: QuerySubject): Promise<QueryVocabulary>
  /** `POST {prefix}/{subject}/translate`. */
  translate(subject: QuerySubject, translation: Translation): Promise<Translated>
}

const Transport = createContext<QueryTransport | null>(null)

export const QueryTransportProvider = Transport.Provider

/**
 * ⚠️ Throws rather than falling back. A builder with no transport would render, sit empty, and read as
 * *this form has no fields* — which is the wrong bug to go looking for.
 */
export function useQueryTransport(): QueryTransport {
  const transport = useContext(Transport)

  if (transport === null) {
    throw new Error(
      "No QueryTransport. Wrap the screen in <QueryTransportProvider value={…}> — this package brings " +
        "no HTTP client of its own, on purpose.",
    )
  }

  return transport
}

/**
 * A transport over any request function, which is what a product's HTTP client already is.
 *
 * ⚠️ `prefix` defaults to what the library's controller answers on. A product that moved it with
 * `jmouse.query.builder.prefix` has to say so here too — the address lives in two places and there is no
 * third to forget.
 */
export function transportOver(
  request: <T>(method: "GET" | "POST", url: string, body?: unknown) => Promise<T>,
  prefix = "/query",
): QueryTransport {
  const address = (subject: QuerySubject, action: string) => {
    const parameters = new URLSearchParams()

    Object.entries(subject.parameters ?? {}).forEach(([name, value]) => {
      if (value !== undefined && value !== "") {
        parameters.set(name, value)
      }
    })

    const query = parameters.toString()

    return `${prefix}/${subject.name}/${action}${query === "" ? "" : `?${query}`}`
  }

  return {
    schema: (subject) => request<QueryVocabulary>("GET", address(subject, "schema")),
    translate: (subject, translation) =>
      request<Translated>("POST", address(subject, "translate"), translation),
  }
}

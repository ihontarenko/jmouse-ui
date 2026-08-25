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
/** A question somebody kept — what the views row lists, applies and manages. */
export interface SavedQueryView {
  id: string
  name: string
  description?: string | null
  /** The jMQ, in either shape — one condition, or a whole `view` block. */
  filter: string | null
  order?: string | null
  /** Whether everyone who can reach its owner sees it, or only its author. */
  shared?: boolean
  /**
   * ⚠️ The SERVER's answer, never derived from an author id in the browser. A screen that worked out
   * who may edit would be a second implementation of a permission, and the two disagree the day one
   * of them is changed.
   */
  editable?: boolean
}

/** What is sent when a view is kept or renamed. */
export interface SavedQueryDraft {
  name: string
  description?: string | null
  filter: string | null
  order?: string | null
  shared?: boolean
}

/**
 * Listing, keeping and managing saved views.
 *
 * ⚠️ **Optional, and the row simply does not appear without it.** A product with no store keeps exactly
 * the panel it has today — the same rule the backend autoconfiguration follows, so a product adopts
 * saved views by wiring them rather than by having them appear half-working.
 */
export interface SavedQueryTransport {
  list(subject: QuerySubject): Promise<SavedQueryView[]>
  save(subject: QuerySubject, draft: SavedQueryDraft): Promise<SavedQueryView>
  update(subject: QuerySubject, id: string, draft: SavedQueryDraft): Promise<SavedQueryView>
  remove(subject: QuerySubject, id: string): Promise<void>
}

export interface QueryTransport {
  /** `GET {prefix}/{subject}/schema` with the subject's parameters as the query string. */
  schema(subject: QuerySubject): Promise<QueryVocabulary>
  /** `POST {prefix}/{subject}/translate`. */
  translate(subject: QuerySubject, translation: Translation): Promise<Translated>
  /** ⚠️ Omitted by a product with no saved-query store — see {@link SavedQueryTransport}. */
  views?: SavedQueryTransport
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

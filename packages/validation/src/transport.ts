import { createContext, useContext } from "react"
import { received } from "./drafts"
import type { OfferedCheck, RenderedValidation, ValidationDraft } from "./types"

/**
 * How this package reaches the server — supplied by the product, never chosen here.
 *
 * ## ⚠️ No HTTP client is imported by this package, deliberately
 *
 * Every product already has one, wired to its own token refresh, its own workspace header and its own
 * error events. A shared package bringing a second would mean a request that skips all of that, and the
 * failure is a silent 401 on one screen while every other screen quietly re-authenticates.
 *
 * So the product hands over one function and this package calls it.
 */
export interface ValidationTransport {
  /** `GET {prefix}/checks` — what the form may offer, and how to label each one's inputs. */
  checks(): Promise<OfferedCheck[]>
  /** `POST {prefix}/render` — rows in, document out. */
  render(draft: ValidationDraft): Promise<RenderedValidation>
  /** `POST {prefix}/parse` — document in, rows out. ⚠️ Refuses with 422 where the form cannot show it. */
  parse(text: string): Promise<ValidationDraft>

  /** `GET {prefix}/documents` — every stored document, ⚠️ WITHOUT its source. */
  documents(): Promise<StoredDocument[]>
  /** `GET {prefix}/documents/by-id` — one, source included. */
  document(id: string): Promise<StoredDocument>
  /** `PUT {prefix}/documents/one` — writes under a name, creating or replacing what it says. */
  write(name: string, source: string): Promise<StoredDocument>
  /** `PUT {prefix}/documents/by-id` — replaces what an existing one says, leaving its name alone. */
  rewrite(id: string, source: string): Promise<StoredDocument>
  /**
   * `DELETE {prefix}/documents/one` — removes one.
   *
   * ⚠️ **The store does not know what points at a document and will not guess.** A product that keeps
   * references says so through `ValidationDocuments`' `usage` prop, and the screen refuses there.
   */
  remove(name: string): Promise<void>
}

/**
 * One stored document, as the library's document controller answers.
 *
 * ⚠️ `source` is `null` in a listing — forty documents is not forty files, which is why a caller that
 * wants one asks for it.
 */
export interface StoredDocument {
  /** ⚠️ What a product POINTS at. A pointer in another table has to survive a rename. */
  id: string
  name: string
  source: string | null
  createdAt: string
  updatedAt: string
}

/** The verbs this package uses. ⚠️ A product's request function has to handle all four. */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE"

const Transport = createContext<ValidationTransport | null>(null)

export const ValidationTransportProvider = Transport.Provider

/**
 * ⚠️ Throws rather than falling back. A builder with no transport would render, sit empty, and read as
 * *this product offers no checks* — which is the wrong bug to go looking for.
 */
export function useValidationTransport(): ValidationTransport {
  const transport = useContext(Transport)

  if (transport === null) {
    throw new Error(
      "No ValidationTransport. Wrap the screen in <ValidationTransportProvider value={…}> — this " +
        "package brings no HTTP client of its own, on purpose.",
    )
  }

  return transport
}

/**
 * A transport over any request function, which is what a product's HTTP client already is.
 *
 * ⚠️ `prefix` defaults to what the library's controller answers on. A product that moved it with
 * `jmouse.validation.management.prefix` has to say so here too — the address lives in two places and
 * there is no third to forget.
 */
export function transportOver(
  request: <T>(method: HttpMethod, url: string, url2?: unknown) => Promise<T>,
  prefix = "/jmouse/validation/api",
): ValidationTransport {
  return {
    checks: () => request<OfferedCheck[]>("GET", `${prefix}/checks`),
    render: (draft) => request<RenderedValidation>("POST", `${prefix}/render`, draft),
    // ⚠️ Through `received` — a product whose serialization omits nulls would otherwise hand every
    // component an `undefined` where the wire model promised a `null`. See `received` for what that costs.
    parse: (text) =>
      request<ValidationDraft>("POST", `${prefix}/parse`, { text }).then(received),

    // ⚠️ A name travels as an encoded QUERY parameter, never in the path: it carries slashes by design
    // (`innoventa/common-fields`), so a path would have to be a wildcard and every handler would slice
    // the URL its own way.
    documents: () => request<StoredDocument[]>("GET", `${prefix}/documents`),
    document: (id) => request<StoredDocument>("GET", `${prefix}/documents/by-id?id=${encodeURIComponent(id)}`),
    write: (name, source) =>
      request<StoredDocument>("PUT", `${prefix}/documents/one?name=${encodeURIComponent(name)}`, { source }),
    rewrite: (id, source) =>
      request<StoredDocument>("PUT", `${prefix}/documents/by-id?id=${encodeURIComponent(id)}`, { source }),
    remove: (name) =>
      request<void>("DELETE", `${prefix}/documents/one?name=${encodeURIComponent(name)}`),
  }
}

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

/**
 * A subject's declaration, written back out as jMQ.
 *
 * ⚠️ **Read-only and derived — there is nothing here to edit.** Both halves are rendered by the server's
 * own translator from the tree it actually runs against, so what a person reads is what the engine holds
 * rather than a description of it that can drift.
 *
 * ⚠️ Either half may be `null`, which means the subject declined to show it — never that it has none. An
 * entry source depends on which form was named, so asked without one there is nothing truthful to render.
 */
export interface QueryProjection {
  subject: string
  /** `structure … { }` — the shape, and the half a saved view is written against. */
  structure: string | null
  /** `mapping … { }` — where the values actually are. */
  mapping: string | null
}

export interface QueryTransport {
  /** `GET {prefix}/{subject}/schema` with the subject's parameters as the query string. */
  schema(subject: QuerySubject): Promise<QueryVocabulary>
  /** `GET {prefix}/{subject}/projection` — the declaration, as jMQ. */
  projection?(subject: QuerySubject): Promise<QueryProjection>
  /** `POST {prefix}/{subject}/translate`. */
  translate(subject: QuerySubject, translation: Translation): Promise<Translated>
  /** ⚠️ Omitted by a product with no saved-query store — see {@link SavedQueryTransport}. */
  views?: SavedQueryTransport
  /** ⚠️ Omitted by a product that does not let declarations be read or written — see {@link SourceTransport}. */
  sources?: SourceTransport
  /** ⚠️ Omitted by a product with no query runner — see {@link PlaygroundTransport}. */
  playground?: PlaygroundTransport
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
    projection: (subject) => request<QueryProjection>("GET", address(subject, "projection")),
    translate: (subject, translation) =>
      request<Translated>("POST", address(subject, "translate"), translation),
  }
}

/** What a listing's declaration is, and what may be done to it. */
export interface SourceDeclaration {
  subject: string
  /** `DERIVED` — built from something already true, never editable. `AUTHORED` — a document. */
  origin: "DERIVED" | "AUTHORED"
  /** ⚠️ `null` means the subject declined to describe itself, never that it has no declaration. */
  body: string | null
  /** Whether this came from a row. `false` means it is the product's own, projected. */
  authored: boolean
  author: string | null
  updatedAt: string | null
  /** ⚠️ The SERVER's answer to *may you rewrite this*, never derived from a permission name here. */
  writable: boolean
  /** Whether the installation publishes any table at all — with none, nothing is authorable. */
  publishesTables: boolean
}

/** One attribute row, as the builder draws it and sends it back. */
export interface SourceAttribute {
  name: string
  source: string | null
  type: string | null
  access: string | null
}

/** What the builder sends: a shape, and where each of its values lives. */
export interface SourceComposition {
  structure: string
  table: string
  alias?: string | null
  key?: string | null
  attributes: SourceAttribute[]
}

/**
 * The server's answer about a declaration.
 *
 * ⚠️ `readable: false` is DATA, not a failure — half-typed text is the normal state of an editor, and a
 * screen raising every keystroke as an error would flash red at somebody who has made no mistake yet.
 * On a compose call `message` carries the jMQ itself rather than a sentence.
 */
export interface SourceVerdict {
  readable: boolean
  message: string
  tables: string[]
  attributes: SourceAttribute[]
}

/**
 * Reading and rewriting what a listing IS.
 *
 * ⚠️ **Optional, exactly like `views`.** A product adopts this by wiring it; one that does not gets a
 * screen with no declaration tab rather than a tab that refuses.
 *
 * ⚠️ **Nothing here composes jMQ in the browser.** `compose` sends ROWS and is handed text back — the
 * same rule the query builder follows, and for the same reason: a second writer for a language drifts
 * from the one that decides what actually runs.
 */
export interface SourceTransport {
  declaration(subject: QuerySubject): Promise<SourceDeclaration>
  rewrite(subject: QuerySubject, body: string): Promise<SourceDeclaration>
  revert(subject: QuerySubject): Promise<SourceDeclaration>
  validate(subject: QuerySubject, body: string): Promise<SourceVerdict>
  compose(subject: QuerySubject, composition: SourceComposition): Promise<SourceVerdict>
}

/**
 * The declaration half of the transport, over the same request function.
 *
 * ⚠️ **Separate from `transportOver` and opt-in, deliberately.** Wiring this is a product saying *these
 * addresses exist here*; getting it for free would put a Declaration tab on a screen whose backend
 * answers 404, and an empty tab reads as *this has no declaration* rather than as *this product has not
 * wired it*.
 *
 * ⚠️ `PUT` and `DELETE` are needed here and `transportOver` only asks for `GET`/`POST`, which is why
 * this takes its own, wider request function.
 */
export function sourceTransportOver(
  request: <T>(method: "GET" | "POST" | "PUT" | "DELETE", url: string, body?: unknown) => Promise<T>,
  prefix = "/query",
): SourceTransport {
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
    declaration: (subject) => request<SourceDeclaration>("GET", address(subject, "source")),
    rewrite: (subject, body) => request<SourceDeclaration>("PUT", address(subject, "source"), { body }),
    revert: (subject) => request<SourceDeclaration>("DELETE", address(subject, "source")),
    validate: (subject, body) =>
      request<SourceVerdict>("POST", address(subject, "source/validate"), { body }),
    compose: (subject, composition) =>
      request<SourceVerdict>("POST", address(subject, "source/compose"), composition),
  }
}

/**
 * What a query compiles to — the statement, never the rows.
 *
 * ⚠️ **The statement is incomplete on purpose.** A listing adds its own confinement before running —
 * the projects this caller may browse, the workspace they are in — and that fragment is supplied at the
 * product's call site, not by the language. Showing this as the statement the listing runs would teach
 * a reader that their listing is unconfined.
 */
export interface CompiledQuery {
  /** ⚠️ `false` is data — half-typed jMQ is the normal state of a box somebody is typing into. */
  readable: boolean
  message: string | null
  /** The rendered form. ⚠️ `null` where the destination produces no text — a pipeline is not a document. */
  output: string | null
  /** What `output` is written in: `sql`, `jmq`, `json`, `xml`, or `rows` for the one that has none. */
  language: string | null
  /** ⚠️ May be ABSENT, not just empty — this backend omits empty values, so guard every read. */
  parameters?: string[]
  dialect: string | null
  /**
   * ⚠️ Whether this is what would actually RUN here. `false` means it was compiled for a dialect this
   * installation is not pointed at — the engines differ in how an interval is written, and that is a
   * query that runs and answers about a different length of time rather than one that fails.
   */
  live: boolean
  /** What the destination can honour, where that is the interesting answer rather than the text. */
  capabilities?: string[]
}

/**
 * Compiling a query without running it.
 *
 * ⚠️ Optional like the rest. A product with the builder and no runner has no dialect to compile
 * against, and gets a screen without the tab rather than a tab that fails at the first press.
 */
/** Where a tree can be sent. ⚠️ `json` and `xml` are for LOOKING at — nothing reads them back. */
export type QueryDestination = "sql" | "jmq" | "json" | "xml" | "rows"

export interface PlaygroundTransport {
  compile(
    subject: QuerySubject,
    filter: string,
    order: string,
    translator: QueryDestination,
    dialect: string,
  ): Promise<CompiledQuery>
}

/**
 * The compiling half of the transport, over the same request function.
 *
 * ⚠️ Opt-in for the same reason `sourceTransportOver` is: wiring it is a product saying *this address
 * exists here*, and a tab whose backend answers 404 reads as a broken product rather than an unwired one.
 */
export function playgroundTransportOver(
  request: <T>(method: "GET" | "POST", url: string, body?: unknown) => Promise<T>,
  prefix = "/query",
): PlaygroundTransport {
  return {
    compile: (subject, filter, order, translator, dialect) => {
      const parameters = new URLSearchParams()

      Object.entries(subject.parameters ?? {}).forEach(([name, value]) => {
        if (value !== undefined && value !== "") {
          parameters.set(name, value)
        }
      })

      const query = parameters.toString()
      const url = `${prefix}/${subject.name}/playground${query === "" ? "" : `?${query}`}`

      return request<CompiledQuery>("POST", url, { filter, order, translator, dialect })
    },
  }
}

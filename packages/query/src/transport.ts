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
/**
 * One listing named in a batch, and what came back for it.
 *
 * ⚠️ **The parameters travel both ways.** A product registers one subject per thing being listed, so two
 * subjects can share a name and differ only here — an answer identified by name alone could not be
 * matched to the row that asked for it.
 */
export interface BatchedSubjectViews {
  subject: string
  parameters: Record<string, string>
  views: SavedQueryView[]
  /** The caller may not read this listing. ⚠️ One refusal must not fail the batch. */
  refused: boolean
}

export interface SavedQueryTransport {
  list(subject: QuerySubject): Promise<SavedQueryView[]>
  /**
   * Every listing's kept views, in one request.
   *
   * ⚠️ **Optional, and a product without it keeps working.** The manager falls back to one request per
   * subject — which is what it always did, and what costs eighty-eight requests on a workspace with
   * forty-four listings.
   */
  listMany?(subjects: readonly QuerySubject[]): Promise<BatchedSubjectViews[]>
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
 * One listing's address — the subject, the action, and ⚠️ **whatever narrows it**.
 *
 * ## ⚠️ Written once, because forgetting the parameters fails SILENTLY
 *
 * A subject is a name *and* the parameters that say which listing of that name it is — forty-four forms
 * are forty-four `entries`. An address built without them still resolves, still answers 200 and still
 * returns rows: the server simply answers about the subject rather than about the listing, so one form's
 * kept questions appear on all of them and a question saved on one is filed where every one of them can
 * see it. Nothing anywhere reports this.
 *
 * That is not hypothetical — every hand-written saved-view address in this workspace omitted them, which
 * is precisely why the address is now built in one place and handed to every transport below.
 */
function addressing(prefix: string) {
  return (subject: QuerySubject, action: string) => {
    const parameters = new URLSearchParams()

    Object.entries(subject.parameters ?? {}).forEach(([name, value]) => {
      if (value !== undefined && value !== "") {
        parameters.set(name, value)
      }
    })

    const query = parameters.toString()

    return `${prefix}/${subject.name}/${action}${query === "" ? "" : `?${query}`}`
  }
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
  const address = addressing(prefix)

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
/** One listing's declaration in a batch — see {@link BatchedSubjectViews} for why parameters travel. */
export interface BatchedSubjectDeclaration {
  subject: string
  parameters: Record<string, string>
  declaration: SourceDeclaration | null
  refused: boolean
}

export interface SourceTransport {
  declaration(subject: QuerySubject): Promise<SourceDeclaration>
  /** Every listing's declaration in one request. ⚠️ Optional — see `SavedQueryTransport.listMany`. */
  declarationMany?(subjects: readonly QuerySubject[]): Promise<BatchedSubjectDeclaration[]>
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
  const address = addressing(prefix)

  return {
    declaration: (subject) => request<SourceDeclaration>("GET", address(subject, "source")),
    // ⚠️ Free for every product that wires `sourceTransportOver` — the route is the library's own, so a
    // product adopts the batch by doing nothing at all.
    declarationMany: (subjects) =>
      request<BatchedSubjectDeclaration[]>(
        "POST",
        `${prefix}/sources/batch`,
        subjects.map((subject) => ({ subject: subject.name, parameters: subject.parameters ?? {} })),
      ),
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
  const address = addressing(prefix)

  return {
    compile: (subject, filter, order, translator, dialect) =>
      request<CompiledQuery>("POST", address(subject, "playground"), {
        filter,
        order,
        translator,
        dialect,
      }),
  }
}

/**
 * The saved-view half of the transport, over the same request function.
 *
 * ## ⚠️ Here rather than in each product, and that is the whole point of it existing
 *
 * These five addresses are the library's own, and a product hand-writing them writes five URLs whose
 * only tricky part — the parameters that say *which* listing — is invisible when it is missing. Innoventa
 * wrote them by hand and left them off all five, so every form's shelf was every other form's, and a view
 * kept on one was saved where all of them could see it.
 *
 * ⚠️ **Opt-in, exactly like `sourceTransportOver`.** Wiring it is a product saying *this product keeps
 * saved views*; getting it for free would draw a shelf over a backend with no store, and a shelf that can
 * never fill reads as *you have saved nothing* rather than as *this product does not keep these*.
 *
 * ⚠️ `PUT` and `DELETE` are needed here, which is why this takes the wider request function.
 */
export function savedQueryTransportOver(
  request: <T>(method: "GET" | "POST" | "PUT" | "DELETE", url: string, body?: unknown) => Promise<T>,
  prefix = "/query",
): SavedQueryTransport {
  const address = addressing(prefix)

  return {
    list: (subject) => request<SavedQueryView[]>("GET", address(subject, "views")),
    // ⚠️ Free for every product that wires this — the route is the library's own, so a product adopts the
    // batch by doing nothing at all. And its parameters travel in the BODY, which is why the batch was
    // the one saved-view call that never lost them.
    listMany: (subjects) =>
      request<BatchedSubjectViews[]>(
        "POST",
        `${prefix}/views/batch`,
        subjects.map((subject) => ({ subject: subject.name, parameters: subject.parameters ?? {} })),
      ),
    save: (subject, draft) => request<SavedQueryView>("POST", address(subject, "views"), draft),
    update: (subject, id, draft) =>
      request<SavedQueryView>("PUT", address(subject, `views/${id}`), draft),
    remove: (subject, id) => request<void>("DELETE", address(subject, `views/${id}`)),
  }
}

import type { ParallaxLive } from "./live";
import type { PageSlice } from "./problem";
import type {
  Category, ComponentModelView, ComponentReferenceView, ComputationAnswer, ComputationRequest, EditedDocument, FormEdit,
  FormulaReference, FramesAnswer, Interpretation, Job, LanguageSchema, ObjectDetail, ObjectDraft, ObjectNature, ObjectQuery,
  ObjectRevision, ObjectSummary, Ready, Rendering, RepresentationSpecification, SubjectView, SymbolView,
} from "./wire";
import type { TimeSeriesDataset } from "../visual/datasets";

/**
 * How the engine's interface reaches the server — supplied by the product, never chosen here.
 *
 * ⚠️ No HTTP client lives here, deliberately: the product already has one, wired to its own token, its own 401 event
 * and its own problem documents. A second one would be a request that skips all of that. So the product hands over
 * one request function (and, for the live socket, its token) and the engine calls them.
 *
 * Only the engine's routes are here. The library's other routes — scenes, comparisons, collections, instruments, an
 * owner's objects and jobs, the machinery's administration — answer under the same prefix but are called from the
 * product's own API modules; workspaces, accounts, lessons, sharing and interface settings are the product's.
 */
export interface ParallaxTransport {
  catalogue: CatalogueTransport;
  components: ComponentTransport;
  computations: ComputationTransport;
  documents: DocumentTransport;
  formula: FormulaTransport;
  subjects: SubjectTransport;
  live: ParallaxLive;
}

/** Catalogue objects, their revisions, and the sections they are filed in. */
export interface CatalogueTransport {
  /** The sections and how many published objects each holds — of one nature when `nature` names one. */
  categories(signal?: AbortSignal, nature?: ObjectNature): Promise<Category[]>;
  saveCategory(code: string, draft: { title: string; description?: string; position?: number }): Promise<Category>;
  deleteCategory(code: string): Promise<void>;
  objects(query: ObjectQuery, signal?: AbortSignal): Promise<PageSlice<ObjectSummary>>;
  /** The objects a shelf or a set names, summarised in the order asked; one the reader cannot open is left out. */
  summaries(slugs: readonly string[], signal?: AbortSignal): Promise<ObjectSummary[]>;
  object(idOrSlug: string, signal?: AbortSignal): Promise<ObjectDetail>;
  create(draft: ObjectDraft): Promise<ObjectDetail>;
  update(id: string, version: number, draft: ObjectDraft): Promise<ObjectDetail>;
  /** The shipped catalogue's newer text, taken over a curator's edit; the edit stays in the history. */
  takeShipped(id: string): Promise<ObjectDetail>;
  setStatus(id: string, status: ObjectSummary["status"]): Promise<ObjectDetail>;
  remove(id: string): Promise<void>;
  /** Every saved revision of the object's text, newest first. */
  revisions(id: string, signal?: AbortSignal): Promise<ObjectRevision[]>;
  /** One revision's text. */
  revision(id: string, revision: number, signal?: AbortSignal): Promise<{ revision: number; source: string }>;
}

/** What a sheet draws its parts from: the component models and the symbol documents. */
export interface ComponentTransport {
  models(signal?: AbortSignal): Promise<ComponentReferenceView[]>;
  model(reference: string, signal?: AbortSignal): Promise<ComponentModelView>;
  symbols(signal?: AbortSignal): Promise<SymbolView[]>;
}

export interface ComputationTransport {
  compute(computation: ComputationRequest, signal?: AbortSignal): Promise<ComputationAnswer>;
  /** One computation at many values of one parameter: an animation computed ahead, in one request. */
  frames(animation: { computation: ComputationRequest; parameter: string; values: number[] }, signal?: AbortSignal): Promise<FramesAnswer>;
  job(jobId: string, signal?: AbortSignal): Promise<Job>;
  jobDataset(jobId: string, signal?: AbortSignal): Promise<Ready>;
  cancel(jobId: string): Promise<Job>;
  representations(signal?: AbortSignal): Promise<RepresentationSpecification[]>;
}

/**
 * The jMX language as an editor sees it (`/jmx/*`): the schema forms are generated from, a text as a form, and a
 * form's edit as the next text.
 */
export interface DocumentTransport {
  schema(signal?: AbortSignal): Promise<LanguageSchema>;
  form(source: string, signal?: AbortSignal): Promise<EditedDocument>;
  /** What a circuit's bench drew, patched into its text line by line. */
  schematic(source: string, definition: { kind: string } & Record<string, unknown>, parameters: unknown[], title: string, summary: string,
    category: string): Promise<EditedDocument>;
  /** What the drawing canvas drew, patched into the symbol's text line by line. */
  drawing(source: string, drawing: string, title: string, category: string): Promise<EditedDocument>;
  edit(source: string, edit: FormEdit, signal?: AbortSignal): Promise<EditedDocument>;
  /**
   * A SPICE netlist as a jMX document: a `.subckt` as a component, a whole netlist as a circuit. What SPICE says that
   * jMX has no counterpart for is named in `notes`, never dropped in silence.
   */
  spiceImport(text: string, name?: string | null): Promise<SpiceImport>;
  /** A jMX component or circuit as a SPICE netlist; what SPICE cannot say is named in `notes`. */
  spiceExport(source: string): Promise<SpiceExport>;
  /**
   * A circuit's transient computed by SPICE — the second engine — at the parameters given, to set beside the engine's
   * own. Refused (`refused`) on a server with no SPICE configured; `notes` name what the deck could not carry.
   */
  spiceTransient(source: string, parameters: Record<string, number>, signal?: AbortSignal): Promise<SpiceTransient>;
}

export interface SpiceImport {
  source: string;
  kind: "COMPONENT" | "CIRCUIT";
  notes: string[];
}

export interface SpiceExport {
  text: string;
  notes: string[];
}

export interface SpiceTransient {
  /** Columns as ngspice names them: a node's voltage by the node, a branch current by its element (`VG1`). */
  series: TimeSeriesDataset;
  /** The deck that ran, its control block included. */
  deck: string;
  notes: string[];
}

export interface FormulaTransport {
  /** Every formula given, in all three notations, in one call. */
  render(sources: string[], signal?: AbortSignal): Promise<Rendering[]>;
  reference(signal?: AbortSignal): Promise<FormulaReference>;
  interpret(source: string, signal?: AbortSignal): Promise<Interpretation>;
}

export interface SubjectTransport {
  resolve(reference: string, signal?: AbortSignal): Promise<SubjectView>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/**
 * The product's request function: the whole address in, the JSON answer out, a refusal thrown as an `ApiProblem`.
 * ⚠️ It must handle all four verbs, and answer `undefined` for a 204.
 */
export type ParallaxRequest = <T>(method: HttpMethod, url: string, options?: { body?: unknown; signal?: AbortSignal }) => Promise<T>;

type Query = Record<string, string | number | boolean | null | undefined>;

/** An address with its query; a value that is undefined, null or empty is left out, not sent as an empty parameter. */
export function queryAddress(path: string, query?: Query): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      parameters.set(key, String(value));
    }
  }
  const search = parameters.toString();
  return `${path}${search ? `?${search}` : ""}`;
}

/** Where the library's REST routes answer unless a product moves them (`jmouse.parallax.management.prefix`). */
export const PARALLAX_API_PREFIX = "/jmouse/parallax/api";

/** Where the library's live socket answers unless a product moves it (`jmouse.parallax.live.path`). */
export const PARALLAX_LIVE_PATH = "/jmouse/parallax/live";

/**
 * The live socket's port at `path`, on the page's own host. The token is asked for when a socket opens, never kept: a
 * reader who signs in later is carried by the next socket.
 */
export function liveOver(token: () => string | null, path = PARALLAX_LIVE_PATH): ParallaxLive {
  return {
    socketUrl: () => `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${path}`,
    token,
  };
}

/**
 * A transport over any request function, which is what a product's HTTP client already is.
 *
 * `prefix` is where the library's routes answer and `livePath` where its socket does — the library's own addresses
 * unless a product moved them. `token` is for the live socket only — a request carries its own, inside the request
 * function.
 */
export function transportOver(request: ParallaxRequest, prefix = PARALLAX_API_PREFIX, token: () => string | null = () => null,
  livePath = PARALLAX_LIVE_PATH): ParallaxTransport {
  return {
    catalogue: {
      categories: (signal, nature) => request<Category[]>("GET", queryAddress(`${prefix}/catalogue/categories`, { nature }), { signal }),
      saveCategory: (code, draft) => request<Category>("PUT", `${prefix}/catalogue/categories/${encodeURIComponent(code)}`, { body: draft }),
      deleteCategory: (code) => request<void>("DELETE", `${prefix}/catalogue/categories/${encodeURIComponent(code)}`),
      objects: (query, signal) => request<PageSlice<ObjectSummary>>("GET", queryAddress(`${prefix}/catalogue/objects`, { ...query }), { signal }),
      summaries: (slugs, signal) => request<ObjectSummary[]>("POST", `${prefix}/catalogue/objects/summaries`, { body: { slugs }, signal }),
      object: (idOrSlug, signal) => request<ObjectDetail>("GET", `${prefix}/catalogue/objects/${encodeURIComponent(idOrSlug)}`, { signal }),
      create: (draft) => request<ObjectDetail>("POST", `${prefix}/catalogue/objects`, { body: draft }),
      update: (id, version, draft) => request<ObjectDetail>("PUT", queryAddress(`${prefix}/catalogue/objects/${encodeURIComponent(id)}`, { version }), { body: draft }),
      takeShipped: (id) => request<ObjectDetail>("POST", `${prefix}/catalogue/objects/${encodeURIComponent(id)}/shipped`),
      setStatus: (id, status) => request<ObjectDetail>("PUT", `${prefix}/catalogue/objects/${encodeURIComponent(id)}/status`, { body: { status } }),
      remove: (id) => request<void>("DELETE", `${prefix}/catalogue/objects/${encodeURIComponent(id)}`),
      revisions: (id, signal) => request<ObjectRevision[]>("GET", `${prefix}/catalogue/objects/${encodeURIComponent(id)}/revisions`, { signal }),
      revision: (id, revision, signal) =>
        request<{ revision: number; source: string }>("GET", `${prefix}/catalogue/objects/${encodeURIComponent(id)}/revisions/${revision}`, { signal }),
    },
    components: {
      models: (signal) => request<ComponentReferenceView[]>("GET", `${prefix}/component-models`, { signal }),
      model: (reference, signal) => request<ComponentModelView>("GET", `${prefix}/component-models/${encodeURIComponent(reference)}`, { signal }),
      symbols: (signal) => request<SymbolView[]>("GET", `${prefix}/symbols`, { signal }),
    },
    computations: {
      compute: (computation, signal) => request<ComputationAnswer>("POST", `${prefix}/computations`, { body: computation, signal }),
      frames: (animation, signal) => request<FramesAnswer>("POST", `${prefix}/computations/frames`, { body: animation, signal }),
      job: (jobId, signal) => request<Job>("GET", `${prefix}/jobs/${encodeURIComponent(jobId)}`, { signal }),
      jobDataset: (jobId, signal) => request<Ready>("GET", `${prefix}/jobs/${encodeURIComponent(jobId)}/dataset`, { signal }),
      cancel: (jobId) => request<Job>("POST", `${prefix}/jobs/${encodeURIComponent(jobId)}/cancel`),
      representations: (signal) => request<RepresentationSpecification[]>("GET", `${prefix}/representations`, { signal }),
    },
    documents: {
      schema: (signal) => request<LanguageSchema>("GET", `${prefix}/jmx/schema`, { signal }),
      form: (source, signal) => request<EditedDocument>("POST", `${prefix}/jmx/form`, { body: { source }, signal }),
      schematic: (source, definition, parameters, title, summary, category) =>
        request<EditedDocument>("POST", `${prefix}/jmx/schematic`, { body: { source, definition, parameters, title, summary, category } }),
      drawing: (source, drawing, title, category) =>
        request<EditedDocument>("POST", `${prefix}/jmx/drawing`, { body: { source, drawing, title, category } }),
      edit: (source, edit, signal) =>
        request<EditedDocument>("POST", `${prefix}/jmx/edit`, { body: { source, edit: { statement: 0, line: 0, values: {}, text: "", ...edit } }, signal }),
      spiceImport: (text, name) => request<SpiceImport>("POST", `${prefix}/spice/import`, { body: { text, name: name ?? null } }),
      spiceExport: (source) => request<SpiceExport>("POST", `${prefix}/spice/export`, { body: { source } }),
      spiceTransient: (source, parameters, signal) => request<SpiceTransient>("POST", `${prefix}/spice/transient`, { body: { source, parameters }, signal }),
    },
    formula: {
      render: (sources, signal) => request<Rendering[]>("POST", `${prefix}/formula/render`, { body: { sources }, signal }),
      reference: (signal) => request<FormulaReference>("GET", `${prefix}/formula/reference`, { signal }),
      interpret: (source, signal) => request<Interpretation>("POST", `${prefix}/formula/interpret`, { body: { source }, signal }),
    },
    subjects: {
      resolve: (reference, signal) => request<SubjectView>("POST", `${prefix}/subjects/resolve`, { body: { reference }, signal }),
    },
    live: liveOver(token, livePath),
  };
}

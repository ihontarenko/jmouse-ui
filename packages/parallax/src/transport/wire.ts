import type { Dataset } from "../visual";

/*
 * What the engine's routes take and answer, as the server writes them — the catalogue, component models and symbols,
 * computations, jMX forms, formulas and subjects. The addresses are `transport.ts`'s; nothing here makes a request.
 */

/**
 * Who something belongs to, in the host's own words: a type the host understands (Parallax says `WORKSPACE`, `PROJECT`)
 * and an id in it. The shared catalogue has none.
 */
export interface ParallaxOwner {
  type: string;
  id: string;
}

/** Whether two owners are the same one; null is nobody. */
export function sameOwner(first: ParallaxOwner | null | undefined, second: ParallaxOwner | null | undefined): boolean {
  return !!first && !!second && first.type === second.type && first.id === second.id;
}

// --- The catalogue -----------------------------------------------------------------------------------------------

/** One derived fact and the line of the text it follows from (`line` 0 when it is a default). */
export interface Derived {
  value: string;
  label: string;
  because: string;
  line: number;
}

/** DECISIONS §15: what a page shows besides the picture — the structure, and what was derived from it. */
export interface ObjectExplanation {
  structure: StatementForm[];
  engine: Derived;
  /** How the page presents the object: `dataset`, `instrument`, `drawing` or `part`. */
  presentation: Derived;
  view: Derived;
  /** How many dimensions it lives in and the names that make them: why it is drawn in Space or on the Plane. */
  space: Derived;
  capabilities: Derived[];
}

export interface Category {
  code: string;
  title: string;
  description: string;
  objectCount: number;
}

/** `ObjectNature` on the backend: mathematics in a plotter, a program in a runner, a circuit in the simulator. */
export type ObjectNature = "MATHEMATICAL" | "PROGRAM" | "CIRCUIT" | "COMPONENT" | "SYMBOL" | "GRAPH";

export interface ObjectSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: string;
  /** What the object is at the coarsest grain — derived from its kind; decides its editor and its workbench. */
  nature: ObjectNature;
  category: string;
  ambientDimension: number;
  formulaLatex: string | null;
  /** The formula in LaTeX, jMF and text, from the definition; null when the object has no formula. */
  notation: Notation | null;
  featured: boolean;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  origin: string;
  tags: string[];
  primaryRepresentation: string | null;
  definitionRevision: number;
  updatedAt: string;
}

export interface ParameterDefinition {
  name: string;
  label: string;
  defaultValue: number;
  minimum: number;
  maximum: number;
  step: number;
  animatable: boolean;
  /** The unit the slider shows its numbers in, prefix included (`µF`); empty for a plain number. */
  unit?: string;
  /** How many SI units one shown unit is; the numbers above are in SI. */
  scale?: number;
  /** The values the slider stops at, when the parameter lists them (`N = 7 in [1, 3, 7, 19, 49]`); empty otherwise. */
  values?: number[];
}

export interface ObjectDetail {
  summary: ObjectSummary;
  description: string | null;
  definition: { kind: string } & Record<string, unknown>;
  definitionRevision: number;
  parameters: ParameterDefinition[];
  properties: { key: string; label: string; value: string }[];
  representations: { kind: string; primary: boolean; settings: Record<string, unknown> }[];
  applicableRepresentations: string[];
  presets: { id: string; name: string; description: string; values: Record<string, number> }[];
  related: { slug: string; title: string; kind: string; relation: string }[];
  owner: ParallaxOwner | null;
  version: number;
  /** The object's jMX text — the truth everything above is read from. Null for an unsaved formula. */
  source: string | null;
  /** The revision `source` is; `slug@revision` pins it. */
  sourceRevision: number;
  /** The shipped catalogue has a newer text, kept back because a curator edited this object. */
  shippedUpdatePending: boolean;
  /** The structure, and what is derived from it with the line each follows from; null for an unsaved formula. */
  explanation: ObjectExplanation | null;
}

export interface ComponentModelView {
  name: string;
  kind: string;
  units: string[];
  pins: { name: string; numbers: Record<string, number>; shared: boolean; nature: "ANALOG" | "DIGITAL" | "POWER" | "GROUND"; output: boolean; description: string | null }[];
  parameters: { name: string; value: number; perUnit: boolean; description: string | null }[];
  /** A parametric symbol's lines (`box`, `left d, clk`); empty when the part is drawn from a symbol document. */
  symbol: string[];
  /** The symbol document it is drawn with by default — the first its `symbol uses` line names. */
  symbolReference: string | null;
  /** Every symbol its text names, the default first. */
  symbolVariants: string[];
  /** The default symbol's drawing JSON (`readSymbolDrawing`). */
  symbolDrawing: string | null;
  /** Each port of that symbol → the component pin it stands for. */
  symbolPorts: Record<string, string>;
  /**
   * What an instrument reads (`measure { reading = … unit V }`), figure by figure; empty for a component that is none.
   * `signal`: a voltage, a current, a power a bench reads as DC, AC or RMS; otherwise a figure read as it is.
   */
  measures: { name: string; unit: string; signal: boolean }[];
  /** How each pin's lead looks on a sheet (`leads { plus red stripes black }`): a lead colour, and its stripes' or null. */
  leads: Record<string, { colour: string; stripes: string | null }>;
  /** The unit of each `display` figure written beside the part (`charge = … unit %`), by figure. */
  displayUnits: Record<string, string>;
  /** What such a figure is of, written after it — "of the rated voltage" —, by figure; absent when it says nothing more. */
  displayCaptions?: Record<string, string>;
  /** What a part of it is called on a sheet before its number (`meta designator R`), or null — then "U". */
  designator: string | null;
}

/** A symbol document with its drawing — `GET /symbols`. */
export interface SymbolView {
  slug: string;
  title: string;
  summary: string | null;
  origin: "CATALOGUE" | "OWNED";
  owner: ParallaxOwner | null;
  drawing: string;
}

export interface ComponentReferenceView {
  reference: string;
  name: string;
  kind: string;
  origin: "BUILTIN" | "CATALOGUE" | "OWNED";
  owner: ParallaxOwner | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
}

export interface ObjectQuery {
  text?: string;
  category?: string;
  kind?: string;
  nature?: ObjectNature;
  featured?: boolean;
  tag?: string;
  includeDrafts?: boolean;
  page?: number;
  size?: number;
}

/**
 * What `POST /catalogue/objects` accepts; the lists default to empty on the server. An object is its jMX text: a
 * draft carrying `source` is that text, and every other field is ignored; without it the server writes the fields as
 * text itself.
 */
export interface ObjectDraft {
  source?: string;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  category: string;
  formulaLatex?: string;
  featured?: boolean;
  /** Optional when `source` is sent: the text is then the definition. */
  definition?: { kind: string } & Record<string, unknown>;
  parameters?: ParameterDefinition[];
  representations?: { kind: string; primary: boolean; settings: Record<string, unknown> }[];
  tags?: string[];
  properties?: { key: string; label: string; value: string }[];
  relations?: { slug: string; kind: string }[];
  presets?: { name: string; description: string | null; values: Record<string, number>; camera?: Record<string, unknown> | null }[];
}

/** One saved revision of an object's jMX text, newest first in a list. */
export interface ObjectRevision {
  revision: number;
  checksum: string;
  writtenAt: string;
  writtenBy: string | null;
}

// --- Computations ------------------------------------------------------------------------------------------------

export interface ComputationRequest {
  /** `catalogue:<slug>` or `inline:<formula>` — the subject, instead of spelling out `objectId` or `definition`. */
  subject?: string;
  objectId?: string;
  definition?: Record<string, unknown>;
  parameters?: unknown[];
  representation: string;
  values?: Record<string, number>;
  integerValues?: Record<string, string>;
  settings?: Record<string, unknown>;
  owner?: ParallaxOwner;
}

export interface Ready {
  datasetId: string;
  fingerprint: string;
  representation: string;
  format: string;
  cached: boolean;
  computeMillis: number;
  elementCount: number;
  dataset: Dataset;
}

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  progressMessage: string | null;
  failureDetail: string | null;
}

export type ComputationAnswer = Ready | { job: Job };

export interface RepresentationSpecification {
  kind: string;
  family: string;
  settings: { name: string; type: string; defaultValue: unknown; minimum: number | null; maximum: number | null; choices: string[]; length: number; description: string }[];
  /** The settings whose increase adds to what a viewport draws; held back on a machine below the minimum frame rate. */
  renderLoad: string[];
}

/** One frame of an animation: the value it was computed at, and its answer. */
export interface Frame {
  value: number;
  ready: Ready;
}

/** The frames answered in order; `complete` is false when the backend stopped early — ask again from the first missing. */
export interface FramesAnswer {
  frames: Frame[];
  complete: boolean;
}

// --- Formulas ----------------------------------------------------------------------------------------------------

export interface NotationRow {
  construct: string;
  written: string;
  example: string;
  note: string;
}

export interface FormEntry {
  name: string;
  signature: string;
  example: string;
  description: string;
}

export interface FormulaReference {
  summary: string;
  notation: NotationRow[];
  forms: FormEntry[];
  precedence: string[];
  functions: { name: string; arity: number; complex: boolean; description: string }[];
  constants: { name: string; latex: string; value: number; description: string }[];
  objectKinds: { variables: string; kind: string; description: string }[];
}

/** One formula in the three notations the interface switches between; a form it cannot be written in is null. */
export interface Notation {
  latex: string | null;
  jmf: string | null;
  text: string | null;
}

export interface Rendering {
  source: string;
  notation: Notation | null;
  refusal: string | null;
  position: number | null;
}

export interface Interpretation {
  source: string;
  text: string | null;
  latex: string | null;
  kind: string | null;
  definition: ({ kind: string } & Record<string, unknown>) | null;
  parameters: ParameterDefinition[];
  representations: string[];
  refusal: string | null;
  position: number | null;
}

// --- jMX documents -----------------------------------------------------------------------------------------------

/**
 * The jMX language as an editor sees it (`/jmx/*`): the schema forms are generated from, a text as a form, and a
 * form's edit as the next text. The grammar lives on the server; nothing here restates it.
 */

/** What a field holds, and so which widget edits it. */
export type FieldType = "TEXT" | "LONG_TEXT" | "NAME" | "NAMES" | "WORD" | "FLAGS" | "EXPRESSION" | "REFERENCE" | "REFERENCES" | "CODE";

export interface FieldSchema {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** The words a WORD or FLAGS field allows. */
  words: string[];
  /** The kinds a REFERENCE or REFERENCES field may name, as keywords; empty for any. */
  kinds: string[];
}

export interface FormField {
  schema: FieldSchema;
  value: string;
}

/** How a statement is edited: line by line, as a body in another language, on a canvas, or as one line. */
export type Editor = "LINES" | "BODY" | "SCHEMATIC" | "DRAWING" | "STATEMENT";

export interface LineForm {
  index: number;
  line: number;
  fields: FormField[];
  problem: string | null;
}

export interface StatementForm {
  index: number;
  word: string;
  editor: Editor;
  line: number;
  header: FormField[];
  lines: LineForm[];
  /** The fields a new line of it is made of. */
  fields: FieldSchema[];
  body: string | null;
  problem: string | null;
}

export interface Refusal {
  line: number;
  column: number;
  message: string;
}

export interface DocumentForm {
  kind: string;
  title: string;
  statements: StatementForm[];
  addable: string[];
  refusal: Refusal | null;
}

export interface EditedDocument {
  source: string;
  form: DocumentForm;
}

export type FormAction = "SET_TITLE" | "SET_LINE" | "ADD_LINE" | "REMOVE_LINE" | "SET_HEADER" | "SET_BODY" | "SET_STATEMENT"
  | "REMOVE_STATEMENT" | "ADD_STATEMENT";

export interface FormEdit {
  action: FormAction;
  statement?: number;
  line?: number;
  values?: Record<string, string>;
  text?: string;
}

export interface BlockSchema {
  name: string;
  editor: Editor;
  repeatable: boolean;
  header: FieldSchema[];
  line: FieldSchema[];
  kinds: string[];
}

export interface LanguageSchema {
  kinds: { keyword: string; role: string; blocks: string[]; lines: string[] }[];
  blocks: BlockSchema[];
  declarations: FieldSchema[];
  fieldTypes: FieldType[];
}

// --- Subjects ----------------------------------------------------------------------------------------------------

/**
 * A subject — a catalogue object or a typed formula — as one object description. ⚠️ An unsaved one (`saved`
 * false) carries no id, slug, category, status or update time: those fields are null, whatever `ObjectDetail`
 * says, and the screens that draw it branch on `saved` before reading them.
 */
export interface SubjectView {
  reference: string;
  saved: boolean;
  object: ObjectDetail | null;
  refusal: string | null;
  position: number | null;
}

// --- Scenes ------------------------------------------------------------------------------------------------------

export interface SceneSummary {
  id: string;
  realm: ParallaxOwner;
  owner: ParallaxOwner;
  title: string;
  description: string | null;
  instrumentCode: string | null;
  headRevision: number;
  updatedAt: string;
  version: number;
}

export interface SceneRepresentation {
  id: string;
  kind: string;
  settings: Record<string, unknown>;
  visible: boolean;
  style: Record<string, unknown>;
}

export interface SceneObject {
  id: string;
  label: string;
  objectId: string | null;
  /** An object defined in the scene itself, as its jMX text; null for a stored one. */
  source?: string | null;
  parameters: ParameterDefinition[];
  values: Record<string, number>;
  representations: SceneRepresentation[];
  visible: boolean;
  color: string | null;
}

export interface SceneCamera {
  projection: "PERSPECTIVE" | "ORTHOGRAPHIC";
  position: number[];
  target: number[];
  up: number[];
  fieldOfView: number;
  rotations: number[][];
}

export interface SceneTimeline {
  objectId: string;
  parameter: string;
  start: number;
  end: number;
  durationSeconds: number;
  loop: boolean;
  speed: number;
  position: number;
  trail: boolean;
}

export interface SceneDocument {
  formatVersion: number;
  objects: SceneObject[];
  /** Null in a scene written without one; the editor then starts from its own camera. */
  camera: SceneCamera | null;
  timeline: SceneTimeline | null;
  viewports: { id: string; title: string; representationIds: string[]; synchronizeCamera: boolean }[];
}

export interface SceneView {
  scene: SceneSummary;
  document: SceneDocument;
  abilities: Record<string, boolean>;
}

// --- The simulator's appearance ----------------------------------------------------------------------------------

export type CurrentColor = "ACCENT" | "AMBER" | "CYAN" | "GREEN" | "PINK" | "WHITE";

export type LeadMode = "HANGING" | "TABLE";

/**
 * How current is drawn moving along a wire: lights running through a frosted tube, or electrons — fine specks drifting
 * in it, more of them for more current.
 */
export type CurrentStyle = "LIGHT" | "ELECTRONS";

/** How the simulator draws current: its colour, how bright against the default 1, how far apart its lights travel. */
export interface SimulatorAppearance {
  currentColor: CurrentColor;
  /** How the current is drawn moving. Absent in an appearance kept before it existed: lights. */
  currentStyle: CurrentStyle;
  /** The colour of a current that reverses too fast to be shown moving. */
  alternatingColor: CurrentColor;
  /** The colour of the lights running back against them on such a wire; `SAME` draws both rows in one colour. */
  alternatingReturnColor: CurrentColor | "SAME";
  /** Above how many alternations a second of wall time a wire is drawn calm — two rows of lights — instead of flowing, 0.5 … 10. */
  alternatingThreshold: number;
  /** The glow behind a part that takes power — current comes into it. */
  takingColor: CurrentColor;
  /** The glow behind a part that gives power back — a source, a capacitor emptying. */
  givingColor: CurrentColor;
  /** How a lead to an instrument lies: hanging under gravity, or on the table where it was put. */
  leadMode: LeadMode;
  /** How deep a hanging lead sags, 0 (taut) … 2 against the default 1. */
  leadSag: number;
  /** 0.25 … 2. */
  currentIntensity: number;
  /** Sheet units between two lights, 12 … 48. */
  lightSpacing: number;
  /** How many past sweeps the oscilloscope's trails keep under the live trace, 2 … 32. */
  scopeTrails: number;
  /** How bright the youngest trail is against the live trace, 0.1 … 1; each older one fainter and thinner. */
  scopeTrailIntensity: number;
}

import type { QueryOperator } from "./types"

/**
 * Every word the panel says, so a product can say it in its own language.
 *
 * ## ⚠️ Not backed by a translation service, and that is the point
 *
 * A shared component that reached for one would force every product onto the same translation service —
 * and two of these products deliberately do not use the same one. Words are props with defaults: a
 * product passes what it wants, and one that passes nothing gets English rather than a key.
 *
 * ⚠️ **Operator words are keyed by the spelling the SERVER sends.** A product adding a word for an
 * operator that does not exist is harmless; the panel only ever looks up what it was given.
 */
export interface QueryLabels {
  /** Keyed by `QueryOperator.spelling`. */
  readonly operators: Readonly<Record<string, string>>
  readonly builderTab: string
  readonly textTab: string
  readonly noConditions: string
  readonly addCondition: string
  readonly removeCondition: string
  readonly field: string
  readonly value: string
  readonly includeMissing: string
  /**
   * ⚠️ The same question as `includeMissing`, in the width a row has for it.
   *
   * Two words for one switch is not duplication: the long sentence is what the control **means** and is
   * shown on hover, while the row itself has about sixty pixels between a value and a delete button.
   * Writing the explanation inline pushed every condition onto two lines; dropping it left a switch
   * captioned by nothing at all.
   */
  readonly includeMissingShort: string
  /**
   * The word leading the FIRST condition, and the one leading every condition after it.
   *
   * ⚠️ **`and` is the whole reason these exist.** Rows are conjoined, and nothing on the screen used to
   * say so — three selects in a bordered card read as an independent statement, and two of them read as
   * two independent statements. A person then has no way to know whether they narrowed the list or
   * widened it, which is the one thing a filter has to be clear about.
   */
  readonly firstCondition: string
  readonly nextCondition: string
  /** What the builder produced, shown under it — the caption, and the invitation to go and edit it. */
  readonly composed: string
  readonly composedOpen: string
  readonly sortBy: string
  readonly sortDefault: string
  readonly descending: string
  readonly ascending: string
  readonly reset: string
  readonly apply: string
  readonly presets: string
  /** The saved-view row: what it is called, and the words its controls need. */
  readonly savedViews: string
  readonly saveView: string
  readonly renameView: string
  readonly discardView: string
  readonly viewName: string
  readonly nothingToSave: string
  readonly handWritten: string
  readonly readable: string
  /**
   * The management screen's own words.
   *
   * ⚠️ Grouped rather than flattened into the list above, because a product wiring only the panel should
   * not have to read past thirty words it will never show.
   */
  readonly manager: QueryManagerLabels
  /** ⚠️ Takes the converter's name, because naming it is what makes the pipe stop looking like noise. */
  readonly converterNote: (converter: string) => string
}

export interface QueryManagerLabels {
  readonly subjects: string
  readonly views: string
  readonly declaration: string
  readonly structure: string
  readonly mapping: string
  /** ⚠️ Says *not shown*, never *none* — a subject may decline to render one. See `QueryProjection`. */
  readonly noProjection: string
  readonly noViews: string
  readonly noStore: string
  readonly editBody: string
  readonly saveChanges: string
  readonly cancel: string
  readonly everyone: string
  readonly mine: string
  readonly readOnly: string
  readonly open: string
  /** ⚠️ Takes the count, because *3 views* is the one thing the row cannot say for itself. */
  readonly viewCount: (count: number) => string
  readonly declarationTab: string
  readonly attributesTab: string
  readonly queriesTab: string
  readonly takeOver: string
  readonly revert: string
  readonly build: string
  readonly composed: string
  readonly addAttribute: string
  readonly shapeName: string
  readonly tableName: string
  readonly attributeName: string
  readonly attributeSource: string
  readonly attributeType: string
  readonly attributeAccess: string
  readonly derivedNote: string
  readonly authoredNote: string
  readonly shippedNote: string
  readonly notYours: string
  readonly nothingPublished: string
  readonly everyQuery: string
  readonly declarationFailed: string
  readonly noQueries: string
  readonly playgroundTab: string
  readonly playgroundFilter: string
  readonly playgroundOrder: string
  readonly playgroundScope: string
  readonly playgroundBound: string
  readonly searchQueries: string
  readonly nothingMatches: string
  /** ⚠️ The COLUMN's word, not the page's sentence — a 15rem row cannot hold a sentence. */
  readonly acrossListings: string
  readonly playgroundAs: string
  readonly playgroundHonours: string
  readonly playgroundJmq: string
  readonly playgroundRows: string
  readonly playgroundShape: string
  /** ⚠️ Takes the dialect, because naming it is what makes the warning act-on-able. */
  readonly playgroundPreview: (dialect: string) => string
}

export const DEFAULT_LABELS: QueryLabels = {
  operators: {
    contains: "contains",
    notContains: "does not contain",
    starts: "starts with",
    ends: "ends with",
    equals: "is",
    notEquals: "is not",
    greater: "is more than",
    greaterOrEqual: "is at least",
    less: "is less than",
    lessOrEqual: "is at most",
    empty: "is empty",
    notEmpty: "is not empty",
  },
  builderTab: "Builder",
  textTab: "Text",
  noConditions: "No conditions — the list shows everything. Add one to narrow it.",
  addCondition: "Condition",
  removeCondition: "Remove condition",
  field: "Field",
  value: "Value",
  includeMissing: "and those with no such field at all",
  includeMissingShort: "or missing",
  firstCondition: "Where",
  nextCondition: "and",
  composed: "Reads as",
  composedOpen: "Edit as text",
  sortBy: "Sort by",
  sortDefault: "Default",
  descending: "descending",
  ascending: "ascending",
  reset: "Reset",
  apply: "Apply",
  savedViews: "Saved",
  saveView: "Save this view",
  renameView: "Rename",
  discardView: "Delete",
  viewName: "Name this view…",
  nothingToSave: "Compose something first — a view that narrows nothing does nothing",
  presets: "Ready questions",
  handWritten:
    "⚠️ This query was written by hand — the builder does not try to redraw it, because quietly " +
    "rewriting somebody's expression is worse than saying so. Edit it as text.",
  readable: "The query reads.",
  manager: {
    subjects: "What can be queried",
    views: "Saved views",
    declaration: "Declaration",
    structure: "Structure — what a query may name",
    mapping: "Mapping — where the values are",
    noProjection:
      "This subject does not show its declaration here. An entry source is built from the form behind " +
      "it, so there is nothing truthful to render until one is named.",
    noViews: "Nothing kept against this subject yet.",
    noStore: "This product keeps no saved views.",
    editBody: "Edit query",
    saveChanges: "Save",
    cancel: "Cancel",
    everyone: "Everyone",
    mine: "Mine",
    readOnly: "Read-only",
    open: "Open",
    viewCount: (count) => (count === 1 ? "1 view" : `${count} views`),
    declarationTab: "Declaration",
    attributesTab: "Attributes",
    queriesTab: "All queries",
    // ⚠️ Not "Save". The first write turns a declaration that lived in code into a row, which is a
    // decision with consequences rather than a keystroke being persisted — and the button is the only
    // place a person is told that before it happens.
    takeOver: "Take over",
    revert: "Back to the shipped one",
    build: "Build",
    composed: "This is what will be saved",
    addAttribute: "Attribute",
    shapeName: "Shape",
    tableName: "table",
    attributeName: "Name",
    attributeSource: "Column",
    attributeType: "Type",
    attributeAccess: "Reached by",
    derivedNote:
      "Derived — what a query may name here follows from the fields on the form behind it, so there is " +
      "nothing to write. Add a field and this changes with it.",
    authoredNote: "Written here, and this is what the listing runs.",
    shippedNote:
      "This is the declaration the product ships, shown as it would be written. Saving takes it over — " +
      "from then on the listing runs what is here, not what is in the code.",
    notYours: "You may read this declaration but not rewrite it.",
    // ⚠️ Names the property, because the reader of this sentence is the person who can set it. "Ask an
    // administrator" would be true and useless.
    nothingPublished:
      "This installation publishes no tables to authored declarations, so nothing here can be " +
      "rewritten. `jmouse.query.published-tables` is what opens that.",
    everyQuery: "Every question kept in this installation, across every listing.",
    declarationFailed:
      "The declaration did not load. This is a failed request, not a listing that declines to show one — " +
      "the difference matters, so it is said rather than left to an empty state.",
    noQueries: "Nothing kept anywhere yet.",
    playgroundTab: "Playground",
    playgroundFilter: "Write a condition — or leave it empty to see the mapping with nothing in the way…",
    playgroundOrder: "issue.createdAt desc",
    // ⚠️ Said ABOVE the statement and never softened. A reader who takes this for the whole statement
    // concludes their listing is unconfined, which is false and is the kind of false thing somebody acts on.
    playgroundScope:
      "⚠️ This is the query as written, compiled but never run. The listing adds its own confinement " +
      "before running — the projects you may browse, the workspace you are in — and that half belongs to " +
      "the product, so it is deliberately not here.",
    playgroundBound: "Bound values",
    searchQueries: "Search names and bodies…",
    nothingMatches: "Nothing matches that.",
    acrossListings: "Across every listing",
    playgroundAs: "as",
    playgroundHonours: "This destination honours",
    playgroundJmq:
      "The query written back out in its own language. ⚠️ Nothing is substituted — names stay names, " +
      "because a query with somebody's identifier baked into it reads correctly and is wrong for " +
      "everybody else.",
    playgroundRows:
      "A pipeline over rows in memory — there is no statement to show, so none is invented. What is " +
      "worth knowing about this destination is what it can honour.",
    playgroundShape:
      "⚠️ The SHAPE of the tree, for looking at. Nothing reads this back and nothing will — the " +
      "machine-readable form of a query is jMQ, which already round-trips.",
    playgroundPreview: (dialect) =>
      `⚠️ Compiled for ${dialect}, which is NOT what this installation is pointed at. A preview — the ` +
      "engines differ in how an interval is written, and that is a query that runs and answers about a " +
      "different length of time rather than one that fails.",
  },
  converterNote: (converter) =>
    `⚠️ This field is stored as text, so the comparison is read as a number — \`| ${converter}\` is ` +
    `added to the query. Without it, "900" would be greater than "1000".`,
}

/** The word for one operator, falling back to its spelling rather than to nothing. */
export function wordFor(labels: QueryLabels, operator: QueryOperator): string {
  return labels.operators[operator.spelling] ?? operator.spelling
}

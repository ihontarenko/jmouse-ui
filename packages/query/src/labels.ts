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
  readonly sortBy: string
  readonly sortDefault: string
  readonly descending: string
  readonly reset: string
  readonly apply: string
  readonly presets: string
  readonly handWritten: string
  readonly readable: string
  /** ⚠️ Takes the converter's name, because naming it is what makes the pipe stop looking like noise. */
  readonly converterNote: (converter: string) => string
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
  sortBy: "Sort by",
  sortDefault: "Default",
  descending: "descending",
  reset: "Reset",
  apply: "Apply",
  presets: "Ready questions",
  handWritten:
    "⚠️ This query was written by hand — the builder does not try to redraw it, because quietly " +
    "rewriting somebody's expression is worse than saying so. Edit it as text.",
  readable: "The query reads.",
  converterNote: (converter) =>
    `⚠️ This field is stored as text, so the comparison is read as a number — \`| ${converter}\` is ` +
    `added to the query. Without it, "900" would be greater than "1000".`,
}

/** The word for one operator, falling back to its spelling rather than to nothing. */
export function wordFor(labels: QueryLabels, operator: QueryOperator): string {
  return labels.operators[operator.spelling] ?? operator.spelling
}

/**
 * Every word the builder says, so a product can say it in its own language.
 *
 * ## ⚠️ Not backed by a translation service, and that is the point
 *
 * A shared component reaching for one would force every product onto the same translation service, and
 * these products deliberately do not share one. Words are a prop with defaults: a product passes what it
 * wants, and one that passes nothing gets English rather than a key.
 */
export interface MapperLabels {
  readonly formTab: string
  readonly documentTab: string
  readonly mappingName: string
  readonly target: string
  readonly source: string
  readonly chooseType: string
  readonly otherType: string
  readonly otherTypeHint: string
  readonly rules: string
  readonly always: string
  readonly alwaysHint: string
  readonly addRule: string
  readonly removeRule: string
  readonly property: string
  readonly expression: string
  readonly expressionHint: string
  readonly condition: string
  readonly conditionHint: string
  readonly ignore: string
  readonly ignoreHint: string
  readonly noRules: string
  readonly addSource: string
  readonly removeSource: string
  readonly addTarget: string
  readonly removeTarget: string
  /** The read-only banner, and the sentence naming what stopped it. */
  readonly readOnly: string
  readonly readOnlyHint: string
  readonly cannotShow: string
  /**
   * ⚠️ The banner for a failure, which is NOT a refusal.
   *
   * A refusal says the document is fine and this form cannot show it. This one says the server could not
   * be asked at all — a session that expired, a fault, the network. Saying the first when the second
   * happened sends somebody hunting through a file that was never the problem.
   */
  readonly unreachable: string
  readonly unreachableHint: string
  readonly applyDocument: string
  readonly revertDocument: string
  readonly unreadChanges: string
  readonly rendering: string
}

export const DEFAULT_LABELS: MapperLabels = {
  formTab: "Form",
  documentTab: "jMM",
  mappingName: "Mapping name",
  target: "Target",
  source: "Source",
  chooseType: "Choose a type…",
  otherType: "Another type",
  otherTypeHint:
    "A type the list does not carry, by its full name. A nested one is written Outer$Inner.",
  rules: "Rules",
  always: "Always",
  alwaysHint: "Applied whichever source the target was filled from.",
  addRule: "Add a rule",
  removeRule: "Remove this rule",
  property: "Property",
  expression: "Comes from",
  expressionHint: "The right-hand side, in jME — a property, a chain of filters, a literal.",
  condition: "Only when",
  conditionHint: "Left empty, the rule always applies.",
  ignore: "Ignore",
  ignoreHint: "Say outright that this property is not mapped, rather than leaving it out.",
  noRules: "No rules yet.",
  addSource: "Add a source",
  removeSource: "Remove this source",
  addTarget: "Add a target",
  removeTarget: "Remove this target",
  readOnly: "This mapping can only be edited as text",
  readOnlyHint:
    "The form would have to leave part of the document out of view, and the next save would delete it.",
  cannotShow: "The form cannot show",
  unreachable: "This document could not be read",
  unreachableHint:
    "Nothing is wrong with the text — the server could not be asked. Your session may have expired.",
  applyDocument: "Read this into the form",
  revertDocument: "Back to the form's document",
  unreadChanges:
    "The document was edited here. Read it into the form, or go back to the form's own document.",
  rendering: "Rendering…",
}

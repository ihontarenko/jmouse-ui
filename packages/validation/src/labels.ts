/**
 * Every word this package puts on a screen.
 *
 * ⚠️ **One object rather than a translation library.** A shared package that reached for i18n would
 * make every consumer adopt the same one; a product that already translates hands over the strings it
 * already has, and one that does not gets English and no dependency.
 */
export interface ValidationLabels {
  formTab: string
  documentTab: string

  /**
   * The words the language itself writes.
   *
   * ⚠️ **A keyword and its explanation are two strings, not one.** `gateBlock` used to be the whole
   * sentence *"Gate — a record failing this is not judged further"* rendered inside a chip, which made
   * a 40-character pill out of a four-character token. The token is drawn as a token; the sentence sits
   * beside it as prose, where a sentence belongs.
   */
  gateKeyword: string
  alwaysKeyword: string
  invariantKeyword: string
  gateHint: string

  guard: string
  otherwise: string
  invariant: string

  field: string
  checks: string
  /** The column the check's own arguments sit in. */
  arguments: string
  lineMessage: string
  checkMessage: string
  stop: string
  /** ⚠️ The short form, for a column heading. `stop` is the whole sentence, for the control itself. */
  stopColumn: string
  condition: string

  /**
   * What a row says when its field has no name yet, and when it asks nothing of one.
   *
   * ⚠️ Two different absences, and a reader has to tell them apart at a glance — a field nobody has
   * named is unfinished, a field with no checks is a line that judges nothing.
   */
  unnamedField: string
  noChecks: string

  /** The accessible name of the row that opens a statement. ⚠️ A row is a control; it needs one. */
  openStatement: string
  /** What the dialog is called, per kind of statement. */
  fieldTitle: string
  guardTitle: string
  invariantTitle: string
  blockTitle: string
  /** The choice between `always` and `gate`, in a block's dialog. */
  blockKind: string
  /** ⚠️ Says that the dialog buffers, and that applying is still not saving. Both halves matter. */
  dialogHint: string
  /** Heads the comments somebody wrote above a statement. ⚠️ Shown, never edited. */
  written: string
  /**
   * The two ways out of the dialog.
   *
   * ⚠️ **`apply`, not *Save*.** It writes the statement into the document being edited; the document
   * is saved by the screen behind, and a second control called Save would be claiming otherwise.
   */
  cancel: string
  apply: string

  /** The one control that follows every branch. */
  addStatement: string
  addCheck: string
  addLine: string
  addGuard: string
  addInvariant: string
  addAlways: string
  addGate: string
  /** Brings a guard's other branch into being. ⚠️ Writing `otherwise { }` is a statement, not a default. */
  addOtherwise: string
  removeOtherwise: string
  removeRow: string

  /** ⚠️ Shown while the document tab holds text nobody has read back into the form. */
  unreadChanges: string
  /** The button that reads the text back. */
  readIntoForm: string
  /** The button that throws the typed text away. */
  discard: string
  /** ⚠️ Shown when the document is fine and the form cannot show it — never as a syntax error. */
  cannotShow: string
  /** Shown when the document will not parse at all. */
  willNotParse: string
  /** Shown when neither answer arrived, which is a fault rather than a statement about the document. */
  unreachable: string

  empty: string
}

export const DEFAULT_LABELS: ValidationLabels = {
  formTab: "Rules",
  documentTab: "Document",

  gateKeyword: "gate",
  alwaysKeyword: "always",
  invariantKeyword: "invariant",
  gateHint: "a record failing this is not judged further",

  guard: "when",
  otherwise: "otherwise",
  invariant: "Assertion",

  field: "Field",
  checks: "Check",
  arguments: "Arguments",
  // ⚠️ Not "Message". A check with none of its own takes this one, so the two boxes — one line apart —
  // are a fallback and the thing it falls back for. Two identical captions said neither.
  lineMessage: "Default",
  checkMessage: "Message",
  stop: "Stop here on failure",
  stopColumn: "Stop",
  condition: "Condition",

  unnamedField: "Unnamed field",
  noChecks: "asks nothing",

  openStatement: "Open",
  fieldTitle: "Field",
  guardTitle: "Guarded branch",
  invariantTitle: "Invariant",
  blockTitle: "Block",
  blockKind: "Kind",
  dialogHint: "Nothing here reaches the document until you apply it — and saving is still on the screen behind.",
  written: "Written above it",
  cancel: "Cancel",
  apply: "Apply",

  addStatement: "Add",
  addCheck: "Add a check",
  addLine: "Field",
  addGuard: "When — a guarded branch",
  addInvariant: "Invariant",
  addAlways: "Always — a block judged every time",
  addGate: "Gate — a block that stops the rest",
  addOtherwise: "otherwise",
  removeOtherwise: "Remove the otherwise branch",
  removeRow: "Remove",

  unreadChanges: "The document has been edited. Read it back into the form, or discard it.",
  readIntoForm: "Read into the form",
  discard: "Discard",
  cannotShow: "This document is valid — the form has no row for one of the things in it.",
  willNotParse: "This is not a validation document yet.",
  unreachable: "The document could not be read. This is a fault, not a problem with what you wrote.",

  empty: "Nothing here yet.",
}

/**
 * The `.jmv` validation builder, shared.
 *
 * ⚠️ **This package contains no implementation of the language.** Rows go to the server and come back
 * as text; text goes to the server and comes back as rows. The one implementation is in Java, it is the
 * one the validation runtime actually loads, and it is the one that writes what a person reads.
 *
 * ⚠️ **And it brings no chrome.** No dialog, no title, no save button — a product mounts
 * {@link ValidationBuilder} where it means to and owns the frame.
 */
export { ValidationBuilder } from "./ValidationBuilder"
export { ValidationRows } from "./ValidationRows"
export { ValidationDocument } from "./ValidationDocument"
export { CheckRow, CheckColumns, CHECK_GRID } from "./CheckRow"
export { Caption } from "./Caption"
export {
  ValidationTransportProvider,
  transportOver,
  useValidationTransport,
  type ValidationTransport,
} from "./transport"
export {
  useOfferedChecks,
  useParsedValidation,
  useRenderedValidation,
  type ParsedValidation,
} from "./hooks"
export {
  appendAt,
  blankCheck,
  blankItem,
  emptyDraft,
  received,
  removeAt,
  replaceAt,
  summarise,
} from "./drafts"
export { DEFAULT_LABELS, type ValidationLabels } from "./labels"
export type {
  CheckDraft,
  ItemDraft,
  ItemKind,
  OfferedCheck,
  RenderedValidation,
  UnshowableValidation,
  ValidationDraft,
} from "./types"
export {
  ValidationDocuments,
  DEFAULT_LABELS as DEFAULT_DOCUMENTS_LABELS,
  type DocumentUsage,
  type DocumentsLabels,
} from "./ValidationDocuments"
export type { StoredDocument, HttpMethod } from "./transport"

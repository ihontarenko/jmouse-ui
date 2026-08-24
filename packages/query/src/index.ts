/**
 * The jMQ filter builder, shared.
 *
 * ⚠️ **This package contains no implementation of the language.** Rows go to the server and come back as
 * text; text goes to the server and comes back as rows. The one implementation is in Java, it is the one
 * that runs the query, and it is the one that writes what a person reads.
 */
export { QueryPanel, type AppliedQuery } from "./QueryPanel"
export { QueryBuilder } from "./QueryBuilder"
export { QueryEditor } from "./QueryEditor"
export { useQueryVocabulary, useTranslation } from "./hooks"
export { QueryTransportProvider, transportOver, useQueryTransport, type QueryTransport } from "./transport"
export { DEFAULT_LABELS, wordFor, type QueryLabels } from "./labels"
export { offered, type QueryPreset } from "./presets"
export type {
  ConditionRow,
  QueryAttribute,
  QueryOperator,
  QuerySubject,
  QueryVocabulary,
  Translated,
  Translation,
} from "./types"

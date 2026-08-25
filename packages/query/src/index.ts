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
export { SavedQueries } from "./SavedQueries"
export { SavedQueryManager, type ManagedSubject } from "./SavedQueryManager"
export { SavedQueryLibrary } from "./SavedQueryLibrary"
export { SubjectProjection } from "./SubjectProjection"
export { SourceEditor } from "./SourceEditor"
export { AttributesBuilder } from "./AttributesBuilder"
export { QueryPlayground } from "./QueryPlayground"
export { EveryQuery } from "./EveryQuery"
export { JmqCode } from "./JmqCode"
export {
  useQueryVocabulary,
  useQueryProjection,
  useTranslation,
  useSavedQueryViews,
  useSavedQueryActions,
  useSourceDeclaration,
  useSourceActions,
  useSourceVerdict,
  useSourceAttributes,
  usePlayground,
  useSettled,
  useEverySavedQuery,
} from "./hooks"
export {
  QueryTransportProvider,
  transportOver,
  sourceTransportOver,
  playgroundTransportOver,
  useQueryTransport,
  type QueryTransport,
  type QueryProjection,
  type SavedQueryTransport,
  type SavedQueryView,
  type SavedQueryDraft,
  type SourceTransport,
  type SourceDeclaration,
  type SourceAttribute,
  type SourceComposition,
  type SourceVerdict,
  type PlaygroundTransport,
  type CompiledQuery,
  type QueryDestination,
} from "./transport"
export { DEFAULT_LABELS, wordFor, type QueryLabels, type QueryManagerLabels } from "./labels"
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

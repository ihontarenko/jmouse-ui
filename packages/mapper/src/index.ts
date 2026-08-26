/**
 * The `.jmm` mapping builder, shared.
 *
 * ⚠️ **This package contains no implementation of the language.** Rows go to the server and come back as
 * text; text goes to the server and comes back as rows. The one implementation is in Java, it is the one
 * the mapping engine actually loads, and it is the one that writes what a person reads.
 */
export { MappingBuilder } from "./MappingBuilder"
export { MappingForm } from "./MappingForm"
export { MappingRules } from "./MappingRules"
export { MappingDocument } from "./MappingDocument"
export { TypeSelect } from "./TypeSelect"
export {
  MapperTransportProvider,
  transportOver,
  useMapperTransport,
  type MapperTransport,
} from "./transport"
export {
  useMappableShape,
  useMappableTypes,
  useParsedMapping,
  useRenderedMapping,
  type ParsedMapping,
} from "./hooks"
export {
  draftOf,
  formOf,
  shortNameOf,
  type MappingFormModel,
  type SourceFormModel,
  type TargetFormModel,
} from "./naming"
export { DEFAULT_LABELS, type MapperLabels } from "./labels"
export type {
  MappableProperty,
  MappableShape,
  MappableType,
  MappingDraft,
  MappingRow,
  RenderedMapping,
  SourceDraft,
  TargetDraft,
  UnshowableMapping,
} from "./types"

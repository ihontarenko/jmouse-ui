import type { FormField, ObjectDetail, ObjectDraft } from "./wire";

/** The whole object as a draft again — what an edit sends, so nothing the form does not show is lost. */
export function draftOf(detail: ObjectDetail): ObjectDraft {
  return {
    slug: detail.summary.slug,
    title: detail.summary.title,
    summary: detail.summary.summary,
    description: detail.description ?? undefined,
    category: detail.summary.category,
    formulaLatex: detail.summary.formulaLatex ?? undefined,
    featured: detail.summary.featured,
    definition: detail.definition,
    parameters: detail.parameters,
    representations: detail.representations,
    tags: detail.summary.tags,
    properties: detail.properties,
    // A circuit's parts imply what it is constructed from; only relations its text states are sent back.
    relations: detail.related
      .filter((related) => !(detail.definition.kind === "CIRCUIT" && related.relation === "CONSTRUCTED_FROM"))
      .map((related) => ({ slug: related.slug, kind: related.relation })),
    presets: detail.presets.map((preset) => ({ name: preset.name, description: preset.description, values: preset.values })),
  };
}

/** A form's values by field name — what an edit sends back. */
export function valuesOf(fields: readonly FormField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.schema.name, field.value]));
}

export const CATALOGUE_SUBJECT = "catalogue:";
export const INLINE_SUBJECT = "inline:";
export const DOCUMENT_SUBJECT = "document:";

/** A catalogue object as the subject a computation is asked of. */
export const catalogueSubject = (slug: string) => `${CATALOGUE_SUBJECT}${slug}`;
/** A typed jMF formula as a subject — an unsaved object. */
export const inlineSubject = (source: string) => `${INLINE_SUBJECT}${source}`;
/** A jMX document kept as text outside the catalogue — an inline object of a scene or a comparison. */
export const documentSubject = (source: string) => `${DOCUMENT_SUBJECT}${source}`;

import type { MappingDraft, SourceDraft, TargetDraft } from "./types"

/**
 * The form's own model, and the two directions between it and a document.
 *
 * ## ⚠️ The form holds QUALIFIED names; a document holds whatever it imported
 *
 * `.jmm` writes `use com.example.Order` once and then says `target Order`. A form cannot hold the short
 * name — two packages both have an `Order`, and a select whose value was `Order` could not tell them
 * apart. So the form holds the full name throughout and the short one is worked out when the document
 * is built.
 *
 * ⚠️ **And a clash must never reach the document.** The reader keeps its imports in a map keyed by the
 * short name, filled with `putIfAbsent` — so a second `use` ending in the same word is *silently
 * dropped*, and every mention of that word resolves to the first class. Nothing anywhere reports it: the
 * mapping simply binds against the wrong type and fails with a message about a property.
 *
 * Hence the rule below — a short name is used only where it is unambiguous among the types this document
 * actually names, and any that clash are written out in full, which needs no import and resolves
 * directly.
 */
export interface MappingFormModel {
  name: string
  targets: TargetFormModel[]
}

export interface TargetFormModel {
  /** ⚠️ Qualified, always. */
  type: string
  always: MappingDraft["targets"][number]["always"]
  sources: SourceFormModel[]
}

export interface SourceFormModel {
  /** ⚠️ Qualified, always. */
  type: string
  rules: SourceDraft["rules"]
}

/**
 * Every type the form names, in the order it names them.
 *
 * ⚠️ Order matters for nothing but the document reading tidily — but it has to be deterministic, or the
 * rendered text changes between two edits that changed nothing.
 */
function typesWithin(form: MappingFormModel): string[] {
  const named: string[] = []

  function remember(type: string) {
    if (type !== "" && !named.includes(type)) {
      named.push(type)
    }
  }

  form.targets.forEach((target) => {
    remember(target.type)
    target.sources.forEach((source) => remember(source.type))
  })

  return named
}

/** `com.example.Outer$Inner` as `Inner` — the same boundary the reader uses. */
export function shortNameOf(qualified: string): string {
  const boundary = Math.max(qualified.lastIndexOf("."), qualified.lastIndexOf("$"))

  return boundary === -1 ? qualified : qualified.slice(boundary + 1)
}

/**
 * The form as a document's rows.
 *
 * @param form what somebody filled in
 * @return the draft to send
 */
export function draftOf(form: MappingFormModel): MappingDraft {
  const named = typesWithin(form)
  const counted = new Map<string, number>()

  named.forEach((qualified) => {
    const short = shortNameOf(qualified)

    counted.set(short, (counted.get(short) ?? 0) + 1)
  })

  // ⚠️ Imported only where the short name belongs to exactly one of them. The rest are written out in
  // full, which the reader resolves directly — see the note at the top of this file.
  const imported = named.filter((qualified) => counted.get(shortNameOf(qualified)) === 1)

  function written(qualified: string): string {
    return imported.includes(qualified) ? shortNameOf(qualified) : qualified
  }

  return {
    name: form.name,
    imports: imported,
    targets: form.targets.map(
      (target): TargetDraft => ({
        type: written(target.type),
        always: target.always,
        sources: target.sources.map(
          (source): SourceDraft => ({ type: written(source.type), rules: source.rules }),
        ),
      }),
    ),
  }
}

/**
 * A document's rows as the form.
 *
 * ⚠️ Resolves each name through the document's own imports rather than assuming the form wrote it — the
 * document may have been typed by hand, where a short name and a full one are equally legal and both
 * mean the same class.
 *
 * @param draft what came back from a parse
 * @return the form model
 */
export function formOf(draft: MappingDraft): MappingFormModel {
  const qualifiedBy = new Map<string, string>()

  draft.imports.forEach((qualified) => qualifiedBy.set(shortNameOf(qualified), qualified))

  function resolved(written: string): string {
    return qualifiedBy.get(written) ?? written
  }

  return {
    name: draft.name,
    targets: draft.targets.map((target) => ({
      type: resolved(target.type),
      always: target.always,
      sources: target.sources.map((source) => ({
        type: resolved(source.type),
        rules: source.rules,
      })),
    })),
  }
}

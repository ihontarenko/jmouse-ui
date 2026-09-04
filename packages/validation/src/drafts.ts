import type { CheckDraft, ItemDraft, ItemKind, ValidationDraft } from "./types"

/**
 * Making and changing rows, without mutating any of them.
 *
 * ⚠️ **Every function here returns a new value.** The builder is controlled — its state belongs to the
 * product — so a helper that edited a row in place would change something React was told had not
 * changed, and the screen would be right until something else re-rendered it.
 */

/**
 * A document as it arrived, with every field the wire model promises actually present. 📥
 *
 * ## ⚠️ A server may omit a null, and then `=== null` is silently always false
 *
 * The wire model has no optional properties, so every component here compares against `null` and
 * against `[]` — but whether a null field is *sent* is a serialization setting a product owns, and
 * one that omits nulls turns every one of them into `undefined`. The comparison then does not
 * throw and does not warn; it takes the other branch, and the first thing to notice is a crash three
 * components down reading `.length` of nothing.
 *
 * So the contract is restored **here, once, at the seam where it is broken**, rather than by loosening
 * a dozen comparisons that would each have to be remembered again.
 *
 * @param draft what came back
 * @returns the same document, whole
 */
export function received(draft: ValidationDraft): ValidationDraft {
  return {
    name: draft.name,
    comments: draft.comments ?? [],
    items: (draft.items ?? []).map(receivedItem),
  }
}

/** One row, likewise — and its children, all the way down. */
function receivedItem(item: ItemDraft): ItemDraft {
  return blankItem(item.kind, {
    ...item,
    comments: item.comments ?? [],
    checks: (item.checks ?? []).map((check) => ({ ...blankCheck(check.check), ...check })),
    items: (item.items ?? []).map(receivedItem),
    // ⚠️ Not coalesced to `[]`. A branch nobody wrote and an empty one are different statements, and
    // the difference is whether `otherwise { }` ends up in somebody's file.
    otherwise: item.otherwise == null ? null : item.otherwise.map(receivedItem),
  })
}

/** An empty document, for a form that is starting from nothing. */
export function emptyDraft(name: string): ValidationDraft {
  return {
    name,
    comments: [],
    items: [blankItem("BLOCK", { block: "always" })],
  }
}

/**
 * A row of one kind, with everything else empty.
 *
 * ⚠️ Every field is present rather than omitted. The wire model has no optional properties — a row
 * missing `checks` and a row with none are the same thing to the server, and only one of them survives
 * a round trip through JSON without becoming `undefined`.
 */
export function blankItem(kind: ItemKind, over: Partial<ItemDraft> = {}): ItemDraft {
  return {
    kind,
    comments: [],
    note: null,
    checksNote: null,
    block: null,
    field: null,
    checks: [],
    message: null,
    condition: null,
    items: [],
    otherwise: null,
    ...over,
  }
}

/** A check with no arguments yet. */
export function blankCheck(check: string): CheckDraft {
  return { check, positional: [], named: {}, stop: false, message: null }
}

/**
 * The same document with one row replaced, wherever it is.
 *
 * ⚠️ Addressed by a **path of indices** rather than by an id, because the wire model has no ids — it
 * mirrors a document, and a document's statements are identified by where they are. Adding ids for the
 * browser's convenience would put a field on the wire the server has to ignore, and the day it stops
 * ignoring it is the day two rows share one.
 */
export function replaceAt(
  items: ItemDraft[],
  path: number[],
  change: (item: ItemDraft) => ItemDraft,
): ItemDraft[] {
  const [index, ...rest] = path

  return items.map((item, at) => {
    if (at !== index) {
      return item
    }

    if (rest.length === 0) {
      return change(item)
    }

    // ⚠️ A negative first step means "into the otherwise branch". The two branches are separate lists
    // on one row, so a path has to be able to say which — and a marker beats a second path argument
    // that every caller would have to thread through unused.
    const [next] = rest

    return next < 0
      ? { ...item, otherwise: replaceAt(item.otherwise ?? [], [-next - 1, ...rest.slice(1)], change) }
      : { ...item, items: replaceAt(item.items, rest, change) }
  })
}

/** The same document with one row removed. */
export function removeAt(items: ItemDraft[], path: number[]): ItemDraft[] {
  const [index, ...rest] = path

  if (rest.length === 0) {
    return items.filter((_, at) => at !== index)
  }

  return items.map((item, at) => {
    if (at !== index) {
      return item
    }

    const [next] = rest

    return next < 0
      ? { ...item, otherwise: removeAt(item.otherwise ?? [], [-next - 1, ...rest.slice(1)]) }
      : { ...item, items: removeAt(item.items, rest) }
  })
}

/** The same document with one row added at the end of a branch. */
export function appendAt(items: ItemDraft[], path: number[], added: ItemDraft): ItemDraft[] {
  if (path.length === 0) {
    return [...items, added]
  }

  const [index, ...rest] = path

  return items.map((item, at) => {
    if (at !== index) {
      return item
    }

    const [next] = rest

    if (rest.length > 0 && next < 0) {
      return {
        ...item,
        otherwise: appendAt(item.otherwise ?? [], [-next - 1, ...rest.slice(1)], added),
      }
    }

    return { ...item, items: appendAt(item.items, rest, added) }
  })
}

/** How a check reads in one line, for a row that is not being edited. */
export function summarise(check: CheckDraft): string {
  const written = [...check.positional, ...Object.entries(check.named).map(([key, value]) => `${key}: ${value}`)]
  const call = written.length === 0 ? check.check : `${check.check}(${written.join(", ")})`

  return check.stop ? `${call} stop` : call
}

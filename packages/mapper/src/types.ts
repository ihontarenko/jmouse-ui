/**
 * What the server says and what the form sends.
 *
 * ⚠️ **Every one of these mirrors a Java record**, and the browser's copy is a description of the wire
 * rather than a model of its own. A field invented here is a field the server ignores.
 */

/** One entry of a type select. */
export interface MappableType {
  /** The name a `use` line writes — ⚠️ a nested type spelled `Outer$Inner`, the way a class loader spells it. */
  qualified: string
  /** The name a document writes everywhere else. */
  simple: string
  /** Where it lives, so a list of forty can be grouped. */
  packageName: string
}

/**
 * One property of a chosen type.
 *
 * ⚠️ `readable` and `writable` are separate answers rather than one direction. A property is routinely
 * both and occasionally neither, and a form assuming *not writable means readable* offers a computed
 * getter as a target — producing a document that refuses to load.
 */
export interface MappableProperty {
  name: string
  type: string
  readable: boolean
  writable: boolean
}

/** What a chosen type is made of. */
export interface MappableShape {
  qualified: string
  simple: string
  properties: MappableProperty[]
}

/**
 * One row of the form.
 *
 * ⚠️ `expression` is `.jmm` **source for one value**, not text this package assembles into a rule. The
 * server puts the rule together; what travels here is the right-hand side exactly as somebody typed it.
 */
export interface MappingRow {
  /** The target property — the left of the rule. */
  target: string
  /** The right of it, or `null` where the row is ignored. */
  expression: string | null
  /** `when …`, or `null`. */
  condition: string | null
  /** `target : ignore`. ⚠️ A flag rather than a missing expression, so *ignored* and *unfilled* stay apart. */
  ignored: boolean
}

/** Everything mapped from one source into the target above it. */
export interface SourceDraft {
  type: string
  rules: MappingRow[]
}

/** One target, its `always` block, and every source that fills it. */
export interface TargetDraft {
  type: string
  always: MappingRow[]
  sources: SourceDraft[]
}

/** A whole document, as rows. */
export interface MappingDraft {
  name: string
  imports: string[]
  targets: TargetDraft[]
}

/** A rendered document. */
export interface RenderedMapping {
  text: string
}

/**
 * Why a document has no rows.
 *
 * ⚠️ **The construct travels on its own**, beside the sentence, so a screen can name it without parsing
 * prose. A message is written for a person; a screen keying on one breaks when the wording improves.
 */
export interface UnshowableMapping {
  construct: string
  detail: string
}

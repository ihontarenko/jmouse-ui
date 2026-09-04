/**
 * What the server says and what the form sends.
 *
 * ⚠️ **Every one of these mirrors a Java record**, and the browser's copy is a description of the wire
 * rather than a model of its own. A field invented here is a field the server ignores.
 */

/**
 * One check a form may offer.
 *
 * ⚠️ **`parameters` is what makes a check drawable.** A constraint binds its arguments by property
 * name; a check writes them by position, because `size(3, 32)` is what somebody wants to type. Without
 * these labels a builder could offer `size` and not say which box is the minimum — which is a text
 * field with a name on it, and no better than the editor.
 */
export interface OfferedCheck {
  /** The word a file writes — `size`, `oneOf`, `required`. */
  check: string
  /** What it builds, for a panel that explains itself. ⚠️ `null` for a word that builds nothing. */
  constraint: string | null
  /** The property each positional argument fills, in order — the labels a form draws. */
  parameters: string[]
  /** Whether the last one collects the rest, which makes `oneOf` a list input rather than two boxes. */
  variadic: boolean
}

/**
 * One check on one field.
 *
 * ⚠️ `positional` and `named` hold **expressions as written**. `min(other_field)` is a thing somebody
 * will type, so what the form edits is text — evaluating it, or re-quoting it, would be the browser
 * deciding what a rule means.
 */
export interface CheckDraft {
  check: string
  positional: string[]
  named: Record<string, string>
  /** Whether a failure here silences the rest of this field's checks. ⚠️ This field's, and no further. */
  stop: boolean
  /** What to say when it fails, or `null` to take the line's. */
  message: string | null
}

/** What a row is. */
export type ItemKind = "BLOCK" | "LINE" | "GUARD" | "INVARIANT"

/**
 * One thing a document holds.
 *
 * ## ⚠️ A tree, not a table
 *
 * jMV says outright that `when a { when b { … } }` and `when a and b { … }` are the same document and
 * that neither is canonical. A form that could show only the flat one would refuse a file the language
 * calls idiomatic; one that flattened on the way in would rewrite somebody's file for them.
 *
 * ## ⚠️ Comments travel with the row
 *
 * Without them a document opened in the form and saved comes back stripped of every explanation
 * somebody wrote. The form shows them; the form keeps them.
 */
export interface ItemDraft {
  kind: ItemKind
  /** What was written above it, line by line, `#` included. ⚠️ An empty string is a blank line. */
  comments: string[]
  /** What was written after it on its own line. */
  note: string | null
  /**
   * What was written after its **checks**, where a message continues on the line below them.
   *
   * ⚠️ A wrapped line has two ends and somebody may write on either. Printing this one under the
   * message instead would move their aside a line down on every save.
   */
  checksNote: string | null
  /** `gate` or `always` — only on a `BLOCK`. */
  block: string | null
  /** The field a line is about — only on a `LINE`. */
  field: string | null
  /** What is asked of it, in order — only on a `LINE`. */
  checks: CheckDraft[]
  /** A line's message, or an invariant's. */
  message: string | null
  /** A guard's condition, or an invariant's assertion. */
  condition: string | null
  /** A block's contents, or a guard's guarded branch. */
  items: ItemDraft[]
  /**
   * A guard's other branch.
   *
   * ⚠️ `null` where none was written, which is **not** the same as an empty one: `otherwise { }` says
   * somebody considered the other case and decided nothing applies.
   */
  otherwise: ItemDraft[] | null
}

/** A whole document, as rows. */
export interface ValidationDraft {
  name: string
  /** The file's header, line by line. */
  comments: string[]
  items: ItemDraft[]
}

/** A rendered document. */
export interface RenderedValidation {
  text: string
}

/**
 * Why a document has no rows.
 *
 * ⚠️ **The construct travels on its own**, beside the sentence, so a screen can name it without parsing
 * prose. A message is written for a person; a screen keying on one breaks when the wording improves.
 */
export interface UnshowableValidation {
  construct: string
  detail: string
}

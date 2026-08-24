/**
 * What the shared builder and the server say to each other.
 *
 * ## ⚠️ Nothing here spells jMQ, and nothing here may start
 *
 * There is no writer and no reader in this package. Rows go to the server and come back as text; text
 * goes to the server and comes back as rows. That is the whole design, and it is a reaction to a real
 * defect rather than a preference: a browser-side writer and a browser-side reader, both hand-written,
 * drifted far enough to turn `submitter == currentMember` into a comparison against the *word*
 * `currentMember` — matching nothing, refusing nothing, explaining nothing.
 *
 * The language has exactly one implementation. It is in Java, it is the one that runs the query, and it
 * is the one that writes the text a person reads.
 */

/** One thing a query may name. */
export interface QueryAttribute {
  /** Exactly as a query writes it — `entry[quantity]`, `created`. */
  name: string
  /** What a person calls it. */
  label: string
  /** `text` · `number` · `boolean` · `temporal` · `unknown` */
  type: string
  /** `column` · `bag` · `joined` · `collection` */
  access: string
  /**
   * ⚠️ The converter an ordered comparison needs, or `null` — shown so a screen can explain the pipe
   * somebody will see in the text. **It is never placed here**; the composer places it.
   */
  converter: string | null
  /** The choices a closed set offers, so the builder draws the product's own select. */
  options: string[]
}

/**
 * One comparison a row may use.
 *
 * ⚠️ Sent by the server rather than hard-coded here. A builder offering a comparison the composer does
 * not have produces a refusal about an operator that same builder handed the person.
 */
export interface QueryOperator {
  spelling: string
  needsValue: boolean
  ordered: boolean
  negative: boolean
}

export interface QueryVocabulary {
  subject: string
  attributes: QueryAttribute[]
  operators: QueryOperator[]
}

/** One row of the builder. ⚠️ Holds no syntax — no pipe, no quotes, no brackets. */
export interface ConditionRow {
  attribute: string
  operator: string
  value: unknown
  includeMissing: boolean
}

/** What a screen asks to have translated. ⚠️ Rows **or** filter, never both — see `Translated`. */
export interface Translation {
  rows?: ConditionRow[] | null
  filter?: string | null
  orderBy?: string | null
  descending?: boolean
}

/**
 * Everything a screen needs after a change, in one answer.
 *
 * ⚠️ `rows: null` means **the builder cannot draw this** — a supplied value, an expression, an `or`. The
 * panel then says so and hands over the text. It never approximates: quietly rewriting somebody's
 * expression is how an editor loses their trust permanently.
 */
export interface Translated {
  filter: string
  order: string
  /**
   * ⚠️ **Optional, not just nullable.** A backend serialising non-null omits the field entirely, so this
   * arrives as `undefined` rather than `null` — and `rows === null` is then silently always false, which
   * is how a query the builder cannot draw was drawn anyway. Test absence with `?? null`, never `===`.
   */
  rows?: ConditionRow[] | null
  readable: boolean
  message: string | null
}

/**
 * Which listing this is — an address, never a flag.
 *
 * ⚠️ `parameters` is open on purpose. One subject narrows by a form, another by a project, a third by
 * nothing. Typing that here would mean this package knowing what a form is, and then what a project is.
 */
export interface QuerySubject {
  /** The segment the server registered — `entries`, `assets`. */
  name: string
  /** Whatever narrows it. */
  parameters?: Record<string, string | undefined>
}

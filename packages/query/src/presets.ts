import type { QueryAttribute } from "./types"

/**
 * A question people ask before they think of writing one.
 *
 * ## ⚠️ The list itself is the PRODUCT'S, never this package's
 *
 * *"Running low"* means `entry[quantity]`, and only one product has such a thing. What is shared is the
 * shape and the rule for offering one; what is not shared is the vocabulary, because vocabulary is
 * exactly what a subject area is.
 *
 * ## ⚠️ Offered only when the schema can actually answer it
 *
 * Each preset declares what it needs and is filtered against the vocabulary the server sent. An unusable
 * one is **dropped silently** — somebody who never had `quantity` on their form never wondered where
 * *"running low"* went, and a disabled chip explaining why would be an apology for a feature they never
 * asked for.
 *
 * ## ⚠️ The filter is jMQ; the sort is not
 *
 * A filter is a query somebody could have typed, so it is stored as one. A sort is two facts the panel
 * already knows how to ask for — which attribute, and which way — so a preset states those and lets the
 * server write it. Storing sort text here would be a second place that has to agree about a pipe.
 */
export interface QueryPreset {
  /** What the chip says. */
  readonly label: string
  /** One line of why, shown as a title — a preset whose meaning is not obvious is one nobody trusts. */
  readonly explains: string
  /** The attributes it names, the sort included. ⚠️ All of them must exist, or it is not offered. */
  readonly needs: readonly string[]
  /** The filter, in jMQ. */
  readonly filter: string
  /** How to order it, if the answer is only useful in an order. */
  readonly sort?: { readonly by: string; readonly descending?: boolean }
}

/** The presets this vocabulary can actually answer. */
export function offered(
  presets: readonly QueryPreset[],
  attributes: QueryAttribute[],
): QueryPreset[] {
  const known = new Set(attributes.map((attribute) => attribute.name))

  return presets.filter((preset) => preset.needs.every((name) => known.has(name)))
}

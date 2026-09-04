import { Tag, tags } from "@lezer/highlight"

/**
 * The tags jMouse's own languages emit, on top of the standard set.
 *
 * <h2>Why these exist at all</h2>
 *
 * <p>`.jmp` and jME used to borrow generic tags — a role name was `tags.className`, a language word was
 * `tags.keyword` — and both resolve to the same colour in any style that does not care about the
 * difference. So `grants` and `ORGANIZATION_ADMIN` came out identically, which is precisely the pair a
 * reader most needs told apart: one is the language, the other is the thing being granted.
 *
 * <p>A borrowed tag also cannot be recoloured without recolouring every other language. `tags.keyword`
 * belongs to Markdown fences, SQL, JSON and everything else an editor renders; making *policy* keywords
 * pink by editing it would repaint the whole product.
 *
 * <h2>⚠️ Every tag names a parent, and that is load-bearing</h2>
 *
 * <p>`Tag.define(parent)` means a style written for the parent still applies when nothing claims the
 * child. That is what keeps imported CodeMirror themes working: they know `tags.keyword` and have never
 * heard of {@link policyKeyword}, and under them a policy file stays coloured — just in that theme's own
 * scheme. Drop the parents and every forced theme renders a policy as undifferentiated plain text.
 *
 * <p>⚠️ A parent must be a **plain** tag: `Tag.define` refuses a modified one, so
 * `tags.definition(tags.variableName)` and `tags.function(tags.variableName)` cannot be inherited from
 * however well they describe the child. Where the natural parent was a modified tag, the closest plain
 * relative is used instead — the choice only decides what a foreign theme falls back to, since
 * {@link ./highlight}'s style names every tag here explicitly.
 *
 * <h2>⚠️ Both halves ship together, wherever only one is rendered</h2>
 *
 * <p>A product with no expression surface still gets the four `expression*` tags, and one with no policy
 * screen still gets the ten `policy*` ones. A tag nothing emits costs nothing, and the trimmed copy is
 * the copy that quietly diverges the first time a second language turns up on a second screen — which is
 * the whole reason this file stopped being five files.
 */

// ── Policy (.jmp) ────────────────────────────────────────────────────────────

/** The language's own words — `policy`, `permissions`, `grants`, `when`, `include`. */
export const policyKeyword = Tag.define(tags.keyword)

/**
 * `declare` and `assign` — which *kind* of statement the block that follows is.
 *
 * <p>Its own tag because it is not a block, it *labels* one, and the difference is the whole reason the
 * words exist: `declare` opens something that says what exists at all, `assign` something that says who
 * has what. That is ADR-0018's line — the document owns structure, the row owns the case — moved to the
 * left margin so a reader sees it before reading anything.
 *
 * <p>⚠️ **Deliberately not a colour of its own.** A prefix painted a second colour reads as a second kind
 * of thing, and the point is the opposite: it qualifies the keyword beside it. So it takes the keyword's
 * hue and is set apart by weight and slant instead — visible when scanning, silent when reading.
 */
export const policyStatementKind = Tag.define(tags.modifier)

/**
 * `deny`, and nothing else.
 *
 * <p>Its own tag because a denial wins over every allow, at every level, from every grant source. It is
 * the one word in a policy file that must never be skimmed past, so it is the one word no palette is
 * allowed to make quiet.
 */
export const policyDeny = Tag.define(tags.atom)

/** A role being declared or handed out — `role SPACE_ADMIN`, `grants ORGANIZATION_ADMIN`. */
export const policyRole = Tag.define(tags.className)

/** Who a block is about — the account named by `subject 'usr_7f21c'`. */
export const policySubject = Tag.define(tags.className)

/** A scope kind: `@GLOBAL`, `@ORGANIZATION`, `@SPACE`, `@SELF`. */
export const policyScope = Tag.define(tags.typeName)

/** Which one — the `'sp_kyiv'` half of `@SPACE:'sp_kyiv'`, or `*` for all of them. */
export const policyInstance = Tag.define(tags.string)

/** The namespace half of a permission — the `entry` of `entry:delete`. */
export const policyNamespace = Tag.define(tags.variableName)

/** The action half of a permission — the `delete` of `entry:delete`, or the `*` that means all. */
export const policyAction = Tag.define(tags.propertyName)

/**
 * What a capability statement is about — the `custody` of `gate custody`, the `storage-byte` of
 * `storage-byte 100GB per month`, the `workspace` of `allow workspace 25`.
 *
 * <p>Its own tag, sharing a colour with {@link policyNamespace} today, because it occupies the same
 * position a permission's namespace does: the *subject* of the line, with everything after it saying how
 * much and until when. Sharing the colour without sharing the tag is what lets a palette split the two
 * later without anybody having to touch the grammar.
 */
export const policyCapability = Tag.define(tags.propertyName)

// ── Expressions (jME) ────────────────────────────────────────────────────────

/** A jME language word — `if`, `for`, `is`, `in`, `not`. */
export const expressionKeyword = Tag.define(tags.keyword)

/** A filter or function applied with `|` — `upper`, `round`, `default`. */
export const expressionFilter = Tag.define(tags.macroName)

/** A field the expression reads by identifier. */
export const expressionField = Tag.define(tags.attributeName)

/** `{{`, `}}`, `{%`, `%}` — the walls of an expression, not part of what it says. */
export const expressionDelimiter = Tag.define(tags.meta)

// ── Mapping (.jmm) ───────────────────────────────────────────────────────────

/**
 * The whole type on a `use` line — `net.innoventa.…$CreateProjectRequest`.
 *
 * <p>⚠️ **Its own tag because it is bookkeeping, and the block types are the subject.** A `use` line
 * says which types the file will go on to name; `target Project` says what the block in front of you is
 * about. Under {@link ./highlight}'s standard set both `tags.typeName` and `tags.namespace` resolve to
 * the keyword colour, so before this tag existed `target` and `Project` came out identical — the one
 * pair in a mapping file a reader most needs told apart, because the keyword is the same on every block
 * and the type is the only thing that says which block this is.
 *
 * <p>It is deliberately the quieter of the two. A file's `use` header is read once and scanned past
 * forever after.
 */
export const mappingImport = Tag.define(tags.namespace)

/**
 * The type a block is about — the `Project` of `target Project`, the `CreateProjectRequest` of
 * `from CreateProjectRequest`.
 *
 * <p>The subject of the block, and what a reader scans a file for. Set apart from the keyword beside it
 * by both hue and weight: `target`, `from` and `mapping` repeat on every block and carry no information
 * once you know the language, while the type is the whole reason the block exists.
 */
export const mappingType = Tag.define(tags.typeName)

// ── Script (.jms) ────────────────────────────────────────────────────────────

/**
 * The name after an `@` — `@world`, `@player`, `@orders`.
 *
 * <p>⚠️ **Its own tag because it is the one syntax in a script that reaches outside it.** Everything
 * else a script names is its own: a local, a loop variable, a declared function, whatever the host put
 * in the context for this event. An `@` name is a *facade* — an object the host explicitly agreed to
 * expose, resolved against a closed catalogue and refused at load if it is not on it. That is the line
 * a reader auditing a script is looking for, and under a borrowed `tags.variableName` it would be the
 * same colour as the loop variable beside it.
 *
 * <p>It takes {@link policyScope}'s hue, and deliberately: a scope and a facade occupy the same role on
 * the page — the named outside thing the line is about, with everything after it saying what is being
 * done to it.
 */
export const scriptFacade = Tag.define(tags.typeName)

/**
 * The event a handler is written for — the `unload` of `on unload when … do`.
 *
 * <p>⚠️ **Its own tag because it is what a reader scans a script for.** Nobody opens a behaviour file
 * asking "what does line forty do"; they ask *what happens when the harvester unloads*, and the answer
 * is a column of event names down the left of the handlers. Without a tag of its own that column is
 * `tags.variableName`, identical to every other identifier in the file — and the one structural thing a
 * script has to offer a reader would be invisible.
 *
 * <p>⚠️ It is emitted for the word after `on` **whatever that word is**. The backend reads every one of
 * the dialect's keywords as an ordinary name wherever a name belongs, because a host is entitled to an
 * event called `end`; a grammar that refused to colour one would make a correct file look broken.
 */
export const scriptEvent = Tag.define(tags.className)

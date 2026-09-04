import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete"
import { syntaxTree } from "@codemirror/language"
import type { Extension } from "@codemirror/state"

/**
 * Completion for the jMouse dialects, fed by a catalogue the host supplies.
 *
 * <h2>⚠️ The split this file exists to get right</h2>
 *
 * <p>A scanner can be self-contained because a language's keywords are the language's. **Completion
 * cannot.** What a script may usefully name — which events exist, which facades, which methods on each,
 * which functions — is *the host's* data, arrives over HTTP, and differs per product and per workspace.
 *
 * <p>So this package supplies the **mechanism** — where each kind of name may appear, and how it is
 * rendered — and a product supplies the **data**. A package that shipped a word list would be a package
 * that knows one product; a product that shipped its own completion source would be three products
 * writing the same CodeMirror plumbing three times.
 *
 * <h2>⚠️ It offers; it does not decide</h2>
 *
 * <p>The same rule the grammars carry. Nothing here validates: an unknown name is refused by the
 * backend's binder, with a line and a column. Completion that quietly narrowed what a person may write
 * would be a second grammar — and one that is wrong the first time a host adds a facade.
 *
 * <p>Which is why a **missing catalogue is not an error**. It degrades to no completion, never to a
 * message, and never to a stale list presented as current.
 *
 * @see ./jmsSyntax for the dialect this is first used with
 */

/** One method on a facade. */
export interface CatalogueMethod {
  /** What is written after the dot. */
  readonly name: string
  /** How many arguments it takes, where the host knows. Shown beside the name; never enforced. */
  readonly arity?: number
  /** A phrase shown beside the entry — what it does, in a few words. */
  readonly detail?: string
}

/** One object a script may reach with `@name`. */
export interface CatalogueFacade {
  readonly name: string
  readonly detail?: string
  readonly methods?: readonly CatalogueMethod[]
  /** What `@name#…` may reach. */
  readonly constants?: readonly string[]
}

/** An event, or a function — a name and something to say about it. */
export interface CatalogueEntry {
  readonly name: string
  readonly detail?: string
  /**
   * The names this event hands a handler.
   *
   * ⚠️ Offered as ordinary identifiers **inside a handler written for this event**, which is the one
   * thing a completion list can tell an author that no amount of reading the grammar will.
   */
  readonly context?: readonly string[]
}

/**
 * Everything a host is willing to let an author name.
 *
 * ⚠️ Deliberately flat: every field is data a backend already has, and it crosses HTTP.
 */
export interface CompletionCatalogue {
  readonly events?: readonly CatalogueEntry[]
  readonly facades?: readonly CatalogueFacade[]
  readonly functions?: readonly CatalogueEntry[]
}

/**
 * Where each kind of name may appear, for one dialect.
 *
 * <p>Each pattern is matched against **the text before the cursor** and must be anchored to its end.
 * The capture groups say what was already typed, so the list can be filtered as somebody types rather
 * than reopening from scratch.</p>
 *
 * ⚠️ The machinery is shared; these are not. `.jmp` wants permissions and scopes where jMS wants
 * facades and events, and a rule set written for one is nonsense in the other.
 */
export interface CompletionRules {
  /** `@name.` — capture 1 the facade, capture 2 what has been typed of the method. */
  readonly member: RegExp
  /** `@name#` — capture 1 the facade, capture 2 what has been typed of the constant. */
  readonly constant?: RegExp
  /** `@` — capture 1 what has been typed of the facade name. */
  readonly facade: RegExp
  /** `on ` — capture 1 what has been typed of the event name. */
  readonly event?: RegExp
  /** A bare word: functions, and whatever the event's context carries. */
  readonly identifier?: RegExp
  /**
   * Syntax node names inside which **nothing** is offered.
   *
   * ⚠️ A comment is where somebody explains a decision, and a string is where they write a message to a
   * player. Popping a list of facade methods over either is the behaviour that makes people switch
   * completion off.
   */
  readonly quiet?: readonly string[]
}

/**
 * The rules for `.jms` — jMouse Script.
 *
 * ⚠️ `member` and `constant` are tried before `facade`, because `@world.` matches all three and only
 * the longest of them is what somebody meant.
 */
export const JMS_COMPLETION_RULES: CompletionRules = {
  member: /@([A-Za-z_]\w*)\.(\w*)$/,
  constant: /@([A-Za-z_]\w*)#(\w*)$/,
  facade: /@(\w*)$/,
  event: /\bon\s+(\w*)$/,
  identifier: /(?:^|[^\w.@#])([A-Za-z_]\w*)?$/,
  quiet: ["comment", "string"],
}

/** What a host hands over, and when. */
export interface CatalogueCompletionOptions {
  /**
   * The catalogue, read afresh on every keystroke.
   *
   * ⚠️ **A getter rather than a value**, so a product can fetch it after the editor is already open and
   * have completion start working without rebuilding the editor — and so that answering `null` while it
   * is in flight is an ordinary state rather than a special case.
   */
  readonly catalogue: () => CompletionCatalogue | null | undefined
  /** Where each kind of name may appear — {@link JMS_COMPLETION_RULES} for `.jms`. */
  readonly rules: CompletionRules
}

/** Nothing to offer. Its own constant so the reason is readable at each of the six call sites. */
const NOTHING = null

/**
 * Builds the completion source. Compose it yourself, or take {@link catalogueCompletion}.
 *
 * @param options the catalogue and the dialect's rules
 * @returns a CodeMirror completion source
 */
export function catalogueCompletionSource(
  options: CatalogueCompletionOptions,
): (context: CompletionContext) => CompletionResult | null {
  const { catalogue, rules } = options

  return (context: CompletionContext): CompletionResult | null => {
    if (isQuiet(context, rules)) {
      return NOTHING
    }

    const known = catalogue()

    if (!known) {
      return NOTHING
    }

    const before = context.state.sliceDoc(context.state.doc.lineAt(context.pos).from, context.pos)

    // ⚠️ Longest shape first. `@world.` matches `member`, `facade` and `identifier`, and only the first
    // of those is what somebody typing a dot meant.
    const member = rules.member.exec(before)

    if (member) {
      const facade = facadeNamed(known, member[1])

      // ⚠️ A facade nobody declared offers NOTHING, not every method of every facade. Offering the
      // wrong facade's methods is worse than offering none: it teaches a name the binder will refuse.
      return facade
        ? result(context, member[2], (facade.methods ?? []).map(asMethod))
        : NOTHING
    }

    const constant = rules.constant?.exec(before)

    if (constant) {
      const facade = facadeNamed(known, constant[1])

      return facade
        ? result(context, constant[2], (facade.constants ?? []).map(asConstant))
        : NOTHING
    }

    const facade = rules.facade.exec(before)

    if (facade) {
      return result(context, facade[1], (known.facades ?? []).map(asFacade))
    }

    const event = rules.event?.exec(before)

    if (event) {
      return result(context, event[1], (known.events ?? []).map(asEvent))
    }

    const identifier = rules.identifier?.exec(before)

    // ⚠️ Only where somebody is actually typing a word, or asked for the list outright. Without this an
    // empty match at every position pops a list over whitespace, which is the other way people end up
    // switching completion off.
    if (identifier && (identifier[1] || context.explicit)) {
      return result(context, identifier[1] ?? "", [
        ...(known.functions ?? []).map(asFunction),
        ...contextNames(known, context, rules).map(asContextName),
      ])
    }

    return NOTHING
  }
}

/**
 * The source, wrapped as an editor extension.
 *
 * @param options the catalogue and the dialect's rules
 * @returns an extension adding catalogue-fed completion
 */
export function catalogueCompletion(options: CatalogueCompletionOptions): Extension {
  return autocompletion({ override: [catalogueCompletionSource(options)] })
}

/**
 * Whether the cursor sits somewhere nothing should be offered.
 *
 * <p>⚠️ Asked of the **syntax tree** rather than by counting quotes on the line. The grammar already
 * knows where a comment and a string are — it is the whole of what it does — and a second answer
 * derived from the raw text is a second grammar that disagrees with the first about `@player#MAX`.</p>
 */
function isQuiet(context: CompletionContext, rules: CompletionRules): boolean {
  const quiet = rules.quiet

  if (!quiet || quiet.length === 0) {
    return false
  }

  // ⚠️ `-1` so a cursor sitting at the very end of a comment is still inside it. Resolving forwards
  // puts the caret after a line comment's last character in whatever follows, which is nothing.
  const node = syntaxTree(context.state).resolveInner(context.pos, -1)

  for (let current: typeof node | null = node; current; current = current.parent) {
    if (quiet.includes(current.name)) {
      return true
    }
  }

  return false
}

/** The names an event hands a handler, when the cursor is inside a handler written for one. */
function contextNames(
  known: CompletionCatalogue,
  context: CompletionContext,
  rules: CompletionRules,
): readonly string[] {
  if (!rules.event || !known.events) {
    return []
  }

  // ⚠️ Read by looking BACKWARDS for the nearest handler header, because a body has no marker of its
  // own that says which event it belongs to. It is a heuristic and it is allowed to be: the worst it
  // does is offer a name that turns out not to be there, which the binder refuses with a line.
  const above = context.state.sliceDoc(0, context.pos)
  const opened = /\bon\s+([A-Za-z_]\w*)[\s\S]*$/.exec(above)

  if (!opened) {
    return []
  }

  return known.events.find((event) => event.name === opened[1])?.context ?? []
}

function facadeNamed(known: CompletionCatalogue, name: string): CatalogueFacade | undefined {
  return known.facades?.find((facade) => facade.name === name)
}

/**
 * Builds the result CodeMirror renders.
 *
 * <p>⚠️ `from` is the start of what was already typed, not the cursor — otherwise accepting an entry
 * appends to the prefix instead of replacing it, and `@wo` becomes `@woworld`.</p>
 */
function result(context: CompletionContext, typed: string, options: Completion[]): CompletionResult | null {
  return options.length === 0
    ? NOTHING
    : { from: context.pos - (typed?.length ?? 0), options, validFor: /^\w*$/ }
}

function asFacade(facade: CatalogueFacade): Completion {
  return { label: facade.name, type: "namespace", detail: facade.detail }
}

function asMethod(method: CatalogueMethod): Completion {
  return {
    label: method.name,
    type: "method",
    // ⚠️ The arity is shown, never applied. Completing `spawn` into `spawn(, , )` guesses at what the
    // arguments are and puts the caret in the wrong one; the author knows and the editor does not.
    detail: method.detail ?? (method.arity === undefined ? undefined : `${method.arity} argument(s)`),
  }
}

function asConstant(constant: string): Completion {
  return { label: constant, type: "constant" }
}

function asEvent(event: CatalogueEntry): Completion {
  return { label: event.name, type: "event", detail: event.detail }
}

function asFunction(entry: CatalogueEntry): Completion {
  return { label: entry.name, type: "function", detail: entry.detail }
}

function asContextName(name: string): Completion {
  return { label: name, type: "variable", detail: "from the event" }
}

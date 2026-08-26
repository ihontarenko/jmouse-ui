import * as React from "react"
import { Search, X } from "lucide-react"

import { cn } from "../../lib/helpers"
import { Input } from "../input"
import { EMOJI_GROUPS, describeEmoji, searchEmojis, type Emoji } from "./emojis"

/**
 * The panel: a search box, a row of group tabs, and a grid.
 *
 * <h2>⚠️ The search is the feature, not the grid</h2>
 *
 * A thousand characters laid out in nine tabs is a catalogue somebody scrolls; the same thousand
 * behind a box that answers `deploy`, `bug` or `docs` is a control somebody uses. So every entry
 * carries tags rather than a name (see `emojis.ts`), the box takes focus on open, and Enter takes the
 * first match — three keys and a glyph, without the pointer moving.
 *
 * <h2>Recents, and why they are the caller's to enable</h2>
 *
 * `recentStorageKey` is opt-in and unset by default. A shared component that wrote to `localStorage`
 * on its own would put one product's history in front of another's picker on the same origin, and
 * would do it invisibly. Naming the key is the caller saying *these recents are mine*.
 *
 * ⚠️ Every read and write is guarded: a private window, cleared site data and a browser configured to
 * refuse storage all throw on access rather than returning empty, and a picker that cannot open is a
 * worse failure than one that forgets.
 */

/** How many recents are kept — one row of the grid, so the row never becomes a second scroll area. */
const RECENT_LIMIT = 16

/**
 * Every string this panel draws, so a product supplies its own translations.
 *
 * ⚠️ This package holds no translation mechanism on purpose — three products carry three different
 * ones, and a library that picked one would make itself unusable in the other two. English defaults
 * mean a caller who has not translated it yet still gets a working picker rather than blank labels.
 */
export interface EmojiPickerLabels {
  search?: string
  empty?: string
  /** Shown beside a pasted character the set does not carry. `{emoji}` is replaced with it. */
  useTyped?: string
  recent?: string
  clear?: string
  /** Per group, keyed by {@link EmojiGroup.id} — `smileys`, `people`, `nature`, and so on. */
  groups?: Record<string, string>
}

/**
 * Whether what somebody typed is itself a character to offer.
 *
 * ⚠️ **This is the escape hatch, and it is the search box rather than a second field.** The set here is
 * curated, so somebody's own emoji — a flag it does not carry, a character Unicode assigned last year —
 * has to be reachable or the picker is a downgrade from a plain text input. Pasting it into the search
 * box is the gesture people already try; all this does is answer it.
 *
 * The test is *short, and not something you type on a keyboard*: no letters, digits or ASCII
 * punctuation, and few enough characters to be one glyph plus its modifiers.
 */
function typedCharacter(query: string): string | null {
  const typed = query.trim()

  if (typed.length === 0 || typed.length > 8 || /[\p{L}\p{N}\p{P}\s]/u.test(typed)) {
    return null
  }

  return typed
}

export interface EmojiPickerProperties {
  /** The emoji currently chosen, drawn as the pressed one. Anything at all, including a character this set does not offer. */
  value?: string | null
  onSelect: (emoji: string) => void
  /** Offered as a "clear" control when given. Omit it where the field is required. */
  onClear?: () => void
  labels?: EmojiPickerLabels
  /** Where this product's recently-used list is kept. Unset means no recents row and nothing stored. */
  recentStorageKey?: string
  className?: string
}

function readRecent(storageKey: string | undefined): string[] {
  if (storageKey === undefined) {
    return []
  }

  try {
    const stored = window.localStorage.getItem(storageKey)
    const parsed: unknown = stored === null ? [] : JSON.parse(stored)

    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []
  } catch {
    return []
  }
}

function writeRecent(storageKey: string | undefined, recent: string[]) {
  if (storageKey === undefined) {
    return
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(recent))
  } catch {
    // Storage the browser refuses is not a reason for the picker to fail — the choice is already made.
  }
}

export function EmojiPicker({
  value,
  onSelect,
  onClear,
  labels,
  recentStorageKey,
  className,
}: EmojiPickerProperties) {
  const [query, setQuery] = React.useState("")
  const [groupId, setGroupId] = React.useState(EMOJI_GROUPS[0].id)
  const [recent, setRecent] = React.useState<string[]>(() => readRecent(recentStorageKey))
  const searchReference = React.useRef<HTMLInputElement>(null)

  // The panel takes focus when it opens (see `anchored.tsx`); this moves it one step further, to the
  // control somebody is about to type in.
  React.useEffect(() => {
    searchReference.current?.focus({ preventScroll: true })
  }, [])

  const group = EMOJI_GROUPS.find((candidate) => candidate.id === groupId) ?? EMOJI_GROUPS[0]
  const searching = query.trim().length > 0
  const shown: Emoji[] = searching ? searchEmojis(query) : group.emojis
  const typed = shown.length === 0 ? typedCharacter(query) : null

  const choose = React.useCallback(
    (character: string) => {
      const next = [character, ...recent.filter((entry) => entry !== character)].slice(0, RECENT_LIMIT)

      setRecent(next)
      writeRecent(recentStorageKey, next)
      onSelect(character)
    },
    [recent, recentStorageKey, onSelect],
  )

  return (
    <div className={cn("flex w-[19.5rem] flex-col gap-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchReference}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          // Enter on a search that matched is the whole interaction — type, confirm, done.
          onKeyDown={(event) => {
            const first = shown.length > 0 ? shown[0].character : typed

            if (event.key === "Enter" && first !== null) {
              event.preventDefault()
              choose(first)
            }
          }}
          placeholder={labels?.search ?? "Search emoji…"}
          className="pl-7"
          aria-label={labels?.search ?? "Search emoji"}
        />
      </div>

      {/* ⚠️ Hidden while searching rather than disabled: results cross every group, so a tab row that
          still looked selectable would be claiming to narrow something it no longer narrows. */}
      {!searching && (
        <div className="flex items-center justify-between gap-0.5 border-b pb-1.5">
          {EMOJI_GROUPS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setGroupId(candidate.id)}
              aria-pressed={candidate.id === group.id}
              title={labels?.groups?.[candidate.id] ?? candidate.label}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-base leading-none transition-colors",
                "hover:bg-accent",
                candidate.id === group.id ? "bg-accent ring-1 ring-primary/40" : "opacity-60 hover:opacity-100",
              )}
            >
              <span aria-hidden>{candidate.mark}</span>
            </button>
          ))}
        </div>
      )}

      {!searching && recent.length > 0 && (
        <div className="space-y-1">
          <p className="px-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {labels?.recent ?? "Recent"}
          </p>
          <EmojiGrid emojis={recent.map((character) => ({ character, tags: [] }))} value={value} onChoose={choose} />
        </div>
      )}

      {/* ⚠️ `max-h` on the scroller itself, and nothing between it and the grid — a height put on an
          ancestor clips instead of scrolling, silently. */}
      <div className="max-h-56 min-h-56 overflow-x-hidden overflow-y-auto">
        {shown.length > 0 ? (
          <EmojiGrid emojis={shown} value={value} onChoose={choose} />
        ) : typed !== null ? (
          <button
            type="button"
            onClick={() => choose(typed)}
            className="flex w-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-xs transition-colors hover:bg-accent"
          >
            <span aria-hidden className="text-xl leading-none">
              {typed}
            </span>
            <span className="text-muted-foreground">
              {(labels?.useTyped ?? "Use {emoji}").replace("{emoji}", typed)}
            </span>
          </button>
        ) : (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {labels?.empty ?? "Nothing matches that."}
          </p>
        )}
      </div>

      {onClear !== undefined && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <X className="size-3.5" />
          {labels?.clear ?? "No emoji"}
        </button>
      )}
    </div>
  )
}

function EmojiGrid({
  emojis,
  value,
  onChoose,
}: {
  emojis: Emoji[]
  value?: string | null
  onChoose: (character: string) => void
}) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {emojis.map((emoji) => (
        <button
          key={emoji.character}
          type="button"
          onClick={() => onChoose(emoji.character)}
          aria-pressed={emoji.character === value}
          // The tags, not the character: a screen reader announcing the glyph twice says nothing, and
          // the tooltip is where somebody discovers what a search would have found this by.
          title={describeEmoji(emoji.character)}
          aria-label={describeEmoji(emoji.character)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-lg leading-none transition-colors",
            "hover:bg-accent focus-visible:ring-[2px] focus-visible:ring-ring/60 focus-visible:outline-none",
            emoji.character === value && "bg-accent ring-1 ring-primary",
          )}
        >
          <span aria-hidden>{emoji.character}</span>
        </button>
      ))}
    </div>
  )
}

import type { ExplorerAction, ExplorerAdapter, ExplorerEntry, ExplorerTarget } from "./adapter"

/**
 * What may be done, decided once.
 *
 * ⚠️ **The "⋯" menu, the toolbar and the keys all read this, and nothing else decides.** A menu that offered rename
 * while F2 refused it — or the reverse — is the drift that happens the moment two places answer the same question.
 */

interface ActionRule {
  /** The adapter method the act needs; absent for an act the explorer does by itself. */
  method?: keyof ExplorerAdapter
  /** Whether the act is about an entry or about a folder as a place. */
  scope: "entry" | "place"
  /** Whether the act makes sense for this entry at all, whatever the reader may do. */
  fits?(entry: ExplorerEntry): boolean
}

const isFile = (entry: ExplorerEntry) => entry.kind === "file"

/**
 * Every act's rule, in the order a menu lists them.
 *
 * ⚠️ `open` needs no method: a folder opens by being listed and a file by the viewer, which says so itself when the
 * product cannot hand over its bytes. It is a rule all the same, so a product's `permits` can refuse it.
 */
const ACTION_RULES: Record<ExplorerAction, ActionRule> = {
  open: { scope: "entry", fits: isFile },
  download: { method: "read", scope: "entry", fits: isFile },
  copyLink: { method: "shareUrl", scope: "entry" },
  rename: { method: "rename", scope: "entry" },
  move: { method: "move", scope: "entry" },
  remove: { method: "remove", scope: "entry" },
  upload: { method: "upload", scope: "place" },
  createFolder: { method: "createFolder", scope: "place" },
}

const EVERY_ACTION = Object.keys(ACTION_RULES) as ExplorerAction[]

/** The acts a "⋯" menu lists — `open` is what activating the entry does, not a menu entry. */
const MENU_ACTIONS = EVERY_ACTION.filter((action) => ACTION_RULES[action].scope === "entry" && action !== "open")

const PLACE_ACTIONS = EVERY_ACTION.filter((action) => ACTION_RULES[action].scope === "place")

/**
 * Whether one act is on offer.
 *
 * @param adapter what the product can do
 * @param action the act
 * @param target what it is done to
 * @return true when the method exists, the act fits the target, and the product permits it
 */
export function permits(adapter: ExplorerAdapter, action: ExplorerAction, target: ExplorerTarget): boolean {
  const rule = ACTION_RULES[action]

  if (rule.method !== undefined && adapter[rule.method] === undefined) {
    return false
  }

  if ("entry" in target) {
    if (rule.scope !== "entry" || !(rule.fits?.(target.entry) ?? true)) {
      return false
    }
  } else if (rule.scope !== "place") {
    return false
  }

  return adapter.permits?.(action, target) ?? true
}

/**
 * The acts a "⋯" menu offers for one entry.
 *
 * ⚠️ `copyLink` is offered only when the product actually has a link for this entry; "copy" that puts nothing on the
 * clipboard is a control that lies.
 */
export function entryActions(adapter: ExplorerAdapter, entry: ExplorerEntry): ExplorerAction[] {
  return MENU_ACTIONS.filter((action) => {
    if (!permits(adapter, action, { entry })) {
      return false
    }

    if (action === "copyLink") {
      return Boolean(adapter.shareUrl?.(entry))
    }

    return true
  })
}

/**
 * The acts on the shown folder as a place.
 *
 * @param place the folder's ID; null is the root
 * @param folder the folder itself, when the explorer knows it
 */
export function placeActions(adapter: ExplorerAdapter, place: string | null, folder?: ExplorerEntry): ExplorerAction[] {
  return PLACE_ACTIONS.filter((action) => permits(adapter, action, { place, folder }))
}

import { Badge, Button, Card, CardContent, cn } from "@jmouse/ui"
import { openStation } from "../station.js"
import type { PwaStation, StationRequirement } from "../station.js"
import { InstallButton } from "../install/InstallButton.js"
import { useInstallPrompt } from "../install/useInstallPrompt.js"

/**
 * ⚠️ **Re-exported, not defined here — it moved to `station.js`.** Launching a station is a document
 * load rather than a route, which is a fact about manifests rather than about a tile grid; keeping it
 * in this file made it unreachable from `@jmouse/pwa/headless`, whose whole purpose is to hand a
 * product the behaviour without the two components that draw with `@jmouse/ui`. Every existing import
 * of `openStation` from the root entry keeps working.
 */
export { openStation } from "../station.js"

export type StationTileState = "available" | "installed" | "unavailable-here" | "closed"

export interface StationShelfProperties {
  stations: readonly PwaStation[]
  /**
   * Whether this account holds what a station asks for.
   *
   * ⚠️ **A predicate passed in — this package never authorizes.** A product hands over the single
   * reader it already uses for its own menu, and the deliberate consequence is that the shelf and the
   * sidebar cannot disagree about who may see what. A library with its own answer would be a second
   * answer, and the day the two differ is the day a tile is offered for a screen the backend refuses.
   */
  holds: (requirement: StationRequirement) => boolean
  /** Defaults to {@link openStation}, which is what a station needs. Override only to log or confirm. */
  onOpen?: (station: PwaStation) => void
  /**
   * Which stations this person has already installed, where the product knows.
   *
   * ⚠️ **A browser cannot answer this about another station.** Whether one is installed is only
   * observable from inside its own launched window, so anything here is a record the product kept —
   * and a tile says "installed" only when it is told. Claiming it from a guess is worse than the
   * ordinary state, because the one thing it removes is the way to install.
   */
  installedKeys?: readonly string[]
  /**
   * The station to put forward — drawn with a quiet mark, never with a different size or colour.
   *
   * ⚠️ A SUGGESTION and nothing else. Where a product decides this from what somebody's job is, the
   * decision has only reordered a list the permission gate already filtered; a shelf that made the
   * suggested tile look like the only working one would have turned a preference into a gate.
   */
  preferredKey?: string
  /**
   * Stations that are present and **will not open**, keyed by station, carrying the sentence to show.
   *
   * ⚠️ **A refusal somebody can act on is a door, not an absence.** Where a product decides this
   * server-side — as Innoventa does, because whether a station is offered turns on modules a browser
   * does not hold — removing the tile would read as a product with fewer screens than a colleague's
   * and nothing to ask about. Shown and shut, it reads as what it is, and discloses nothing about what
   * is behind it.
   *
   * ⚠️ **The words are never composed here.** They come from whichever axis refused — "your plan does
   * not include this" and "ask an administrator" are two different next moves, and a shelf that said
   * one sentence for both would teach a reader that the product is broken.
   *
   * A station named here bypasses {@link holds} entirely: the decision has already been taken by
   * something that knew more.
   */
  refusals?: Readonly<Record<string, string>>
  className?: string
  /** Shown when this account may open nothing at all. */
  emptyMessage?: string
}

interface StationTileProperties {
  station: PwaStation
  preferred?: boolean
  state: StationTileState
  refusal?: string
  onOpen: (station: PwaStation) => void
}

function StationTile({ station, preferred, state, refusal, onOpen }: StationTileProperties) {
  const closed = state === "closed"

  return (
    <Card className={cn("flex h-full flex-col", closed && "opacity-70")}>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn("[&_svg]:size-8", closed ? "text-muted-foreground" : "text-primary")}
            aria-hidden="true"
          >
            {station.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">
              {station.name}
              {preferred && <Badge variant="secondary" className="text-[10px]">Suggested</Badge>}
            </p>
            <p className="text-muted-foreground text-[12.5px] leading-relaxed">{station.description}</p>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {closed ? (
            // ⚠️ No Open and no install control — both would be affordances that cannot work, and a
            // control that does nothing when tapped is worse than no control.
            <p className="text-muted-foreground text-[12.5px] leading-relaxed">{refusal}</p>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpen(station)}>
                Open
              </Button>

              {state === "installed" ? (
                <span className="text-muted-foreground text-[12.5px]">On your home screen</span>
              ) : (
                <InstallButton station={station} className="text-[12.5px]" />
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * The stations this account may open, offered for installing.
 *
 * ⚠️ **A station the predicate refuses is not rendered at all** — not greyed, not disabled, no
 * explanation. A disabled tile tells somebody a thing exists and that they are not allowed it, which
 * is both a disclosure and an invitation to go and ask; absence is the honest rendering of "this is
 * not part of your work".
 *
 * ⚠️ **The shelf is not laid out around an install button**, because on roughly half the phones this
 * is meant for there cannot be one — iOS installs only through Share → Add to Home Screen. Every tile
 * therefore leads with **Open**, which always works, and the offer to install is whatever the browser
 * can actually manage beside it.
 */
export function StationShelf({
  stations,
  holds,
  onOpen = openStation,
  installedKeys,
  refusals,
  preferredKey,
  className,
  emptyMessage = "There are no stations for you to install yet.",
}: StationShelfProperties) {
  const { capability } = useInstallPrompt()
  const installed = new Set(installedKeys ?? [])
  // A refused station is shown and shut rather than filtered — see `refusals`. Everything else still
  // goes through the product's own gate, which is the only one this package has.
  const permitted = stations.filter((station) => refusals?.[station.key] !== undefined || holds(station))

  if (permitted.length === 0) {
    return <p className={cn("text-muted-foreground text-[12.5px]", className)}>{emptyMessage}</p>
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {permitted.map((station) => (
        <StationTile
          key={station.key}
          station={station}
          refusal={refusals?.[station.key]}
          preferred={station.key === preferredKey}
          state={
            refusals?.[station.key] !== undefined
              ? "closed"
              : installed.has(station.key)
                ? "installed"
                : capability === "unsupported"
                  ? "unavailable-here"
                  : "available"
          }
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

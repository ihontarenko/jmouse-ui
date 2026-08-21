import type { ReactNode } from "react"
import { cn } from "../../lib/helpers"
import type { EntityCardDensity } from "./surface"

/**
 * What a run of cards sits in — a grid of cards, or a list of rows.
 *
 * ⚠️ **The compact density is a real `<ul>`, and the compact card is a real `<li>`.** The two are a
 * pair: the row draws a hairline under itself and nothing else, and this draws the one border around the
 * whole run. Rendering a compact card outside this container leaves an `li` with no list and a row with
 * no edges.
 *
 * ⚠️ **Rails laid three across were the worst of both.** A 320px row still had to carry a name, a badge,
 * a count and every action, so the name truncated to "Battery ..." while a third of the screen sat empty.
 * Down one column the row is as wide as the screen, everything fits inline, and the names line up under
 * each other the way a list's do.
 *
 * ⚠️ **The roomy density asks for a minimum width rather than counted breakpoints, because the viewport
 * is not the grid.** These cards sit beside a filter panel inside a shell with a sidebar, so a
 * `2xl:grid-cols-4` written against the *window* produced 240px cards. `auto-fill` asks the container,
 * which is the thing that actually holds them.
 */
export function EntityCardGrid({
  density = "comfortable",
  className,
  children,
}: {
  density?: EntityCardDensity
  className?: string
  children: ReactNode
}) {
  if (density === "compact") {
    // ⚠️ `bg-card`, so the run reads as one surface the rows are cut out of rather than as hairlines
    // floating on the page — the same ground the roomy card sits on, at list density.
    return <ul className={cn("overflow-hidden rounded-lg border bg-card", className)}>{children}</ul>
  }

  return (
    <div className={cn("grid gap-2 grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]", className)}>{children}</div>
  )
}

/**
 * One avatar, drawn inline.
 *
 * Inline SVG rather than an `<img>`: there is nothing to fetch, nothing to cache and nothing to go
 * missing, and a face is around thirty rectangles. A member list of forty people costs forty memoised
 * strings and no requests at all.
 */

import { useMemo } from "react"

import { buildSVG, type AvatarSource } from "../render"

export interface AvatarProperties {
  /** A token, or the descriptor one decodes into. A bare legacy seed is a token here too. */
  source: AvatarSource
  /** Pixel size of the box. Pass `null` to let the surrounding CSS decide. */
  size?: number | null
  className?: string
}

/** What is drawn when a stored value turns out to be something this engine cannot read. */
const UNREADABLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>`

export function Avatar({ source, size = 64, className }: AvatarProperties) {
  const markup = useMemo(() => {
    try {
      // ⚠️ Always `null`: the wrapper owns the box, so a caller can size this with a class as easily
      // as with the prop, and the two can never disagree.
      return buildSVG(source, null)
    } catch {
      // An unreadable token draws nothing rather than throwing. A member list is not the place to
      // discover that one row in the database is malformed, and a thrown render takes the page with it.
      return UNREADABLE
    }
  }, [source])

  return (
    <span
      className={className}
      style={size === null ? undefined : { width: size, height: size }}
      role="presentation"
      aria-hidden="true"
      // Our own generated markup, and the only path that ever carries somebody's text runs through
      // `escapeMarkup`.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

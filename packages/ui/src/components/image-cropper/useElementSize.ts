import * as React from "react"

import type { Dimensions } from "./cropGeometry"

/**
 * The size an element actually has, watched.
 *
 * ⚠️ **The frame cannot be a constant.** A cropper sized once at mount is a cropper that is the wrong
 * size inside a dialog that has not finished opening, and the wrong size again the moment somebody
 * turns a phone — and because the pan limits are measured against the frame, "the wrong size" means a
 * picture that slides off its own edge rather than merely looking cramped.
 */
export function useElementSize<E extends HTMLElement>(): [
  React.RefObject<E | null>,
  Dimensions | null,
] {
  const reference = React.useRef<E>(null)
  const [size, setSize] = React.useState<Dimensions | null>(null)

  React.useEffect(() => {
    const element = reference.current

    if (!element) {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect

      setSize((current) => {
        if (current && current.width === box.width && current.height === box.height) {
          return current
        }

        return { width: box.width, height: box.height }
      })
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [reference, size]
}

import * as React from "react"

import type { Dimensions } from "./cropGeometry"

export interface ObservedElement<E extends HTMLElement> {
  /** Attach to the element being measured. */
  ref: (element: E | null) => void
  /** The element itself, for the things a size cannot answer — a bounding box, a native listener. */
  element: React.RefObject<E | null>
  /** `null` until the element is in the document and has been measured. */
  size: Dimensions | null
}

/**
 * The size an element actually has, watched.
 *
 * ⚠️ **The frame cannot be a constant.** A cropper sized once at mount is a cropper that is the wrong
 * size inside a dialog that has not finished opening, and the wrong size again the moment somebody
 * turns a phone — and because the pan limits are measured against the frame, "the wrong size" means a
 * picture that slides off its own edge rather than merely looking cramped.
 *
 * ⚠️ **A callback ref, never an effect reading `ref.current` on mount, and this is not a style
 * preference.** An effect with empty dependencies runs once, and if the element is not in the document
 * at that moment it returns having observed nothing and never tries again. That is not a corner case:
 * a Radix portal flips itself on in a layout effect, so its children mount in a *second* commit — and
 * a hook called by the component that owns the dialog therefore runs its effect one commit too early.
 * The symptom is a cropper stuck on "reading the picture" with the picture already decoded, on a stage
 * that has a perfectly good width and height.
 *
 * A callback ref cannot be early: React calls it with the element the moment there is one, and calls
 * the cleanup it returns when there stops being one.
 */
export function useElementSize<E extends HTMLElement>(): ObservedElement<E> {
  const element = React.useRef<E | null>(null)
  const [size, setSize] = React.useState<Dimensions | null>(null)

  const ref = React.useCallback((node: E | null) => {
    element.current = node

    if (node === null) {
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

    observer.observe(node)

    return () => {
      observer.disconnect()
      element.current = null
      setSize(null)
    }
  }, [])

  return { ref, element, size }
}

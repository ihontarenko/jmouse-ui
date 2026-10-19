import { useCallback, useEffect, useId, useRef, useState } from "react"

export type PopoverAlignment = "start" | "end"

/**
 * Places a fixed popover under its anchor, flipping above when there is no room below and staying inside the
 * viewport sideways. The browser's Popover API does the rest — the top layer (no clipping by an `overflow` parent),
 * light dismiss and Escape — so nothing here traps a click or listens to the document.
 */
export function placeUnderAnchor(anchor: Element, popover: HTMLElement, alignment: PopoverAlignment, gap = 4): void {
  const margin = 8
  const anchorBox = anchor.getBoundingClientRect()
  const popoverBox = popover.getBoundingClientRect()
  let top = anchorBox.bottom + gap
  if (top + popoverBox.height > window.innerHeight - margin && anchorBox.top - gap - popoverBox.height > margin) {
    top = anchorBox.top - gap - popoverBox.height
  }
  let left = alignment === "end" ? anchorBox.right - popoverBox.width : anchorBox.left
  left = Math.max(margin, Math.min(left, window.innerWidth - popoverBox.width - margin))
  popover.style.top = `${Math.round(top)}px`
  popover.style.left = `${Math.round(left)}px`
}

/**
 * The wiring of one anchored `popover="auto"` element: its id for `popoverTarget`, the two references, whether it is
 * open, and a close that hands focus back to the anchor — which the platform does not do for a popover.
 */
export function useAnchoredPopover<Anchor extends HTMLElement = HTMLButtonElement>(alignment: PopoverAlignment = "start") {
  const popoverId = useId()
  const anchorReference = useRef<Anchor>(null)
  const popoverReference = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const popover = popoverReference.current
    if (!popover) {
      return
    }
    function onToggle(event: Event) {
      const opening = (event as ToggleEvent).newState === "open"
      setOpen(opening)
      if (opening && anchorReference.current && popover) {
        placeUnderAnchor(anchorReference.current, popover, alignment)
      }
    }
    function onBeforeToggle(event: Event) {
      // A first placement before the popover paints, so it never flashes at the corner; refined once it has a size.
      if ((event as ToggleEvent).newState === "open" && anchorReference.current && popover) {
        const anchorBox = anchorReference.current.getBoundingClientRect()
        popover.style.top = `${Math.round(anchorBox.bottom + 4)}px`
        popover.style.left = `${Math.round(anchorBox.left)}px`
      }
    }
    popover.addEventListener("toggle", onToggle)
    popover.addEventListener("beforetoggle", onBeforeToggle)
    return () => {
      popover.removeEventListener("toggle", onToggle)
      popover.removeEventListener("beforetoggle", onBeforeToggle)
    }
  }, [alignment])

  const close = useCallback((returnFocus = true) => {
    popoverReference.current?.hidePopover()
    if (returnFocus) {
      anchorReference.current?.focus()
    }
  }, [])

  return { popoverId, anchorReference, popoverReference, open, close }
}

/** Moves focus among the enabled items of a list with the arrow keys, Home and End — a menu's or a listbox's keys. */
export function moveFocusAmong(container: HTMLElement, selector: string, key: string): boolean {
  const items = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((item) => !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true")
  if (items.length === 0) {
    return false
  }
  const current = items.indexOf(document.activeElement as HTMLElement)
  let next: number
  if (key === "ArrowDown") {
    next = current < 0 ? 0 : (current + 1) % items.length
  } else if (key === "ArrowUp") {
    next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
  } else if (key === "Home") {
    next = 0
  } else if (key === "End") {
    next = items.length - 1
  } else {
    return false
  }
  items[next].focus()
  return true
}

"use client"

import * as React from "react"
import { PanelLeft, PanelRight } from "lucide-react"

import { cn } from "../lib/helpers"
import { useViewportBelow } from "../hooks/use-viewport-below"
import { Button } from "./button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet"

/**
 * A panel that sits **beside** the content on a wide screen and **over** it on a narrow one.
 *
 * <h2>⚠️ Rearranging, not narrowing — which is why this is a component and not a class</h2>
 *
 * <p>A tree rail, a details rail and a filter column all have the same problem below about a thousand
 * pixels: they are fixed-width, the document beside them is what has to give, and there is no width at
 * which a 256px column and a readable document both fit on a phone. Every product here solved it by
 * hiding the panel, which trades a cramped screen for an unreachable one. What a narrow screen actually
 * wants is the same panel, opened over the document and dismissed by tapping away from it.
 *
 * <h2>⚠️ The state is a value, not a context</h2>
 *
 * <p>One screen legitimately has two of these — a tree on the left and a rail on the right — and a
 * provider-and-context arrangement makes the second one silently drive the first. So the caller holds
 * {@link useResponsivePanel}'s value and hands it both to the panel and to whatever opens it, which
 * also means the trigger can live anywhere on the screen rather than inside this subtree.
 *
 * <h2>⚠️ Wide renders the children with nothing wrapped around them</h2>
 *
 * <p>No sizing box, no border, no scroll container. The panel a product already has knows its own
 * width and its own edge; a wrapper here would be a second opinion about both, and the first symptom
 * would be a double border down the middle of a screen.
 */
export interface ResponsivePanelState {
  /** Whether the viewport is currently below the panel's breakpoint. */
  narrow: boolean
  /** Whether the overlay is showing. Always false while the panel is beside the content. */
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  /** Close it — what a navigation inside the panel calls, since navigating is not dismissing. */
  close: () => void
}

/**
 * The panel's state.
 *
 * @param below the first width at which the panel sits beside the content — Tailwind's `lg` is 1024
 */
export function useResponsivePanel({ below }: { below: number }): ResponsivePanelState {
  const narrow = useViewportBelow(below)
  const [open, setOpen] = React.useState(false)

  /**
   * ⚠️ **Closed the moment the screen becomes wide again**, and this is not tidiness. Radix keeps the
   * open flag whatever is rendered, so a sheet left open, a rotation to landscape and a rotation back
   * re-opens an overlay nobody asked for — over a screen where the panel is already visible beside the
   * content, so it reads as the application opening a duplicate of what is on screen.
   */
  React.useEffect(() => {
    if (!narrow) {
      setOpen(false)
    }
  }, [narrow])

  return React.useMemo(
    () => ({
      narrow,
      open: narrow && open,
      setOpen,
      toggle: () => setOpen((showing) => !showing),
      close: () => setOpen(false),
    }),
    [narrow, open],
  )
}

export function ResponsivePanel({
  state,
  side = "left",
  title,
  description,
  className,
  children,
}: {
  state: ResponsivePanelState
  side?: "left" | "right"
  /**
   * What the overlay is called.
   *
   * ⚠️ **Required, and rendered for assistive technology rather than for the eye.** Radix refuses a
   * dialog without a title and says so only in the console; a screen reader announcing an unnamed sheet
   * is the same failure said out loud. The panel below draws its own heading where it wants one, so
   * showing this too would be the same words twice.
   */
  title: string
  description?: string
  /** Classes for the scrolling box inside the overlay. Ignored while the panel is beside the content. */
  className?: string
  children: React.ReactNode
}) {
  if (!state.narrow) {
    return <>{children}</>
  }

  return (
    <Sheet open={state.open} onOpenChange={state.setOpen}>
      {/* ⚠️ `dismissOnOutsideClick`, against this package's own default. That default protects a sheet
          holding a half-filled form; a panel somebody opened to look at something is the case the
          default's own note calls "purely navigational", and refusing to close when they tap the
          document is how an overlay comes to feel stuck. */}
      <SheetContent
        side={side}
        dismissOnOutsideClick
        className="w-[85vw] gap-0 p-0 sm:max-w-sm"
        aria-label={title}
      >
        {/* Named for assistive technology and for nobody else — the panel below draws its own heading
            where it wants one, and a second visible title would be the same words twice. */}
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {description && <SheetDescription className="sr-only">{description}</SheetDescription>}

        {/* ⚠️ `min-h-0` on a flex child that scrolls. Without it the box refuses to shrink below its
            content, the sheet grows past the viewport, and the scroll happens on the page behind. */}
        <div className={cn("min-h-0 flex-1 overflow-x-hidden overflow-y-auto pt-10", className)}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * The control that opens one — rendered only while the panel is an overlay.
 *
 * <p>⚠️ **It renders nothing at all on a wide screen rather than being disabled.** The panel is on
 * screen there; a greyed-out button beside a visible panel is an offer to open what is already open.
 */
export function ResponsivePanelTrigger({
  state,
  side = "left",
  label,
  className,
  ...properties
}: React.ComponentProps<typeof Button> & {
  state: ResponsivePanelState
  side?: "left" | "right"
  label: string
}) {
  if (!state.narrow) {
    return null
  }

  const Glyph = side === "left" ? PanelLeft : PanelRight

  return (
    <Button
      type="button"
      variant="ghost"
      // ⚠️ The large icon size, not the default one. This control only ever renders on a screen too
      // narrow for the panel, which in practice is a screen operated with a thumb — and the default
      // 34px box is below every platform's minimum touch target.
      size="icon-lg"
      aria-label={label}
      aria-expanded={state.open}
      title={label}
      className={className}
      onClick={state.toggle}
      {...properties}
    >
      <Glyph className="size-4" />
    </Button>
  )
}

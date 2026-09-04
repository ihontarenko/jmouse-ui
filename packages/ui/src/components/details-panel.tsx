"use client"

import * as React from "react"
import { X } from "lucide-react"

import { cn } from "../lib/helpers"
import { Button } from "./button"
import { ResponsivePanel, useResponsivePanel, type ResponsivePanelState } from "./responsive-panel"

/**
 * The rail beside a list showing what the active row is.
 *
 * <h2>⚠️ Built ON {@link ResponsivePanel}, not beside it</h2>
 *
 * <p>"Beside the content on a wide screen, over it on a narrow one" is a solved problem in this
 * package and is the harder half of this component. What is added here is only what a *details* rail
 * needs on top: a heading with a way out, one width every list agrees on, and the closing rule below.
 * A second panel that re-solved the responsive half would be the duplicate this package exists to stop.
 *
 * <h2>⚠️ Closing clears the selection, and that is not tidiness</h2>
 *
 * <p>The panel is the answer to "what is this row". Close it while the row stays highlighted and the
 * screen is left saying something is selected with no way to see what — a state a person gets out of
 * by clicking around until the highlight goes. So {@link DetailsPanelState.close} is one act: dismiss
 * the panel and forget the row.
 *
 * <p>⚠️ `Esc` is handled here rather than through the global shortcut registry, because a details rail
 * is not always on a screen that has one, and a panel that only closes where a registry happens to be
 * mounted is a panel that sometimes traps somebody.
 */

const DETAILS_PANEL_BREAKPOINT = 1024

export interface DetailsPanelState<Subject> {
  /** What is being shown, or null when nothing is. */
  subject: Subject | null
  /** Show something — the same call opens the panel on a narrow screen. */
  show: (subject: Subject) => void
  /** Dismiss it AND forget the subject. */
  close: () => void
  /** Whether the panel is an overlay rather than a rail. */
  narrow: boolean
  /** Handed to {@link DetailsPanel}; a caller does not read it. */
  responsive: ResponsivePanelState
}

/**
 * The panel's state, held by the screen so the list and the panel agree on one subject.
 *
 * @param onClose run when the panel closes, however it closed — normally clearing the list's active row
 */
export function useDetailsPanel<Subject>({ onClose }: { onClose?: () => void } = {}): DetailsPanelState<Subject> {
  const responsive = useResponsivePanel({ below: DETAILS_PANEL_BREAKPOINT })
  const [subject, setSubject] = React.useState<Subject | null>(null)
  const { setOpen } = responsive

  const close = React.useCallback(() => {
    setSubject(null)
    setOpen(false)
    onClose?.()
  }, [setOpen, onClose])

  const show = React.useCallback(
    (next: Subject) => {
      setSubject(next)
      setOpen(true)
    },
    [setOpen],
  )

  React.useEffect(() => {
    if (subject === null) {
      return
    }

    const handle = (event: KeyboardEvent) => {
      // ⚠️ A dialog above the panel owns Escape first — closing what is underneath a modal leaves the
      // person looking at the modal wondering what just happened behind it.
      if (event.key !== "Escape" || document.querySelector("[role=dialog][data-state=open], dialog[open]")) {
        return
      }
      event.preventDefault()
      close()
    }

    window.addEventListener("keydown", handle)

    return () => window.removeEventListener("keydown", handle)
  }, [subject, close])

  return { subject, show, close, narrow: responsive.narrow, responsive }
}

/**
 * ⚠️ **Generic over the subject rather than taking `DetailsPanelState<unknown>`.** `show` takes the
 * subject as a parameter, and a function parameter is contravariant: a state holding one concrete type
 * is not assignable to one holding `unknown`, so the un-generic version is refused at every call site
 * that actually holds something.
 */
export function DetailsPanel<Subject>({
  state,
  title,
  description,
  actions,
  className,
  children,
}: {
  state: DetailsPanelState<Subject>
  /** The heading, and the overlay's accessible name. */
  title: string
  description?: string
  /** Controls in the header, left of the close button. */
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  // ⚠️ Nothing is rendered where there is nothing to show — including the empty rail. A 376px column of
  // nothing beside a list is width taken from the rows, which are what the screen is for.
  if (state.subject === null) {
    return null
  }

  return (
    <ResponsivePanel state={state.responsive} side="right" title={title} description={description}>
      <aside
        className={cn(
          "bg-background flex min-h-0 flex-col",
          // Beside the content it is a fixed rail with its own edge; as an overlay the sheet already
          // supplies both, so the width and the border are dropped.
          state.narrow ? "w-full" : "w-[376px] shrink-0 border-l",
          className,
        )}
        aria-label={title}
      >
        <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
          <h2 className="flex-1 truncate text-[13px] font-semibold">{title}</h2>
          {actions}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close (Esc)"
            title="Close (Esc)"
            onClick={state.close}
          >
            <X className="size-4" />
          </Button>
        </header>

        {/* ⚠️ `min-h-0` on the scrolling flex child — without it the column refuses to shrink below its
            content and the page behind scrolls instead. */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</div>
      </aside>
    </ResponsivePanel>
  )
}

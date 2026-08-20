import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "../lib/helpers"
import { AnchoredPanel, anchorProperties, useAnchorName, type AnchoredAlign } from "./anchored"

/**
 * A popover, positioned by the browser rather than by a library — see `components/ui/anchored.tsx`.
 *
 * ⚠️ **Nothing in this application uses it today.** It is here because it was here, and because the
 * next screen that wants a panel next to a control should find one rather than reach for the library
 * that opens it in the wrong place. It was moved onto the anchored primitive with everything else
 * precisely so that it cannot be the one that reintroduces the bug.
 */

interface PopoverContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  anchorName: string
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopover(component: string): PopoverContextValue {
  const context = React.useContext(PopoverContext)

  if (context === null) {
    throw new Error(`${component} has to be used inside a <Popover>`)
  }

  return context
}

function Popover({
  open: openProperty,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const anchorName = useAnchorName()
  const open = openProperty ?? uncontrolledOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  const context = React.useMemo(() => ({ open, setOpen, anchorName }), [open, setOpen, anchorName])

  return (
    <PopoverContext.Provider value={context}>
      {/* `contents` — see `dropdown-menu.tsx` for why this imposes no layout. */}
      <div data-slot="popover" className="contents">
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

function PopoverTrigger({
  asChild = false,
  style,
  ...properties
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { open, setOpen, anchorName } = usePopover("PopoverTrigger")
  const Component = asChild ? Slot.Root : "button"

  return (
    <Component
      data-slot="popover-trigger"
      data-state={open ? "open" : "closed"}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      {...properties}
      {...anchorProperties(anchorName, style)}
    />
  )
}

function PopoverContent({
  className,
  align = "center",
  sideOffset: _sideOffset,
  ...properties
}: React.ComponentProps<"div"> & { align?: AnchoredAlign; sideOffset?: number }) {
  const { open, setOpen, anchorName } = usePopover("PopoverContent")

  return (
    <AnchoredPanel
      anchorName={anchorName}
      open={open}
      onClose={() => setOpen(false)}
      side="bottom"
      align={align}
      data-slot="popover-content"
      className={cn("w-72 p-4", className)}
      {...properties}
    />
  )
}

/**
 * ⚠️ Kept as a passthrough. Radix's anchor let a panel be positioned against something other than its
 * trigger; the anchored primitive would express that as a second `anchor-name`, and nothing here needs
 * one. Removing the export would be a rename dressed as a cleanup.
 */
function PopoverAnchor({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function PopoverHeader({ className, ...properties }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...properties}
    />
  )
}

function PopoverTitle({ className, ...properties }: React.ComponentProps<"div">) {
  return <div data-slot="popover-title" className={cn("font-medium", className)} {...properties} />
}

function PopoverDescription({ className, ...properties }: React.ComponentProps<"p">) {
  return (
    <p data-slot="popover-description" className={cn("text-muted-foreground", className)} {...properties} />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
}

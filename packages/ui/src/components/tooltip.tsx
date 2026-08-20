import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "../lib/helpers"
import {
  AnchoredPanel,
  anchorProperties,
  useAnchorName,
  type AnchoredAlign,
  type AnchoredSide,
} from "./anchored"

/**
 * A tooltip, positioned by the browser rather than by a library — for the same reason as every other
 * overlay here. See `components/ui/anchored.tsx`.
 *
 * ⚠️ **It never takes focus.** A tooltip describes the control the keyboard is already on; moving
 * focus into it would take the keyboard away from the thing being described. `manageFocus={false}` is
 * the whole of that decision.
 */

const TooltipDelayContext = React.createContext(0)

/** Kept as a component so existing trees compile; all it carries now is the delay. */
function TooltipProvider({
  delayDuration = 0,
  children,
}: {
  delayDuration?: number
  children: React.ReactNode
}) {
  return <TooltipDelayContext.Provider value={delayDuration}>{children}</TooltipDelayContext.Provider>
}

interface TooltipContextValue {
  open: boolean
  show: () => void
  hide: () => void
  anchorName: string
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null)

function useTooltip(component: string): TooltipContextValue {
  const context = React.useContext(TooltipContext)

  if (context === null) {
    throw new Error(`${component} has to be used inside a <Tooltip>`)
  }

  return context
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const anchorName = useAnchorName()
  const delay = React.useContext(TooltipDelayContext)
  const timer = React.useRef<number | undefined>(undefined)

  const show = React.useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), delay)
  }, [delay])

  const hide = React.useCallback(() => {
    window.clearTimeout(timer.current)
    setOpen(false)
  }, [])

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const context = React.useMemo(() => ({ open, show, hide, anchorName }), [open, show, hide, anchorName])

  return (
    <TooltipContext.Provider value={context}>
      <div data-slot="tooltip" className="contents">
        {children}
      </div>
    </TooltipContext.Provider>
  )
}

function TooltipTrigger({
  asChild = false,
  style,
  ...properties
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { show, hide, anchorName } = useTooltip("TooltipTrigger")
  const Component = asChild ? Slot.Root : "button"

  return (
    <Component
      data-slot="tooltip-trigger"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      {...properties}
      {...anchorProperties(anchorName, style)}
    />
  )
}

function TooltipContent({
  className,
  side = "right",
  align = "center",
  sideOffset: _sideOffset,
  children,
  ...properties
}: React.ComponentProps<"div"> & {
  side?: AnchoredSide
  align?: AnchoredAlign
  sideOffset?: number
}) {
  const { open, hide, anchorName } = useTooltip("TooltipContent")

  return (
    <AnchoredPanel
      anchorName={anchorName}
      open={open}
      onClose={hide}
      side={side}
      align={align}
      manageFocus={false}
      role="tooltip"
      data-slot="tooltip-content"
      className={cn(
        "w-fit border-none bg-foreground px-3 py-1.5 text-xs text-balance text-background shadow-md",
        className,
      )}
      {...properties}
    >
      {children}
    </AnchoredPanel>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

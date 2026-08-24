import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "../lib/helpers"
import { Button } from "./button"

function Dialog({
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...properties} />
}

function DialogTrigger({
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...properties} />
}

function DialogPortal({
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...properties} />
}

function DialogClose({
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...properties} />
}

function DialogOverlay({
  className,
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...properties}
    />
  )
}

/**
 * ⚠️ **A click outside does NOT close a dialog, and that is the default on purpose.**
 *
 * Nearly every dialog in these products is a surface somebody types into — a form, a policy, a label
 * design. Radix dismisses on any pointer-down outside the panel, so one stray click on the scrim threw
 * away whatever had been filled in, with no warning and nothing to undo. A modal is now closed
 * **deliberately**: with `Esc`, with the close button, or with a control that knows what the answers
 * were.
 *
 * A dialog that genuinely holds nothing losable — a picker, a preview — may opt back in with
 * `dismissOnOutsideClick`.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  dismissOnOutsideClick = false,
  onInteractOutside,
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  dismissOnOutsideClick?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        // ⚠️ The caller's own handler runs first and may refuse the dismissal for its own reasons;
        // this only refuses the ones it left standing.
        onInteractOutside={(event) => {
          onInteractOutside?.(event)

          if (!dismissOnOutsideClick) {
            event.preventDefault()
          }
        }}
        className={cn(
          // ⚠️ `grid-cols-[minmax(0,1fr)]`, and it is a bug fix rather than a style: a grid track is
          // `min-width: auto` by default, so ONE wide child — a `<pre>` of embed code, a long token —
          // stretches the whole dialog past its own `max-w` and past the viewport, taking the buttons
          // at its right edge off screen with it. Capping the track at the container is what lets an
          // `overflow-auto` child scroll inside the dialog instead of widening it.
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] grid-cols-[minmax(0,1fr)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...properties}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...properties }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...properties}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...properties
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...properties}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...properties}
    />
  )
}

function DialogDescription({
  className,
  ...properties
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...properties}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Button, IconButton } from "../controls/Button"
import { joinClassNames } from "../lib/classNames"

export interface DialogProperties {
  open: boolean
  /** Called for every way out — Escape, the close button, a click on the backdrop. Give this or `onOpenChange`. */
  onClose?(): void
  /** The same, in Radix's shape (Innoventa's dialogs): called with `false` on every way out. */
  onOpenChange?(open: boolean): void
  title: ReactNode
  description?: ReactNode
  /** The foot: the actions on the right, a note on the left. */
  actions?: ReactNode
  footNote?: ReactNode
  size?: "small" | "regular" | "wide" | "large" | "full"
  /** Innoventa's names for two sizes: `wide` is size "wide"; `large` holds a whole editor at a FIXED height, so the
      footer with Save does not move as the editor's cards come and go. */
  wide?: boolean
  large?: boolean
  /** The footer's actions, Innoventa's name for `actions`. The confirming action is the filled one and goes last. */
  footer?: ReactNode
  /** No padding on the body — for content that brings its own, like a full editor. */
  flush?: boolean
  /** The body is ONE thing that takes the height (a canvas, a viewer) rather than a stack packed to the top. */
  fill?: boolean
  /** Under 600px: the full width, rising from the bottom edge, as tall as its content — for a dialog used one-handed. */
  fullscreenOnPhone?: boolean
  /** start / end: a drawer along that edge instead of a centred dialog. */
  placement?: "center" | "start" | "end"
  /** A click on the backdrop closes it. Off for a dialog holding unsaved input. */
  dismissOnBackdrop?: boolean
  closeLabel?: string
  className?: string
  children?: ReactNode
}

/**
 * A modal dialog or drawer on the native <dialog>: the browser traps focus inside it, Escape closes it, the page under
 * it is inert, and focus returns to what opened it. Mark the control the reader starts at with `data-autofocus`.
 */
export function Dialog({ open, onClose: onCloseGiven, onOpenChange, title, description, actions: actionsGiven, footer, footNote, size: sizeGiven = "regular", wide, large, flush, fill, fullscreenOnPhone, placement = "center", dismissOnBackdrop = true, closeLabel = "Close", className, children }: DialogProperties) {
  const onClose = () => {
    onCloseGiven?.()
    onOpenChange?.(false)
  }
  const actions = actionsGiven ?? footer
  const size = large ? "large" : wide ? "wide" : sizeGiven
  const reference = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = reference.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal focuses the first focusable element — the close button. The control the dialog marks with
      // data-autofocus (the safe answer, the first field) is where the reader is meant to start.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={reference}
      className={joinClassNames("kit-dialog", className)}
      data-size={size === "regular" ? undefined : size}
      data-placement={placement === "center" ? undefined : placement}
      data-phone={fullscreenOnPhone ? "sheet" : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // The dialog element itself is the backdrop's only target: its content never is.
        if (dismissOnBackdrop && event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      {open && (
        <>
          <header className="kit-dialog-head">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p id={descriptionId}>{description}</p>}
            </div>
            <IconButton icon="close" label={closeLabel} onClick={onClose} />
          </header>
          {children && <div className="kit-dialog-body" data-flush={flush ? "" : undefined} data-fill={fill ? "" : undefined}>{children}</div>}
          {(actions || footNote) && (
            <footer className="kit-dialog-foot">
              {footNote}
              {actions && <div className="kit-panel-actions">{actions}</div>}
            </footer>
          )}
        </>
      )}
    </dialog>
  )
}

export interface ConfirmDialogProperties {
  open: boolean
  title: ReactNode
  /** What will happen, in words — what is lost, what cannot be undone. */
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** A destructive confirmation is drawn in the danger tone. */
  tone?: "accent" | "danger"
  /** May return a promise; the button shows it is busy until it settles. */
  onConfirm(): void | Promise<void>
  onClose(): void
}

/** "Are you sure" with the consequence spelled out. The safe answer is the focused one. */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Cancel", tone = "accent", onConfirm, onClose }: ConfirmDialogProperties) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="small"
      dismissOnBackdrop={!busy}
      actions={
        <>
          <Button onClick={onClose} data-autofocus="" disabled={busy}>{cancelLabel}</Button>
          <Button
            variant="primary"
            tone={tone}
            busy={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

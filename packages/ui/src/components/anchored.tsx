import * as React from "react"
import { cn } from "../lib/helpers"

/**
 * The one way this application opens a panel next to something.
 *
 * ⚠️ **No JavaScript computes a position here, and that is the whole point.** Text size is applied as
 * `zoom` (see `ThemeContext`), and a JS positioner cannot survive it: floating-ui divides a trigger's
 * `getBoundingClientRect()` by the scale it detects — which for a zoomed element *is* the zoom — and
 * then cannot reconcile a `position: fixed` containing block. Measured, trigger at y=18 at 1.5×: the
 * panel opened at y=654 with the zoom on `body`, and at y=436 with it on the application root. There is
 * no zoom host that fixes it, because the arithmetic itself is what is wrong.
 *
 * So the browser does it. `anchor-name`/`position-anchor`/`position-area` anchor the panel during
 * normal layout, where every length already agrees, and `position-try-fallbacks` flips it when the
 * chosen side will not fit. Measured across 1×/1.25×/1.5×, both zoom hosts, and a trigger inside the
 * fixed sidebar: the gap scales with the zoom and the edges align to the pixel.
 *
 * <h2>⚠️ The top layer, via the native popover</h2>
 *
 * The panel is a `popover`, so it renders in the top layer. That buys three things a hand-rolled
 * absolutely-positioned panel does not have: it is never clipped by an ancestor's `overflow: hidden`
 * (a table cell, a card, a toolbar), it never loses a z-index argument, and light dismiss plus Escape
 * are the platform's rather than two document-level listeners per open panel.
 *
 * It also inherits `body`'s zoom like anything else in the document, so the panel renders at the
 * application's text size with nothing to reapply.
 *
 * <h2>Browser floor</h2>
 *
 * CSS anchor positioning is Chromium-only today (Chrome 125+; this application runs on 151). The products
 * consuming this package are internal tools on Chrome, and the alternative was a positioner that is wrong in every browser. When
 * Firefox and Safari ship it, nothing here changes.
 */

/**
 * A CSS identifier unique to one trigger/panel pair.
 *
 * `useId()` produces `:r0:`, which is not a valid custom-ident — the colons have to go before it can
 * be an `anchor-name`.
 */
export function useAnchorName(): string {
  const id = React.useId()

  return React.useMemo(() => `--anchor-${id.replace(/[^a-zA-Z0-9]/g, "")}`, [id])
}

/** Which edge of the trigger the panel is asked for, before any fallback moves it. */
export type AnchoredSide = "bottom" | "top" | "left" | "right"

/** How the panel lines up along that edge. */
export type AnchoredAlign = "start" | "center" | "end"

/**
 * The `position-area` for a side and alignment.
 *
 * `span-*` rather than a fixed span so the panel may be wider than its trigger and grow in the
 * expected direction — a menu aligned to the start grows rightwards, and one aligned to the end grows
 * leftwards, which is what stops it leaving the screen before a fallback has to.
 */
function positionArea(side: AnchoredSide, align: AnchoredAlign): string {
  const vertical: Record<AnchoredAlign, string> = {
    start: "span-right",
    center: "span-all",
    end: "span-left",
  }
  const horizontal: Record<AnchoredAlign, string> = {
    start: "span-bottom",
    center: "span-all",
    end: "span-top",
  }

  return side === "bottom" || side === "top"
    ? `${side} ${vertical[align]}`
    : `${side} ${horizontal[align]}`
}

export interface AnchoredPanelProperties extends React.ComponentProps<"div"> {
  /** The trigger's `anchor-name`, from {@link useAnchorName}. */
  anchorName: string
  open: boolean
  onClose: () => void
  side?: AnchoredSide
  align?: AnchoredAlign
  /** Match the trigger's width — what a select wants and a menu does not. */
  matchTriggerWidth?: boolean
  /** Keep the DOM mounted while closed. A select needs it: its value is read from its items. */
  keepMounted?: boolean
  /**
   * Move focus into the panel when it opens, and back to the trigger when it closes.
   *
   * On by default, because a panel that does not take focus cannot receive a key — arrow navigation,
   * type-ahead and Enter all arrive at whatever was focused before. A tooltip turns it off: it is not
   * something anybody interacts with, and stealing focus from the control it describes is worse than
   * having none.
   */
  manageFocus?: boolean
}

/**
 * The panel itself.
 *
 * ⚠️ **`popover="manual"`, not `"auto"`.** Auto's light dismiss closes on any pointerdown outside,
 * including the trigger's own — which lands as close-then-reopen and reads as a menu that will not
 * open. The dismissal here skips the trigger, which is the one element that has its own opinion.
 */
export function AnchoredPanel({
  anchorName,
  open,
  onClose,
  side = "bottom",
  align = "start",
  matchTriggerWidth = false,
  keepMounted = false,
  manageFocus = true,
  className,
  style,
  children,
  ...properties
}: AnchoredPanelProperties) {
  const panelReference = React.useRef<HTMLDivElement>(null)

  // Show and hide through the popover API rather than by unmounting, so the panel is in the top layer
  // whenever it is visible and nowhere at all when it is not.
  React.useEffect(() => {
    const panel = panelReference.current

    if (panel === null) {
      return
    }

    if (open && !panel.matches(":popover-open")) {
      panel.showPopover()

      if (manageFocus) {
        panel.focus({ preventScroll: true })
      }
    }

    if (!open && panel.matches(":popover-open")) {
      panel.hidePopover()

      // Back to the trigger, so closing a menu with Escape leaves the keyboard where it started
      // rather than at the top of the document.
      if (manageFocus) {
        document.querySelector<HTMLElement>(`[data-anchor-for="${anchorName}"]`)?.focus({ preventScroll: true })
      }
    }
  }, [open, manageFocus, anchorName])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const dismiss = (event: PointerEvent) => {
      const panel = panelReference.current
      const target = event.target as Element | null

      if (panel === null || target === null) {
        return
      }

      // The trigger toggles itself; closing here as well would make a click open and close in one go.
      if (panel.contains(target) || target.closest(`[data-anchor-for="${anchorName}"]`) !== null) {
        return
      }

      onClose()
    }

    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("pointerdown", dismiss, true)
    document.addEventListener("keydown", escape)

    return () => {
      document.removeEventListener("pointerdown", dismiss, true)
      document.removeEventListener("keydown", escape)
    }
  }, [open, onClose, anchorName])

  if (!open && !keepMounted) {
    return null
  }

  return (
    <div
      ref={panelReference}
      popover="manual"
      data-slot="anchored-panel"
      data-side={side}
      className={cn(
        "anchored-panel rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className,
      )}
      style={{
        // The two custom properties the stylesheet's `.anchored-panel` rule reads. They are inline
        // because both are per-instance: the anchor name is generated, and the area depends on props.
        ["--anchored-area" as string]: positionArea(side, align),
        ["positionAnchor" as string]: anchorName,
        ...(matchTriggerWidth ? { minWidth: "anchor-size(width)" } : undefined),
        ...style,
      }}
      {...properties}
    >
      {children}
    </div>
  )
}

/**
 * The style a trigger needs to be anchorable, plus the marker the panel's dismissal looks for.
 *
 * Spread onto whatever element opens the panel — a `button`, a `SidebarMenuButton`, a table row — so
 * that being a trigger costs one spread rather than a wrapper element.
 *
 * ⚠️ **The caller's own `style` has to come in here rather than be spread after.** `anchor-name` is
 * carried in `style`, so a trigger written `<SelectTrigger style={{ width: 240 }}>` silently replaced
 * it, and the panel — with nothing to anchor to — fell to the top-left corner of the screen. It looked
 * exactly like the positioning bug this whole change was made to end, which is the sort of resemblance
 * that costs an afternoon. Merging here means a trigger cannot get it wrong by passing a style.
 */
export function anchorProperties(anchorName: string, style?: React.CSSProperties) {
  return {
    "data-anchor-for": anchorName,
    style: { ...style, anchorName } as React.CSSProperties,
  }
}

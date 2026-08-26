"use client"

import * as React from "react"
import { MoreHorizontal } from "lucide-react"

import { cn } from "../lib/helpers"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu"

/**
 * A screen's own actions, as a row of buttons on a wide screen and a `⋯` menu on a narrow one.
 *
 * <h2>⚠️ The actions are DATA, and that is the whole reason this can be shared</h2>
 *
 * <p>Every header in this family carries four or five controls, and every one of them stops fitting at
 * about the width of a phone — where the title, which is the thing somebody needs in order to know what
 * they are looking at, is what loses. The obvious fix is a `hidden sm:flex` beside a `sm:hidden` menu,
 * which is the same five actions written twice in one file and drifting apart by the third edit.
 *
 * <p>So an action is a value here rather than a piece of markup: a label, a glyph and something to call.
 * One list renders both ways, and adding a control cannot leave the phone behind.
 *
 * <h2>⚠️ Collapsing is the caller's decision, not this component's</h2>
 *
 * <p>What "too narrow" means depends on what else is in the header — a screen with an editable title in
 * it runs out of room long before one showing a word. So the caller passes {@link ActionBarProperties.collapsed}
 * from its own breakpoint (see `useViewportBelow`), and this renders what it is told.
 */
export interface BarAction {
  id: string
  /** What it is called — the button's text, and the menu item's. */
  label: string
  /** Drawn beside the label. Any component taking a `className`, which every lucide glyph is. */
  icon?: React.ComponentType<{ className?: string }>
  onSelect: () => void
  disabled?: boolean
  /** Painted as a removal — a button in the destructive ink, a menu item in the destructive variant. */
  destructive?: boolean
  /** The `title` attribute — where the sentence explaining a surprising action belongs. */
  hint?: string
  /**
   * A keyboard shortcut, drawn as a badge beside the label.
   *
   * ⚠️ **Never rendered while collapsed.** A collapsed bar is a touch screen, and a phone showing
   * `E` beside "Edit" is naming a key nobody in front of it has.
   */
  shortcut?: string
  /**
   * Keep it a button at every width, out of the overflow menu.
   *
   * ⚠️ At most one or two. The point of collapsing is that the title gets the room back, and a bar
   * where everything is kept is a bar that never collapses.
   */
  primary?: boolean
}

export interface ActionBarProperties {
  actions: BarAction[]
  /** Render as one `⋯` menu plus whatever is `primary`, rather than as a row of labelled buttons. */
  collapsed?: boolean
  /** Slotted in after the actions, at every width — a panel toggle, a separator, anything unlisted. */
  children?: React.ReactNode
  className?: string
}

export function ActionBar({ actions, collapsed = false, children, className }: ActionBarProperties) {
  // Every action is rendered at both widths — a disabled one is drawn disabled rather than removed,
  // so the bar does not change shape while something is in flight.

  if (!collapsed) {
    return (
      <span className={cn("flex items-center gap-1", className)}>
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            size="sm"
            variant="ghost"
            disabled={action.disabled}
            title={action.hint}
            className={cn(action.destructive && "text-destructive-ink hover:text-destructive-ink")}
            onClick={action.onSelect}
          >
            {action.icon && <action.icon className="mr-1 size-3.5" />}
            {action.label}
            {action.shortcut && (
              <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px] text-muted-foreground">
                {action.shortcut}
              </kbd>
            )}
          </Button>
        ))}
        {children}
      </span>
    )
  }

  const kept = actions.filter((action) => action.primary)
  const folded = actions.filter((action) => !action.primary)

  return (
    <span className={cn("flex items-center gap-0.5", className)}>
      {kept.map((action) => (
        <Button
          key={action.id}
          type="button"
          // ⚠️ The large icon size on a collapsed bar, which is a bar being used with a thumb.
          size="icon-lg"
          variant="ghost"
          disabled={action.disabled}
          aria-label={action.label}
          title={action.hint ?? action.label}
          className={cn(action.destructive && "text-destructive-ink hover:text-destructive-ink")}
          onClick={action.onSelect}
        >
          {action.icon ? <action.icon className="size-4" /> : action.label}
        </Button>
      ))}

      {folded.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-lg" variant="ghost" aria-label="More actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {folded.map((action, index) => (
              <React.Fragment key={action.id}>
                {/* A removal is not one more thing in the list — it gets a line above it, so a thumb
                    travelling down the menu does not arrive at it by momentum. */}
                {action.destructive && index > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  disabled={action.disabled}
                  variant={action.destructive ? "destructive" : undefined}
                  onSelect={action.onSelect}
                >
                  {action.icon && <action.icon className="size-4" />}
                  {action.label}
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {children}
    </span>
  )
}

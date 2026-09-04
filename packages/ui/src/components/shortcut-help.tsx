"use client"

import * as React from "react"

import { cn } from "../lib/helpers"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog"
import { useKeyboardShortcuts, useShortcutHelp, type Shortcut } from "../hooks/use-keyboard-shortcuts"

/**
 * The `?` screen, printed from the registry that is actually in force.
 *
 * <p>⚠️ **Generated, never written down.** A hand-kept list of shortcuts beside a registry of them is
 * one fact stated twice, and the copy is wrong within a month — usually in the direction that matters,
 * promising a key that no longer does anything. Reading the registry means a shortcut cannot exist
 * without appearing here, and this cannot promise one that does not exist.
 *
 * <p>⚠️ **It registers `?` itself**, so mounting it once in an application shell is the whole wiring.
 */
export function ShortcutHelp({ title = "Keyboard shortcuts" }: { title?: string }) {
  const [open, setOpen] = React.useState(false)
  const groups = useShortcutHelp()

  useKeyboardShortcuts([
    {
      keys: "/",
      shift: true,
      describes: "Show this help",
      group: "Everywhere",
      run: () => setOpen((showing) => !showing),
    },
  ])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="text-muted-foreground text-[12.5px]">This screen has no shortcuts of its own.</p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            {groups.map((group) => (
              <section key={group.group} className="flex flex-col gap-1">
                <h3 className="text-muted-foreground text-[11px] font-semibold tracking-[0.06em] uppercase">
                  {group.group}
                </h3>
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className={cn(
                      "flex items-baseline justify-between gap-4 py-0.5 text-[12.5px]",
                      shortcut.disabled && "opacity-40",
                    )}
                  >
                    <span>{shortcut.describes}</span>
                    <ShortcutKeys shortcut={shortcut} />
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * One shortcut's keys as `kbd` elements — a sequence renders as separate keys, since `g p` is two
 * presses and printing it as one would teach the wrong thing.
 */
export function ShortcutKeys({ shortcut, className }: { shortcut: Pick<Shortcut, "keys" | "shift">; className?: string }) {
  const keys = shortcut.keys.split(" ")

  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      {shortcut.shift && <Key>shift</Key>}
      {keys.map((key, index) => (
        <Key key={index}>{printable(key)}</Key>
      ))}
    </span>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground border-border rounded-[2px] border px-1.5 py-0.5 font-mono text-[11px] leading-none">
      {children}
    </kbd>
  )
}

function printable(key: string): string {
  if (key === " ") {
    return "space"
  }
  return key
}

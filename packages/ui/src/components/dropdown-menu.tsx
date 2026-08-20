import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "../lib/helpers"
import { AnchoredPanel, anchorProperties, useAnchorName, type AnchoredAlign } from "./anchored"

/**
 * A menu, positioned by the browser rather than by a library.
 *
 * ⚠️ **This replaced Radix's for one reason: positioning.** Under the font-scale `zoom`, a floating-ui
 * popper opens nowhere near its trigger — a control at y=18 opened its menu at y=654 — and no zoom host
 * fixes it, because the arithmetic is what is wrong. See `components/ui/anchored.tsx`.
 *
 * The exported API is the one the call sites already use. `Sub`, `RadioGroup` and `CheckboxItem` are
 * kept because they were exported before; the sub-menu is rendered inline rather than as a second
 * anchored panel, which is what the two call sites in this application actually want.
 */

interface MenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  anchorName: string
}

const MenuContext = React.createContext<MenuContextValue | null>(null)

function useMenu(component: string): MenuContextValue {
  const context = React.useContext(MenuContext)

  if (context === null) {
    throw new Error(`${component} has to be used inside a <DropdownMenu>`)
  }

  return context
}

function DropdownMenu({
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
    <MenuContext.Provider value={context}>
      {/* ⚠️ `contents`, so this wrapper imposes no layout of its own — the trigger sizes exactly as it
          would if it were a direct child of whatever contains the menu. It briefly was
          `relative inline-flex`, carried over from the hand-rolled panel that needed a positioned
          ancestor, and it shrank every full-width trigger to its text (the sidebar's account button
          being the visible one). The panel is in the top layer and anchored by `anchor-name`, so
          there is nothing left for this element to do. */}
      <div data-slot="dropdown-menu" className="contents">
        {children}
      </div>
    </MenuContext.Provider>
  )
}

function DropdownMenuTrigger({
  asChild = false,
  className,
  style,
  ...properties
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { open, setOpen, anchorName } = useMenu("DropdownMenuTrigger")
  const Component = asChild ? Slot.Root : "button"

  return (
    <Component
      data-slot="dropdown-menu-trigger"
      data-state={open ? "open" : "closed"}
      aria-expanded={open}
      aria-haspopup="menu"
      className={className}
      onClick={() => setOpen(!open)}
      {...properties}
      {...anchorProperties(anchorName, style)}
    />
  )
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset: _sideOffset,
  children,
  ...properties
}: React.ComponentProps<"div"> & { align?: AnchoredAlign; sideOffset?: number }) {
  const { open, setOpen, anchorName } = useMenu("DropdownMenuContent")

  return (
    <AnchoredPanel
      anchorName={anchorName}
      open={open}
      onClose={() => setOpen(false)}
      side="bottom"
      align={align}
      role="menu"
      tabIndex={-1}
      data-slot="dropdown-menu-content"
      className={cn("min-w-[8rem]", className)}
      // A menu closes when something in it is chosen. Every item is a click, so one listener on the
      // panel beats a wrapper around each item's own handler.
      onClick={(event) => {
        if ((event.target as Element).closest("[data-slot='dropdown-menu-item']") !== null) {
          setOpen(false)
        }
      }}
      {...properties}
    >
      {children}
    </AnchoredPanel>
  )
}

function DropdownMenuGroup({ className, ...properties }: React.ComponentProps<"div">) {
  return <div data-slot="dropdown-menu-group" role="group" className={className} {...properties} />
}

/**
 * One item.
 *
 * <h2>⚠️ `onSelect` is honoured HERE, and it has to be</h2>
 *
 * <p>This menu is hand-rolled — it is not Radix, whatever the file's shape suggests — so an item is a
 * plain `div` and only `onClick` means anything to it. But every call site in this product was written
 * against **shadcn's API**, where the prop is `onSelect`, and `onSelect` is *also a real DOM prop on a
 * `div`* (the `select` event). So it type-checked perfectly, spread straight onto the element, and never
 * fired: six menu items across the product that opened, highlighted, closed, and did nothing.
 *
 * <p>⚠️ **Mapping it here rather than rewriting the call sites** is deliberate. The Radix name is the one
 * anybody copying an example will reach for, and the next person to add a menu item will write it again;
 * a primitive that silently ignores the obvious prop is a trap that re-arms itself.
 *
 * <p>⚠️ **Keyboard too.** A `tabIndex={-1}` div with no key handling cannot be activated by Enter or
 * Space, so the menu was mouse-only — which is invisible until somebody tries, and is exactly how this
 * was found.
 */
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  disabled = false,
  asChild = false,
  onSelect,
  onClick,
  onKeyDown,
  ...properties
}: React.ComponentProps<"div"> & {
  inset?: boolean
  variant?: "default" | "destructive"
  disabled?: boolean
  /** For an item that is really a link — the styling stays here, the element becomes the child's. */
  asChild?: boolean
}) {
  const Component = asChild ? Slot.Root : "div"

  function activate(event: React.SyntheticEvent<HTMLDivElement>) {
    if (disabled) {
      return
    }

    onSelect?.(event as React.SyntheticEvent<HTMLDivElement, Event>)
  }

  return (
    <Component
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      data-disabled={disabled ? "" : undefined}
      onClick={(event: React.MouseEvent<HTMLDivElement>) => {
        onClick?.(event)
        activate(event)
      }}
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event)

        if (event.key === "Enter" || event.key === " ") {
          // Space scrolls the page otherwise, and Enter inside a form would submit it.
          event.preventDefault()
          activate(event)
          // The content closes on click; a keyboard activation has to say so itself.
          event.currentTarget.click()
        }
      }}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive-ink data-[variant=destructive]:hover:bg-destructive/10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...properties}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked = false,
  onCheckedChange,
  ...properties
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <div
      role="menuitemcheckbox"
      aria-checked={checked}
      data-slot="dropdown-menu-item"
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...properties}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CheckIcon className="size-4" />}
      </span>
      {children}
    </div>
  )
}

const RadioGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  ...properties
}: React.ComponentProps<"div"> & { value?: string; onValueChange?: (value: string) => void }) {
  const context = React.useMemo(() => ({ value, onValueChange }), [value, onValueChange])

  return (
    <RadioGroupContext.Provider value={context}>
      <div data-slot="dropdown-menu-radio-group" role="group" {...properties} />
    </RadioGroupContext.Provider>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  value,
  ...properties
}: Omit<React.ComponentProps<"div">, "value"> & { value: string }) {
  const group = React.useContext(RadioGroupContext)
  const checked = group.value === value

  return (
    <div
      role="menuitemradio"
      aria-checked={checked}
      data-slot="dropdown-menu-item"
      onClick={() => group.onValueChange?.(value)}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...properties}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CircleIcon className="size-2 fill-current" />}
      </span>
      {children}
    </div>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...properties
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
      {...properties}
    />
  )
}

function DropdownMenuSeparator({ className, ...properties }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...properties}
    />
  )
}

function DropdownMenuShortcut({ className, ...properties }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...properties}
    />
  )
}

/**
 * ⚠️ **A sub-menu renders inline, indented, rather than as a second anchored panel.**
 *
 * A panel anchored to an item inside another panel is where positioning libraries earn their keep and
 * where this application has no need for one: neither call site uses a sub-menu, and the exports exist
 * only because they existed before. Inline keeps them working and honest — everything is visible, and
 * nothing is positioned against a moving target.
 */
function DropdownMenuSub({ children }: { children: React.ReactNode }) {
  return <div data-slot="dropdown-menu-sub">{children}</div>
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...properties
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[inset]:pl-8",
        className,
      )}
      {...properties}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </div>
  )
}

function DropdownMenuSubContent({ className, ...properties }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-sub-content"
      className={cn("ml-3 border-l pl-1", className)}
      {...properties}
    />
  )
}

/** Kept so an import of it still resolves; the panel is in the top layer and needs no portal. */
function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}

import * as React from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "../lib/helpers"
import { AnchoredPanel, anchorProperties, useAnchorName } from "./anchored"

/**
 * A select, positioned by the browser rather than by a library.
 *
 * ⚠️ **This replaced Radix's, and the reason was positioning and only positioning.** Under this
 * application's font-scale `zoom`, a floating-ui popper opens nowhere near its trigger — see
 * `components/ui/anchored.tsx` for the numbers. The API here is the same one seventeen call sites
 * already use, so replacing the mechanism cost them nothing.
 *
 * ⚠️ **The panel stays mounted while closed**, unlike the menu's. `SelectValue` has to render the
 * selected item's own children — an icon and a label, not just a string — and those children are
 * written inside `SelectItem`. Keeping the panel mounted lets each item register itself, so the
 * trigger can show exactly what the list shows. The panel is a `popover`, so mounted-and-closed
 * occupies no space and paints nothing.
 */

interface SelectContextValue {
  value: string | undefined
  select: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  disabled: boolean
  anchorName: string
  /** value → the item's rendered children, so the trigger can show what the list shows. */
  register: (value: string, label: React.ReactNode, text: string) => void
  unregister: (value: string) => void
  labels: Map<string, { label: React.ReactNode; text: string }>
  /** The order items appear in, for keyboard navigation and type-ahead. */
  order: React.RefObject<string[]>
  activeValue: string | undefined
  setActiveValue: (value: string | undefined) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelect(component: string): SelectContextValue {
  const context = React.useContext(SelectContext)

  if (context === null) {
    throw new Error(`${component} has to be used inside a <Select>`)
  }

  return context
}

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  open: openProperty,
  onOpenChange,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [labels, setLabels] = React.useState(new Map<string, { label: React.ReactNode; text: string }>())
  const [activeValue, setActiveValue] = React.useState<string | undefined>(undefined)
  const order = React.useRef<string[]>([])
  const anchorName = useAnchorName()

  const currentValue = value ?? uncontrolledValue
  const open = openProperty ?? uncontrolledOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  const select = React.useCallback(
    (next: string) => {
      setUncontrolledValue(next)
      onValueChange?.(next)
      setOpen(false)
    },
    [onValueChange, setOpen],
  )

  const register = React.useCallback((itemValue: string, label: React.ReactNode, text: string) => {
    setLabels((previous) => {
      const next = new Map(previous)
      next.set(itemValue, { label, text })
      return next
    })
  }, [])

  const unregister = React.useCallback((itemValue: string) => {
    setLabels((previous) => {
      const next = new Map(previous)
      next.delete(itemValue)
      return next
    })
  }, [])

  const context = React.useMemo<SelectContextValue>(
    () => ({
      value: currentValue,
      select,
      open,
      setOpen,
      disabled,
      anchorName,
      register,
      unregister,
      labels,
      order,
      activeValue,
      setActiveValue,
    }),
    [currentValue, select, open, setOpen, disabled, anchorName, register, unregister, labels, activeValue],
  )

  return (
    <SelectContext.Provider value={context}>
      {/* `contents` — no layout of its own; the trigger sizes as a direct child of its container.
          See `dropdown-menu.tsx` for why this is not `relative`. */}
      <div data-slot="select" className="contents">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

/** Grouping is presentational here — the panel is one flat listbox, as it was before. */
function SelectGroup({ className, ...properties }: React.ComponentProps<"div">) {
  return <div data-slot="select-group" role="group" className={className} {...properties} />
}

/**
 * What the trigger shows: the selected item's own children, or the placeholder.
 *
 * ⚠️ **Children override the mirroring**, and that escape hatch is what keeps a rich list usable. An
 * item is free to be two lines — a name above a sentence explaining it — but a trigger is one line in
 * a grid cell, and mirroring that item into it stretches the cell over its neighbour. A call site with
 * items like that passes the short form itself; passing nothing keeps the icon-and-label behaviour the
 * other call sites rely on.
 */
function SelectValue({
  placeholder,
  className,
  children,
  ...properties
}: React.ComponentProps<"span"> & { placeholder?: React.ReactNode }) {
  const { value, labels } = useSelect("SelectValue")
  const selected = value === undefined ? undefined : labels.get(value)

  return (
    <span data-slot="select-value" className={className} {...properties}>
      {children ?? (selected ? selected.label : placeholder)}
    </span>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  id,
  style,
  ...properties
}: React.ComponentProps<"button"> & { size?: "sm" | "default" }) {
  const { open, setOpen, disabled, anchorName, value, order, setActiveValue } = useSelect("SelectTrigger")

  function openWith(startAt: string | undefined) {
    setActiveValue(startAt ?? value ?? order.current[0])
    setOpen(true)
  }

  return (
    <button
      type="button"
      id={id}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={disabled}
      data-slot="select-trigger"
      data-size={size}
      data-state={open ? "open" : "closed"}
      data-placeholder={value === undefined ? "" : undefined}
      onClick={() => (open ? setOpen(false) : openWith(undefined))}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          openWith(undefined)
        }
      }}
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[13px] whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-[34px] data-[size=sm]:h-[30px] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...properties}
      {...anchorProperties(anchorName, style)}
    >
      {children}
      <ChevronDownIcon className="size-4 opacity-50" />
    </button>
  )
}

/**
 * The listbox.
 *
 * `position` and `align` are still accepted so the call sites that pass them keep compiling; the panel
 * chooses its own side when the asked-for one will not fit, which is what those props were reaching for.
 */
function SelectContent({
  className,
  children,
  ...properties
}: React.ComponentProps<"div"> & { position?: string; align?: "start" | "center" | "end" }) {
  const { open, setOpen, anchorName, value, select, order, activeValue, setActiveValue } =
    useSelect("SelectContent")
  const typedReference = React.useRef({ query: "", at: 0 })

  // `position`/`align` are consumed rather than spread — they are not DOM attributes.
  const { position: _position, align: _align, ...rest } = properties

  function move(delta: number) {
    const values = order.current
    const from = activeValue ?? value
    const index = from === undefined ? -1 : values.indexOf(from)
    const next = values[Math.min(Math.max(index + delta, 0), values.length - 1)]

    if (next !== undefined) {
      setActiveValue(next)
    }
  }

  /**
   * Type-ahead, which is how anybody actually picks out of a long list.
   *
   * Keystrokes within a second accumulate into one query — "st" finds "Story" rather than jumping to
   * everything beginning with s and then everything beginning with t.
   */
  function typeAhead(character: string) {
    const now = Date.now()
    const typed = typedReference.current
    typed.query = now - typed.at > 1000 ? character : typed.query + character
    typed.at = now

    const match = order.current.find((candidate) =>
      (candidate === undefined ? "" : candidate).toLowerCase().startsWith(typed.query),
    )

    if (match !== undefined) {
      setActiveValue(match)
    }
  }

  return (
    <AnchoredPanel
      anchorName={anchorName}
      open={open}
      onClose={() => setOpen(false)}
      side="bottom"
      align="start"
      matchTriggerWidth
      keepMounted
      role="listbox"
      tabIndex={-1}
      data-slot="select-content"
      className={cn("min-w-[8rem]", className)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault()
          move(1)
        } else if (event.key === "ArrowUp") {
          event.preventDefault()
          move(-1)
        } else if (event.key === "Home") {
          event.preventDefault()
          setActiveValue(order.current[0])
        } else if (event.key === "End") {
          event.preventDefault()
          setActiveValue(order.current[order.current.length - 1])
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          if (activeValue !== undefined) {
            select(activeValue)
          }
        } else if (event.key === "Tab") {
          setOpen(false)
        } else if (event.key.length === 1) {
          typeAhead(event.key.toLowerCase())
        }
      }}
      {...rest}
    >
      {children}
    </AnchoredPanel>
  )
}

function SelectLabel({ className, ...properties }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...properties}
    />
  )
}

function SelectItem({
  className,
  children,
  value,
  disabled = false,
  ...properties
}: Omit<React.ComponentProps<"div">, "value"> & { value: string; disabled?: boolean }) {
  const select = useSelect("SelectItem")
  const selected = select.value === value
  const active = select.activeValue === value
  const itemReference = React.useRef<HTMLDivElement>(null)

  // Registering the children — not a string — is what lets the trigger show an icon beside the name.
  React.useEffect(() => {
    select.register(value, children, itemReference.current?.textContent ?? "")

    return () => select.unregister(value)
    // `children` is compared by identity and would re-register every render; the text content is the
    // part that can meaningfully change, and it is read at registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, select.register, select.unregister])

  // The panel's flat value order, rebuilt on every render so it follows the DOM order items appear in.
  const order = select.order
  React.useEffect(() => {
    if (!order.current.includes(value)) {
      order.current = [...order.current, value]
    }

    return () => {
      order.current = order.current.filter((candidate) => candidate !== value)
    }
  }, [order, value])

  React.useEffect(() => {
    if (active) {
      itemReference.current?.scrollIntoView({ block: "nearest" })
    }
  }, [active])

  return (
    <div
      ref={itemReference}
      role="option"
      aria-selected={selected}
      data-slot="select-item"
      data-state={selected ? "checked" : "unchecked"}
      data-active={active ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      onPointerDown={(event) => {
        event.preventDefault()

        if (!disabled) {
          select.select(value)
        }
      }}
      onPointerEnter={() => !disabled && select.setActiveValue(value)}
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-[12.5px] outline-hidden select-none data-[active]:bg-accent data-[active]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...properties}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        {selected && <CheckIcon className="size-4" />}
      </span>
      <span>{children}</span>
    </div>
  )
}

function SelectSeparator({ className, ...properties }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...properties}
    />
  )
}

/**
 * ⚠️ **Nothing, deliberately, and they are kept because three call sites import them.**
 *
 * Radix needed explicit scroll affordances because its viewport was a custom scroller. This panel is a
 * plain element with `max-height` and `overflow-y: auto`, so the browser draws a scrollbar and an arrow
 * button would be a second, worse one. Removing the exports would be a rename dressed as a cleanup.
 */
function SelectScrollUpButton(_properties: React.ComponentProps<"div">) {
  return null
}

function SelectScrollDownButton(_properties: React.ComponentProps<"div">) {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}

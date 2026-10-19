import { createContext, useContext, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react"
import type { Tone } from "../controls/Button"
import { KeyChord } from "../controls/Labels"
import { Icon, type IconSource } from "../icons/Icon"
import { moveFocusAmong, useAnchoredPopover, type PopoverAlignment } from "../lib/anchoredPopover"
import { joinClassNames } from "../lib/classNames"
import { useKitNavigate } from "../lib/links"

const MenuContext = createContext<{ close(): void } | null>(null)

/** What a menu's trigger must wear: these properties spread onto any kit button (or a native one). */
export interface MenuTriggerProperties {
  ref: Ref<HTMLButtonElement>
  popoverTarget: string
  "aria-haspopup": "menu"
  "aria-expanded": boolean
  "aria-controls": string
}

/** One entry of a menu given as data — Innoventa's shape. */
export interface MenuEntry {
  label: string
  icon?: IconSource
  /** Goes somewhere, through the product's router. */
  to?: string
  onSelect?(): void
  danger?: boolean
  /** A rule above this entry. */
  separated?: boolean
  /** The key that does the same, printed at the entry's end. */
  hint?: string
}

export interface MenuProperties {
  /** The menu's accessible name — and, with `items` and no `trigger`, the words on its button. */
  label: string
  /** Renders the trigger with the properties it must wear. Left out, a button with the label and a chevron. */
  trigger?(triggerProperties: MenuTriggerProperties): ReactNode
  /** The entries as data (Innoventa's shape), instead of `MenuItem` children. */
  items?: MenuEntry[]
  alignment?: PopoverAlignment
  className?: string
  children?: ReactNode
}

function MenuEntries({ items }: { items: MenuEntry[] }) {
  const navigate = useKitNavigate()
  return (
    <>
      {items.map((item) => (
        <span key={item.label} className="kit-menu-entry">
          {item.separated && <MenuSeparator />}
          <MenuItem icon={item.icon} tone={item.danger ? "danger" : undefined} shortcut={item.hint} onSelect={() => (item.to !== undefined ? navigate(item.to) : item.onSelect?.())}>
            {item.label}
          </MenuItem>
        </span>
      ))}
    </>
  )
}

/**
 * A menu of actions under a button. Built on the Popover API: it sits in the top layer, closes on Escape and on a
 * click outside, and focus returns to the trigger. Arrow keys, Home and End move between items.
 */
export function Menu({ label, trigger, items, alignment, className, children }: MenuProperties) {
  const { popoverId, anchorReference, popoverReference, open, close } = useAnchoredPopover(alignment ?? (items && !trigger ? "end" : "start"))
  const triggerProperties: MenuTriggerProperties = { ref: anchorReference, popoverTarget: popoverId, "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": popoverId }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (moveFocusAmong(event.currentTarget, "[role^='menuitem']", event.key)) {
      event.preventDefault()
    } else if (event.key === "Tab") {
      close(false)
    }
  }

  return (
    <>
      {trigger ? (
        trigger(triggerProperties)
      ) : (
        <button type="button" className={joinClassNames("kit-button", className)} {...triggerProperties}>
          {label}
          <Icon name="chevron-down" size="small" />
        </button>
      )}
      <div
        ref={popoverReference}
        id={popoverId}
        popover="auto"
        className="kit-popover"
        onToggle={(event) => {
          if (event.newState === "open") {
            event.currentTarget.querySelector<HTMLElement>("[role^='menuitem']:not([disabled])")?.focus()
          }
        }}
      >
        <div role="menu" aria-label={label} className="kit-menu" onKeyDown={onKeyDown}>
          <MenuContext.Provider value={{ close }}>
            {items ? <MenuEntries items={items} /> : children}
          </MenuContext.Provider>
        </div>
      </div>
    </>
  )
}

/** A row's own menu: a quiet "more" glyph that opens the entries — Innoventa's `RowMenu`. */
export function RowMenu({ label, items, className }: { label: string; items: MenuEntry[]; className?: string }) {
  return (
    <Menu
      label={label}
      items={items}
      alignment="end"
      trigger={(triggerProperties) => (
        <button type="button" className={joinClassNames("kit-row-menu", className)} aria-label={label} title={label} {...triggerProperties}>
          <Icon name="more" size="small" />
        </button>
      )}
    />
  )
}

export interface MenuItemProperties extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
  icon?: IconSource
  shortcut?: string
  tone?: Extract<Tone, "danger">
  /** A checkable item: rendered as menuitemcheckbox (or menuitemradio, with `radio`) with its state announced. */
  checked?: boolean
  /** One of a set where exactly one is chosen — a run configuration. */
  radio?: boolean
  /** Drawn in place of the icon — a project's badge. */
  leading?: ReactNode
  /** Quiet words at the end, in the data face — a path, how far a branch is ahead. */
  detail?: ReactNode
  /** The item is what is open now — the current project, the checked-out branch. */
  current?: boolean
  /** Runs, then the menu closes and focus returns to the trigger. */
  onSelect?(): void
}

export function MenuItem({ icon, shortcut, tone, checked, radio, leading, detail, current, onSelect, className, children, ...rest }: MenuItemProperties) {
  const menu = useContext(MenuContext)
  const checkable = checked !== undefined
  return (
    <button
      type="button"
      role={checkable ? (radio ? "menuitemradio" : "menuitemcheckbox") : "menuitem"}
      aria-checked={checkable ? checked : undefined}
      aria-current={current || undefined}
      tabIndex={-1}
      className={joinClassNames("kit-menu-item", className)}
      data-tone={tone}
      onClick={() => {
        onSelect?.()
        menu?.close()
      }}
      {...rest}
    >
      {leading ?? (checkable && !icon ? <span className="kit-menu-check">{checked && <Icon name="check" size="small" />}</span> : icon && <Icon name={icon} />)}
      <span>{children}</span>
      {detail && <span className="kit-menu-item-detail">{detail}</span>}
      {shortcut && <KeyChord keys={shortcut} />}
    </button>
  )
}

export function MenuSeparator() {
  return <hr className="kit-menu-separator" role="separator" />
}

/** A heading over a run of items — never focusable, never an action. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <span className="kit-menu-label kit-micro-label" role="presentation">{children}</span>
}

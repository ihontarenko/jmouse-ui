import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from "react"
import { Icon } from "../icons/Icon"
import type { IconSource } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"
import { KitLink } from "../lib/links"

export type Tone = "accent" | "good" | "warn" | "danger"

/**
 * How a button looks. The kit's names come first; Innoventa's are taken as they are, so a screen written against its
 * own library keeps working on the kit unchanged:
 *
 * | Innoventa            | the kit                         |
 * |----------------------|---------------------------------|
 * | variant "accent"     | variant "primary"               |
 * | variant "ghost"      | variant "quiet"                 |
 * | variant "danger"     | tone "danger" (a soft danger fill) |
 * | size "default"       | size "regular"                  |
 * | size "icon"          | an icon-only square             |
 * | size "iconSmall"     | an icon-only small square       |
 * | hint="n"             | shortcut="n"                    |
 */
export type ButtonVariant = "default" | "primary" | "quiet" | "accent" | "ghost" | "danger"
export type ButtonSize = "regular" | "small" | "default" | "icon" | "iconSmall"

interface ButtonLookProperties {
  /** default: outlined · primary: filled — ONE per screen · quiet: no chrome until hovered. */
  variant?: ButtonVariant
  tone?: Tone
  size?: ButtonSize
  /** An icon before the label. */
  icon?: IconSource
  /** An icon after the label — a menu's chevron, an outward link. */
  trailingIcon?: IconSource
  /** A shortcut printed on the button, so the key is learned by using the mouse. */
  shortcut?: string
  /** Innoventa's name for `shortcut`. */
  hint?: string
  stretch?: boolean
}

function lookAttributes({ variant = "default", tone, size = "regular", stretch }: ButtonLookProperties) {
  const kitVariant = variant === "accent" ? "primary" : variant === "ghost" ? "quiet" : variant === "danger" ? "soft" : variant
  const kitTone = variant === "danger" ? "danger" : tone
  const small = size === "small" || size === "iconSmall"
  const iconOnly = size === "icon" || size === "iconSmall"
  return {
    "data-variant": kitVariant === "default" ? undefined : kitVariant,
    "data-tone": kitTone,
    "data-size": small ? "small" : undefined,
    "data-icon-only": iconOnly ? "" : undefined,
    "data-stretch": stretch ? "" : undefined,
  }
}

function ButtonContent({ icon, trailingIcon, shortcut, children }: ButtonLookProperties & { children?: ReactNode }) {
  return (
    <>
      {icon && <Icon name={icon} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size="small" />}
      {shortcut && <kbd>{shortcut}</kbd>}
    </>
  )
}

export interface ButtonProperties extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonLookProperties {
  /** The request it started has not come back: a spinner in place of the label, and no second press. */
  busy?: boolean
  /** A toggle: rendered as aria-pressed, so the state is announced and drawn the same way. */
  pressed?: boolean
  /**
   * Innoventa's way to make the same button navigate: given, it renders as the product's router link (see
   * `LinkProvider`). A button that only navigates is better written as a {@link ButtonLink}.
   */
  to?: string
  /** An outward address: the button renders as a plain anchor. */
  href?: string
  ref?: Ref<HTMLButtonElement>
}

/** A button that does something on this page. A button that goes somewhere is a {@link ButtonLink}. */
export function Button({ variant, tone, size, icon, trailingIcon, shortcut, hint, stretch, busy, pressed, to, href, className, type = "button", children, disabled, ...rest }: ButtonProperties) {
  const look = lookAttributes({ variant, tone, size, stretch })
  const content = <ButtonContent icon={icon} trailingIcon={trailingIcon} shortcut={shortcut ?? hint}>{children}</ButtonContent>
  if (to !== undefined || href !== undefined) {
    const anchorProperties = { className: joinClassNames("kit-button", className), ...look, title: rest.title, "aria-label": rest["aria-label"], onClick: rest.onClick as AnchorHTMLAttributes<HTMLAnchorElement>["onClick"] }
    return to !== undefined ? <KitLink to={to} {...anchorProperties}>{content}</KitLink> : <a href={href} {...anchorProperties}>{content}</a>
  }
  return (
    <button
      type={type}
      className={joinClassNames("kit-button", className)}
      {...look}
      aria-busy={busy || undefined}
      aria-pressed={pressed}
      disabled={disabled || busy}
      {...rest}
    >
      {content}
    </button>
  )
}

export interface ButtonLinkProperties extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">, ButtonLookProperties {
  /** A route inside the product, through its router (`LinkProvider`). */
  to?: string
  /** An address outside it. */
  href?: string
}

/** Navigation that looks like a button — a link, so it opens in a new tab and reads as a link. */
export function ButtonLink({ variant, tone, size, icon, trailingIcon, shortcut, hint, stretch, to, href, className, children, ...rest }: ButtonLinkProperties) {
  const classes = joinClassNames("kit-button", className)
  const content = <ButtonContent icon={icon} trailingIcon={trailingIcon} shortcut={shortcut ?? hint}>{children}</ButtonContent>
  const look = lookAttributes({ variant, tone, size, stretch })
  if (to !== undefined) {
    return <KitLink to={to} className={classes} {...look} {...rest}>{content}</KitLink>
  }
  return <a href={href} className={classes} {...look} {...rest}>{content}</a>
}

export interface IconButtonProperties extends Omit<ButtonProperties, "icon" | "trailingIcon" | "children" | "stretch"> {
  icon: IconSource
  /** Required: an icon-only button has no other name. It is also the tooltip. */
  label: string
}

/** A square button with an icon and no visible word; its label is its accessible name and its title. */
export function IconButton({ icon, label, variant = "quiet", size, title, ...rest }: IconButtonProperties) {
  return (
    <Button variant={variant} size={size === "small" || size === "iconSmall" ? "iconSmall" : "icon"} aria-label={label} title={title ?? label} {...rest}>
      <Icon name={icon} />
    </Button>
  )
}

export interface ButtonGroupProperties extends HTMLAttributes<HTMLDivElement> {
  /** What the group does, for assistive technology — the buttons alone do not say. */
  label: string
}

/** Buttons that share a border: a set of related actions, or the options of one toggle. */
export function ButtonGroup({ label, className, ...rest }: ButtonGroupProperties) {
  return <div role="group" aria-label={label} className={joinClassNames("kit-button-group", className)} {...rest} />
}

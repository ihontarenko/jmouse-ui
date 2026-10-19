import { useState, type ButtonHTMLAttributes, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react"
import { Icon } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"
import type { Tone } from "./Button"
import { useFieldControl } from "./Field"

export interface BadgeProperties extends HTMLAttributes<HTMLSpanElement> {
  /**
   * A status. The word inside is what says it; the tone repeats it in colour. Innoventa's tones are taken as they are:
   * "ok" is "good", and "outline" is a frame with no fill.
   */
  tone?: Tone | "neutral" | "ok" | "outline"
  /** The dot pulses: something is happening now. */
  live?: boolean
  /**
   * The status dot. Left out, the THEME decides (`--kit-badge-dot`): Parallax's badges carry one, Innoventa's do not.
   * `led` is Innoventa's name for it.
   */
  dot?: boolean
  led?: boolean
}

export function Badge({ tone = "neutral", live, dot, led, className, ...rest }: BadgeProperties) {
  const shown = dot ?? led
  return (
    <span
      className={joinClassNames("kit-badge", className)}
      data-tone={tone === "neutral" ? undefined : tone === "ok" ? "good" : tone}
      data-live={live ? "" : undefined}
      data-dot={shown === undefined ? undefined : shown ? "true" : "false"}
      {...rest}
    />
  )
}

/** What a thing is — a formula, a circuit, a PDF — in the data face with a hairline frame. Neutral by design. */
export function Kind({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={joinClassNames("kit-kind", className)} {...rest} />
}

export interface TagProperties extends HTMLAttributes<HTMLSpanElement> {
  /** Shows a remove button; the label names what is removed. */
  onRemove?(): void
  removeLabel?: string
}

/** A topic attached to something. A tag that filters a list is a {@link Chip}. */
export function Tag({ onRemove, removeLabel = "Remove", className, children, ...rest }: TagProperties) {
  return (
    <span className={joinClassNames("kit-tag", className)} {...rest}>
      {children}
      {onRemove && (
        <button type="button" aria-label={typeof children === "string" ? `${removeLabel} ${children}` : removeLabel} onClick={onRemove}>
          <Icon name="close" size="small" />
        </button>
      )}
    </span>
  )
}

export interface ChipProperties extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean
  count?: number
}

/** A filter that is on or off, in a strip of filters. */
export function Chip({ pressed, count, className, children, type = "button", ...rest }: ChipProperties) {
  return (
    <button type={type} aria-pressed={pressed} className={joinClassNames("kit-chip", className)} {...rest}>
      {pressed && <Icon name="check" size="small" />}
      {children}
      {count !== undefined && <span className="kit-chip-count">{count}</span>}
    </button>
  )
}

export interface ChipInputProperties {
  values: string[]
  onValuesChange(values: string[]): void
  placeholder?: string
  /** Keys that end a value besides Enter. */
  separators?: string[]
  id?: string
  "aria-label"?: string
  "aria-describedby"?: string
  removeLabel?: string
}

/** Several values typed into one field, each becoming a tag; Backspace in the empty field takes the last one back. */
export function ChipInput({ values, onValuesChange, placeholder, separators = [","], removeLabel = "Remove", ...rest }: ChipInputProperties) {
  const [draft, setDraft] = useState("")
  const wiring = useFieldControl(rest)

  function commit() {
    const value = draft.trim()
    if (value && !values.includes(value)) {
      onValuesChange([...values, value])
    }
    setDraft("")
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || separators.includes(event.key)) {
      event.preventDefault()
      commit()
    } else if (event.key === "Backspace" && !draft && values.length > 0) {
      setDraft(values[values.length - 1])
      onValuesChange(values.slice(0, -1))
    }
  }

  return (
    <div className="kit-chip-input" onClick={(event) => event.currentTarget.querySelector("input")?.focus()}>
      {values.map((value) => (
        <Tag key={value} removeLabel={removeLabel} onRemove={() => onValuesChange(values.filter((candidate) => candidate !== value))}>{value}</Tag>
      ))}
      <input value={draft} placeholder={values.length === 0 ? placeholder : undefined} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={commit} aria-label={rest["aria-label"]} {...wiring} />
    </div>
  )
}

/** A key or a chord, printed: `Ctrl+Shift+A` becomes three keys. */
export function KeyChord({ keys, className }: { keys: string; className?: string }) {
  const parts = keys.split("+")
  return (
    <span className={joinClassNames("kit-shortcut", className)}>
      {parts.map((part, index) => (
        <kbd key={index}>{part}</kbd>
      ))}
    </span>
  )
}

export interface StatusLightProperties extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone | "neutral"
  live?: boolean
}

/** A state as a word with a lamp beside it — running, stopped, offline. */
export function StatusLight({ tone = "neutral", live, className, ...rest }: StatusLightProperties) {
  return <span className={joinClassNames("kit-status-light", className)} data-tone={tone === "neutral" ? undefined : tone} data-live={live ? "" : undefined} {...rest} />
}

export interface AvatarProperties {
  /** The person's name: the initials are drawn from it, and it is the image's alternative text. */
  name: string
  imageUrl?: string
  size?: "small" | "regular" | "large"
}

export function Avatar({ name, imageUrl, size = "regular" }: AvatarProperties) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("")
  return (
    <span className="kit-avatar" data-size={size === "regular" ? undefined : size} title={name}>
      {imageUrl ? <img src={imageUrl} alt={name} /> : <span aria-label={name} role="img">{initials}</span>}
    </span>
  )
}

/** Wraps labels so they flow and wrap together. */
export function Tags({ className, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div className={joinClassNames("kit-tags", className)} {...rest} />
}

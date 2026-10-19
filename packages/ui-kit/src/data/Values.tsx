import { Fragment, useEffect, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react"
import type { Tone } from "../controls/Button"
import { IconButton } from "../controls/Button"
import { joinClassNames } from "../lib/classNames"

export interface ListProperties extends HTMLAttributes<HTMLUListElement> {
  density?: "regular" | "compact"
  /** A hairline between rows. */
  ruled?: boolean
}

/** Rows the user picks from — parts, nets, revisions. Each row is a {@link ListItem}. */
export function List({ density = "regular", ruled, className, ...rest }: ListProperties) {
  return <ul role="list" className={joinClassNames("kit-list", className)} data-density={density === "regular" ? undefined : density} data-ruled={ruled ? "" : undefined} {...rest} />
}

export interface ListItemProperties extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  /** Marked by the band and announced as the current one. */
  current?: boolean
  /** Right-aligned in the data face — a value, a count. */
  value?: ReactNode
}

export function ListItem({ current, value, className, children, type = "button", ...rest }: ListItemProperties) {
  return (
    <li>
      <button type={type} className={joinClassNames("kit-list-item", className)} aria-current={current ? "true" : undefined} {...rest}>
        {children}
        {value !== undefined && <span className="kit-list-item-value">{value}</span>}
      </button>
    </li>
  )
}

export interface Fact {
  label: ReactNode
  value: ReactNode
  /** The data face with tabular figures. */
  technical?: boolean
}

export interface FactsProperties {
  facts: Fact[]
  /** columns: one column of labels · stacked: labels above values, for a narrow column · wide: pairs flowing across
      the width, each label over its value (Innoventa's `wide`). */
  layout?: "columns" | "stacked" | "wide"
  /** Innoventa's name for layout "wide". */
  wide?: boolean
  className?: string
}

/** Label / value pairs — a description list, aligned on one column of labels. */
export function Facts({ facts, layout = "columns", wide, className }: FactsProperties) {
  const shape = wide ? "wide" : layout
  return (
    <dl className={joinClassNames("kit-facts", className)} data-layout={shape === "columns" ? undefined : shape}>
      {facts.map((fact, index) =>
        shape === "wide" ? (
          <div key={index} className="kit-fact">
            <dt>{fact.label}</dt>
            <dd data-technical={fact.technical ? "" : undefined}>{fact.value}</dd>
          </div>
        ) : (
          <Fragment key={index}>
            <dt>{fact.label}</dt>
            <dd data-technical={fact.technical ? "" : undefined}>{fact.value}</dd>
          </Fragment>
        ),
      )}
    </dl>
  )
}

/** A list of things with one figure each, ruled between — a part's suppliers, a box's contents. */
export function PairList({ children }: { children: ReactNode }) {
  return <ul className="kit-pair-list" role="list">{children}</ul>
}

export function PairListItem({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <li>
      <span className="kit-pair-name">{children}</span>
      {side === undefined ? null : <span className="kit-pair-side">{side}</span>}
    </li>
  )
}

export interface Figure {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  tone?: Exclude<Tone, "accent">
}

/** A page's key numbers as one ruled band — a strip of facts, never floating metric cards. */
export function Figures({ figures, className }: { figures: Figure[]; className?: string }) {
  return (
    <dl className={joinClassNames("kit-figures", className)}>
      {figures.map((figure, index) => (
        <div key={index} className="kit-figure" data-tone={figure.tone}>
          <dt>{figure.label}</dt>
          <dd>
            {figure.value}
            {figure.unit && <small>{figure.unit}</small>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export interface PathTextProperties {
  path: string
  separator?: string
  /** One line, its start cut away — the file name at the end always stays visible. */
  truncate?: boolean
  className?: string
}

/** A path that breaks only at its separators, its last part in ink; never broken in the middle of a name. */
export function PathText({ path, separator = "/", truncate, className }: PathTextProperties) {
  const parts = path.split(separator)
  return (
    <span className={joinClassNames("kit-path", className)} data-truncate={truncate ? "" : undefined} title={truncate ? path : undefined}>
      <bdi>
        {parts.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <>
                <span className="kit-path-separator">{separator}</span>
                <wbr />
              </>
            )}
            <span className={index === parts.length - 1 ? "kit-path-last" : undefined}>{part}</span>
          </Fragment>
        ))}
      </bdi>
    </span>
  )
}

export interface CopyButtonProperties {
  value: string
  label?: string
  copiedLabel?: string
  className?: string
}

/** Copies a value and says so for a moment, in its own words and its icon. */
export function CopyButton({ value, label = "Copy", copiedLabel = "Copied", className }: CopyButtonProperties) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <IconButton
      className={joinClassNames("kit-copy", className)}
      icon={copied ? "check" : "copy"}
      label={copied ? copiedLabel : label}
      size="small"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 1600)
      }}
    />
  )
}

export interface CodeProperties {
  code: string
  /** Shows a copy button over the block. */
  copyable?: boolean
  label?: string
  className?: string
}

/** A block of code or a document's source, on the canvas. Highlighting is the host's — `@jmouse/codemirror`. */
export function Code({ code, copyable = true, label, className }: CodeProperties) {
  return (
    <pre className={joinClassNames("kit-code", className)} aria-label={label} tabIndex={0}>
      <code>{code}</code>
      {copyable && <CopyButton value={code} />}
    </pre>
  )
}

/** Code inside a sentence. */
export function InlineCode({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <code className={joinClassNames("kit-code-inline", className)} {...rest} />
}

export interface ProgressProperties {
  /** 0…1. Leave it out while the amount of work is unknown. */
  value?: number
  label: string
  /** The value printed beside the label — "62%", "3 of 12 files". */
  valueText?: string
  tone?: Exclude<Tone, "accent">
  /** Print the label and the value over the bar. */
  showLabel?: boolean
}

export function Progress({ value, label, valueText, tone, showLabel }: ProgressProperties) {
  const indeterminate = value === undefined
  const percent = indeterminate ? undefined : Math.round(Math.max(0, Math.min(1, value)) * 100)
  const bar = (
    <span
      className="kit-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText}
      data-tone={tone}
      data-indeterminate={indeterminate ? "" : undefined}
    >
      <span style={{ width: `${percent ?? 35}%` }} />
    </span>
  )
  if (!showLabel) {
    return bar
  }
  return (
    <span className="kit-progress-labelled">
      <span>{label}</span>
      <output>{valueText ?? (percent !== undefined ? `${percent}%` : "")}</output>
      {bar}
    </span>
  )
}

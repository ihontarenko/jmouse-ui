import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { joinClassNames } from "../lib/classNames"

/*
 * The typographic roles a screen actually has (Innoventa's jMUI `Text.tsx`, same names and properties). A page never
 * picks a font size of its own: whatever it says is one of these.
 */

/** The metadata voice — mono, small, uppercase, tracked. It marks what something IS, never what it says. */
export function Micro({ className, ...rest }: ComponentPropsWithoutRef<"span">) {
  return <span className={joinClassNames("kit-micro-label", className)} {...rest} />
}

/** An identifier — a part number, a machine name, a key. Mono because it is read character by character. */
export function Mono({ className, ...rest }: ComponentPropsWithoutRef<"span">) {
  return <span className={joinClassNames("kit-text-mono", className)} {...rest} />
}

/** A number that belongs in a column: the data face, tabular figures. */
export function Numeric({ className, ...rest }: ComponentPropsWithoutRef<"span">) {
  return <span className={joinClassNames("kit-text-numeric", className)} {...rest} />
}

/** Second-tier text: a subtitle, a hint, an explanation under a control. */
export function Dim({ className, ...rest }: ComponentPropsWithoutRef<"p">) {
  return <p className={joinClassNames("kit-text-dim", className)} {...rest} />
}

export interface SectionTitleProperties {
  count?: number
  action?: ReactNode
  className?: string
  children: ReactNode
}

/** A heading inside a document: its title, its count, one action on the right — always in that order. */
export function SectionTitle({ count, action, className, children }: SectionTitleProperties) {
  return (
    <div className={joinClassNames("kit-section-title", className)}>
      <h2>{children}</h2>
      {count === undefined ? null : <Count>{count}</Count>}
      {action === undefined ? null : <div className="kit-panel-actions">{action}</div>}
    </div>
  )
}

export interface CountProperties {
  /** quiet: a tally beside something already named · active: a tally of something the reader turned on. */
  tone?: "quiet" | "active"
  className?: string
  children: ReactNode
}

/** How many — the number beside a label. Fixed width and tabular, so 9 → 10 never moves the label. */
export function Count({ tone = "quiet", className, children }: CountProperties) {
  return <span className={joinClassNames("kit-count", className)} data-tone={tone === "active" ? "active" : undefined}>{children}</span>
}

/** A key, as it is printed on a keyboard. */
export function Kbd({ children, className }: { children: string; className?: string }) {
  return <kbd className={className}>{children}</kbd>
}

/** A sequence — `g` then `i`, separated by spaces — drawn as separate keys, because that is how it is pressed. */
export function KeySequence({ keys, className }: { keys: string; className?: string }) {
  return (
    <span className={joinClassNames("kit-shortcut", className)}>
      {keys.split(" ").map((key, index) => (
        <kbd key={`${key}-${index}`}>{key}</kbd>
      ))}
    </span>
  )
}

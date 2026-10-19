import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import { IconButton } from "../controls/Button"
import { Icon } from "../icons/Icon"
import { joinClassNames } from "../lib/classNames"

export interface PanelProperties extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode
  /** A count or a state beside the title. */
  meta?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  /** The body without padding — a table or a list that runs to the panel's edges. */
  flush?: boolean
  /** The body scrolls inside a panel whose height the layout fixes. */
  scroll?: boolean
  headingLevel?: 2 | 3
}

/** A bordered region of a page with its own head. Never put a panel in a panel: split the body with rules instead. */
export function Panel({ title, meta, actions, footer, flush, scroll, headingLevel = 2, className, children, ...rest }: PanelProperties) {
  const Heading = headingLevel === 2 ? "h2" : "h3"
  return (
    <section className={joinClassNames("kit-panel", className)} {...rest}>
      {(title || actions) && (
        <header className="kit-panel-head">
          {title && <Heading>{title}</Heading>}
          {meta && <span className="kit-panel-head-meta">{meta}</span>}
          {actions && <div className="kit-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="kit-panel-body" data-flush={flush ? "" : undefined} data-scroll={scroll ? "" : undefined}>{children}</div>
      {footer && <footer className="kit-panel-foot">{footer}</footer>}
    </section>
  )
}

export interface SectionProperties extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

/** A ruled block of a page: a heading on a line, the content under it, no box. */
export function Section({ title, description, actions, className, children, ...rest }: SectionProperties) {
  return (
    <section className={joinClassNames("kit-section", className)} {...rest}>
      <header className="kit-section-head">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {actions && <div className="kit-panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export interface PageHeaderProperties {
  title: ReactNode
  /** Above the title: the crumbs, or a micro-label naming the section. */
  eyebrow?: ReactNode
  description?: ReactNode
  /** Innoventa's name for `description`. */
  subtitle?: ReactNode
  /** Beside the title: what the thing is and its state. */
  badges?: ReactNode
  /** Innoventa's name for `badges`. */
  titleExtra?: ReactNode
  actions?: ReactNode
  className?: string
}

/** A page's head: one h1, never a marketing hero. */
export function PageHeader({ title, eyebrow, description, subtitle, badges, titleExtra, actions, className }: PageHeaderProperties) {
  const words = description ?? subtitle
  return (
    <header className={joinClassNames("kit-page-header", className)}>
      {eyebrow}
      <div className="kit-page-header-row">
        <h1>{title}</h1>
        {badges ?? titleExtra}
        {actions && <div className="kit-page-header-actions">{actions}</div>}
      </div>
      {words && <p className="kit-page-header-description">{words}</p>}
    </header>
  )
}

export interface InspectorProperties extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Left out, "Inspector" (Innoventa's default). */
  title?: ReactNode
  /** Shows a close button that calls this — Innoventa's inspector closes. */
  onClose?(): void
  closeLabel?: string
  /** Under the title: the identifier, the kind. */
  subtitle?: ReactNode
  actions?: ReactNode
  /** The label of the complementary landmark; defaults to the title when that is a string. */
  label?: string
}

/** The right-hand column that explains the selection: its title, then ruled groups. */
export function Inspector({ title = "Inspector", onClose, closeLabel = "Close inspector", subtitle, actions, label, className, children, ...rest }: InspectorProperties) {
  return (
    <aside className={joinClassNames("kit-inspector", className)} aria-label={label ?? (typeof title === "string" ? title : undefined)} {...rest}>
      <header className="kit-inspector-head">
        <div className="kit-inspector-head-row">
          <h2>{title}</h2>
          {(actions || onClose) && (
            <div className="kit-panel-actions">
              {actions}
              {onClose && <IconButton icon="close" label={closeLabel} size="small" onClick={onClose} />}
            </div>
          )}
        </div>
        {subtitle && <div className="kit-inspector-subtitle">{subtitle}</div>}
      </header>
      <div className="kit-inspector-body">{children}</div>
    </aside>
  )
}

/** The inspector with nothing chosen: say so, and how to choose. */
export function InspectorEmpty({ title = "Select a row", hint = "↑↓ or j/k to move · Enter opens", label = "Nothing selected" }: { title?: string; hint?: string; label?: string }) {
  return (
    <div className="kit-inspector-empty">
      <span className="kit-micro-label">{label}</span>
      <p>{title}</p>
      <small>{hint}</small>
    </div>
  )
}

/** Innoventa's section of an inspector: an optional micro-label title, its content, a hairline under it. */
export function InspectorSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="kit-inspector-group">
      {title === undefined ? null : <h3 className="kit-micro-label">{title}</h3>}
      {children}
    </section>
  )
}

export interface InspectorGroupProperties extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode
  actions?: ReactNode
}

export function InspectorGroup({ title, actions, className, children, ...rest }: InspectorGroupProperties) {
  return (
    <section className={joinClassNames("kit-inspector-group", className)} {...rest}>
      <h3 className="kit-micro-label">
        <span>{title}</span>
        {actions}
      </h3>
      {children}
    </section>
  )
}

export interface DisclosureProperties extends Omit<HTMLAttributes<HTMLDetailsElement>, "title"> {
  title: ReactNode
  meta?: ReactNode
  defaultOpen?: boolean
}

/** Content that folds under its title — the native details element, so it needs no script and keeps its keys. */
export function Disclosure({ title, meta, defaultOpen, className, children, ...rest }: DisclosureProperties) {
  return (
    <details className={joinClassNames("kit-disclosure", className)} open={defaultOpen} {...rest}>
      <summary>
        <span>{title}</span>
        {meta && <span className="kit-disclosure-meta">{meta}</span>}
        <Icon name="chevron-down" size="small" className="kit-disclosure-chevron" />
      </summary>
      <div className="kit-disclosure-body">{children}</div>
    </details>
  )
}

export interface CardProperties extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "title" | "media"> {
  title: ReactNode
  /** A preview over the body: a picture, a drawing, a plot. */
  media?: ReactNode
  meta?: ReactNode
  selected?: boolean
}

/** One independent object — a part, a project, a film. A card is a link to that object; it never nests another card. */
export function Card({ title, media, meta, selected, className, children, ...rest }: CardProperties) {
  return (
    <a className={joinClassNames("kit-card", className)} aria-current={selected ? "true" : undefined} {...rest}>
      {media && <div className="kit-card-media">{media}</div>}
      <div className="kit-card-body">
        <h3>{title}</h3>
        {children}
        {meta && <div className="kit-card-meta">{meta}</div>}
      </div>
    </a>
  )
}

export function CardGrid({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClassNames("kit-card-grid", className)} {...rest} />
}

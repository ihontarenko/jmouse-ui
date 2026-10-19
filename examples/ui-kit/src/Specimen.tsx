import type { ReactNode } from "react"
import { Code, Disclosure } from "@jmouse/ui-kit"

export interface SpecimenProperties {
  id: string
  title: string
  /** What the component is for and the rule it keeps — written for whoever composes the next screen. */
  summary: ReactNode
  /** How it is written; shown folded under the live specimen. */
  usage?: string
  layout?: "row" | "grid" | "column"
  flush?: boolean
  height?: "tall"
  children: ReactNode
}

/** One entry of the reference: the component live, what it is for, and how it is written. */
export function Specimen({ id, title, summary, usage, layout = "row", flush, height, children }: SpecimenProperties) {
  return (
    <section id={id} className="showcase-specimen" aria-labelledby={`${id}-title`}>
      <header className="showcase-specimen-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{summary}</p>
      </header>
      <div className="showcase-stage" data-layout={layout === "row" ? undefined : layout} data-flush={flush ? "" : undefined} data-height={height}>
        {children}
      </div>
      {usage && (
        <Disclosure title="Usage">
          <Code code={usage.trim()} label={`${title} usage`} />
        </Disclosure>
      )}
    </section>
  )
}

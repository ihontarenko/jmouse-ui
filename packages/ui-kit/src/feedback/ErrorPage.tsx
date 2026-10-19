import { Component, type ErrorInfo, type ReactNode } from "react"
import { Disclosure } from "../containers/Panel"
import { Code } from "../data/Values"
import { Icon } from "../icons/Icon"
import type { IconSource } from "../icons/Icon"

/** Why a whole place cannot be shown. Each has its own words, icon and tone, so the cause is never a guess. */
export type ErrorKind = "not-found" | "forbidden" | "failed" | "offline" | "unavailable"

const kinds: Record<ErrorKind, { code: string; icon: IconSource; tone?: "danger" | "warn"; title: string; description: string }> = {
  "not-found": { code: "404", icon: "search", title: "Nothing lives at this address", description: "It was moved, deleted, or the address is mistyped." },
  forbidden: { code: "403", icon: "lock", tone: "warn", title: "You cannot open this", description: "Your account does not have access. Ask its owner to grant it." },
  failed: { code: "Error", icon: "danger", tone: "danger", title: "Something broke while showing this", description: "The page failed on our side. Reload it; if it fails again, the detail below helps whoever fixes it." },
  offline: { code: "Offline", icon: "activity", tone: "warn", title: "You are offline", description: "This needs the network. It reloads by itself once the connection is back." },
  unavailable: { code: "503", icon: "database", tone: "warn", title: "The server is not answering", description: "It may be starting or under maintenance. Try again in a moment." },
}

export interface ErrorPageProperties {
  kind: ErrorKind
  /** Replaces the kind's own words when the product knows more — "This part was deleted on 2 October". */
  title?: ReactNode
  description?: ReactNode
  /** The way out: go back, go home, reload, ask for access. */
  actions?: ReactNode
  /** The technical detail — a message, a stack, a request id — folded away under its own heading. */
  detail?: string
  detailLabel?: string
}

/** A whole page that cannot be shown: what happened, why, and the way out. Never a blank screen, never a spinner forever. */
export function ErrorPage({ kind, title, description, actions, detail, detailLabel = "Technical detail" }: ErrorPageProperties) {
  const known = kinds[kind]
  return (
    <section className="kit-error-page" data-tone={known.tone} role={kind === "failed" ? "alert" : undefined}>
      <span className="kit-error-page-code">
        <Icon name={known.icon} />
        {known.code}
      </span>
      <h1>{title ?? known.title}</h1>
      <p>{description ?? known.description}</p>
      {actions && <div className="kit-panel-actions">{actions}</div>}
      {detail && (
        <Disclosure title={detailLabel} className="kit-error-page-detail">
          <Code code={detail} label={detailLabel} />
        </Disclosure>
      )}
    </section>
  )
}

export interface ErrorBoundaryProperties {
  /** What to draw instead of the part that threw; `reset` renders it again. */
  fallback(error: Error, reset: () => void): ReactNode
  /** Report the failure — to the console, to a log endpoint. */
  onError?(error: Error, information: ErrorInfo): void
  children: ReactNode
}

/**
 * Catches a render failure below it and draws the fallback instead of an empty page. React offers this only as a class
 * component; it is the one class in the kit.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProperties, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, information: ErrorInfo) {
    this.props.onError?.(error, information)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset)
    }
    return this.props.children
  }
}

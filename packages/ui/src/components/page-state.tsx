"use client"

import * as React from "react"
import { Lock, TriangleAlert } from "lucide-react"

import { cn } from "../lib/helpers"
import { Button } from "./button"
import { Skeleton } from "./skeleton"

/**
 * What a list shows when it is not showing rows.
 *
 * <h2>⚠️ Four states, because an empty table tells three different lies</h2>
 *
 * <p>*Still loading*, *there is genuinely nothing here*, *the request failed* and *you may not see
 * this* are four different facts about a screen, and in a query result they look almost identical —
 * `data` is undefined or an empty array in all but one. A list that renders "Nothing found" for all of
 * them sends somebody to check their filters when the server returned 502, and sends an administrator
 * looking for missing data when what is missing is a permission.
 *
 * <p>⚠️ **`forbidden` names the permission and where to get it.** A refusal that says only "no access"
 * is a dead end: the person cannot act on it, and the administrator they eventually ask cannot either,
 * because nobody wrote down which right was wanted.
 *
 * <p>⚠️ **`error` prints the server's own sentence.** The backend answers `ProblemDetail` with text
 * written for a person; replacing it with "Something went wrong" throws away the only part of the
 * answer that could have helped.
 */

export type PageStateKind = "loading" | "empty" | "error" | "forbidden"

export interface PageStateAction {
  label: string
  onClick?: () => void
  href?: string
  primary?: boolean
}

export interface PageStateProperties {
  kind: PageStateKind
  /** The heading. Omitted for `loading`, which has nothing to say yet. */
  title?: string
  /** A sentence under it — for `error`, the server's own `detail`. */
  text?: string
  /** For `forbidden`: the permission wanted, printed verbatim so it can be searched for. */
  permission?: string
  icon?: React.ReactNode
  actions?: PageStateAction[]
  /** How many skeleton rows `loading` draws. Match the page's usual density. */
  rows?: number
  className?: string
}

export function PageState({
  kind,
  title,
  text,
  permission,
  icon,
  actions = [],
  rows = 8,
  className,
}: PageStateProperties) {
  if (kind === "loading") {
    return (
      <div className={cn("flex flex-col gap-2 p-3", className)} aria-busy="true" aria-live="polite">
        {/*
          ⚠️ Uneven widths on purpose. Equal bars read as a rendered table with blank content — which
          is the one thing a loading state must not be mistaken for.
        */}
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-6" style={{ width: `${[92, 71, 84, 63, 88, 58, 77, 69][index % 8]}%` }} />
        ))}
      </div>
    )
  }

  const shown = icon ?? defaultIconOf(kind)

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-6 py-12 text-center",
        kind === "error" && "text-destructive",
        className,
      )}
      role={kind === "error" ? "alert" : undefined}
    >
      {shown && <div className="text-muted-foreground [&_svg]:size-6">{shown}</div>}

      {title && <p className="text-[13px] font-semibold">{title}</p>}

      {text && <p className="text-muted-foreground max-w-md text-[12.5px] leading-relaxed">{text}</p>}

      {permission && (
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          This needs <code className="text-foreground font-mono text-[12px]">{permission}</code>.
        </p>
      )}

      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {actions.map((action) =>
            action.href ? (
              <Button key={action.label} asChild size="sm" variant={action.primary ? "default" : "outline"}>
                <a href={action.href}>{action.label}</a>
              </Button>
            ) : (
              <Button
                key={action.label}
                size="sm"
                variant={action.primary ? "default" : "outline"}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

function defaultIconOf(kind: PageStateKind): React.ReactNode {
  if (kind === "error") {
    return <TriangleAlert aria-hidden="true" />
  }
  if (kind === "forbidden") {
    return <Lock aria-hidden="true" />
  }
  return null
}

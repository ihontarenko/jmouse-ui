import type { ReactNode } from "react"
import { Button, IconButton } from "../controls/Button"

export interface PaginationProperties {
  /** One-based. */
  page: number
  pageCount: number
  onPageChange(page: number): void
  /** What the list holds — "1–50 of 1 204 parts". */
  summary?: ReactNode
  label?: string
  previousLabel?: string
  nextLabel?: string
  pageLabel?(page: number): string
}

/** The pages to print: the first, the last, and the current one with its neighbours; a gap stands for the rest. */
export function visiblePages(page: number, pageCount: number): Array<number | "gap"> {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((candidate) => candidate >= 1 && candidate <= pageCount))
  const sorted = Array.from(pages).sort((first, second) => first - second)
  const result: Array<number | "gap"> = []
  for (const candidate of sorted) {
    const previous = result[result.length - 1]
    if (typeof previous === "number" && candidate - previous > 1) {
      result.push("gap")
    }
    result.push(candidate)
  }
  return result
}

/** A list's foot: what it holds, and the way through its pages. */
export function Pagination({ page, pageCount, onPageChange, summary, label = "Pages", previousLabel = "Previous page", nextLabel = "Next page", pageLabel = (number) => `Page ${number}` }: PaginationProperties) {
  return (
    <nav className="kit-pagination" aria-label={label}>
      {summary && <span>{summary}</span>}
      <span className="kit-pagination-pages">
        <IconButton icon="chevron-left" label={previousLabel} size="small" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
        {visiblePages(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="kit-pagination-gap" aria-hidden="true">…</span>
          ) : (
            <Button key={entry} size="small" variant="quiet" aria-label={pageLabel(entry)} aria-current={entry === page ? "page" : undefined} onClick={() => onPageChange(entry)}>
              {entry}
            </Button>
          ),
        )}
        <IconButton icon="chevron-right" label={nextLabel} size="small" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} />
      </span>
    </nav>
  )
}

export interface PagerProperties {
  /** ZERO-based, as Innoventa's listings page. */
  page: number
  totalPages: number
  totalElements?: number
  onChange(page: number): void
  previousLabel?: string
  nextLabel?: string
  describe?(page: number, totalPages: number, totalElements?: number): string
}

/**
 * Innoventa's pager: previous, where you are, next. ⚠️ Draws NOTHING on a single page — a pager with nowhere to go is a
 * control the reader has to try to understand. The numbered strip is {@link Pagination}.
 */
export function Pager({ page, totalPages, totalElements, onChange, previousLabel = "Previous", nextLabel = "Next", describe = (current, total, elements) => `page ${current + 1} of ${total}${elements === undefined ? "" : ` · ${elements} in all`}` }: PagerProperties) {
  if (totalPages <= 1) {
    return null
  }
  return (
    <nav className="kit-pager" aria-label="Pages">
      <Button size="small" disabled={page === 0} onClick={() => onChange(page - 1)}>{previousLabel}</Button>
      <span className="kit-micro-label">{describe(page, totalPages, totalElements)}</span>
      <Button size="small" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>{nextLabel}</Button>
    </nav>
  )
}

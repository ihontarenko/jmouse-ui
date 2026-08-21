import type { ReactNode } from "react"
import { cn } from "../lib/helpers"

/**
 * The shape a list of *things you act on* takes across every product on this render layer.
 *
 * ⚠️ **Not a table, and the difference is what it is for.** A table is for comparing a column down a
 * page — which grant is bigger, which event is later. This is for a list whose rows are each one
 * subject: a member, a module, a connected client, a menu item. Those rows carry a name, a mark and a
 * control, in that order, and forcing them into columns gives three of the four a heading nobody reads.
 *
 * ⚠️ **Two paints, one behaviour.** `flat` is rows on a tinted ground with hairline gaps, the eye
 * running down a column of names. `carded` gives each row its own border — right where a row has a
 * second line under it, because a description on a tinted ground reads as a row of its own. Whichever a
 * caller picks, the parts and the order are the same, so two lists on two screens are two lists rather
 * than two designs.
 *
 * ⚠️ **The trailing control appears on hover and stays for the keyboard.** A remove that is always
 * visible turns a list of names into a list of buttons; one that vanishes under `focus-visible` is a
 * control nobody tabbing can reach.
 */

export type RowListVariant = "flat" | "carded"

/**
 * A named run of rows, with the tally on the far right.
 *
 * ⚠️ **The tally is the heading's other half.** "Children" says what the group is; "3 of 3 done" says
 * whether it needs anything — and that second question is the one somebody scanning a screen actually
 * has. A group heading without one is a label.
 */
export function RowGroup({
  label,
  tally,
  action,
  children,
  className,
}: {
  label?: ReactNode
  /** Right-aligned, quiet, and about the whole group — a count, a state, "6 of 6 done". */
  tally?: ReactNode
  /** One control for the group, beside the tally. */
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      {/* ⚠️ The label is the one thing allowed to shrink. Callers pass ancestry paths here — a
          Locations group is labelled `Lab / Cabinet A / Drawer 3` inside a 22rem aside — and without
          `min-w-0 truncate` on it and `shrink-0` on the tally, a long one wraps to three lines and
          shoves the count against the panel edge. */}
      {(label || tally || action) && (
        <div className="flex items-center gap-2 px-0.5">
          {label && (
            <span className="min-w-0 truncate text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {label}
            </span>
          )}
          {tally && <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{tally}</span>}
          {action && <span className={cn("shrink-0", !tally && "ml-auto")}>{action}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

export function RowList({
  variant = "flat",
  children,
  className,
}: {
  variant?: RowListVariant
  children: ReactNode
  className?: string
}) {
  return <div className={cn("flex flex-col", variant === "flat" ? "gap-1" : "gap-1.5", className)}>{children}</div>
}

/**
 * One row.
 *
 * @param onOpen makes the whole row the target. ⚠️ A row that opens something is a `button`, not a
 *               `div` with a click handler — otherwise it is unreachable by keyboard and silent to a
 *               screen reader, and it looks identical either way.
 * @param tone   `muted` for a row that is over — a revoked connection, an ended trial. Struck through
 *               rather than removed, because *it happened* is the thing the list is recording.
 */
export function Row({
  variant = "flat",
  tone,
  onOpen,
  leading,
  trailing,
  children,
  className,
}: {
  variant?: RowListVariant
  tone?: "muted" | "danger"
  onOpen?: () => void
  /** A glyph or a key chip before the name — the thing the eye lands on first. */
  leading?: ReactNode
  /** Marks and controls, right-aligned. Wrap a control in {@link RowAction} to have it appear on hover. */
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) {
  /**
   * ⚠️ **The row is never itself the button, even when the whole row opens something.** The trailing slot
   * routinely holds a control — a remove, a switch, a disconnect — and a `<button>` inside a `<button>` is
   * invalid HTML: React says so, and the browser silently reparents it, which breaks both.
   *
   * So the *body* is the target and the trailing controls are its siblings. The paint sits on the wrapper,
   * so the whole row still lights up as one thing.
   */
  const body = (
    <>
      {/* ⚠️ `gap-2` on the leading slot, not left to the caller. Two children there — a glyph and a key
          — is the ordinary case, and without it they run together as `🗂CATEGORY`. */}
      {leading && <span className="flex shrink-0 items-center gap-2 text-muted-foreground">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
    </>
  )

  return (
    <div
      className={cn(
        "group/row flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors",
        variant === "flat" ? "bg-muted/40" : "border",
        onOpen && "hover:bg-accent",
        tone === "muted" && "opacity-60",
        tone === "danger" && "border-l-2 border-l-destructive bg-destructive/10",
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left focus-visible:outline-none"
        >
          {body}
        </button>
      ) : (
        body
      )}

      {trailing && <span className="flex shrink-0 items-center gap-1.5">{trailing}</span>}
    </div>
  )
}

/** The identifier a row is quoted by — `TSSR-79`, `storage-byte`, `entry:write`. */
export function RowKey({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("shrink-0 font-mono text-[11px] text-muted-foreground", className)}>{children}</span>
}

/** The row's name. One line, truncated — a list where one row is three lines tall stops being a list. */
export function RowTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("truncate text-sm", className)}>{children}</span>
}

/** The second line: what the row is, why it is refused, when it last acted. */
export function RowMeta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("truncate text-[11px] text-muted-foreground", className)}>{children}</span>
}

/**
 * A control that appears when the row is under the pointer.
 *
 * ⚠️ **`focus-within` as well as `hover`**, or the keyboard cannot reach it — and `opacity` rather than
 * `hidden`, so the row does not change width when the pointer crosses it.
 */
export function RowAction({ children }: { children: ReactNode }) {
  return (
    <span className="opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
      {children}
    </span>
  )
}

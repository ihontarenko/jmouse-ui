import * as React from "react"

import { cn } from "../lib/helpers"
import { Badge } from "./badge"
import { Input } from "./input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./sheet"

/** One choice in the panel. */
export interface FilterItem {
  key: string
  /** A glyph or an emoji the customer chose. Absent draws nothing rather than a placeholder. */
  icon?: string | null
  label: string
  count?: number
  /** A heading above this row, opening a group. Absent continues the one above. */
  dividerLabel?: string
  /** Depth in a tree — indents the row. ⚠️ Leading spaces in a label would only collapse. */
  depth?: number
}

export interface FilterPanelProperties {
  title: string
  items: FilterItem[]
  activeKey: string | null
  onSelect: (key: string | null) => void
  allLabel?: string
  allIcon?: string
  allCount?: number
  searchable?: boolean
  searchPlaceholder?: string
  footer?: React.ReactNode
  /**
   * ⚠️ **The negative margins that join the divider to the header above and the frame below.**
   * A shell whose content wrapper is `flex-col gap-4 p-4` — which all three products' are — leaves a
   * column starting 1rem below the page header's rule and stopping 1rem above the bottom of the frame,
   * drawing a vertical line joined to nothing at either end. That reads as a rendering fault rather
   * than as a column divider. A shell laid out differently passes `false` and spaces the column itself.
   */
  bleed?: boolean
  className?: string
}

/**
 * The column a content screen narrows itself with.
 *
 * ⚠️ **The same column shape every other screen already uses** — access control, settings, the audit
 * log — all put their choices in a left column and the answer on the right. A filter panel that looked
 * like a fifth thing would be a fifth thing to learn.
 *
 * ⚠️ **Single-select, and `null` is a real choice.** "All" is not the absence of a filter, it is the
 * filter that includes everything — which is why it is a row like the others and carries its own count.
 * A panel where clearing means clicking the active row again is a panel nobody clears.
 *
 * ⚠️ **A count per row, always.** The question a category list answers is *where are the things*, and a
 * list of names without numbers answers it only after somebody has clicked each one.
 *
 * ⚠️ **Below `lg` the column is not a column — it is a bar and a bottom sheet, and the panel arranges
 * that itself.** Stacked above the content, forty categories are a screenful of chrome somebody has to
 * scroll past to reach the thing they came for, on the width where scrolling costs most. The bar states
 * what is currently narrowing the list, so a filter left on is never invisible, and opening it hands the
 * choices back within thumb reach. A caller passes nothing extra for this: one component, two shapes.
 *
 * ⚠️ **CSS decides which shape, not a media-query hook.** Both are rendered and one is hidden, so there
 * is no first paint at the wrong width and no resize listener to get wrong.
 *
 * ⚠️ **Chips are the small case.** Under about six flat choices this is three hundred pixels of chrome
 * for one line of meaning. Reach for the panel where the choices are a **catalogue**: they are many,
 * they are named by the customer, and they carry counts.
 */
export function FilterPanel({
  title,
  items,
  activeKey,
  onSelect,
  allLabel = "All",
  allIcon = "☰",
  allCount,
  searchable = false,
  searchPlaceholder = "Filter…",
  footer,
  bleed = true,
  className,
}: FilterPanelProperties) {
  const [query, setQuery] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)

  const needle = query.trim().toLowerCase()
  const visible = searchable && needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items

  const activeItem = items.find((item) => item.key === activeKey)
  const activeLabel = activeItem?.label ?? allLabel
  const activeCount = activeItem ? activeItem.count : allCount

  const search = searchable ? (
    <Input
      className="h-8 text-sm"
      value={query}
      placeholder={searchPlaceholder}
      onChange={(event) => setQuery(event.target.value)}
    />
  ) : null

  const list = (
    <FilterList
      title={title}
      items={visible}
      query={query}
      activeKey={activeKey}
      allLabel={allLabel}
      allIcon={allIcon}
      allCount={allCount}
      onSelect={(key) => {
        onSelect(key)
        // ⚠️ Only the sheet closes on a choice, and only because it covers what it just filtered.
        // The column stays open — narrowing twice in a row is the ordinary case there.
        setIsOpen(false)
      }}
    />
  )

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col gap-2",
        bleed && "lg:-mt-4 lg:-mb-4 lg:py-4",
        "lg:border-r lg:pr-3",
        className,
      )}
    >
      {/* ── Below `lg`: one line that says what is narrowing the list, and opens the choices ── */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm hover:bg-accent/50 lg:hidden"
      >
        <span aria-hidden="true" className="shrink-0">
          {activeItem?.icon ?? allIcon}
        </span>
        <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{title}</span>
        <span className="truncate font-medium">{activeLabel}</span>
        {activeCount !== undefined && (
          <Badge variant="outline" className="ml-auto font-mono text-[10px] text-current">
            {activeCount}
          </Badge>
        )}
      </button>

      {/* ── `lg` and up: the column itself ────────────────────────────────────────────────── */}
      {/* ⚠️ `min-h-0` rather than a `max-h-[calc(100vh-…)]`: the magic number was a guess at
          everything above the panel, wrong the moment a header wrapped to two lines, and it capped
          the column short of the row even when it was right. The grid row already knows its own
          height — stretching into it and scrolling inside is the answer that cannot drift. */}
      <div className="hidden min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 lg:flex">
        <span className="px-0.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {title}
        </span>
        {search}
        {list}
        {footer}
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {/* ⚠️ Dismissible on a tap outside, unlike every other sheet in these products — this one
            holds a choice rather than an answer, and there is nothing here to lose. */}
        <SheetContent
          side="bottom"
          dismissOnOutsideClick
          className="max-h-[72dvh] gap-0 rounded-t-lg pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {title}
            </SheetTitle>
            <SheetDescription className="sr-only">Narrow the list to one {title.toLowerCase()}.</SheetDescription>
            {search}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {list}
            {footer}
          </div>
        </SheetContent>
      </Sheet>
    </aside>
  )
}

function FilterList({
  title,
  items,
  query,
  activeKey,
  allLabel,
  allIcon,
  allCount,
  onSelect,
}: {
  title: string
  items: FilterItem[]
  query: string
  activeKey: string | null
  allLabel: string
  allIcon: string
  allCount?: number
  onSelect: (key: string | null) => void
}) {
  return (
    <div role="listbox" aria-label={title} className="flex flex-col gap-0.5">
      <FilterRow
        label={allLabel}
        icon={allIcon}
        count={allCount}
        active={activeKey === null}
        onSelect={() => onSelect(null)}
      />

      {items.map((item) => (
        <div key={item.key}>
          {item.dividerLabel && (
            <div className="mt-3 mb-1 px-2 text-[10px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">
              {item.dividerLabel}
            </div>
          )}
          <FilterRow
            label={item.label}
            icon={item.icon}
            count={item.count}
            depth={item.depth}
            active={activeKey === item.key}
            onSelect={() => onSelect(item.key)}
          />
        </div>
      ))}

      {/* ⚠️ Only when something was actually typed. A panel whose facets have not arrived yet — or a
          screen with no facets at all — is not a failed search, and “Nothing matches ””” under an
          empty box reads as one. */}
      {items.length === 0 && query.trim() !== "" && (
        <p className="px-2 py-3 text-[11px] text-muted-foreground">Nothing matches “{query}”.</p>
      )}
    </div>
  )
}

function FilterRow({
  label,
  icon,
  count,
  depth = 0,
  active,
  onSelect,
}: {
  label: string
  icon?: string | null
  count?: number
  depth?: number
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      style={depth > 0 ? { paddingLeft: `${8 + depth * 12}px` } : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent/50",
      )}
    >
      {/* ⚠️ A fixed width whether or not there is a glyph, so a list where half the categories chose an
          emoji does not read as two lists with different left edges. */}
      <span aria-hidden="true" className="w-4 shrink-0 text-center">
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <Badge variant="outline" className="ml-auto font-mono text-[10px] text-current">
          {count}
        </Badge>
      )}
    </button>
  )
}

import { useMemo, useState, type ReactNode } from "react"
import { Count } from "../controls/Text"
import { Icon, type IconSource } from "../icons/Icon"
import { RowMenu, type MenuEntry } from "../navigation/Menu"

/*
 * A folder tree as a rail — Innoventa's `TreeRail`, same names and properties. The nodes arrive FLAT, in display order,
 * each with its depth (a nested set's natural output); a node is a parent when the next one is deeper.
 */

export interface TreeRailNode {
  id: string
  label: string
  depth: number
  count?: number
  glyph?: string
  icon?: IconSource
  /** Drawn instead of the glyph — a folder's own mark. */
  mark?: ReactNode
}

export interface TreeRailProperties {
  nodes: TreeRailNode[]
  activeId?: string
  /** `undefined` is the "all" row. */
  onSelect(id: string | undefined): void
  all?: { label: string; count?: number }
  /** A node's own menu, revealed on hover and focus (always on touch). */
  actions?(node: TreeRailNode): MenuEntry[]
  label?: string
  footer?: ReactNode
  emptyText?: string
}

export function TreeRail({ nodes, activeId, onSelect, all, actions, label, footer, emptyText = "No folders yet." }: TreeRailProperties) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())

  const parents = useMemo(() => {
    const withChildren = new Set<string>()
    nodes.forEach((node, index) => {
      const next = nodes[index + 1]
      if (next !== undefined && next.depth > node.depth) {
        withChildren.add(node.id)
      }
    })
    return withChildren
  }, [nodes])

  const shown = useMemo(() => {
    const visible: TreeRailNode[] = []
    let foldedAt: number | undefined
    for (const node of nodes) {
      if (foldedAt !== undefined && node.depth > foldedAt) {
        continue
      }
      foldedAt = undefined
      visible.push(node)
      if (collapsedIds.has(node.id)) {
        foldedAt = node.depth
      }
    }
    return visible
  }, [nodes, collapsedIds])

  const fold = (nodeId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  return (
    <div className="kit-tree-rail">
      {label === undefined ? null : (
        <div className="kit-facet-group-head">
          <span className="kit-micro-label">{label}</span>
          {all?.count === undefined ? null : <Count>{all.count}</Count>}
        </div>
      )}
      {all === undefined ? null : <TreeRailRow label={all.label} count={all.count} depth={0} glyph="▣" emphasised active={activeId === undefined} onSelect={() => onSelect(undefined)} />}
      {shown.map((node) => (
        <TreeRailRow
          key={node.id}
          label={node.label}
          count={node.count}
          depth={node.depth}
          glyph={node.glyph}
          icon={node.icon}
          mark={node.mark}
          active={node.id === activeId}
          folded={collapsedIds.has(node.id)}
          onFold={parents.has(node.id) ? () => fold(node.id) : undefined}
          onSelect={() => onSelect(node.id)}
          actions={actions?.(node)}
        />
      ))}
      {nodes.length === 0 ? <p className="kit-facet-nothing">{emptyText}</p> : null}
      {footer === undefined ? null : <div className="kit-tree-rail-footer">{footer}</div>}
    </div>
  )
}

interface TreeRailRowProperties {
  label: string
  count?: number
  depth: number
  glyph?: string
  icon?: IconSource
  mark?: ReactNode
  active?: boolean
  emphasised?: boolean
  folded?: boolean
  onFold?(): void
  onSelect(): void
  actions?: MenuEntry[]
}

/** The row is a button and its menu sits OUTSIDE it — a menu inside an activatable row would be a button in a button. */
function TreeRailRow({ label, count, depth, glyph, icon, mark, active = false, emphasised = false, folded = false, onFold, onSelect, actions }: TreeRailRowProperties) {
  return (
    <div className="kit-tree-rail-row" data-active={active ? "" : undefined}>
      <button type="button" aria-current={active ? "true" : undefined} onClick={onSelect} style={{ paddingLeft: `${depth * 12 + 12}px` }} data-empty={!emphasised && !count ? "" : undefined}>
        {onFold === undefined ? (
          <span aria-hidden="true" />
        ) : (
          <span
            role="button"
            tabIndex={-1}
            className="kit-tree-rail-twisty"
            aria-label={folded ? `Open ${label}` : `Close ${label}`}
            aria-expanded={!folded}
            onClick={(event) => {
              event.stopPropagation()
              onFold()
            }}
          >
            <Icon name={folded ? "chevron-right" : "chevron-down"} size="small" />
          </span>
        )}
        {mark !== undefined ? <span className="kit-tree-rail-mark">{mark}</span> : icon === undefined ? <span aria-hidden="true" className="kit-facet-glyph">{glyph ?? "·"}</span> : <Icon name={icon} size="small" />}
        <span className="kit-facet-link-label">{label}</span>
      </button>
      <span className="kit-tree-rail-end">
        <Count>{count ?? ""}</Count>
        {actions === undefined || actions.length === 0 ? null : <RowMenu label={`Options for ${label}`} items={actions} className="kit-tree-rail-menu" />}
      </span>
    </div>
  )
}

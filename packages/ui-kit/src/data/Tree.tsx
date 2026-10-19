import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Icon } from "../icons/Icon"
import type { IconSource } from "../icons/Icon"
import type { FileChange } from "../navigation/EditorTabs"

export interface TreeNode {
  id: string
  name: string
  icon?: IconSource
  /** Swaps the icon for its open form while the node is expanded — a folder. */
  expandedIcon?: IconSource
  /** Custom library glyph, shared with the listing and tabs. */
  glyph?: ReactNode
  fileType?: { letter: string; color: string }
  /** The icon's own colour — a source root, a test root, a module. */
  iconColor?: string
  /** Muted words after the name — a module, a count of matches. */
  hint?: string
  /** Right-aligned, in the data face — a size, a letter for what changed. */
  end?: ReactNode
  change?: FileChange
  children?: TreeNode[]
}

export interface TreeProperties {
  label: string
  nodes: TreeNode[]
  selectedId?: string
  onSelect?(id: string): void
  /** A double click or Enter — open the file. */
  onActivate?(id: string): void
  expandedIds?: string[]
  defaultExpandedIds?: string[]
  onExpandedChange?(ids: string[]): void
  /** Checkboxes on every row — the files of a commit. A folder is checked when all of its files are. */
  checkedIds?: string[]
  onCheckedChange?(ids: string[]): void
}

interface VisibleNode {
  node: TreeNode
  depth: number
  parentId: string | undefined
}

function flattenVisible(nodes: TreeNode[], expanded: Set<string>, depth = 0, parentId?: string, into: VisibleNode[] = []): VisibleNode[] {
  for (const node of nodes) {
    into.push({ node, depth, parentId })
    if (node.children && expanded.has(node.id)) {
      flattenVisible(node.children, expanded, depth + 1, node.id, into)
    }
  }
  return into
}

function leafIdsOf(node: TreeNode): string[] {
  if (!node.children || node.children.length === 0) {
    return [node.id]
  }
  return node.children.flatMap(leafIdsOf)
}

/**
 * A tree of files, folders or any nested things — the WAI-ARIA tree pattern: one tab stop, Up and Down through the
 * visible rows, Right opens or steps into a folder, Left closes or steps out, Home and End, Enter activates.
 */
export function Tree({ label, nodes, selectedId, onSelect, onActivate, expandedIds, defaultExpandedIds = [], onExpandedChange, checkedIds, onCheckedChange }: TreeProperties) {
  const [ownExpanded, setOwnExpanded] = useState<string[]>(defaultExpandedIds)
  const expanded = useMemo(() => new Set(expandedIds ?? ownExpanded), [expandedIds, ownExpanded])
  const visible = useMemo(() => flattenVisible(nodes, expanded), [nodes, expanded])
  const [focusedId, setFocusedId] = useState<string | undefined>(undefined)
  const checked = useMemo(() => new Set(checkedIds ?? []), [checkedIds])
  const treeReference = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (selectedId) {
      treeReference.current?.querySelector(`[data-node-id="${CSS.escape(selectedId)}"] > .kit-tree-row`)?.scrollIntoView({ block: "nearest" })
    }
  }, [selectedId])
  const tabStopId = [focusedId, selectedId].find((id) => id !== undefined && visible.some((entry) => entry.node.id === id)) ?? visible[0]?.node.id

  function setExpanded(id: string, open: boolean) {
    const next = new Set(expanded)
    if (open) {
      next.add(id)
    } else {
      next.delete(id)
    }
    const ids = Array.from(next)
    if (expandedIds === undefined) {
      setOwnExpanded(ids)
    }
    onExpandedChange?.(ids)
  }

  function focusNode(id: string, tree: HTMLElement) {
    setFocusedId(id)
    tree.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus()
  }

  function toggleChecked(node: TreeNode) {
    if (!onCheckedChange) {
      return
    }
    const leaves = leafIdsOf(node)
    const allChecked = leaves.every((id) => checked.has(id))
    const next = new Set(checked)
    for (const id of leaves) {
      if (allChecked) {
        next.delete(id)
      } else {
        next.add(id)
      }
    }
    onCheckedChange(Array.from(next))
  }

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const index = visible.findIndex((entry) => entry.node.id === tabStopId)
    const current = visible[index]
    if (!current) {
      return
    }
    const tree = event.currentTarget
    const hasChildren = Boolean(current.node.children?.length)
    const isOpen = expanded.has(current.node.id)
    let handled = true
    if (event.key === "ArrowDown") {
      const next = visible[index + 1]
      if (next) {
        focusNode(next.node.id, tree)
      }
    } else if (event.key === "ArrowUp") {
      const previous = visible[index - 1]
      if (previous) {
        focusNode(previous.node.id, tree)
      }
    } else if (event.key === "ArrowRight") {
      if (hasChildren && !isOpen) {
        setExpanded(current.node.id, true)
      } else if (hasChildren && isOpen) {
        focusNode(current.node.children![0].id, tree)
      }
    } else if (event.key === "ArrowLeft") {
      if (hasChildren && isOpen) {
        setExpanded(current.node.id, false)
      } else if (current.parentId) {
        focusNode(current.parentId, tree)
      }
    } else if (event.key === "Home") {
      focusNode(visible[0].node.id, tree)
    } else if (event.key === "End") {
      focusNode(visible[visible.length - 1].node.id, tree)
    } else if (event.key === "Enter") {
      onSelect?.(current.node.id)
      if (hasChildren && !onActivate) {
        setExpanded(current.node.id, !isOpen)
      } else {
        onActivate?.(current.node.id)
      }
    } else if (event.key === " ") {
      if (onCheckedChange) {
        toggleChecked(current.node)
      } else {
        onSelect?.(current.node.id)
      }
    } else {
      handled = false
    }
    if (handled) {
      event.preventDefault()
    }
  }

  function renderNodes(level: TreeNode[], depth: number): ReactNode {
    return level.map((node) => {
      const hasChildren = Boolean(node.children?.length)
      const isOpen = expanded.has(node.id)
      const leaves = onCheckedChange ? leafIdsOf(node) : []
      const checkedCount = leaves.filter((id) => checked.has(id)).length
      return (
        <li
          key={node.id}
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={hasChildren ? isOpen : undefined}
          aria-selected={node.id === selectedId}
          aria-checked={onCheckedChange ? (checkedCount === 0 ? false : checkedCount === leaves.length ? true : "mixed") : undefined}
          tabIndex={node.id === tabStopId ? 0 : -1}
          data-node-id={node.id}
          onFocus={(event) => {
            if (event.target === event.currentTarget) {
              setFocusedId(node.id)
            }
          }}
        >
          <div
            className="kit-tree-row"
            data-change={node.change}
            style={{ ["--kit-depth" as string]: depth }}
            onClick={() => {
              setFocusedId(node.id)
              onSelect?.(node.id)
            }}
            onDoubleClick={() => {
              if (hasChildren) {
                setExpanded(node.id, !isOpen)
              } else {
                onActivate?.(node.id)
              }
            }}
          >
            {hasChildren ? (
              <span
                className="kit-tree-twisty"
                aria-hidden="true"
                onClick={(event) => {
                  event.stopPropagation()
                  setExpanded(node.id, !isOpen)
                }}
              >
                <Icon name="chevron-right" />
              </span>
            ) : (
              <span className="kit-tree-twisty-space" />
            )}
            {onCheckedChange && (
              <input
                type="checkbox"
                className="kit-check"
                tabIndex={-1}
                aria-hidden="true"
                checked={checkedCount > 0 && checkedCount === leaves.length}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = checkedCount > 0 && checkedCount < leaves.length
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggleChecked(node)}
              />
            )}
            {node.glyph ? <span className="kit-tree-glyph" aria-hidden="true">{node.glyph}</span> : node.fileType ? (
              <span className="kit-file-type" style={{ ["--kit-file-type-color" as string]: node.fileType.color }} aria-hidden="true">{node.fileType.letter}</span>
            ) : (
              node.icon && <Icon name={isOpen && node.expandedIcon ? node.expandedIcon : node.icon} style={node.iconColor ? { ["--kit-tree-icon-color" as string]: node.iconColor } : undefined} />
            )}
            <span className="kit-tree-name">{node.name}</span>
            {node.hint && <span className="kit-tree-hint">{node.hint}</span>}
            {node.end !== undefined && <span className="kit-tree-end">{node.end}</span>}
          </div>
          {hasChildren && isOpen && (
            <ul role="group">{renderNodes(node.children!, depth + 1)}</ul>
          )}
        </li>
      )
    })
  }

  return (
    <ul ref={treeReference} className="kit-tree" role="tree" aria-label={label} aria-multiselectable={onCheckedChange ? true : undefined} onKeyDown={onKeyDown}>
      {renderNodes(nodes, 0)}
    </ul>
  )
}

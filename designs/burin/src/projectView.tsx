/*
 * How Burin's fixtures read on the kit: a kind's glyph, a project node as a tree node, the members around the caret.
 * Pure translation — nothing here draws chrome of its own.
 */
import { FileTypeGlyph, plainSourceLine, splitSourceLines, type TreeNode } from "@jmouse/ui-kit"
import { files, type FileKind, type NodeKind, type ProjectNode } from "./project"

/** Burin's file-type glyphs: a letter and a tint per kind (Html/Burin/styles/ide.css, .file-type). */
const glyphs: Record<FileKind, { letter: string; color: string; round?: boolean }> = {
  class: { letter: "C", color: "#4f86c6" },
  interface: { letter: "I", color: "#4f9a7a" },
  record: { letter: "R", color: "#8b6fc0" },
  enum: { letter: "E", color: "#b5964a" },
  test: { letter: "T", color: "#4c9a5b" },
  yaml: { letter: "Y", color: "#a05d8c" },
  xml: { letter: "X", color: "#5f7d9e" },
  md: { letter: "M", color: "#6b7381" },
  method: { letter: "m", color: "#c27a54", round: true },
  field: { letter: "f", color: "#8a6fb0", round: true },
}

export function glyphOf(kind: FileKind) {
  return glyphs[kind]
}

export function KindGlyph({ kind }: { kind: FileKind }) {
  const glyph = glyphs[kind]
  return <FileTypeGlyph letter={glyph.letter} color={glyph.color} round={glyph.round} />
}

export const fileName = (path: string) => path.split("/").pop() ?? path

const folderColors: Partial<Record<NodeKind, string>> = {
  source: "var(--kit-change-modified)",
  test: "var(--kit-change-added)",
  resources: "var(--kit-syntax-annotation)",
  module: "var(--kit-accent)",
}

/** A project node as the kit's tree node; its id is its path of names, so two "Lifecycle" folders stay apart. */
export function toTreeNode(node: ProjectNode, parentId = ""): TreeNode {
  const id = parentId ? `${parentId}/${node.name}` : node.name
  const base = { id, name: node.name, hint: node.hint, end: node.end, change: node.vcs }
  if (node.children) {
    if (node.kind === "package") {
      return { ...base, icon: "package", children: node.children.map((child) => toTreeNode(child, id)) }
    }
    return { ...base, icon: "folder", iconColor: folderColors[node.kind], children: node.children.map((child) => toTreeNode(child, id)) }
  }
  const kind = node.type ?? (node.file ? files[node.file].type : "md")
  const glyph = glyphs[kind]
  return { ...base, fileType: { letter: glyph.letter, color: glyph.color } }
}

/** Every node by its tree id — to answer "what was clicked" without walking the tree again. */
export function indexNodes(node: ProjectNode, parentId = "", into = new Map<string, ProjectNode>()): Map<string, ProjectNode> {
  const id = parentId ? `${parentId}/${node.name}` : node.name
  into.set(id, node)
  node.children?.forEach((child) => indexNodes(child, id, into))
  return into
}

/** The ids of the folders named in `names`, plus the root: the tree's first open state. */
export function expandedIdsOf(node: ProjectNode, names: Set<string>, parentId = "", into: string[] = []): string[] {
  const id = parentId ? `${parentId}/${node.name}` : node.name
  if (node.children && (parentId === "" || names.has(node.name))) {
    into.push(id)
  }
  node.children?.forEach((child) => expandedIdsOf(child, names, id, into))
  return into
}

/** The tree id of the node that opens `path`. */
export function treeIdOfFile(node: ProjectNode, path: string, parentId = ""): string | undefined {
  const id = parentId ? `${parentId}/${node.name}` : node.name
  if (node.file === path) {
    return id
  }
  for (const child of node.children ?? []) {
    const found = treeIdOfFile(child, path, id)
    if (found) {
      return found
    }
  }
  return undefined
}

export function ancestorIdsOf(id: string): string[] {
  const parts = id.split("/")
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"))
}

const controlWords = new Set(["if", "for", "while", "switch", "catch", "return", "new", "throw"])

export interface Member {
  name: string
  kind: FileKind
  line: number
}

/** The type, then the method the caret is inside — what the editor's breadcrumbs show (Burin's editor.js). */
export function enclosingMembers(path: string, line: number): Member[] {
  const file = files[path]
  const trail: Member[] = []
  if (file.language !== "java") {
    return trail
  }
  const lines = splitSourceLines(file.source).slice(0, line).map(plainSourceLine)
  const typeLine = lines.findIndex((text) => /\b(class|interface|record|enum)\s+\w+/.test(text))
  if (typeLine !== -1) {
    trail.push({ name: lines[typeLine].match(/\b(?:class|interface|record|enum)\s+(\w+)/)![1], kind: file.type, line: typeLine + 1 })
  }
  for (let index = lines.length - 1; index > typeLine; index--) {
    /* a member is declared at one level of indent, exactly */
    const match = lines[index].match(/^ {4}(?! )(?:(?:public|private|protected|static|final|default)\s+)*(?:<[^>]+>\s*)?[\w<>?,[\]]+(?:<[^>]*>)?\s+(\w+)\s*\(/)
    if (match && !controlWords.has(match[1])) {
      const closed = lines.slice(index + 1).some((text) => /^\s{4}\}\s*$/.test(text))
      if (!closed) {
        trail.push({ name: `${match[1]}()`, kind: "method", line: index + 1 })
      }
      break
    }
  }
  return trail
}

/** The fields and methods of the open file, for the Structure tool window. */
export function structureOf(path: string): ProjectNode {
  const file = files[path]
  const children: ProjectNode[] = []
  splitSourceLines(file.source).map(plainSourceLine).forEach((text, index) => {
    const field = text.match(/^\s{4}(?:private|public|protected)?\s*(?:static\s+)?(?:final\s+)?[\w<>?,\s]+\s+(\w+)(?:\s*=.*)?;$/)
    const method = text.match(/^\s{4}(?:public|private|protected|static|final|default|\s)*(?:<[^>]+>\s*)?([\w<>?,[\]]+)\s+(\w+)\s*\(([^)]*)\)/)
    if (method && !/^\s{4}(return|if|for)/.test(text)) {
      const parameters = method[3].split(",").map((parameter) => parameter.trim().split(/\s+/)[0]).filter(Boolean).join(", ")
      children.push({ name: `${method[2]}(${parameters})`, kind: "file", type: "method", end: method[1], hint: undefined, file: `#${index + 1}` })
    } else if (field) {
      children.push({ name: field[1], kind: "file", type: "field", file: `#${index + 1}` })
    }
  })
  return { name: fileName(path).replace(/\.\w+$/, ""), kind: "folder", children }
}

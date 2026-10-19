/*
 * jMouse UI-kit — syntax highlighting for a code view: Java, XML and YAML, ported from Burin (Html/Burin/scripts/syntax.js).
 *
 * highlightSource(source, language) → one array of segments per line. A block comment carries its state over line ends,
 * so a line is never highlighted out of its context. Nothing here builds HTML: a segment is data a component draws.
 *
 * Three markers in a source are drawn rather than highlighted, so a fixture stays plain text:
 *   ⟦name:⟧   an inlay hint (a parameter name, an inferred type)
 *   ⟨text⟩    text an inspection underlines with a warning
 *   ‸         the caret
 */

export type SyntaxRole =
  | "keyword" | "string" | "number" | "comment" | "doc" | "doc-tag" | "annotation" | "type" | "method" | "field"
  | "constant" | "tag" | "attribute" | "key" | "punctuation"

export type SyntaxSegment =
  | { kind: "text"; text: string; role?: SyntaxRole }
  | { kind: "inlay"; text: string }
  | { kind: "warning"; text: string }
  | { kind: "caret" }

export type SyntaxLanguage = "java" | "xml" | "yaml" | "plain"

const javaKeywords = new Set(
  ("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally " +
    "float for goto if implements import instanceof int interface long native new package private protected public record return " +
    "sealed permits non-sealed short static strictfp super switch synchronized this throw throws transient try var void volatile while yield " +
    "true false null").split(" "),
)

/** The markers are shared by every language, so they are matched first wherever a token could start. */
function readMarker(line: string, index: number): { length: number; segment: SyntaxSegment } | null {
  const character = line[index]
  if (character === "⟦") {
    const end = line.indexOf("⟧", index)
    return { length: end - index + 1, segment: { kind: "inlay", text: line.slice(index + 1, end) } }
  }
  if (character === "⟨") {
    const end = line.indexOf("⟩", index)
    return { length: end - index + 1, segment: { kind: "warning", text: line.slice(index + 1, end) } }
  }
  if (character === "‸") {
    return { length: 1, segment: { kind: "caret" } }
  }
  return null
}

/** Appends text, merging it into the previous segment when both carry the same role — fewer nodes to draw. */
function appendText(segments: SyntaxSegment[], text: string, role?: SyntaxRole) {
  if (!text) {
    return
  }
  const last = segments[segments.length - 1]
  if (last && last.kind === "text" && last.role === role) {
    last.text += text
    return
  }
  segments.push({ kind: "text", text, role })
}

function highlightJava(lines: string[]): SyntaxSegment[][] {
  let inComment = false
  let isDocumentation = false
  return lines.map((line) => {
    const segments: SyntaxSegment[] = []
    let index = 0
    while (index < line.length) {
      if (inComment) {
        const end = line.indexOf("*/", index)
        const stop = end === -1 ? line.length : end + 2
        const text = line.slice(index, stop)
        if (isDocumentation) {
          for (const part of text.split(/(@\w+)/)) {
            appendText(segments, part, part.startsWith("@") ? "doc-tag" : "doc")
          }
        } else {
          appendText(segments, text, "comment")
        }
        index = stop
        if (end !== -1) {
          inComment = false
        }
        continue
      }
      const marker = readMarker(line, index)
      if (marker) {
        segments.push(marker.segment)
        index += marker.length
        continue
      }
      const rest = line.slice(index)
      let match: RegExpMatchArray | null
      if (rest.startsWith("//")) {
        appendText(segments, rest, "comment")
        break
      }
      if (rest.startsWith("/*")) {
        inComment = true
        isDocumentation = rest.startsWith("/**")
        continue
      }
      if ((match = rest.match(/^"(?:[^"\\]|\\.)*"?/)) || (match = rest.match(/^'(?:[^'\\]|\\.)*'?/))) {
        appendText(segments, match[0], "string")
        index += match[0].length
        continue
      }
      if ((match = rest.match(/^@[A-Za-z_]\w*/))) {
        appendText(segments, match[0], "annotation")
        index += match[0].length
        continue
      }
      if ((match = rest.match(/^(?:0x[\da-fA-F_]+|\d[\d_]*(?:\.\d+)?[lLdDfF]?)\b/))) {
        appendText(segments, match[0], "number")
        index += match[0].length
        continue
      }
      if ((match = rest.match(/^[A-Za-z_$][\w$]*/))) {
        const word = match[0]
        const following = rest.slice(word.length)
        const previous = line.slice(0, index).trimEnd()
        let role: SyntaxRole | undefined
        if (javaKeywords.has(word)) {
          role = "keyword"
        } else if (/^[A-Z][A-Z0-9_]+$/.test(word) && word.length > 1) {
          role = "constant"
        } else if (/^\s*\(/.test(following)) {
          role = /^[A-Z]/.test(word) ? "type" : "method"
        } else if (/^[A-Z]/.test(word)) {
          role = "type"
        } else if (previous.endsWith("this.") || previous.endsWith("this .")) {
          role = "field"
        }
        appendText(segments, word, role)
        index += word.length
        continue
      }
      appendText(segments, line[index])
      index += 1
    }
    return segments
  })
}

function highlightXml(lines: string[]): SyntaxSegment[][] {
  let inComment = false
  return lines.map((line) => {
    const segments: SyntaxSegment[] = []
    let index = 0
    while (index < line.length) {
      if (inComment) {
        const end = line.indexOf("-->", index)
        const stop = end === -1 ? line.length : end + 3
        appendText(segments, line.slice(index, stop), "comment")
        index = stop
        inComment = end === -1
        continue
      }
      const marker = readMarker(line, index)
      if (marker) {
        segments.push(marker.segment)
        index += marker.length
        continue
      }
      const rest = line.slice(index)
      let match: RegExpMatchArray | null
      if (rest.startsWith("<!--")) {
        inComment = true
        continue
      }
      if ((match = rest.match(/^<\/?[\w:.-]+/))) {
        appendText(segments, match[0].startsWith("</") ? "</" : "<", "punctuation")
        appendText(segments, match[0].replace(/^<\/?/, ""), "tag")
        index += match[0].length
        continue
      }
      if ((match = rest.match(/^\/?>/))) {
        appendText(segments, match[0], "punctuation")
        index += match[0].length
        continue
      }
      if ((match = rest.match(/^([\w:.-]+)(=)("[^"]*")/))) {
        appendText(segments, match[1], "attribute")
        appendText(segments, match[2])
        appendText(segments, match[3], "string")
        index += match[0].length
        continue
      }
      if ((match = rest.match(/^\$\{[^}]+\}/))) {
        appendText(segments, match[0], "constant")
        index += match[0].length
        continue
      }
      appendText(segments, line[index])
      index += 1
    }
    return segments
  })
}

function highlightYaml(lines: string[]): SyntaxSegment[][] {
  return lines.map((line) => {
    const segments: SyntaxSegment[] = []
    let index = 0
    const keyMatch = line.match(/^(\s*-?\s*)([\w.-]+)(:)(?=\s|$)/)
    if (keyMatch) {
      appendText(segments, keyMatch[1])
      appendText(segments, keyMatch[2], "key")
      appendText(segments, keyMatch[3], "punctuation")
      index = keyMatch[0].length
    }
    while (index < line.length) {
      const marker = readMarker(line, index)
      if (marker) {
        segments.push(marker.segment)
        index += marker.length
        continue
      }
      const rest = line.slice(index)
      let match: RegExpMatchArray | null
      if (rest.startsWith("#") && (index === 0 || /\s/.test(line[index - 1]))) {
        appendText(segments, rest, "comment")
        break
      }
      if ((match = rest.match(/^"[^"]*"|^'[^']*'/))) {
        appendText(segments, match[0], "string")
        index += match[0].length
        continue
      }
      if ((match = rest.match(/^\$\{[^}]+\}/))) {
        appendText(segments, match[0], "constant")
        index += match[0].length
        continue
      }
      if ((match = rest.match(/^\b(?:true|false|null|on|off)\b/))) {
        appendText(segments, match[0], "keyword")
        index += match[0].length
        continue
      }
      if ((match = rest.match(/^\b\d+(?:\.\d+)?(?:ms|s|m|h|MB|KB)?\b/))) {
        appendText(segments, match[0], "number")
        index += match[0].length
        continue
      }
      appendText(segments, line[index])
      index += 1
    }
    return segments
  })
}

function highlightPlain(lines: string[]): SyntaxSegment[][] {
  return lines.map((line) => {
    const segments: SyntaxSegment[] = []
    let index = 0
    while (index < line.length) {
      const marker = readMarker(line, index)
      if (marker) {
        segments.push(marker.segment)
        index += marker.length
        continue
      }
      appendText(segments, line[index])
      index += 1
    }
    return segments
  })
}

const highlighters: Record<SyntaxLanguage, (lines: string[]) => SyntaxSegment[][]> = { java: highlightJava, xml: highlightXml, yaml: highlightYaml, plain: highlightPlain }

export function splitSourceLines(source: string): string[] {
  return source.replace(/\r\n/g, "\n").split("\n")
}

export function highlightSource(source: string, language: SyntaxLanguage): SyntaxSegment[][] {
  return highlighters[language](splitSourceLines(source))
}

/** The plain text of a source line, the markers removed: what a column count or a search should see. */
export function plainSourceLine(line: string): string {
  return line.replace(/⟦[^⟧]*⟧/g, "").replace(/[⟨⟩‸]/g, "")
}

export interface SourceSearchOptions {
  matchCase: boolean
  wholeWord: boolean
  regularExpression: boolean
}

/** One occurrence of a query: its 1-based line and its start and end in that line's plain text. */
export interface SourceMatch {
  line: number
  start: number
  end: number
}

/**
 * Every occurrence of a query in a source's plain text, in reading order. An invalid regular expression finds nothing
 * and says so through `invalid`, so the field can say it in words.
 */
export function findInSource(source: string, query: string, options: SourceSearchOptions): { matches: SourceMatch[]; invalid: boolean } {
  if (!query) {
    return { matches: [], invalid: false }
  }
  let expression: RegExp
  try {
    const pattern = options.regularExpression ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    expression = new RegExp(options.wholeWord ? `\\b(?:${pattern})\\b` : pattern, options.matchCase ? "g" : "gi")
  } catch {
    return { matches: [], invalid: true }
  }
  const matches: SourceMatch[] = []
  splitSourceLines(source).forEach((line, index) => {
    const text = plainSourceLine(line)
    expression.lastIndex = 0
    let found: RegExpExecArray | null
    while ((found = expression.exec(text)) !== null) {
      if (found[0].length === 0) {
        expression.lastIndex += 1
        continue
      }
      matches.push({ line: index + 1, start: found.index, end: found.index + found[0].length })
    }
  })
  return { matches, invalid: false }
}

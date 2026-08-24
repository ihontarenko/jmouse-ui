/**
 * A deliberately small YAML reader — enough for a document's frontmatter, and no more.
 *
 * <p>The documents this exists for are written by tooling rather than by hand: a skill file, an agent's
 * memory, a page exported from somewhere. They use scalars, one or two nested maps and short sequences.
 * A complete YAML implementation is around forty kilobytes, and this package is installed by every
 * interface in the workspace — so the whole of what those documents need is implemented here instead.
 *
 * <p>**Supported:** `key: value`, maps nested by indentation, `- item` sequences, `- key: value` maps
 * inside them, single- and double-quoted scalars, `#` comments, block scalars (`|` and `>`, with `-`
 * and `+` chomping), flow sequences `[a, b]`, and the scalar vocabulary `true` / `false` / `null` /
 * `~` / integers / floats.
 *
 * <p>⚠️ **Not supported, and deliberately never will be:** anchors and aliases, tags, multi-document
 * streams, flow mappings and complex keys. Anything this reader does not understand raises, and the
 * caller's answer to that is to leave the document alone — see `parseFrontmatter`. A page must never
 * fail to render because its metadata is malformed.
 */

export type YamlScalar = string | number | boolean | null;

export type YamlValue = YamlScalar | readonly YamlValue[] | YamlMapping;

export interface YamlMapping {
    readonly [key: string]: YamlValue;
}

/** Reads a whole document as one mapping. Raises on anything it cannot represent. */
export function readYamlMapping(source: string): YamlMapping {
    const reader = { lines: source.replace(/\r\n?/g, '\n').split('\n'), index: 0 };
    const first  = peek(reader);

    if (first === null) {
        return {};
    }

    const mapping = readMapping(reader, indentOf(first));

    if (peek(reader) !== null) {
        throw new Error(`Line ${reader.index + 1} is not part of the mapping.`);
    }

    return mapping;
}

/**
 * A cursor over the document's lines.
 *
 * <p>`lines` is mutable on purpose: a `- key: value` item is turned into an ordinary mapping line by
 * writing the dash away, which lets the mapping reader take it — continuation lines included — instead
 * of a second, near-identical reader existing for sequence items.
 */
interface Reader {
    readonly lines: string[];
    index: number;
}

// ── Structure ────────────────────────────────────────────────────────────────────

function readMapping(reader: Reader, indent: number): YamlMapping {
    const mapping: Record<string, YamlValue> = {};

    for (let line = peek(reader); line !== null; line = peek(reader)) {
        const column = indentOf(line);

        if (column < indent) {
            break;
        }

        if (column > indent) {
            throw new Error(`Unexpected indentation on line ${reader.index + 1}.`);
        }

        const pair = splitPair(line.slice(column));

        if (!pair) {
            throw new Error(`Line ${reader.index + 1} is not a "key: value" pair.`);
        }

        reader.index += 1;
        mapping[pair.key] = readValue(reader, indent, pair.rest);
    }

    return mapping;
}

function readSequence(reader: Reader, indent: number): YamlValue[] {
    const items: YamlValue[] = [];

    for (let line = peek(reader); line !== null; line = peek(reader)) {
        const column  = indentOf(line);
        const content = line.slice(column);

        if (column !== indent || !isSequenceItem(content)) {
            break;
        }

        const rest          = content.slice(1).trimStart();
        const contentColumn = column + (content.length - rest.length);

        if (rest === '') {
            reader.index += 1;
            items.push(readNested(reader, column));
            continue;
        }

        // `- key: value` opens a mapping whose own indentation starts where the key does. Rewriting the
        // dash into spaces hands it to the mapping reader exactly as if it had been written that way.
        if (splitPair(rest)) {
            reader.lines[reader.index] = ' '.repeat(contentColumn) + rest;
            items.push(readMapping(reader, contentColumn));
            continue;
        }

        reader.index += 1;
        items.push(readValue(reader, column, rest));
    }

    return items;
}

/** Whatever belongs to a key that carried no value of its own — a nested map, a sequence, or nothing. */
function readNested(reader: Reader, indent: number): YamlValue {
    const line = peek(reader);

    if (line === null) {
        return null;
    }

    const column  = indentOf(line);
    const content = line.slice(column);

    if (column < indent) {
        return null;
    }

    // A sequence may sit at its key's own indentation — the one place YAML lets a child start no
    // deeper than its parent, and the shape most people actually write.
    if (isSequenceItem(content)) {
        return readSequence(reader, column);
    }

    if (column === indent) {
        return null;
    }

    return readMapping(reader, column);
}

function readValue(reader: Reader, indent: number, rest: string): YamlValue {
    const blockScalar = /^([|>])([-+]?)[ \t]*(?:#.*)?$/.exec(rest);

    if (blockScalar) {
        return readBlockScalar(reader, indent, blockScalar[1] === '>', blockScalar[2]);
    }

    if (rest === '') {
        return readNested(reader, indent);
    }

    return readScalar(rest);
}

function readBlockScalar(reader: Reader, indent: number, folded: boolean, chomping: string): string {
    const collected: string[] = [];
    let base = -1;

    while (reader.index < reader.lines.length) {
        const line = reader.lines[reader.index];

        if (line.trim() === '') {
            collected.push('');
            reader.index += 1;
            continue;
        }

        const column = indentOf(line);

        if (column <= indent) {
            break;
        }

        if (base < 0) {
            base = column;
        }

        collected.push(line.slice(base));
        reader.index += 1;
    }

    while (collected.length > 0 && collected[collected.length - 1] === '') {
        collected.pop();
    }

    const text = folded ? foldLines(collected) : collected.join('\n');

    return chomping === '+' ? `${text}\n` : text;
}

/** A folded block joins its lines with a space; a blank line is the paragraph break it keeps. */
function foldLines(lines: readonly string[]): string {
    let text = '';

    for (const line of lines) {
        if (line === '') {
            text += '\n';
        } else if (text === '' || text.endsWith('\n')) {
            text += line;
        } else {
            text += ` ${line}`;
        }
    }

    return text;
}

// ── Scalars ──────────────────────────────────────────────────────────────────────

function readScalar(text: string): YamlValue {
    const value = stripComment(text).trim();

    if (value === '' || value === '~' || value.toLowerCase() === 'null') {
        return null;
    }

    if (value.startsWith('"') || value.startsWith("'")) {
        return unquote(value);
    }

    if (value.startsWith('[') && value.endsWith(']')) {
        return readFlowSequence(value.slice(1, -1));
    }

    const lowered = value.toLowerCase();

    if (lowered === 'true') {
        return true;
    }

    if (lowered === 'false') {
        return false;
    }

    // ⚠️ Only where the number survives the round trip. A long identifier written without quotes is a
    // string as far as anybody reading the page is concerned, and turning it into a float silently
    // changes its last digits.
    if (/^-?\d+$/.test(value) && Number.isSafeInteger(Number(value))) {
        return Number(value);
    }

    if (/^-?(?:\d+\.\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(value)) {
        return Number(value);
    }

    return value;
}

function readFlowSequence(inner: string): YamlValue[] {
    const parts: string[] = [];
    let quote: string | null = null;
    let depth = 0;
    let start = 0;

    for (let index = 0; index < inner.length; index += 1) {
        const character = inner[index];

        if (quote) {
            if (quote === '"' && character === '\\') {
                index += 1;
            } else if (character === quote) {
                quote = null;
            }
            continue;
        }

        if (character === '"' || character === "'") {
            quote = character;
        } else if (character === '[' || character === '{') {
            depth += 1;
        } else if (character === ']' || character === '}') {
            depth -= 1;
        } else if (character === ',' && depth === 0) {
            parts.push(inner.slice(start, index));
            start = index + 1;
        }
    }

    parts.push(inner.slice(start));

    return parts
        .filter((part) => part.trim() !== '')
        .map((part) => readScalar(part));
}

/** Drops a trailing `# comment`, which is only a comment when it is outside quotes and follows space. */
function stripComment(text: string): string {
    let quote: string | null = null;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];

        if (quote) {
            if (quote === '"' && character === '\\') {
                index += 1;
            } else if (character === quote) {
                quote = null;
            }
            continue;
        }

        if (character === '"' || character === "'") {
            quote = character;
            continue;
        }

        if (character === '#' && (index === 0 || /\s/.test(text[index - 1]))) {
            return text.slice(0, index);
        }
    }

    return text;
}

const ESCAPES: Readonly<Record<string, string>> = {
    n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '0': '\0', '\\': '\\', '"': '"', '/': '/',
};

function unquote(text: string): string {
    const quote = text[0];
    const body  = text.slice(1, -1);

    if (quote === "'") {
        return body.replace(/''/g, "'");
    }

    return body.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (whole, escape: string) => {
        if (escape[0] === 'u' || escape[0] === 'x') {
            return String.fromCodePoint(parseInt(escape.slice(1), 16));
        }
        return ESCAPES[escape] ?? whole;
    });
}

// ── Lines ────────────────────────────────────────────────────────────────────────

interface Pair {
    readonly key:  string;
    readonly rest: string;
}

function splitPair(text: string): Pair | null {
    if (text.startsWith('"') || text.startsWith("'")) {
        const closing = findClosingQuote(text);

        if (closing < 0 || text[closing + 1] !== ':') {
            return null;
        }

        return { key: unquote(text.slice(0, closing + 1)), rest: text.slice(closing + 2).trim() };
    }

    const colon = findSeparator(text);

    if (colon < 0) {
        return null;
    }

    const key = text.slice(0, colon).trim();

    return key === '' ? null : { key, rest: text.slice(colon + 1).trim() };
}

/**
 * The first colon that actually separates a key from a value — one followed by whitespace or by the
 * end of the line. Everything else is part of the value, which is what keeps `url: http://host/path`
 * and `description: over MCP: the tree` from being cut in the wrong place.
 */
function findSeparator(text: string): number {
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] !== ':') {
            continue;
        }

        const next = text[index + 1];

        if (next === undefined || next === ' ' || next === '\t') {
            return index;
        }
    }

    return -1;
}

function findClosingQuote(text: string): number {
    const quote = text[0];

    for (let index = 1; index < text.length; index += 1) {
        if (quote === '"' && text[index] === '\\') {
            index += 1;
            continue;
        }

        if (quote === "'" && text[index] === "'" && text[index + 1] === "'") {
            index += 1;
            continue;
        }

        if (text[index] === quote) {
            return index;
        }
    }

    return -1;
}

function isSequenceItem(content: string): boolean {
    return /^-(?:\s|$)/.test(content);
}

function indentOf(line: string): number {
    return line.length - line.trimStart().length;
}

/** The next line that carries something, skipping blanks and whole-line comments. */
function peek(reader: Reader): string | null {
    while (reader.index < reader.lines.length) {
        const line = reader.lines[reader.index];

        if (line.trim() === '' || /^\s*#/.test(line)) {
            reader.index += 1;
            continue;
        }

        return line;
    }

    return null;
}

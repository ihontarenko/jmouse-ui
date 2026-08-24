import type { YamlMapping } from './yaml';
import { readYamlMapping } from './yaml';

/**
 * A document's frontmatter: the `---` delimited YAML block a generated document opens with, holding
 * what the document *is* rather than what it says.
 *
 * <p>Every skill file and every agent memory in this workspace begins with one, and so do most static
 * site generators' pages. Read as prose it is worse than unstyled — CommonMark makes the opening `---`
 * a thematic break, the metadata lines a paragraph, and the closing `---` directly beneath them a
 * setext underline, so the least interesting lines in the document render as its largest heading.
 */
export interface Frontmatter {
    /** The parsed mapping, in the order the keys were written. */
    readonly data: YamlMapping;
    /** The document with the block removed — what a reader was meant to see. */
    readonly body: string;
    /** The block's own text, delimiters excluded. Kept so a host can show or re-save it verbatim. */
    readonly source: string;
}

/**
 * ⚠️ **Position zero is the whole definition.** A `---` fence further down a document is a thematic
 * break and a ` ```yaml ` fence is quoted code; neither is metadata, and treating either as metadata
 * would eat content somebody wrote on purpose. The optional group is what lets an empty block (`---`
 * immediately followed by `---`) match at all.
 */
const FRONTMATTER = /^---[ \t]*\r?\n((?:[\s\S]*?\r?\n)?)---[ \t]*(?:\r?\n|$)/;

/**
 * Reads the frontmatter a document opens with, or `null` when it opens with anything else — which is
 * most documents, and is not a failure.
 *
 * <p>⚠️ **A malformed block is also `null`.** The reader raises on syntax it cannot represent, and the
 * answer here is to hand the document back untouched rather than to propagate the error: a page must
 * never fail to render because its metadata is wrong. What the reader accepts is written down in
 * `yaml.ts`.
 *
 * <p>This is exported in its own right, because the parsed object is worth more than the card drawn
 * from it: `name` and `description` are what a host wants for a page title, a browser tab or a search
 * snippet, and re-typing them beside the document is how the two drift apart.
 */
export function parseFrontmatter(markdown: string): Frontmatter | null {
    // A byte-order mark ahead of the delimiter is invisible in every editor and would otherwise move
    // the block off position zero.
    const text  = (markdown ?? '').replace(/^\uFEFF/, '');
    const match = FRONTMATTER.exec(text);

    if (!match) {
        return null;
    }

    const source = match[1].replace(/\r?\n$/, '');

    try {
        return { data: readYamlMapping(source), body: text.slice(match[0].length), source };
    } catch {
        return null;
    }
}

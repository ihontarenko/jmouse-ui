/**
 * Splits a Markdown document into prose runs and plugin-claimed blocks.
 *
 * The parser knows two *shapes* and no names at all:
 *
 *     :::name argument            a `line` block — one whole line
 *     ;;;name … ;;;               a `fence` block — everything between the markers
 *
 * Which names exist is not compiled in here: the caller passes the set claimed by the registered
 * plugins, and a shape whose name nobody claims stays prose. That is what keeps the engine portable —
 * a document full of `:::part` reads as plain text in a product that has no parts plugin, rather than
 * as a broken block.
 *
 * Anything inside a fenced code block is left alone. Documentation that *describes* the syntax must be
 * able to show it without it being evaluated, which is the one case a naive line scan gets wrong.
 */

export type BlockShape = 'line' | 'fence';

/** A plugin's claim on one name in one shape. */
export interface SyntaxClaim {
    readonly shape: BlockShape;
    readonly name:  string;
}

export interface MarkdownBlock {
    readonly shape: BlockShape;
    readonly name:  string;
    /** A line block's argument, or a fence block's body. */
    readonly body:  string;
}

export type MarkdownSegment =
    | { readonly kind: 'prose'; readonly content: string }
    | { readonly kind: 'block'; readonly block: MarkdownBlock };

const LINE_PATTERN        = /^:::([a-zA-Z][\w-]*)[ \t]+(.+?)[ \t]*$/;
const FENCE_OPEN_PATTERN  = /^;;;([a-zA-Z][\w-]*)[ \t]*$/;
const FENCE_CLOSE_PATTERN = /^;;;[ \t]*$/;
const CODE_FENCE_PATTERN  = /^\s*(`{3,}|~{3,})/;

/** The identity of a claim, and the key a claimed set is looked up by. */
export function claimKey(shape: BlockShape, name: string): string {
    return `${shape}:${name}`;
}

/**
 * The identity of one block's *content*, used to deduplicate resolution: two `:::stock 0603 10k`
 * lines in one document are one lookup. Case-insensitive, matching how the backend matches.
 */
export function blockKey(block: MarkdownBlock): string {
    return `${block.shape}:${block.name}:${block.body.trim().toLowerCase()}`;
}

export function parseMarkdown(markdown: string, claimed: ReadonlySet<string>): MarkdownSegment[] {
    const segments:  MarkdownSegment[] = [];
    const proseLines: string[]         = [];

    let openCodeFence: string | null = null;
    let openBlockName: string | null = null;
    let blockLines:   string[]       = [];

    const flushProse = () => {
        if (proseLines.length > 0) {
            segments.push({ kind: 'prose', content: proseLines.join('\n') });
            proseLines.length = 0;
        }
    };

    const flushBlock = () => {
        if (openBlockName !== null) {
            segments.push({
                kind:  'block',
                block: { shape: 'fence', name: openBlockName, body: blockLines.join('\n') },
            });
            openBlockName = null;
            blockLines    = [];
        }
    };

    for (const line of (markdown ?? '').split('\n')) {
        // Inside a claimed fence everything is raw payload until its closing `;;;`.
        if (openBlockName !== null) {
            if (FENCE_CLOSE_PATTERN.test(line)) {
                flushBlock();
            } else {
                blockLines.push(line);
            }
            continue;
        }

        const codeFence = CODE_FENCE_PATTERN.exec(line);
        if (codeFence) {
            // A fence of the same character closes the block; anything else is just content.
            const marker = codeFence[1][0];
            if (openCodeFence === null) {
                openCodeFence = marker;
            } else if (openCodeFence === marker) {
                openCodeFence = null;
            }
            proseLines.push(line);
            continue;
        }

        if (openCodeFence === null) {
            const fenceOpen = FENCE_OPEN_PATTERN.exec(line);
            if (fenceOpen && claimed.has(claimKey('fence', fenceOpen[1]))) {
                flushProse();
                openBlockName = fenceOpen[1];
                continue;
            }

            const lineBlock = LINE_PATTERN.exec(line);
            if (lineBlock && claimed.has(claimKey('line', lineBlock[1]))) {
                flushProse();
                segments.push({
                    kind:  'block',
                    block: { shape: 'line', name: lineBlock[1], body: lineBlock[2] },
                });
                continue;
            }
        }

        proseLines.push(line);
    }

    // An unterminated fence still renders — half a diagram beats a document that stops at it.
    flushBlock();
    flushProse();
    return segments;
}

/** Every distinct block in a document, deduplicated so one lookup serves repeated blocks. */
export function collectBlocks(segments: readonly MarkdownSegment[]): MarkdownBlock[] {
    const seen = new Map<string, MarkdownBlock>();
    for (const segment of segments) {
        if (segment.kind === 'block') {
            seen.set(blockKey(segment.block), segment.block);
        }
    }
    return [...seen.values()];
}

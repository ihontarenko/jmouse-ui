import { parseFrontmatter } from './parseFrontmatter';

/**
 * Lifts a document's leading frontmatter out of the prose and into one node of its own.
 *
 * <p>⚠️ **It matches the SOURCE, not the tree.** CommonMark currently turns the block into a thematic
 * break followed by a setext heading; that is an accident of two rules meeting, not a shape worth
 * pattern-matching, and a different parser version could produce a different one. Reading the
 * delimiters off `file.value` at offset zero is stable against all of it, and the tree is only used to
 * find out which nodes the block swallowed.
 */

/**
 * The element the carrier node renders as.
 *
 * <p>A name nothing else can claim, on purpose: the library merges every plugin's element overrides
 * with `Object.assign`, so two plugins naming one element means the last one registered silently wins.
 * That has already happened here between the image plugin and a host's file renderer — a custom name
 * cannot join in.
 */
export const FRONTMATTER_ELEMENT = 'jm-frontmatter';

/** The attribute the parsed mapping travels in, as JSON. */
export const FRONTMATTER_PROPERTY = 'data-frontmatter';

/** Just enough of mdast to do the job, so the emitted types name no package this one does not depend on. */
interface SyntaxNode {
    type: string;
    position?: { start?: { offset?: number } };
    data?: Record<string, unknown>;
    children?: SyntaxNode[];
}

interface SyntaxTree extends SyntaxNode {
    children: SyntaxNode[];
}

interface SourceFile {
    value?: unknown;
}

/**
 * @param strip render nothing at all — the block is removed and the host reads it with
 *              `parseFrontmatter` instead of seeing a card.
 */
export function createRemarkFrontmatter(strip: boolean) {
    // ⚠️ `unknown` rather than the mdast types, and not out of laziness: a transformer that accepts
    // anything is assignable to unified's `Transformer` under `strictFunctionTypes`, while one that
    // narrows its own parameters is not. The narrowing happens here instead, where it costs nothing.
    return () => (tree: unknown, file: unknown) => {
        if (!isTree(tree)) {
            return;
        }

        const source = readSource(file);
        const matter = parseFrontmatter(source);

        if (!matter) {
            return;
        }

        // Where the document proper starts. Every node beginning before it belongs to the block, and
        // none of them spans it — the closing delimiter ends the setext heading it underlines.
        const boundary = source.length - matter.body.length;
        const rest     = tree.children.filter((node) => (node.position?.start?.offset ?? 0) >= boundary);

        tree.children = strip ? rest : [carrier(matter.data), ...rest];
    };
}

function isTree(value: unknown): value is SyntaxTree {
    return typeof value === 'object' && value !== null && Array.isArray((value as SyntaxTree).children);
}

function readSource(file: unknown): string {
    const value = (file as SourceFile | null)?.value;
    return typeof value === 'string' ? value : '';
}

/**
 * An empty paragraph wearing another element's name.
 *
 * <p>`hName` and `hProperties` are how mdast hands an element to hast, and a node type the pipeline
 * already knows is the well-trodden path through it — an invented type reaches an unknown-node
 * fallback whose behaviour is not part of anybody's contract.
 */
function carrier(data: unknown): SyntaxNode {
    return {
        type:     'paragraph',
        children: [],
        data:     {
            hName:       FRONTMATTER_ELEMENT,
            hProperties: { [FRONTMATTER_PROPERTY]: JSON.stringify(data) },
        },
    };
}

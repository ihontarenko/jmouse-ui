import { useMemo } from 'react';
import type { AnchorHTMLAttributes, ComponentType, CSSProperties, ReactNode } from 'react';
import type { Root } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';
import type { BlockDataStatus, MarkdownPlugin } from '../core';
import { useProseDataFor } from '../core';

/**
 * A reference to something in another system, written inside a sentence and drawn as a badge.
 *
 * ```md
 * Blocked on [TES-42](issue:9f3a21) until Friday.
 * ```
 *
 * <h2>What this is for</h2>
 *
 * <p>A document that names a ticket, a part or a build usually names it by whatever it was called the
 * day somebody typed it — and those names move. What does not move is an identifier the owning system
 * hands out, so a durable reference stores that and asks for the name **while the page is being read**.
 *
 * <p>Which means the words between the brackets are not the record: they are the fallback for a reader
 * whose plugin is not installed, or whose lookup failed. The renderer prints what the resolver said.
 *
 * <h2>⚠️ What this plugin does NOT know</h2>
 *
 * <p>What any of it means. It owns the *shape* — a scheme in a link destination, an optional pattern
 * that turns a bare token into one, a single batched lookup per document, one badge, and the rule that
 * an unresolved reference reads as ordinary prose. Which schemes exist, who answers them and what
 * decorates the chip are the host's, passed in.
 *
 * <h2>Why it is a plugin factory rather than two plugins in two products</h2>
 *
 * <p>Because it was two, and the halves that were identical were the subtle ones: the destination
 * parser, the batching, the sanitiser declaration, the fallback rule, and the chip. Every one of them
 * fails silently when it is slightly wrong, which is the worst kind of thing to keep two copies of.
 */

/** One reference, as written. */
export interface ReferenceToken {
    /** The part before the colon — `issue`, `part`. Always one of the plugin's own schemes, lowercased. */
    readonly scheme:   string;
    /** The part after it — a permanent identifier, or a name the owning system also accepts. */
    readonly argument: string;
}

/**
 * The key a resolved answer is filed under, and looked up by: `scheme:argument`.
 *
 * <p>⚠️ Exported because a host's resolver has to file its answers under the same string the renderer
 * asks with, and two functions agreeing by convention is one refactor away from not agreeing.
 */
export function referenceKey(token: ReferenceToken): string {
    return `${token.scheme}:${token.argument}`;
}

export interface ReferenceState<TData> {
    /** ⚠️ **Resolved answers only.** Anything absent renders as the words the document already carried. */
    readonly byKey:     ReadonlyMap<string, TData>;
    readonly status:    BlockDataStatus;
    /**
     * Why a token has no answer, by {@link referenceKey} — shown as the tooltip on those words.
     *
     * <p>⚠️ **A map rather than a message**, because the reasons are the host's: not found, no access,
     * that product is unreachable, this installation has nothing that answers it. A library sentence
     * covering all of them would say "something went wrong", which nobody can act on.
     */
    readonly refusals?: ReadonlyMap<string, string>;
}

export interface ReferenceRenderProperties<TData> {
    readonly token:    ReferenceToken;
    /** ⚠️ Always present — the library handles the unresolved case itself. */
    readonly data:     TData;
    /** The document's own words, for a host that wants them as a fallback label. */
    readonly children: ReactNode;
}

export interface ReferenceAutolink {
    /**
     * A bare token in prose that becomes a reference — an issue key, a part number.
     *
     * <p>⚠️ **A source string, not a `RegExp`.** A global regular expression carries `lastIndex`, and
     * one shared instance means a scan starting wherever the last render happened to stop. The plugin
     * builds a fresh one per pass.
     *
     * <p>⚠️ **Omit this where prose must stay prose.** Recognising a token by shape means this document
     * renderer knowing another system's vocabulary — right in that system's own interface, wrong in a
     * wiki that merely quotes it.
     */
    readonly pattern: string;
    /** Which scheme a matched token is minted with. Defaults to the first declared scheme. */
    readonly scheme?: string;
}

export interface ReferencePluginOptions<TData> {
    readonly name?:          string;
    /** The schemes this plugin owns, without colons. The first is what {@link ReferenceAutolink} mints. */
    readonly schemes:        readonly string[];
    /** Accepted but never written — an older spelling still sitting in stored documents. */
    readonly legacySchemes?: readonly string[];
    readonly autolink?:      ReferenceAutolink;
    /** Resolves every token one document mentions, in one batch. A hook: bring your own cache. */
    readonly useReferences:  (tokens: readonly ReferenceToken[]) => ReferenceState<TData>;
    /** Draws one **resolved** reference. */
    readonly render:         ComponentType<ReferenceRenderProperties<TData>>;
    /**
     * What an ordinary link renders as.
     *
     * <p>⚠️ **This exists because `a` can only have one owner.** The registry merges element overrides
     * with `Object.assign`, so two plugins claiming `a` means the later one silently wins and the
     * earlier never runs — no error, no warning, just a feature that stopped. A host that decorates
     * links for its own reasons passes that component in here instead of claiming the element beside
     * this plugin.
     */
    readonly fallback?:      ComponentType<AnchorHTMLAttributes<HTMLAnchorElement>>;
}

export function referencePlugin<TData>(options: ReferencePluginOptions<TData>): MarkdownPlugin<unknown> {
    const {
        name = 'inline-references',
        schemes,
        legacySchemes = [],
        autolink,
        useReferences,
        render: Render,
        fallback: Fallback = PlainAnchor,
    } = options;

    const accepted = [...schemes, ...legacySchemes].map((scheme) => scheme.toLowerCase());
    const minted   = autolink?.scheme ?? schemes[0];

    return {
        name,
        useProseData: (markdown) => useResolvedReferences(markdown, accepted, autolink, minted, useReferences),
        prose: {
            remarkPlugins: autolink ? [() => autolinkPass(autolink.pattern, minted)] : [],
            // ⚠️ Declared for the host rather than by it. Without this the sanitiser rewrites every
            // destination below to the empty string before any override runs, and the only symptom is
            // an ordinary underlined link — see `ProseRenderer`.
            urlSchemes: accepted,
            components: {
                a: ({ href, children, ...rest }) => {
                    const token = tokenIn(href, accepted);

                    if (token) {
                        return <Reference plugin={name} token={token} render={Render}>{children}</Reference>;
                    }

                    // ⚠️ Cast: the props react-markdown hands an override are typed against ITS copy of
                    // `@types/react`, and two copies produce two unrelated `ref` types that no amount of
                    // correct code reconciles. Nothing is asserted about the values themselves.
                    const properties = { ...rest, href } as AnchorHTMLAttributes<HTMLAnchorElement>;

                    return <Fallback {...properties}>{children}</Fallback>;
                },
            },
        },
    };
}

/** What a plain link is, where the host has not said otherwise. */
function PlainAnchor(properties: AnchorHTMLAttributes<HTMLAnchorElement>) {
    return <a {...properties}/>;
}

/** What is filed under a token's key: an answer, or the reason there is none. */
interface ReferenceEntry<TData> {
    readonly data?:    TData;
    readonly refusal?: string;
}

/**
 * Collects a document's tokens, hands them to the host once, and files the answers where the renderer
 * looks.
 *
 * <p>⚠️ **The token list is memoised on the document**, not rebuilt per render. The host's hook almost
 * certainly keys a cache on what it is given, and a fresh array every render is a cache that never hits
 * — a request per keystroke, on the path that runs while somebody is typing.
 *
 * <p>⚠️ **Answers and refusals are merged into one map**, because the renderer asks one question — "is
 * there an answer for this token, and if not, why" — and two lookups against two structures is two
 * chances for them to disagree about the same token.
 */
function useResolvedReferences<TData>(
    markdown: string,
    accepted: readonly string[],
    autolink: ReferenceAutolink | undefined,
    minted: string,
    useReferences: (tokens: readonly ReferenceToken[]) => ReferenceState<TData>,
) {
    const tokens = useMemo(
        () => tokensIn(markdown, accepted, autolink, minted),
        [markdown, accepted, autolink, minted],
    );

    const state = useReferences(tokens);

    return useMemo(() => {
        const byKey = new Map<string, unknown>();

        for (const [key, data] of state.byKey) {
            byKey.set(key, { data } satisfies ReferenceEntry<TData>);
        }

        for (const [key, refusal] of state.refusals ?? []) {
            if (!byKey.has(key)) {
                byKey.set(key, { refusal } satisfies ReferenceEntry<TData>);
            }
        }

        return { byKey, status: state.status };
    }, [state]);
}

/**
 * The reference a destination names, or null where it is an ordinary link.
 *
 * <p>⚠️ **Anchored at the start.** `https://example.com/issue:4` is a URL that happens to contain one of
 * these words, and claiming it would take a perfectly ordinary link away from the reader.
 */
function tokenIn(href: string | undefined, accepted: readonly string[]): ReferenceToken | null {
    if (typeof href !== 'string') {
        return null;
    }

    const matched = new RegExp(`^(${accepted.join('|')}):(.+)$`, 'i').exec(href);

    if (!matched) {
        return null;
    }

    return { scheme: matched[1].toLowerCase(), argument: matched[2] };
}

/**
 * Every reference a document mentions, each one once.
 *
 * <p>⚠️ **Over the raw source.** Scanning the parsed tree would be more precise — it would skip a
 * destination written inside a fenced block — and the two scans could then disagree about what this
 * document asked for. The cost of the imprecision is one lookup nobody sees.
 *
 * <p>⚠️ **Two sweeps, because there are two ways to write one.** The destination sweep sees what an
 * author or a picker wrote out; the autolink sweep sees bare tokens, which are rewritten into
 * destinations by the remark pass *after* this runs — so waiting for the tree would mean never
 * resolving them.
 */
function tokensIn(
    markdown: string,
    accepted: readonly string[],
    autolink: ReferenceAutolink | undefined,
    minted: string,
): ReferenceToken[] {
    const found = new Map<string, ReferenceToken>();
    const add   = (token: ReferenceToken) => found.set(referenceKey(token), token);

    for (const match of markdown.matchAll(new RegExp(`\\]\\((${accepted.join('|')}):([^)\\s]+)\\)`, 'gi'))) {
        add({ scheme: match[1].toLowerCase(), argument: match[2] });
    }

    if (autolink) {
        for (const match of markdown.matchAll(new RegExp(autolink.pattern, 'g'))) {
            add({ scheme: minted, argument: match[0] });
        }
    }

    return [...found.values()];
}

/**
 * The tree pass: a bare token in prose becomes a link node carrying the minted scheme.
 *
 * <p>⚠️ **`ignore` names the two node types whose children are text that is already a link.** A token in
 * the *text* of a link must stay text, because a link inside a link is not something a document can
 * express — and one in a *destination* is never visited at all, destinations not being children.
 * Between the two, running this over an already-linked document changes nothing.
 *
 * <p>⚠️ And `findAndReplace` visits **text nodes only**, so code spans and fenced blocks never come near
 * it. That is the whole reason this is a tree pass rather than a pre-pass over the source: by the time
 * a tree exists, the parser has already decided what is prose and what is syntax.
 */
function autolinkPass(pattern: string, scheme: string) {
    return (tree: Root) => {
        findAndReplace(
            tree,
            [[
                new RegExp(pattern, 'g'),
                (matched: string) => ({
                    type: 'link' as const,
                    url: `${scheme}:${matched}`,
                    children: [{ type: 'text' as const, value: matched }],
                }),
            ]],
            { ignore: ['link', 'linkReference'] },
        );
    };
}

/**
 * One reference, resolved or not.
 *
 * <p>⚠️ **Unresolved renders the document's own words, unstyled** — not a broken link, not an error
 * mark. A reference to something the reader may not see has to read exactly like the text somebody
 * typed, or its absence announces that the thing exists. The reason goes on the tooltip, where it helps
 * whoever is looking for it and interrupts nobody who is not.
 */
function Reference<TData>({ plugin, token, render: Render, children }: {
    readonly plugin:   string;
    readonly token:    ReferenceToken;
    readonly render:   ComponentType<ReferenceRenderProperties<TData>>;
    readonly children: ReactNode;
}) {
    const state   = useProseDataFor(plugin);
    const entry   = state.byKey.get(referenceKey(token)) as ReferenceEntry<TData> | undefined;
    const loading = state.status === 'loading';

    if (entry?.data === undefined) {
        return (
            <span
                className={loading ? 'opacity-60' : undefined}
                title={entry?.refusal ?? (loading ? 'Looking up…' : undefined)}
            >
                {children}
            </span>
        );
    }

    return <Render token={token} data={entry.data}>{children}</Render>;
}

/**
 * The chip a resolved reference draws as — one look, in every product.
 *
 * <h2>⚠️ Why `text-decoration` and `color` are inline styles</h2>
 *
 * <p>Every host here carries a `.prose-<product> a { text-decoration: underline; color: … }` rule, and
 * an element selector plus a class outranks any class this package could ship. So a badge styled from a
 * library stylesheet wears a prose link's underline in every product, and each one needs its own
 * counter-rule — which is three places to forget. An inline style outranks all of them and asks nothing
 * of the host.
 *
 * <p>Everything else is left to the host's own utility classes through {@link className}, because how
 * dense a chip should be is a product's decision and not this file's.
 */
export function ReferenceBadge({
    href, label, icon, accent, title, struck, className, anchor = ExternalAnchor,
}: {
    readonly href?:      string;
    /** What the badge prints — ⚠️ the owning system's *current* name for the thing, not the authored text. */
    readonly label:      ReactNode;
    readonly icon?:      ReactNode;
    /** A colour for the state dot; omit for no dot. */
    readonly accent?:    string;
    readonly title?:     string;
    /** Struck through — finished, closed, retired. */
    readonly struck?:    boolean;
    readonly className?: string;
    /**
     * How the badge's own link is rendered.
     *
     * <p>⚠️ **Because "where this goes" is not the same question in every host.** A reference to another
     * product opens a tab; a reference to something in *this* product should go through the host's
     * router, or every badge is a full page load. The default is the first; a host with a router passes
     * a wrapper for the second.
     */
    readonly anchor?:    (properties: AnchorHTMLAttributes<HTMLAnchorElement>) => ReactNode;
}) {
    // ⚠️ Inline, and see the note above: an element-plus-class selector in the host's stylesheet
    // outranks anything this package could ship, and every host here has one for links in prose.
    const style: CSSProperties = { textDecoration: 'none', color: 'inherit' };

    return anchor({
        href,
        title,
        style,
        className: className ?? DEFAULT_BADGE_CLASS,
        children: (
            <>
                {icon}
                <span style={struck ? { textDecoration: 'line-through', opacity: 0.7 } : undefined}>
                    {label}
                </span>
                {accent !== undefined && (
                    <span
                        aria-hidden
                        style={{
                            width: '0.375em', height: '0.375em', borderRadius: '50%',
                            background: accent, flexShrink: 0,
                        }}
                    />
                )}
            </>
        ),
    });
}

/** A badge pointing at another product: a new tab, and no window handle back to this one. */
function ExternalAnchor(properties: AnchorHTMLAttributes<HTMLAnchorElement>) {
    return <a {...properties} target="_blank" rel="noopener noreferrer"/>;
}

/**
 * ⚠️ Tailwind class names, and the one place this package assumes anything about a host's CSS.
 *
 * <p>Every product that consumes this runs Tailwind and lists the package in its `@source`, so these
 * resolve. A host that does not can pass its own `className` — which is why this is a default rather
 * than something concatenated onto whatever it is given.
 */
const DEFAULT_BADGE_CLASS =
    'inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 '
    + 'align-baseline text-[0.85em] font-medium leading-none transition-colors hover:bg-accent';

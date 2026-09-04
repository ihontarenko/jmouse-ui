import { useEffect, useState } from "react"
import type { StaticHighlighter } from "./highlight"

/**
 * `@jmouse/codemirror/react-highlight` — a block of code that is being *read*, as a React component.
 *
 * <h2>⚠️ Its own entry point, and not part of `./react`</h2>
 *
 * <p>The same rule the rest of the package is split by: an entry point costs you whatever it imports.
 * `./react` reaches `./editor` and therefore `@codemirror/view`, which a product showing one static
 * document must not be made to install for a `<pre>`. This module imports React and a *type*, and
 * nothing else — so a host with no editor anywhere still gets the component.
 *
 * <h2>⚠️ Why this is not written per product</h2>
 *
 * <p>It was, twice, and the second copy is what moved it here. What looks like fifteen lines of markup
 * is four decisions that have to agree everywhere: that the parser resolves asynchronously and a late
 * answer must not paint over a newer document, that an unknown language falls back to plain text
 * rather than throwing, that the markup comes from token offsets and therefore goes in as `innerHTML`,
 * and that every character reaches that string through the highlighter's own escaping. A copy that
 * drifts on the first two renders a stale document; a copy that drifts on the last two is an
 * injection.
 *
 * <p>What is left to a host is the skin, which is what `className` is for — a policy document sits on
 * a different surface in an authorization server than it does in a media library, and neither of them
 * is the library's business.
 */
export interface HighlightedCodeProps {
    /** The document, exactly as the server sent it. */
    readonly code: string
    /**
     * A language name the highlighter answers for — `jmp`, `jmouse-policy`, `policy`, and whatever
     * else the host declared. ⚠️ Anything else renders as plain text, which is the intended outcome
     * rather than an error: a fence labelled `hcl` in a build with no HCL grammar is still readable.
     */
    readonly language: string
    /** The surface it is painted on. The colours inside it are never the host's — see `./highlight`. */
    readonly className?: string
}

/**
 * Binds a component to one host's highlighter.
 *
 * <p>⚠️ **A factory rather than a `highlighter` prop**, because which grammars a host answers for is
 * decided once, in its `lib/codemirror`, and repeating it at every call site is how one screen comes
 * to know about a language the rest of the product does not.
 *
 * @param highlighter the host's own — {@link createStaticHighlighter}'s answer
 */
export function createHighlightedCode(
    highlighter: StaticHighlighter,
): (properties: HighlightedCodeProps) => React.ReactElement {
    return function HighlightedCode({ code, language, className }: HighlightedCodeProps) {
        const [highlighted, setHighlighted] = useState<string | null>(null)

        useEffect(() => {
            // ⚠️ The parser resolves asynchronously and `code` can change under it, so a late answer
            // for a previous document must not paint over the current one.
            let current = true

            setHighlighted(null)

            void highlighter.resolveParser(language).then((parser) => {
                if (!current || !parser) {
                    return
                }

                setHighlighted(highlighter.highlightToHtml(parser, code))
            })

            return () => {
                current = false
            }
        }, [code, language])

        // ⚠️ Both branches are the same element with the same class, so a document does not move when
        // the colours arrive — only React's two ways of filling one in. Every character of the
        // highlighted branch passed through the escaping in `highlightToHtml`; the spans around it are
        // generated from the parse tree, never from the content.
        if (highlighted === null) {
            return <pre className={className}>{code}</pre>
        }

        return <pre className={className} dangerouslySetInnerHTML={{ __html: highlighted }} />
    }
}

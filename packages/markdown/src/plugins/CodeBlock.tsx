import { useEffect, useState } from 'react';
import type { FC } from 'react';

/** Turns source into highlighted HTML, or null when the language is unknown. May resolve lazily. */
export type Highlighter = (language: string, code: string) => Promise<string | null>;

/**
 * A fenced code block. It paints plain immediately and upgrades once the highlighter answers, so a
 * lazily-loaded grammar costs a repaint rather than a blank space — and an unknown language simply
 * stays plain, with no error and no missing-grammar warning.
 */
export const CodeBlock: FC<{ language: string; code: string; highlight: Highlighter }> = ({
    language, code, highlight,
}) => {
    const [markup, setMarkup] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setMarkup(null);

        highlight(language, code)
            .then((html) => {
                if (!cancelled) {
                    setMarkup(html);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setMarkup(null);
                }
            });

        return () => { cancelled = true; };
    }, [language, code, highlight]);

    if (markup === null) {
        return <code>{code}</code>;
    }
    // The markup comes from the host's highlighter over the document's own source — the same trust
    // model as the prose around it, and never from user input this component has not been given.
    return <code dangerouslySetInnerHTML={{ __html: markup }}/>;
};

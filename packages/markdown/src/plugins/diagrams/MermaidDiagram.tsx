import { useEffect, useRef, useState } from 'react';
import s from './diagrams.module.css';

/** The six hex digits of a CSS colour (`#abc` → `aabbcc`, `#aabbcc…` → `aabbcc`), or null if not hex. */
function toSixDigitHex(color: string): string | null {
    if (!color.startsWith('#')) {
        return null;
    }
    const body = color.slice(1);
    if (body.length === 3) {
        return body.split('').map((channel) => channel + channel).join('');
    }
    if (body.length >= 6) {
        return body.slice(0, 6);
    }
    return null;
}

/**
 * Mermaid's own colour theme, matched to the app's active light/dark mode by reading the page
 * background (`--paper`). Both `default` (light) and `dark` are fully colourised — unlike `neutral`,
 * which renders every diagram in greyscale.
 */
function diagramTheme(): 'default' | 'dark' {
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    const hex   = toSixDigitHex(paper);
    if (!hex) {
        return 'default';
    }
    const red       = parseInt(hex.slice(0, 2), 16);
    const green     = parseInt(hex.slice(2, 4), 16);
    const blue      = parseInt(hex.slice(4, 6), 16);
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    return luminance < 128 ? 'dark' : 'default';
}

/**
 * Renders a Mermaid diagram from a `;;;mermaid … ;;;` block. Mermaid (~0.5 MB) is imported dynamically,
 * so it only loads when a page actually contains a diagram. Rendered with `securityLevel: 'strict'`,
 * which sanitises the output — safe even on a shared public page.
 */
export function MermaidDiagram({ source }: { source: string }) {
    const containerReference = useRef<HTMLDivElement>(null);
    const [error, setError]  = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const mermaid = (await import('mermaid')).default;
                mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: diagramTheme() });
                const renderId = `mermaid-${Math.random().toString(36).slice(2)}`;
                const { svg } = await mermaid.render(renderId, source);
                if (!cancelled && containerReference.current) {
                    containerReference.current.innerHTML = svg;
                    setError(null);
                }
            } catch (renderError) {
                if (!cancelled) {
                    setError(renderError instanceof Error ? renderError.message : 'Could not render the diagram.');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [source]);

    if (error) {
        return (
            <div className={s.diagramError}>
                <span className={s.diagramBadge}>mermaid</span>
                <span>{error}</span>
            </div>
        );
    }
    return <div className={s.diagram} ref={containerReference}/>;
}

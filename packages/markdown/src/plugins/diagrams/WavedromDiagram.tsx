import { useEffect, useRef, useState } from 'react';
import s from './diagrams.module.css';

/**
 * Renders a WaveDrom timing diagram / register map from a `;;;wavedrom … ;;;` block — the electronics
 * differentiator general-purpose tools lack. WaveDrom and its JSON5 parser are imported dynamically, so
 * they only load when a page contains a diagram. The source is parsed with JSON5 (never eval), so the
 * usual unquoted-key WaveJSON is accepted without an arbitrary-code-execution hole.
 */
export function WavedromDiagram({ source }: { source: string }) {
    const containerReference = useRef<HTMLDivElement>(null);
    const [error, setError]  = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [wavedromModule, json5Module] = await Promise.all([import('wavedrom'), import('json5')]);
                const wavedrom = wavedromModule.default;
                const waveJson = json5Module.default.parse(source);
                const tree     = wavedrom.renderAny(0, waveJson, wavedrom.waveSkin);
                const svg      = wavedrom.onml.stringify(tree);
                if (!cancelled && containerReference.current) {
                    containerReference.current.innerHTML = svg;
                    setError(null);
                }
            } catch (renderError) {
                if (!cancelled) {
                    setError(renderError instanceof Error ? renderError.message : 'Could not render the timing diagram.');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [source]);

    if (error) {
        return (
            <div className={s.diagramError}>
                <span className={s.diagramBadge}>wavedrom</span>
                <span>{error}</span>
            </div>
        );
    }
    return <div className={s.diagram} ref={containerReference}/>;
}

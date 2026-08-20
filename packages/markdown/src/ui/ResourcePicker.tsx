import { useEffect, useMemo, useState } from 'react';
import { useMarkdownUi } from './kit';
import type { ResourceItem, ResourceSource } from './resource';
import s from './dialogs.module.css';

/**
 * Searches one {@link ResourceSource} and lets the reader pick from it. The library's only list widget,
 * shared by every dialog that offers "…or choose an existing one".
 *
 * <p>Debounced, and it never applies a response its query has already moved past — a picker that
 * flickers back to stale results as you type reads as broken.
 */
export function ResourcePicker({ source, accept, onPick }: {
    source:  ResourceSource;
    /** Narrows what may be picked — an image dialog takes only images. */
    accept?: (item: ResourceItem) => boolean;
    onPick:  (item: ResourceItem) => void;
}) {
    const { Input } = useMarkdownUi();
    const [query, setQuery]     = useState('');
    const [items, setItems]     = useState<readonly ResourceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed]   = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFailed(false);

        const timer = setTimeout(() => {
            source.search(query)
                .then((found) => {
                    if (!cancelled) {
                        setItems(found);
                        setLoading(false);
                    }
                })
                .catch(() => {
                    if (!cancelled) {
                        setItems([]);
                        setFailed(true);
                        setLoading(false);
                    }
                });
        }, SEARCH_DEBOUNCE_MS);

        return () => { cancelled = true; clearTimeout(timer); };
    }, [source, query]);

    const allowed = useMemo(
        () => (accept ? items.filter(accept) : items),
        [items, accept],
    );

    /**
     * The kinds present in what came back, each with how many carry it.
     *
     * <p>⚠️ **Derived from the items, never declared by the source.** {@link ResourceItem#kind} has
     * always been "a coarse type the caller may filter on" and nothing rendered it, so a list of
     * seventy fields was seventy rows and a search box. A source that sets a kind gets a filter column
     * for free — fields by element type, files by MIME type — and one that does not is unchanged.
     */
    const kinds = useMemo(() => {
        const counted = new Map<string, number>();

        for (const item of allowed) {
            if (item.kind) {
                counted.set(item.kind, (counted.get(item.kind) ?? 0) + 1);
            }
        }

        return [...counted.entries()].sort(([left], [right]) => left.localeCompare(right));
    }, [allowed]);

    const [kind, setKind] = useState<string | null>(null);

    // A filter that no longer matches anything is a list that looks empty for a reason nobody can see.
    useEffect(() => {
        if (kind !== null && !kinds.some(([each]) => each === kind)) {
            setKind(null);
        }
    }, [kinds, kind]);

    const visible = kind === null ? allowed : allowed.filter((item) => item.kind === kind);

    // One kind is not a choice, and a column offering it would be furniture.
    const faceted = kinds.length > 1;

    return (
        <div className={s.picker}>
            <Input value={query} onChange={setQuery} placeholder="Search…" ariaLabel="Search"/>

            {loading && <div className={s.pickerNotice}>Loading…</div>}
            {!loading && failed && <div className={s.pickerNotice}>Could not load — try again.</div>}
            {!loading && !failed && allowed.length === 0 && (
                <div className={s.pickerNotice}>{source.emptyHint ?? 'Nothing here yet.'}</div>
            )}

            {allowed.length > 0 && (
                <div className={faceted ? s.pickerBody : undefined}>
                    {faceted && (
                        <div className={s.pickerKinds} role="listbox" aria-label="Filter by kind">
                            <button
                                type="button"
                                role="option"
                                aria-selected={kind === null}
                                className={kind === null ? s.pickerKindOn : s.pickerKind}
                                onClick={() => setKind(null)}
                            >
                                <span className={s.pickerKindLabel}>All</span>
                                <span className={s.pickerKindCount}>{allowed.length}</span>
                            </button>

                            {kinds.map(([each, count]) => (
                                <button
                                    key={each}
                                    type="button"
                                    role="option"
                                    aria-selected={kind === each}
                                    className={kind === each ? s.pickerKindOn : s.pickerKind}
                                    onClick={() => setKind(each)}
                                >
                                    <span className={s.pickerKindLabel}>{each}</span>
                                    <span className={s.pickerKindCount}>{count}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <ul className={s.pickerList}>
                        {visible.map((item) => (
                            <li key={item.id}>
                                <button type="button" className={s.pickerItem} onClick={() => onPick(item)}>
                                    <span className={s.pickerLabel}>{item.label}</span>
                                    {item.hint && <span className={s.pickerHint}>{item.hint}</span>}
                                </button>
                            </li>
                        ))}

                        {visible.length === 0 && (
                            <li className={s.pickerNotice}>Nothing of that kind matches.</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

const SEARCH_DEBOUNCE_MS = 250;

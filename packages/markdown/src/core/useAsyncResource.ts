import { useEffect, useRef, useState } from 'react';

/**
 * Loads a value for a key, and keeps the last value for that key while a new one is in flight.
 *
 * <p>Deliberately tiny. A block resolver needs exactly three things — do not refetch for an unchanged
 * key, do not flash empty while refetching, do not apply a response that a newer request has already
 * superseded — and a host that wants real caching passes its own hook instead. This is what keeps the
 * library free of a data-fetching dependency.
 */

export interface AsyncResource<TValue> {
    readonly value:   TValue | undefined;
    readonly loading: boolean;
    readonly error:   unknown;
}

export function useAsyncResource<TValue>(
    key:  string | null,
    load: () => Promise<TValue>,
): AsyncResource<TValue> {
    const [state, setState] = useState<AsyncResource<TValue>>({ value: undefined, loading: false, error: undefined });

    // The loader closes over changing values but must not itself retrigger the effect — the key is the
    // whole statement of "this is a different request".
    const loadReference = useRef(load);
    loadReference.current = load;

    useEffect(() => {
        if (key === null) {
            setState({ value: undefined, loading: false, error: undefined });
            return;
        }

        let cancelled = false;
        setState((current) => ({ ...current, loading: true, error: undefined }));

        loadReference.current()
            .then((value) => {
                if (!cancelled) {
                    setState({ value, loading: false, error: undefined });
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setState({ value: undefined, loading: false, error });
                }
            });

        return () => { cancelled = true; };
    }, [key]);

    return state;
}

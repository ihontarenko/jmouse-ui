import { useCallback, useEffect, useRef, useState } from "react";
import { ApiProblem, isAbort } from "@jmouse/parallax";

export interface AsyncValue<T> {
  data: T | null;
  error: ApiProblem | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads one thing and keeps the previous answer on screen while the next one is in flight, so a change never collapses
 * the layout. A newer request aborts the older one.
 */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: readonly unknown[], enabled = true): AsyncValue<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiProblem | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [generation, setGeneration] = useState(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    loader
      .current(controller.signal)
      .then((answer) => {
        if (controller.signal.aborted) {
          return;
        }
        setData(answer);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted || isAbort(failure)) {
          return;
        }
        setError(failure instanceof ApiProblem ? failure : new ApiProblem(0, {}));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
    // The caller names what the load depends on, as with useEffect.
  }, [...dependencies, generation, enabled]);

  const reload = useCallback(() => setGeneration((current) => current + 1), []);
  return { data, error, loading, reload };
}

/** The value, once it has stopped changing for `delay` milliseconds — for a line being typed. */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

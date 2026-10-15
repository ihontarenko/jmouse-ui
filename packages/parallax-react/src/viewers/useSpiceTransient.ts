import { useEffect, useState } from "react";
import { ApiProblem, isAbort } from "@jmouse/parallax";
import type { Computation } from "@jmouse/parallax/computation";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";

/** What SPICE answered beside the computation it is shown as: the deck it ran and what the deck could not carry. */
export interface SpiceComputation extends Computation {
  deck: string | null;
  notes: string[];
}

const IDLE: SpiceComputation = { ready: null, readyFor: null, job: null, error: null, computing: false, deck: null, notes: [] };

/**
 * A circuit's transient computed by SPICE — the second engine — in the shape of any computation, so the instrument
 * that shows the engine's own transient shows this one unchanged. Asked again when the text or a value changes; the
 * previous answer stays on screen while the next is computed.
 */
export function useSpiceTransient(source: string | null, values: Record<string, number>, enabled: boolean): SpiceComputation {
  const transport = useParallaxTransport();
  const [state, setState] = useState<SpiceComputation>(IDLE);
  const key = JSON.stringify(values);

  useEffect(() => {
    if (!enabled || !source) {
      return;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, computing: true, error: null }));
    const started = performance.now();
    transport.documents.spiceTransient(source, values, controller.signal).then((answer) => {
      const readyFor = `spice/${key}`;
      setState({
        ready: { datasetId: readyFor, fingerprint: readyFor, representation: "TRANSIENT_RESPONSE", format: answer.series.format,
          cached: false, computeMillis: Math.round(performance.now() - started), elementCount: answer.series.axisValues.length, dataset: answer.series },
        readyFor, job: null, error: null, computing: false, deck: answer.deck, notes: answer.notes,
      });
    }).catch((failure: unknown) => {
      if (isAbort(failure)) {
        return;
      }
      const error = failure instanceof ApiProblem ? failure : new ApiProblem(0, { detail: String(failure) });
      setState((current) => ({ ...current, computing: false, error }));
    });
    return () => controller.abort();
    // `values` is read through its key: a new object of the same values is not a new run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, source, key, enabled]);

  return state;
}

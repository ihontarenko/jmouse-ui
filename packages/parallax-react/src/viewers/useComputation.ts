import { useEffect, useRef, useState } from "react";
import { ApiProblem, isAbort } from "@jmouse/parallax";
import { computationRequest, runComputation, type Computation, type ComputationTarget } from "@jmouse/parallax/computation";
import { useParallaxSettings } from "../providers/ParallaxSettings";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";

/**
 * Computes one representation of one object with the given parameter values. Changes are debounced, the
 * previous dataset stays on screen while the next is computed, and a queued job is polled to its dataset.
 * The backend caches by fingerprint, so returning to earlier values answers at once.
 */
export function useComputation(
  target: ComputationTarget,
  representation: string | null,
  values: Record<string, number>,
  enabled = true,
  settings: Record<string, unknown> = {},
): Computation {
  const { computationOwner } = useParallaxSettings();
  const transport = useParallaxTransport();
  const [state, setState] = useState<Computation>({ ready: null, readyFor: null, job: null, error: null, computing: false });
  const key = JSON.stringify(values);
  const targetKey = typeof target === "string" ? target : target ? JSON.stringify(target) : null;
  const settingsKey = JSON.stringify(settings);
  const previousTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !targetKey || !representation) {
      return;
    }
    const identity = `${targetKey}/${representation}`;
    // A different object or representation is a different picture: never keep the old one under the new title.
    if (previousTarget.current !== identity) {
      previousTarget.current = identity;
      setState({ ready: null, readyFor: null, job: null, error: null, computing: true });
    } else {
      setState((current) => ({ ...current, computing: true }));
    }
    const requested = `${identity}/${key}/${settingsKey}`;
    const controller = new AbortController();
    const signal = controller.signal;
    const run = async () => {
      const named = typeof target === "string" ? target : JSON.parse(targetKey);
      const request = computationRequest(named, representation, JSON.parse(key), JSON.parse(settingsKey), computationOwner ?? undefined);
      const outcome = await runComputation(transport, request, signal, (job) => setState((current) => ({ ...current, job, computing: true })));
      if ("ready" in outcome) {
        setState({ ready: outcome.ready, readyFor: requested, job: null, error: null, computing: false });
        return;
      }
      setState({ ready: null, readyFor: null, job: outcome.failedJob, error: outcome.problem, computing: false });
    };
    run().catch((failure: unknown) => {
      if (isAbort(failure)) {
        return;
      }
      setState((current) => ({ ...current, job: null, computing: false, error: failure instanceof ApiProblem ? failure : new ApiProblem(0, {}) }));
    });
    return () => controller.abort();
  }, [transport, targetKey, representation, key, settingsKey, enabled, computationOwner]);

  return state;
}

import { ApiProblem } from "../transport/problem";
import type { ParallaxTransport } from "../transport/transport";
import type { ComputationRequest, Job, ParallaxOwner, Ready } from "../transport/wire";

/** Where a computation of one representation stands: the dataset shown, the job it waits on, or why it failed. */
export interface Computation {
  ready: Ready | null;
  /** What `ready` was computed for: the target, representation, values and settings, as one key. */
  readyFor: string | null;
  /** A heavy computation runs as a job; its progress is shown in place of the viewport. */
  job: Job | null;
  error: ApiProblem | null;
  computing: boolean;
}

const DEBOUNCE_MILLISECONDS = 120;
const POLL_MILLISECONDS = 700;

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/**
 * What is computed: a stored object (its id or slug), a subject (`catalogue:<slug>` or `inline:<formula>`, the one
 * way a catalogue object and a typed formula are both named), or a definition spelled out by a scene.
 */
export type ComputationTarget = string | { subject: string } | { objectId: string; definition: Record<string, unknown> } | { definition: Record<string, unknown>; parameters: unknown[] } | null;

/** What `POST /computations` is asked for a target — the one place a target becomes a request. */
export function computationRequest(target: Exclude<ComputationTarget, null>, representation: string, values: Record<string, number>,
  settings: Record<string, unknown>, owner: ParallaxOwner | undefined): ComputationRequest {
  const named = typeof target === "string" ? { objectId: target } : target;
  return { ...named, representation, values, settings, owner };
}

/** A frame computed ahead, shown where a computation would be. */
export function computationOf(ready: Ready): Computation {
  return { ready, readyFor: ready.fingerprint, job: null, error: null, computing: false };
}

/** How a run ended: the dataset computed, or the job that was queued for it and did not finish. */
export type ComputationOutcome = { ready: Ready } | { failedJob: Job; problem: ApiProblem };

/**
 * Runs one computation after a short pause — a change that follows at once cancels it through `signal` — and, when the
 * server queued it, polls the job to its dataset, telling `onQueued` each time the job is seen still waiting or running.
 */
export async function runComputation(transport: ParallaxTransport, request: ComputationRequest, signal: AbortSignal,
  onQueued: (job: Job) => void): Promise<ComputationOutcome> {
  await wait(DEBOUNCE_MILLISECONDS, signal);
  const answer = await transport.computations.compute(request, signal);
  if ("dataset" in answer) {
    return { ready: answer };
  }
  let job = answer.job;
  while (job.status === "QUEUED" || job.status === "RUNNING") {
    onQueued(job);
    await wait(POLL_MILLISECONDS, signal);
    job = await transport.computations.job(job.id, signal);
  }
  if (job.status === "SUCCEEDED") {
    return { ready: await transport.computations.jobDataset(job.id, signal) };
  }
  return { failedJob: job, problem: new ApiProblem(500, { detail: job.failureDetail || "The computation did not finish.", code: job.status.toLowerCase() }) };
}

import type { ParallaxOwner } from "@jmouse/parallax";
import { useAsync } from "../support/useAsync";
import { evaluateGraphCheck, type CheckResult, type GraphCheck } from "@jmouse/parallax/graph";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";

/** Every check over the clock's frames, or at the sliders' values when the graph has no clock. */
export function useGraphChecks(checks: readonly GraphCheck[], library: string, values: Record<string, number>,
  clock: { parameter: string; grid: readonly number[] } | null, owner: ParallaxOwner | undefined): CheckResult[] {
  const transport = useParallaxTransport();
  const key = JSON.stringify([checks, library, values, clock?.parameter, clock?.grid.length, clock?.grid[0], clock?.grid.at(-1)]);
  const results = useAsync((signal) => Promise.all(checks.map((check) => evaluateGraphCheck(transport, check, library, values, clock, owner, signal))),
    [transport, key], checks.length > 0);
  return results.data ?? checks.map((check) => ({ check, passed: null, worst: null, problem: results.error ? results.error.detail : null }));
}

import { useCallback, useMemo, useState } from "react";
import { planeExtentOf, refinementWindow, visibleWindow, type Dataset, type Size, type StageLayer, type StageView, type ZoomWindow } from "@jmouse/parallax/visual";
import { useRepresentationSpecifications } from "./SettingsForm";
import type { Computation, ComputationTarget } from "@jmouse/parallax/computation";
import { useComputation } from "./useComputation";

/** What a frame's picture was computed from, so the part in sight can be computed again closer. */
export interface Refinement {
  target: ComputationTarget;
  representation: string;
  values: Record<string, number>;
  settings?: Record<string, unknown>;
}

/**
 * Deeper zoom for a computed plane picture whose representation declares a `window` setting: past the picture's own
 * detail, the visible part is computed again and drawn over it as the layer `refined`. Zooming back out drops it.
 */
export function useDeeperZoom(refinement: Refinement | undefined, dataset: Dataset | null): {
  layer: StageLayer | null;
  refined: Computation;
  onView: (view: StageView, size: Size) => void;
} {
  const specifications = useRepresentationSpecifications();
  const specification = refinement ? specifications.data?.find((candidate) => candidate.kind === refinement.representation) : undefined;
  const windowed = Boolean(specification?.settings.some((setting) => setting.name === "window"));
  const resolution = specification?.settings.find((setting) => setting.name === "resolution");
  const samplesAcross = Number(refinement?.settings?.resolution ?? resolution?.defaultValue) || null;
  const extent = windowed && dataset ? planeExtentOf(dataset, samplesAcross) : null;
  const [zoomWindow, setZoomWindow] = useState<ZoomWindow | null>(null);

  const onView = useCallback((view: StageView, size: Size) => {
    const next = extent ? refinementWindow(extent.window, extent.samples, visibleWindow(view.plane, size), size) : null;
    setZoomWindow((current) => (current?.join() === next?.join() ? current : next));
  }, [extent?.window.xMinimum, extent?.window.xMaximum, extent?.window.yMinimum, extent?.window.yMaximum, extent?.samples]);

  const refined = useComputation(refinement?.target ?? null, refinement?.representation ?? null, refinement?.values ?? {}, zoomWindow !== null,
    { ...refinement?.settings, window: zoomWindow });
  const shown = zoomWindow !== null;
  const layer = useMemo(() => (shown && refined.ready ? { id: "refined", dataset: refined.ready.dataset } : null), [shown, refined.ready]);
  return { layer, refined, onView };
}

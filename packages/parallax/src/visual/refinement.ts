import type { Dataset } from "./datasets";
import type { PlaneWindow, Size } from "./plane";

/**
 * Deeper zoom: when a view is zoomed past the detail of a computed picture, the part in sight is computed again and
 * drawn over the coarse one. The window is asked for in the form the engine's `window` setting takes — a centre and a
 * half-width, the height following the picture's own aspect — and snapped, so a short pan asks for the window already
 * computed and going back is answered by the backend's cache.
 */
export type ZoomWindow = readonly [centerX: number, centerY: number, halfWidth: number];

/** Where a plane picture lies and how many samples it has across, or null for data that is not a plane rectangle. */
export function planeExtentOf(dataset: Dataset, samplesAcross: number | null = null): { window: PlaneWindow; samples: number } | null {
  switch (dataset.format) {
    case "SCALAR_GRID":
      return { window: rectangle(dataset.x, dataset.y), samples: dataset.columns };
    case "COMPLEX_GRID":
    case "ITERATION_GRID":
      return { window: rectangle(dataset.real, dataset.imaginary), samples: dataset.columns };
    case "POLYLINES":
      return dataset.dimension === 2 && samplesAcross
        ? { window: { xMinimum: dataset.minimum[0], xMaximum: dataset.maximum[0], yMinimum: dataset.minimum[1], yMaximum: dataset.maximum[1] }, samples: samplesAcross }
        : null;
    default:
      return null;
  }
}

function rectangle(x: { minimum: number; maximum: number }, y: { minimum: number; maximum: number }): PlaneWindow {
  return { xMinimum: x.minimum, xMaximum: x.maximum, yMinimum: y.minimum, yMaximum: y.maximum };
}

/**
 * The window to compute again, or null while one sample of the whole picture still covers no more than
 * `pixelsPerSample` pixels. The half-width is the whole picture's halved until it is as small as can still cover what
 * is visible once its centre is snapped to a quarter of it.
 */
export function refinementWindow(whole: PlaneWindow, samples: number, visible: PlaneWindow, size: Size, pixelsPerSample = 1.5): ZoomWindow | null {
  const wholeHalfWidth = (whole.xMaximum - whole.xMinimum) / 2;
  const visibleWidth = visible.xMaximum - visible.xMinimum;
  if (!(wholeHalfWidth > 0) || !(visibleWidth > 0) || samples <= 0) {
    return null;
  }
  const sampleOnScreen = (2 * wholeHalfWidth / samples) * (size.width / visibleWidth);
  if (sampleOnScreen <= pixelsPerSample) {
    return null;
  }
  const aspect = (whole.yMaximum - whole.yMinimum) / (2 * wholeHalfWidth);
  const needed = Math.max(visibleWidth / 2, (visible.yMaximum - visible.yMinimum) / 2 / aspect);
  let halfWidth = wholeHalfWidth;
  while (halfWidth / 2 >= (4 / 3) * needed) {
    halfWidth /= 2;
  }
  if (halfWidth === wholeHalfWidth) {
    return null;
  }
  const stepX = halfWidth / 2;
  const stepY = (halfWidth * aspect) / 2;
  const centerX = Math.round((visible.xMinimum + visible.xMaximum) / 2 / stepX) * stepX;
  const centerY = Math.round((visible.yMinimum + visible.yMaximum) / 2 / stepY) * stepY;
  return [centerX, centerY, halfWidth];
}

/**
 * A raster computed over what is visible, snapped to a sixteenth of its larger side, so a short pan reuses it — for
 * data whose own definition carries its rectangle (a region's `from`/`to`) rather than a `window` setting.
 */
export function snappedWindow(visible: PlaneWindow): PlaneWindow {
  const step = Math.max(visible.xMaximum - visible.xMinimum, visible.yMaximum - visible.yMinimum) / 16;
  return {
    xMinimum: Math.floor(visible.xMinimum / step) * step,
    xMaximum: Math.ceil(visible.xMaximum / step) * step,
    yMinimum: Math.floor(visible.yMinimum / step) * step,
    yMaximum: Math.ceil(visible.yMaximum / step) * step,
  };
}

/**
 * Where a drawing editor looks: a window onto the drawing in its own units. Zoomed about a point so what is under the
 * pointer stays under it, panned by a screen distance, kept within sizes where a drawing can still be worked on.
 */
export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameLimits {
  /** The narrowest window — the deepest zoom. */
  minimumWidth: number;
  /** The widest window. */
  maximumWidth: number;
}

/** The frame zoomed by `factor` (above 1 shows more) about `at`, a point of the drawing that stays where it is. */
export function zoomedAbout(frame: Frame, factor: number, at: { x: number; y: number }, limits: FrameLimits): Frame {
  const width = Math.max(limits.minimumWidth, Math.min(limits.maximumWidth, frame.width * factor));
  const scale = width / frame.width;
  return {
    x: at.x - (at.x - frame.x) * scale,
    y: at.y - (at.y - frame.y) * scale,
    width,
    height: frame.height * scale,
  };
}

/** The frame zoomed about its own centre — the buttons, which have no pointer. */
export function zoomedAtCentre(frame: Frame, factor: number, limits: FrameLimits): Frame {
  return zoomedAbout(frame, factor, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, limits);
}

/** The frame moved so the drawing follows a drag of `dx`, `dy` drawing units. */
export function panned(frame: Frame, dx: number, dy: number): Frame {
  return { ...frame, x: frame.x - dx, y: frame.y - dy };
}

/** A value snapped to a step; a step of 0 leaves it as it is. */
export function snapped(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value;
}

/**
 * Parallax's drawing library: datasets on the plane or in space, through one stage and two drivers (WebGL for a live
 * view, Canvas for a thumbnail). It imports nothing from the product; the product imports it from here.
 */
export { Stage, type FrameStatistics, type StageContent, type StageLayer, type StageOptions, type StageView, type TracedPoint } from "./stage";
export { defaultPlaneView, visibleWindow, type PlaneView, type PlaneWindow, type Size } from "./plane";
export { planeExtentOf, refinementWindow, snappedWindow, type ZoomWindow } from "./refinement";
export { revealUntil } from "./reveal";
export type { StageBar, StageBars, StageLabel } from "./annotations";
export { defaultSpaceCamera, type SpaceCamera } from "./space";
export { formatReadout, formatTick, gridStep } from "./scale";
export { SERIES_COUNT, readTheme, type Surface, type VisualTheme } from "./theme";
export { css, parseColor, type Rgb } from "./color";
export { FloatBuilder, type Batch, type SegmentBatch } from "./geometry";
export { AnimationClock, AnimationPlayer, FrameBuffer, frameGrid, nearestFrame, type ClockOptions, type FrameLoader, type PlayerFrame } from "./animation";
export * from "./datasets";

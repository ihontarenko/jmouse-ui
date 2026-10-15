import type { Rgb } from "../color";
import type { Batch } from "../geometry";
import type { Size } from "../plane";
import type { Transform } from "../transform";

/**
 * What draws a frame. A frame is three layers in order: a 2-D context beneath the geometry (the grid, the floor), the
 * geometry itself, and a 2-D context above it (labels, markers, the traced point). The WebGL driver keeps the geometry
 * on the GPU and only moves it; the Canvas driver projects it on the CPU — for thumbnails, where a page holds more
 * canvases than a browser gives GPU contexts.
 */
export interface Driver {
  readonly kind: "webgl" | "canvas";
  resize(size: Size, ratio: number): void;
  /**
   * Starts a frame. `changed` says which 2-D layers differ from the last frame; a driver that keeps them on canvases
   * of their own redraws only those — at 4K a full-screen 2-D layer redrawn every animation frame is most of a frame —
   * and one that draws everything on one canvas redraws all. A layer kept as it was comes back null.
   */
  begin(background: Rgb, changed: { under: boolean; over: boolean }): { under: CanvasRenderingContext2D | null; over: CanvasRenderingContext2D | null };
  draw(batches: readonly Batch[], transform: Transform, background: Rgb): void;
  /** Lets go of what earlier frames kept for batches this frame no longer draws. */
  retain(batches: readonly Batch[]): void;
  /** The frame as one PNG. */
  snapshot(): string;
  destroy(): void;
}

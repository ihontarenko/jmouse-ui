import { css } from "./color";
import type { VisualTheme } from "./theme";

/*
 * Space: the camera that turns around the data and the frame that scales any data into one box (xy to ±2, z to at
 * most ±1.3), so a surface of any size sits on the same floor.
 */

export interface SpaceCamera {
  azimuth: number;
  elevation: number;
  zoom: number;
  projection: "perspective" | "orthographic";
}

export const defaultSpaceCamera: SpaceCamera = { azimuth: -0.65, elevation: 0.62, zoom: 1, projection: "perspective" };

export type Point3 = [number, number, number];

/** A point on screen and its depth, for sorting what is nearer. */
export type Projected = [number, number, number];

export type Projector = (x: number, y: number, z: number) => Projected;

export class SpaceFrame {
  readonly center: Point3;
  readonly scaleHorizontal: number;
  readonly scaleVertical: number;

  constructor(minimum: Point3, maximum: Point3) {
    this.center = [0, 1, 2].map((axis) => (minimum[axis] + maximum[axis]) / 2) as Point3;
    const halfWidth = Math.max((maximum[0] - minimum[0]) / 2, (maximum[1] - minimum[1]) / 2);
    const halfHeight = (maximum[2] - minimum[2]) / 2;
    this.scaleHorizontal = halfWidth > 0 ? 2 / halfWidth : halfHeight > 0 ? 1.3 / halfHeight : 1;
    this.scaleVertical = halfHeight > 0 ? Math.min(this.scaleHorizontal, 1.3 / halfHeight) : this.scaleHorizontal;
  }

  normalize(x: number, y: number, z: number): Point3 {
    return [(x - this.center[0]) * this.scaleHorizontal, (y - this.center[1]) * this.scaleHorizontal, (z - this.center[2]) * this.scaleVertical];
  }
}

/** The floor grid under the data and the three axes from its centre. */
export function drawSpaceFloor(context: CanvasRenderingContext2D, box: Projector, theme: VisualTheme, decoration: { grid: boolean; axes: boolean }) {
  const floor = -1.4;
  if (decoration.grid) {
    context.beginPath();
    for (let step = -2.5; step <= 2.5 + 1e-9; step += 0.5) {
      const [startX, startY] = box(step, -2.5, floor);
      const [endX, endY] = box(step, 2.5, floor);
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      const [rowStartX, rowStartY] = box(-2.5, step, floor);
      const [rowEndX, rowEndY] = box(2.5, step, floor);
      context.moveTo(rowStartX, rowStartY);
      context.lineTo(rowEndX, rowEndY);
    }
    context.strokeStyle = theme.majorGrid;
    context.lineWidth = 1;
    context.stroke();
  }
  if (decoration.axes) {
    context.font = theme.labelFont;
    context.fillStyle = theme.label;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    const [originX, originY] = box(0, 0, floor);
    context.beginPath();
    for (const [end, label] of [[[2.7, 0, floor], "x"], [[0, 2.7, floor], "y"], [[0, 0, 1.7], "z"]] as [Point3, string][]) {
      const [endX, endY] = box(end[0], end[1], end[2]);
      context.moveTo(originX, originY);
      context.lineTo(endX, endY);
      context.fillText(label, endX + 4, endY + 3);
    }
    context.strokeStyle = css(theme.muted, 0.6);
    context.stroke();
  }
}

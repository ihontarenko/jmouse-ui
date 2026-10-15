import { css, mix, type Rgb } from "../color";
import { resolveBlend, type Batch, type ImageBatch, type PointBatch, type SegmentBatch, type TriangleBatch } from "../geometry";
import { toPixels, type Size } from "../plane";
import type { Projected, Projector } from "../space";
import { projectorOf, type Transform } from "../transform";
import type { Driver } from "./driver";

const LIGHT = [0.35, -0.45, 0.82];

const colorKey = (colors: Float32Array, offset: number) =>
  `rgba(${Math.round(colors[offset] * 255)},${Math.round(colors[offset + 1] * 255)},${Math.round(colors[offset + 2] * 255)},${colors[offset + 3].toFixed(2)})`;

/** Rasters turned into canvases once, then only scaled. */
const images = new WeakMap<ImageBatch, HTMLCanvasElement>();

function imageOf(batch: ImageBatch): HTMLCanvasElement {
  let canvas = images.get(batch);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = batch.columns;
    canvas.height = batch.rows;
    canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(batch.pixels), batch.columns, batch.rows), 0, 0);
    images.set(batch, canvas);
  }
  return canvas;
}

/** The geometry drawn by the CPU onto one 2-D canvas, the grid beneath and the labels above it. */
export class CanvasDriver implements Driver {
  readonly kind = "canvas" as const;
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  #size: Size = { width: 0, height: 0 };

  constructor(host: HTMLElement) {
    this.#canvas = document.createElement("canvas");
    this.#canvas.className = "parallax-visual-layer";
    host.append(this.#canvas);
    const context = this.#canvas.getContext("2d");
    if (!context) {
      throw new Error("A 2-D canvas is not available.");
    }
    this.#context = context;
  }

  resize(size: Size, ratio: number) {
    this.#size = size;
    this.#canvas.width = Math.round(size.width * ratio);
    this.#canvas.height = Math.round(size.height * ratio);
    this.#context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /** One canvas holds everything, so every frame is drawn whole. */
  begin(background: Rgb): { under: CanvasRenderingContext2D; over: CanvasRenderingContext2D } {
    this.#context.fillStyle = css(background);
    this.#context.fillRect(0, 0, this.#size.width, this.#size.height);
    return { under: this.#context, over: this.#context };
  }

  draw(batches: readonly Batch[], transform: Transform, background: Rgb) {
    const project = projectorOf(transform);
    for (const drawn of batches) {
      const batch = drawn.kind === "blend" ? resolveBlend(drawn) : drawn;
      switch (batch.kind) {
        case "segments":
          this.#segments(batch, project);
          break;
        case "triangles":
          this.#triangles(batch, project, background, transform.kind === "space");
          break;
        case "points":
          this.#points(batch, project);
          break;
        case "image":
          if (transform.kind === "plane") {
            const [left, top] = toPixels(transform.view, transform.size, batch.extent.xMinimum, batch.extent.yMaximum);
            const [right, bottom] = toPixels(transform.view, transform.size, batch.extent.xMaximum, batch.extent.yMinimum);
            this.#context.imageSmoothingEnabled = batch.smooth;
            this.#context.drawImage(imageOf(batch), left, top, right - left, bottom - top);
            this.#context.imageSmoothingEnabled = true;
          }
          break;
      }
    }
  }

  retain() {
    // Nothing is kept between frames but the raster images, which their batches hold.
  }

  snapshot(): string {
    return this.#canvas.toDataURL("image/png");
  }

  destroy() {
    this.#canvas.remove();
  }

  #segments(batch: SegmentBatch, project: Projector) {
    const context = this.#context;
    const paths = new Map<string, Path2D>();
    for (let segment = 0; segment * 6 < batch.positions.length; segment++) {
      const offset = segment * 6;
      const [ax, ay] = project(batch.positions[offset], batch.positions[offset + 1], batch.positions[offset + 2]);
      const [bx, by] = project(batch.positions[offset + 3], batch.positions[offset + 4], batch.positions[offset + 5]);
      const key = colorKey(batch.colors, segment * 4);
      let path = paths.get(key);
      if (!path) {
        path = new Path2D();
        paths.set(key, path);
      }
      path.moveTo(ax, ay);
      path.lineTo(bx, by);
    }
    context.lineWidth = batch.width;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const [color, path] of paths) {
      context.strokeStyle = color;
      context.stroke(path);
    }
  }

  #triangles(batch: TriangleBatch, project: Projector, background: Rgb, spatial: boolean) {
    const context = this.#context;
    const vertexCount = batch.positions.length / 3;
    const screen: Projected[] = new Array(vertexCount);
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      screen[vertex] = project(batch.positions[vertex * 3], batch.positions[vertex * 3 + 1], batch.positions[vertex * 3 + 2]);
    }
    const triangleCount = Math.floor(batch.indices.length / 3);
    const order = Array.from({ length: triangleCount }, (_, triangle) => triangle);
    if (spatial) {
      const depth = (triangle: number) => screen[batch.indices[triangle * 3]][2] + screen[batch.indices[triangle * 3 + 1]][2] + screen[batch.indices[triangle * 3 + 2]][2];
      order.sort((first, second) => depth(second) - depth(first));
    }
    for (const triangle of order) {
      const [first, second, third] = [0, 1, 2].map((corner) => batch.indices[triangle * 3 + corner]);
      let shade = 0.75;
      if (batch.lit && batch.normals) {
        shade = 0.45 + 0.55 * Math.abs(batch.normals[first * 3] * LIGHT[0] + batch.normals[first * 3 + 1] * LIGHT[1] + batch.normals[first * 3 + 2] * LIGHT[2]);
      }
      const base: Rgb = [batch.colors[first * 4] * 255, batch.colors[first * 4 + 1] * 255, batch.colors[first * 4 + 2] * 255];
      const fill = css(batch.lit ? mix(background, base, 0.25 + 0.75 * shade) : base);
      context.beginPath();
      context.moveTo(screen[first][0], screen[first][1]);
      context.lineTo(screen[second][0], screen[second][1]);
      context.lineTo(screen[third][0], screen[third][1]);
      context.closePath();
      context.fillStyle = fill;
      context.strokeStyle = fill;
      context.lineWidth = 0.6;
      context.fill();
      context.stroke();
    }
  }

  #points(batch: PointBatch, project: Projector) {
    const context = this.#context;
    const paths = new Map<string, Path2D>();
    const radius = batch.size / 2;
    for (let point = 0; point * 3 < batch.positions.length; point++) {
      const [x, y] = project(batch.positions[point * 3], batch.positions[point * 3 + 1], batch.positions[point * 3 + 2]);
      const key = colorKey(batch.colors, point * 4);
      let path = paths.get(key);
      if (!path) {
        path = new Path2D();
        paths.set(key, path);
      }
      path.moveTo(x + radius, y);
      path.arc(x, y, radius, 0, Math.PI * 2);
    }
    for (const [color, path] of paths) {
      context.fillStyle = color;
      context.fill(path);
    }
  }
}

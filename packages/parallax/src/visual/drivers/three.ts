import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Group,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NearestFilter,
  NotEqualStencilFunc,
  PlaneGeometry,
  Points,
  PointsMaterial,
  ReplaceStencilOp,
  RGBAFormat,
  Scene,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { css, type Rgb } from "../color";
import type { Batch, ImageBatch, PointBatch, SegmentBatch, TriangleBatch } from "../geometry";
import type { Size } from "../plane";
import { cameraOf, modelMatrixOf, type Transform } from "../transform";
import type { Driver } from "./driver";

/*
 * The GPU driver, on three.js: lines are fat-line segments, surfaces lit meshes, points sprites, rasters textures.
 * Every batch becomes a three.js object once and is reused while it lives; a frame only moves the camera. Two frames of
 * an animation blend on the GPU — a mesh or a point cloud by a morph target, lines by rewriting their few vertices.
 */

/** How many batches stay on the GPU after they leave the screen — two passes of a 64-frame animation, and then some. */
const KEPT_RECENTLY = 160;

/** The light the surfaces are shaded by — the same direction the drawing has always used. */
const LIGHT_DIRECTION: [number, number, number] = [0.35, -0.45, 0.82];

type Geometry = SegmentBatch | TriangleBatch | PointBatch;

/** A batch's vertex data as three.js attributes, made once and shared by every object that draws it. */
interface Attributes {
  position: BufferAttribute;
  normal: BufferAttribute | null;
  color: BufferAttribute;
  index: BufferAttribute | null;
}

/** A segment batch drawn as fat lines, and the vertices it was last blended to. */
interface Lines {
  object: LineSegments2;
  blendedTo: SegmentBatch | null;
  amount: number;
}

function stackedCanvas(host: HTMLElement, className: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.className = `parallax-visual-layer ${className}`;
  host.append(canvas);
  return canvas;
}

/** A round sprite for points, so a point is a dot and not a square. */
function dotTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(32, 32, 30, 0, Math.PI * 2);
    context.fill();
  }
  return new CanvasTexture(canvas);
}

/** Per-segment colours as fat-line geometry takes them: a colour for each end. */
function endColors(colors: Float32Array): Float32Array {
  const segments = colors.length / 4;
  const result = new Float32Array(segments * 6);
  for (let segment = 0; segment < segments; segment++) {
    for (let end = 0; end < 2; end++) {
      result.set(colors.subarray(segment * 4, segment * 4 + 3), segment * 6 + end * 3);
    }
  }
  return result;
}

export class ThreeDriver implements Driver {
  readonly kind = "webgl" as const;
  readonly #under: HTMLCanvasElement;
  readonly #surface: HTMLCanvasElement;
  readonly #over: HTMLCanvasElement;
  readonly #underContext: CanvasRenderingContext2D;
  readonly #overContext: CanvasRenderingContext2D;
  readonly #renderer: WebGLRenderer;
  readonly #scene = new Scene();
  readonly #content = new Group();
  readonly #dot = dotTexture();
  readonly #attributes = new Map<Batch, Attributes>();
  readonly #lines = new Map<SegmentBatch, Lines>();
  /** A mesh or point cloud per pair of frames it is drawn between — itself when still. */
  readonly #shapes = new Map<Batch, Map<Batch, Mesh | Points>>();
  readonly #images = new Map<ImageBatch, Mesh>();
  readonly #recent = new Set<Batch>();
  #size: Size = { width: 0, height: 0 };
  #ratio = 1;
  /** The stencil value the next translucent line batch claims, 1 … 255, so each covers a pixel once. */
  #nextStencil = 1;

  /** Throws when the browser gives no WebGL; the stage then draws with the Canvas driver. */
  constructor(host: HTMLElement) {
    this.#under = stackedCanvas(host, "visual-under");
    this.#surface = stackedCanvas(host, "visual-surface");
    this.#over = stackedCanvas(host, "visual-over");
    const under = this.#under.getContext("2d");
    const over = this.#over.getContext("2d");
    try {
      if (!under || !over) {
        throw new Error("A 2-D canvas is not available.");
      }
      this.#renderer = new WebGLRenderer({ canvas: this.#surface, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, stencil: true });
    } catch (failure) {
      this.#under.remove();
      this.#surface.remove();
      this.#over.remove();
      throw failure;
    }
    this.#underContext = under;
    this.#overContext = over;
    // The colours handed in are the colours meant: no conversion on the way out.
    this.#renderer.outputColorSpace = LinearSRGBColorSpace;
    this.#renderer.setClearColor(0x000000, 0);
    this.#content.matrixAutoUpdate = false;
    this.#scene.add(this.#content);
    // Physical light units: a Lambert surface reflects intensity ÷ π, so π brings the old shading back.
    this.#scene.add(new AmbientLight(0xffffff, 0.6 * Math.PI));
    const light = new DirectionalLight(0xffffff, 0.55 * Math.PI);
    light.position.set(...LIGHT_DIRECTION);
    this.#scene.add(light);
  }

  resize(size: Size, ratio: number) {
    this.#size = size;
    this.#ratio = ratio;
    for (const canvas of [this.#under, this.#over]) {
      canvas.width = Math.round(size.width * ratio);
      canvas.height = Math.round(size.height * ratio);
    }
    this.#underContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.#overContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.#renderer.setPixelRatio(ratio);
    this.#renderer.setSize(size.width, size.height, false);
    this.#lines.forEach((lines) => (lines.object.material as LineMaterial).resolution.set(size.width * ratio, size.height * ratio));
  }

  begin(background: Rgb, changed: { under: boolean; over: boolean }): { under: CanvasRenderingContext2D | null; over: CanvasRenderingContext2D | null } {
    if (changed.under) {
      this.#underContext.fillStyle = css(background);
      this.#underContext.fillRect(0, 0, this.#size.width, this.#size.height);
    }
    if (changed.over) {
      this.#overContext.clearRect(0, 0, this.#size.width, this.#size.height);
    }
    return { under: changed.under ? this.#underContext : null, over: changed.over ? this.#overContext : null };
  }

  draw(batches: readonly Batch[], transform: Transform) {
    const spatial = transform.kind === "space";
    this.#content.clear();
    this.#content.matrix.copy(modelMatrixOf(transform));
    this.#content.matrixWorldNeedsUpdate = true;
    batches.forEach((batch, order) => {
      const object = this.#objectFor(batch, spatial);
      if (object) {
        object.renderOrder = order;
        this.#content.add(object);
      }
    });
    this.#renderer.render(this.#scene, cameraOf(transform));
  }

  /**
   * Frees what this frame no longer draws — except the batches drawn lately, up to `KEPT_RECENTLY`: a looping animation
   * returns to them, and building a frame again each time round is what makes a loop stutter.
   */
  retain(batches: readonly Batch[]) {
    for (const batch of batches) {
      for (const part of batch.kind === "blend" ? [batch.from, batch.to] : [batch]) {
        this.#recent.delete(part);
        this.#recent.add(part);
      }
    }
    while (this.#recent.size > KEPT_RECENTLY) {
      this.#recent.delete(this.#recent.values().next().value as Batch);
    }
    const live = batches.length === 0 ? new Set<Batch>() : this.#recent;
    for (const [from, pairs] of this.#shapes) {
      for (const [to, shape] of pairs) {
        if (!live.has(from) || !live.has(to)) {
          shape.geometry.dispose();
          (shape.material as Material).dispose();
          pairs.delete(to);
        }
      }
      if (pairs.size === 0) {
        this.#shapes.delete(from);
      }
    }
    for (const [batch, lines] of this.#lines) {
      if (!live.has(batch)) {
        lines.object.geometry.dispose();
        (lines.object.material as Material).dispose();
        this.#lines.delete(batch);
      }
    }
    for (const [batch, image] of this.#images) {
      if (!live.has(batch)) {
        image.geometry.dispose();
        const material = image.material as MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
        this.#images.delete(batch);
      }
    }
    for (const batch of [...this.#attributes.keys()]) {
      if (!live.has(batch)) {
        this.#attributes.delete(batch);
      }
    }
  }

  snapshot(): string {
    const canvas = document.createElement("canvas");
    canvas.width = this.#surface.width;
    canvas.height = this.#surface.height;
    const context = canvas.getContext("2d");
    for (const layer of [this.#under, this.#surface, this.#over]) {
      context?.drawImage(layer, 0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL("image/png");
  }

  destroy() {
    this.#recent.clear();
    this.retain([]);
    this.#dot.dispose();
    this.#renderer.dispose();
    this.#renderer.forceContextLoss();
    this.#under.remove();
    this.#surface.remove();
    this.#over.remove();
  }

  // ─── objects ───────────────────────────────────────────────────────────────────────────────────────

  #objectFor(batch: Batch, spatial: boolean): Object3D | null {
    if (batch.kind === "image") {
      return spatial ? null : this.#image(batch);
    }
    const [from, to, amount] = batch.kind === "blend" ? [batch.from, batch.to, batch.amount] : [batch, batch, 0];
    if (from.kind === "segments") {
      return this.#segments(from, to as SegmentBatch, amount, spatial);
    }
    return this.#shape(from, to, amount, spatial);
  }

  #attributesOf(batch: TriangleBatch | PointBatch): Attributes {
    let attributes = this.#attributes.get(batch);
    if (!attributes) {
      attributes = {
        position: new BufferAttribute(batch.positions, 3),
        normal: batch.kind === "triangles" && batch.normals ? new BufferAttribute(batch.normals, 3) : null,
        color: new BufferAttribute(batch.colors, 4),
        index: batch.kind === "triangles" ? new BufferAttribute(batch.indices, 1) : null,
      };
      this.#attributes.set(batch, attributes);
    }
    return attributes;
  }

  /** A mesh or a point cloud drawn from one frame toward another by a morph target; still, toward itself. */
  #shape(from: TriangleBatch | PointBatch, to: Geometry, amount: number, spatial: boolean): Mesh | Points {
    const pairs = this.#shapes.get(from) ?? new Map<Batch, Mesh | Points>();
    this.#shapes.set(from, pairs);
    let shape = pairs.get(to);
    if (!shape) {
      const start = this.#attributesOf(from);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", start.position);
      geometry.setAttribute("color", start.color);
      if (start.normal) {
        geometry.setAttribute("normal", start.normal);
      }
      if (start.index) {
        geometry.setIndex(start.index);
      }
      if (to !== from && to.kind !== "segments") {
        const end = this.#attributesOf(to);
        geometry.morphAttributes.position = [end.position];
        if (start.normal && end.normal) {
          geometry.morphAttributes.normal = [end.normal];
        }
      }
      if (from.kind === "triangles") {
        const material = from.lit
          ? new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })
          : new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
        if (!from.normals && from.lit) {
          geometry.computeVertexNormals();
        }
        shape = new Mesh(geometry, material);
      } else {
        shape = new Points(geometry, new PointsMaterial({ size: from.size * this.#ratio, sizeAttenuation: false, vertexColors: true, map: this.#dot, alphaTest: 0.5, transparent: true }));
      }
      shape.frustumCulled = false;
      pairs.set(to, shape);
    }
    const material = shape.material as Material;
    material.depthTest = spatial;
    material.depthWrite = spatial && from.kind === "triangles";
    if (to !== from) {
      shape.morphTargetInfluences = [amount];
    }
    return shape;
  }

  /** Fat lines; blended toward the next frame by writing their vertices, which are few. */
  #segments(from: SegmentBatch, to: SegmentBatch, amount: number, spatial: boolean): LineSegments2 {
    let lines = this.#lines.get(from);
    if (!lines) {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(Float32Array.from(from.positions));
      geometry.setColors(endColors(from.colors));
      const alpha = from.colors.length >= 4 ? from.colors[3] : 1;
      const material = new LineMaterial({ vertexColors: true, linewidth: from.width * this.#ratio, transparent: alpha < 1, opacity: alpha, worldUnits: false });
      material.resolution.set(this.#size.width * this.#ratio, this.#size.height * this.#ratio);
      if (alpha < 1) {
        // Segments overlap where they meet; blended twice, a translucent line turns to beads. Each translucent batch
        // claims a stencil value and draws a pixel only where that value is not written yet.
        material.stencilWrite = true;
        material.stencilRef = this.#nextStencil;
        material.stencilFunc = NotEqualStencilFunc;
        material.stencilZPass = ReplaceStencilOp;
        this.#nextStencil = this.#nextStencil % 255 + 1;
      }
      const object = new LineSegments2(geometry, material);
      object.frustumCulled = false;
      lines = { object, blendedTo: null, amount: 0 };
      this.#lines.set(from, lines);
    }
    const material = lines.object.material as LineMaterial;
    material.depthTest = spatial;
    material.depthWrite = false;
    const target = to !== from && amount > 0 ? to : null;
    if (lines.blendedTo !== target || lines.amount !== amount) {
      const start = lines.object.geometry.getAttribute("instanceStart") as unknown as { data: { array: Float32Array; needsUpdate: boolean } };
      const array = start.data.array;
      if (target) {
        for (let index = 0; index < array.length; index++) {
          array[index] = from.positions[index] + (target.positions[index] - from.positions[index]) * amount;
        }
      } else {
        array.set(from.positions);
      }
      start.data.needsUpdate = true;
      lines.blendedTo = target;
      lines.amount = target ? amount : 0;
    }
    return lines.object;
  }

  /** A raster as a texture on the plane, its first row at the top. */
  #image(batch: ImageBatch): Mesh {
    let image = this.#images.get(batch);
    if (!image) {
      const texture = new DataTexture(new Uint8Array(batch.pixels.buffer, batch.pixels.byteOffset, batch.pixels.byteLength), batch.columns, batch.rows, RGBAFormat);
      texture.premultiplyAlpha = true;
      texture.magFilter = batch.smooth ? LinearFilter : NearestFilter;
      texture.minFilter = batch.smooth ? LinearFilter : NearestFilter;
      texture.generateMipmaps = false;
      // Rows arrive top first; a texture counts them from the bottom.
      texture.repeat.set(1, -1);
      texture.offset.set(0, 1);
      texture.needsUpdate = true;
      const { xMinimum, xMaximum, yMinimum, yMaximum } = batch.extent;
      image = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
      image.scale.set(xMaximum - xMinimum, yMaximum - yMinimum, 1);
      image.position.set((xMinimum + xMaximum) / 2, (yMinimum + yMaximum) / 2, 0);
      image.frustumCulled = false;
      this.#images.set(batch, image);
    }
    return image;
  }
}

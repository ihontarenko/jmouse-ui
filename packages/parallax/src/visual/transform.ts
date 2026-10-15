import { Matrix4, OrthographicCamera, PerspectiveCamera, Vector3, type Camera } from "three";
import type { PlaneView, Size } from "./plane";
import type { Projector, SpaceCamera, SpaceFrame } from "./space";

/**
 * How data reaches the screen: through the plane's view, or through the space frame and its camera. Both are real
 * three.js cameras — orthographic on the plane, perspective (or orthographic) turning round the data in space — and
 * every driver uses them: the WebGL driver renders through them, the Canvas driver projects points with their matrices,
 * so a thumbnail and a live view of the same data coincide.
 */
export type Transform =
  | { kind: "plane"; size: Size; view: PlaneView }
  | { kind: "space"; size: Size; camera: SpaceCamera; frame: SpaceFrame };

const FIELD_OF_VIEW = 30;

/** Pixels one unit of the frame's box spans at its centre — the box of ±2 fills about half the canvas at zoom 1. */
function boxScale(size: Size, camera: SpaceCamera): number {
  return Math.min(size.width / 7.6, size.height / 5.8) * camera.zoom;
}

/** The camera a transform looks through. */
export function cameraOf(transform: Transform): Camera {
  const { size } = transform;
  const aspect = size.width / Math.max(1, size.height);
  if (transform.kind === "plane") {
    const { view } = transform;
    const halfWidth = size.width / 2 / view.unitX;
    const halfHeight = size.height / 2 / view.unitY;
    const camera = new OrthographicCamera(view.centerX - halfWidth, view.centerX + halfWidth, view.centerY + halfHeight, view.centerY - halfHeight, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld();
    return camera;
  }
  const { azimuth, elevation, projection } = transform.camera;
  const scale = boxScale(size, transform.camera);
  // Seen from the side the azimuth names, above by the elevation, z up: screen right is (cos a, −sin a, 0).
  const direction = new Vector3(-Math.sin(azimuth) * Math.cos(elevation), -Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation));
  let camera: PerspectiveCamera | OrthographicCamera;
  if (projection === "orthographic") {
    const halfWidth = size.width / 2 / scale;
    const halfHeight = size.height / 2 / scale;
    camera = new OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 100);
    camera.position.copy(direction.multiplyScalar(20));
  } else {
    // At this distance one box unit at the centre spans `scale` pixels, as the box was framed before.
    const distance = size.height / 2 / (scale * Math.tan((FIELD_OF_VIEW / 2) * Math.PI / 180));
    camera = new PerspectiveCamera(FIELD_OF_VIEW, aspect, 0.05, distance * 10 + 50);
    camera.position.copy(direction.multiplyScalar(distance));
  }
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

/** Data units into the frame's box: the space frame's centre and scales; nothing on the plane. */
export function modelMatrixOf(transform: Transform): Matrix4 {
  if (transform.kind === "plane") {
    return new Matrix4();
  }
  const { center, scaleHorizontal, scaleVertical } = transform.frame;
  return new Matrix4().makeScale(scaleHorizontal, scaleHorizontal, scaleVertical)
    .multiply(new Matrix4().makeTranslation(-center[0], -center[1], -center[2]));
}

function projectorThrough(transform: Transform, model: Matrix4 | null): Projector {
  const camera = cameraOf(transform);
  const { width, height } = transform.size;
  const point = new Vector3();
  return (x, y, z) => {
    point.set(x, y, z);
    if (model) {
      point.applyMatrix4(model);
    }
    point.project(camera);
    return [(point.x + 1) / 2 * width, (1 - point.y) / 2 * height, point.z];
  };
}

/** Data units to screen pixels and depth (larger is farther). */
export function projectorOf(transform: Transform): Projector {
  return projectorThrough(transform, transform.kind === "space" ? modelMatrixOf(transform) : null);
}

/** The frame's box to screen pixels — the floor and the axes of space are drawn in it. */
export function boxProjectorOf(transform: Extract<Transform, { kind: "space" }>): Projector {
  return projectorThrough(transform, null);
}

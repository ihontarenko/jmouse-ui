/**
 * Where the picture sits behind the frame — the whole of it, and nothing that touches the DOM.
 *
 * ⚠️ **There is exactly one transform, and both the preview and the encoder replay it.** The version
 * this replaces kept two descriptions of the same rectangle — a CSS `translate` laying the preview out,
 * and a separate routine recomputing the region in source pixels for the canvas — and its own comment
 * records what that cost: the second read the offset from the image's corner while the first measured
 * it from its centre, so every photograph nobody dragged was saved as its top-left corner. Two
 * descriptions of one rectangle will disagree eventually. This is the one.
 *
 * The chain, outermost first, is: put the image's centre at the frame's centre, shift it by the pan,
 * turn it, scale it. `placementOf` writes it for CSS and `encodeCrop` writes the same thing for a
 * canvas context; nothing else may write it at all.
 */

export interface Dimensions {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** How the image is laid over the frame. Offsets are in frame pixels, the rotation in radians. */
export interface CropPlacement {
  offset: Point
  rotation: number
  scale: number
}

export function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest)
}

export function rotatePoint(point: Point, radians: number): Point {
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)

  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  }
}

/**
 * The frame, measured along the image's own axes.
 *
 * Turning the image by `rotation` is the same as turning the frame by `-rotation` underneath it, and a
 * turned rectangle needs its bounding box to be reasoned about. Every limit below is that box.
 */
function frameSpanOf(frame: Dimensions, rotation: number): Dimensions {
  const cosine = Math.abs(Math.cos(rotation))
  const sine = Math.abs(Math.sin(rotation))

  return {
    width: frame.width * cosine + frame.height * sine,
    height: frame.width * sine + frame.height * cosine,
  }
}

/**
 * The smallest scale at which the turned image still covers every corner of the frame.
 *
 * This is what zoom 1 means, and it is why zoom never goes below 1: under it the frame would take in
 * area the picture does not cover, and the encoder would fill it with whatever the canvas started as.
 */
export function coverScaleOf(image: Dimensions, frame: Dimensions, rotation: number): number {
  const span = frameSpanOf(frame, rotation)

  return Math.max(span.width / image.width, span.height / image.height)
}

/**
 * How far the frame's centre may travel from the image's — **along the image's own axes**, not the
 * screen's.
 */
export function panLimitsOf(
  image: Dimensions,
  frame: Dimensions,
  scale: number,
  rotation: number
): Point {
  const span = frameSpanOf(frame, rotation)

  return {
    x: Math.max(0, (image.width * scale - span.width) / 2),
    y: Math.max(0, (image.height * scale - span.height) / 2),
  }
}

/**
 * Pulls a pan back inside its limits.
 *
 * ⚠️ **The clamping happens in the image's rotated basis and is turned back afterwards.** Clamping the
 * screen-space offset against those limits looks right and is silently wrong at every angle that is
 * not a right one: the frame slides off the corner of the picture while both numbers are still inside
 * their bounds.
 */
export function confinedOffsetOf(
  offset: Point,
  image: Dimensions,
  frame: Dimensions,
  scale: number,
  rotation: number
): Point {
  const limits = panLimitsOf(image, frame, scale, rotation)
  const alongImage = rotatePoint(offset, -rotation)

  return rotatePoint(
    {
      x: clamp(alongImage.x, -limits.x, limits.x),
      y: clamp(alongImage.y, -limits.y, limits.y),
    },
    rotation
  )
}

/**
 * The frame that fits the given ratio into the space available, less a margin so the picture is still
 * visible around it.
 */
export function frameFittingIn(available: Dimensions, aspect: number, margin: number): Dimensions {
  const width = Math.max(1, available.width - margin * 2)
  const height = Math.max(1, available.height - margin * 2)

  if (width / height > aspect) {
    return { width: height * aspect, height }
  }

  return { width, height: width / aspect }
}

/**
 * The placement written as a CSS `transform`, for an element whose `transform-origin` is its centre and
 * whose size is the image's own.
 *
 * The leading translate is what puts the image's centre on the frame's; the rest is the pan, the turn
 * and the scale, in the order {@link transformIntoContext} applies them to a canvas.
 *
 * ⚠️ **`container` is the box the element is positioned in, not the frame** — they share a centre,
 * which is the only thing this needs, and they are the same size only when the frame fills the stage.
 */
export function transformOf(
  placement: CropPlacement,
  image: Dimensions,
  container: Dimensions
): string {
  const centringX = container.width / 2 - image.width / 2
  const centringY = container.height / 2 - image.height / 2

  return [
    `translate(${centringX + placement.offset.x}px, ${centringY + placement.offset.y}px)`,
    `rotate(${placement.rotation}rad)`,
    `scale(${placement.scale})`,
  ].join(" ")
}

/**
 * The chosen region's size in source pixels, for a caller that asked for no particular output size.
 *
 * ⚠️ **It does not depend on how big the preview happens to be.** `scale` carries the frame's own size
 * in it, so the division cancels it out and only the ratio survives — which is what makes an untouched
 * crop of a 4000-pixel photograph come back at 4000 pixels rather than at the 320 the dialog was drawn
 * at.
 */
export function naturalOutputOf(frame: Dimensions, scale: number, ceiling: number): Dimensions {
  const width = frame.width / scale
  const height = frame.height / scale
  const restraint = Math.min(1, ceiling / Math.max(width, height))

  return {
    width: Math.max(1, Math.round(width * restraint)),
    height: Math.max(1, Math.round(height * restraint)),
  }
}

/**
 * The same chain again, written into a canvas context.
 *
 * ⚠️ **This function and {@link transformOf} are the pair that must never drift.** The magnification is
 * read from the surface rather than passed in, so a surface drawn at four times the frame — which is
 * what a heavy reduction renders into before halving down — needs nothing said about it here.
 */
export function transformIntoContext(
  context: CanvasRenderingContext2D,
  placement: CropPlacement,
  frame: Dimensions,
  surface: Dimensions
): void {
  const magnification = surface.width / frame.width

  context.translate(surface.width / 2, surface.height / 2)
  context.scale(magnification, magnification)
  context.translate(placement.offset.x, placement.offset.y)
  context.rotate(placement.rotation)
  context.scale(placement.scale, placement.scale)
}

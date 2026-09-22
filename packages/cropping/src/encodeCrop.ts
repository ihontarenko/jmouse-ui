/**
 * Turning what the frame is showing into the bytes that get uploaded.
 *
 * ⚠️ **The crop happens in the browser, before the upload, and that is a division of labour rather than
 * a shortcut.** A phone photograph is several megabytes of a scene and what a product needs is a
 * kilobyte-sized region of it: doing it here means no backend carries an imaging dependency, none of
 * them spends CPU on a resize, and every one can keep a size ceiling low enough to mean something. It
 * also means the person sees the crop they are getting instead of discovering it afterwards.
 */

import {
  naturalOutputOf,
  transformIntoContext,
  type CropPlacement,
  type Dimensions,
} from "./cropGeometry"
import {
  OPAQUE_FALLBACK,
  mimeTypeForFormat,
  type ImageCropSpecification,
} from "./cropSpecification"

/** The largest side an unsized output may reach, so a 100-megapixel canvas is never asked for. */
export const OUTPUT_CEILING = 4096

/** How many halving passes a heavy reduction may take. Four is a factor of sixteen. */
const REDUCTION_PASSES = 4

export interface CropEncodeRequest {
  image: CanvasImageSource
  imageSize: Dimensions
  frame: Dimensions
  placement: CropPlacement
  specification: ImageCropSpecification
}

/** The size the result is encoded at, once the specification has been read against the frame. */
export function outputSizeOf(request: CropEncodeRequest): Dimensions {
  const { frame, placement, specification } = request
  const aspect = frame.width / frame.height

  if (specification.outputWidth && specification.outputHeight) {
    return { width: specification.outputWidth, height: specification.outputHeight }
  }

  if (specification.outputWidth) {
    return {
      width: specification.outputWidth,
      height: Math.max(1, Math.round(specification.outputWidth / aspect)),
    }
  }

  if (specification.outputHeight) {
    return {
      width: Math.max(1, Math.round(specification.outputHeight * aspect)),
      height: specification.outputHeight,
    }
  }

  return naturalOutputOf(frame, placement.scale, OUTPUT_CEILING)
}

/**
 * @throws when the browser will not hand out a drawing surface, or refuses to encode the result
 *
 * ⚠️ **Quality is withheld for PNG.** It is lossless, so there is nothing for the number to mean — and
 * some browsers answer a quality on a PNG by silently encoding a different format instead of ignoring
 * it, which is a JPEG arriving with a `.png` name.
 */
export async function encodeCrop(request: CropEncodeRequest): Promise<Blob> {
  const { specification } = request
  const output = outputSizeOf(request)
  const canvas = drawCrop(request, output)

  return await encodeCanvas(canvas, specification)
}

/**
 * Draws the region at the output size, reducing in halves when the reduction is a heavy one.
 *
 * ⚠️ **One `drawImage` from four thousand pixels to two hundred and fifty-six is visibly worse than
 * four from four thousand.** Every browser's single-pass filter is a compromise struck for scrolling
 * photographs, not for a sixteen-fold reduction, and what it leaves on a face is the aliasing people
 * describe as "the picture went crunchy". Halving down is the standard answer and costs a few
 * milliseconds once.
 */
function drawCrop(request: CropEncodeRequest, output: Dimensions): HTMLCanvasElement {
  const { image, imageSize, frame, placement, specification } = request

  const sourcePixelsPerOutputPixel = frame.width / placement.scale / output.width
  const passes = Math.max(
    0,
    Math.min(REDUCTION_PASSES, Math.floor(Math.log2(sourcePixelsPerOutputPixel)))
  )

  const magnification = 2 ** passes
  let canvas = surfaceOf(output.width * magnification, output.height * magnification)
  const context = contextOf(canvas)

  paintBackground(context, canvas, specification)
  transformIntoContext(context, placement, frame, canvas)
  context.drawImage(image, -imageSize.width / 2, -imageSize.height / 2, imageSize.width, imageSize.height)

  for (let pass = 0; pass < passes; pass += 1) {
    canvas = halved(canvas)
  }

  return canvas
}

function halved(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = surfaceOf(Math.max(1, source.width / 2), Math.max(1, source.height / 2))
  const context = contextOf(canvas)

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(source, 0, 0, canvas.width, canvas.height)

  return canvas
}

/**
 * ⚠️ **Transparency is filled in before anything is drawn when the format cannot keep it.** A JPEG
 * encoded from a canvas nobody painted first is a picture on a black background — the format has no
 * alpha, and the untouched surface it flattens is transparent black.
 */
function paintBackground(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  specification: ImageCropSpecification
): void {
  const colour =
    specification.background ?? (specification.format === "jpeg" ? OPAQUE_FALLBACK : null)

  if (!colour) {
    return
  }

  context.fillStyle = colour
  context.fillRect(0, 0, canvas.width, canvas.height)
}

function surfaceOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")

  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))

  return canvas
}

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("This browser would not provide a drawing surface.")
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"

  return context
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  specification: ImageCropSpecification
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error("The cropped image could not be encoded."))
      },
      mimeTypeForFormat(specification.format),
      specification.format === "png" ? undefined : specification.quality
    )
  })
}

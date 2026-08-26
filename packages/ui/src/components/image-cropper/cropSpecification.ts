/**
 * What a cropper is being asked for.
 *
 * ⚠️ **One specification rather than a component per call site.** Before this, three products carried
 * byte-identical copies of a cropper that could only ever produce a 256-pixel square, and a fourth
 * implementation existed purely because one screen needed a rectangle and a quality setting. Every
 * difference between those four is a field here.
 */

/** How the chosen region is drawn, and — for the first two — what it fixes the ratio to. */
export type CropShape = "circle" | "square" | "rectangle"

export type ImageFormat = "png" | "jpeg" | "webp"

export interface ImageCropSpecification {
  shape: CropShape
  /**
   * Width over height of the chosen region.
   *
   * `null` means the source image's own ratio, which is what an offered crop on an arbitrary
   * attachment wants: the frame opens around the whole picture and nothing is lost by accepting it.
   * Ignored for `circle` and `square`, which are 1 by definition.
   */
  aspect: number | null
  /** Pixels the result is encoded at. `null` for both means the region's own size in source pixels. */
  outputWidth: number | null
  outputHeight: number | null
  format: ImageFormat
  /** 0–1, and ⚠️ ignored for PNG — see {@link encodeCrop}. */
  quality: number
  /** How far past "just covers the frame" the image may be pushed. */
  maximumZoom: number
  rotatable: boolean
  /** The rule-of-thirds overlay. Off for a circular frame, where thirds mean nothing. */
  guides: boolean
  /**
   * What shows through the source image's transparency.
   *
   * `null` keeps it transparent — which PNG and WebP can store and ⚠️ **JPEG cannot**, so a JPEG is
   * flattened onto {@link OPAQUE_FALLBACK} rather than onto the black every canvas would otherwise
   * give it.
   */
  background: string | null
}

/** What a transparent pixel becomes when the format cannot keep it. */
export const OPAQUE_FALLBACK = "#ffffff"

export const DEFAULT_CROP_SPECIFICATION: ImageCropSpecification = {
  shape: "rectangle",
  aspect: null,
  outputWidth: null,
  outputHeight: null,
  format: "jpeg",
  quality: 0.92,
  maximumZoom: 5,
  rotatable: true,
  guides: true,
  background: null,
}

/**
 * A face.
 *
 * ⚠️ **256 PNG is a stored contract, not a preference.** Every avatar already in every product is one,
 * the backends' upload allowlists were written around it, and a cropper that quietly began producing
 * WebP would be a storage change wearing a component's clothes.
 */
export const AVATAR_CROP: Partial<ImageCropSpecification> = {
  shape: "circle",
  outputWidth: 256,
  outputHeight: 256,
  format: "png",
  guides: false,
}

/** A square that is not a face — a logo, a tile, a thumbnail. */
export const SQUARE_CROP: Partial<ImageCropSpecification> = {
  shape: "square",
  outputWidth: 512,
  outputHeight: 512,
  format: "png",
}

/** The wide strip across the top of something. */
export const COVER_CROP: Partial<ImageCropSpecification> = {
  shape: "rectangle",
  aspect: 16 / 9,
  outputWidth: 1600,
  format: "jpeg",
  quality: 0.9,
}

/** Keep the picture's own proportions; the person is trimming, not reshaping. */
export const FREE_CROP: Partial<ImageCropSpecification> = {
  shape: "rectangle",
  aspect: null,
  outputWidth: null,
  outputHeight: null,
  format: "png",
  guides: true,
}

/**
 * The specification for a crop somebody was offered rather than required to make.
 *
 * ⚠️ **It keeps the picture's own format.** An offered crop that quietly turns a 400 kB JPEG
 * photograph into a six-megabyte PNG has changed something nobody asked it to change — and the person
 * who accepted the offer has no way of knowing it did. A format the cropper cannot write (a GIF, an
 * AVIF) falls back to `base`, because a still is what a crop of one is anyway.
 */
export function keepingFormatOf(
  file: { type: string },
  base: Partial<ImageCropSpecification> = FREE_CROP
): Partial<ImageCropSpecification> {
  const format = FORMAT_BY_MIME[file.type]

  return format ? { ...base, format } : base
}

const FORMAT_BY_MIME: Record<string, ImageFormat> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
}

const MIME_TYPES: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
}

const EXTENSIONS: Record<ImageFormat, string> = {
  png: ".png",
  jpeg: ".jpg",
  webp: ".webp",
}

export function mimeTypeForFormat(format: ImageFormat): string {
  return MIME_TYPES[format]
}

export function extensionForFormat(format: ImageFormat): string {
  return EXTENSIONS[format]
}

/**
 * Fills a partial specification in, and settles the ratio.
 *
 * ⚠️ **Two output dimensions imply the ratio, and win over `shape: "rectangle"` saying nothing.** A
 * caller that asks for 400×300 and is given a portrait region gets an image squashed on every screen
 * that renders it — the region has to be the shape the output is.
 */
export function cropSpecificationOf(
  requested?: Partial<ImageCropSpecification>
): ImageCropSpecification {
  const specification = { ...DEFAULT_CROP_SPECIFICATION, ...requested }

  return { ...specification, aspect: settledAspectOf(specification) }
}

function settledAspectOf(specification: ImageCropSpecification): number | null {
  if (specification.shape === "circle" || specification.shape === "square") {
    return 1
  }

  if (specification.aspect) {
    return specification.aspect
  }

  if (specification.outputWidth && specification.outputHeight) {
    return specification.outputWidth / specification.outputHeight
  }

  return null
}

/**
 * The ratio the frame is actually drawn at, once the picture is known.
 *
 * A settled specification may still say `null` — "whatever the picture is" — and only the picture can
 * answer that.
 */
export function frameAspectOf(
  specification: ImageCropSpecification,
  image: { width: number; height: number }
): number {
  return specification.aspect ?? image.width / image.height
}

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

/**
 * A shape somebody may switch the frame to, offered as a row of choices under the picture.
 *
 * ⚠️ **`aspect: null` is the picture's own proportions, and it is an answer rather than the absence of
 * one.** "Trim it, do not reshape it" is what most people want from most attachments, and a row that
 * only listed fixed ratios would have no way to say it — leaving the one common intention as the one
 * thing the control could not express.
 */
export interface CropRatio {
  label: string
  aspect: number | null
}

/**
 * The shapes worth offering when the caller has no opinion beyond "let them choose".
 *
 * Portrait sits beside landscape rather than being reached by turning the picture: a phone photograph
 * cropped to 9:16 and the same one cropped to 16:9 are two different pictures, and rotating to reach
 * the second would take the subject with it.
 */
export const COMMON_RATIOS: CropRatio[] = [
  { label: "Original", aspect: null },
  { label: "Square", aspect: 1 },
  { label: "4:3", aspect: 4 / 3 },
  { label: "3:2", aspect: 3 / 2 },
  { label: "16:9", aspect: 16 / 9 },
  { label: "3:4", aspect: 3 / 4 },
  { label: "9:16", aspect: 9 / 16 },
]

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
  /**
   * The shapes offered as a row under the picture, letting the person change {@link aspect} while
   * framing.
   *
   * ⚠️ **`null` offers nothing, and that is the right answer for most callers.** An avatar, a tile and
   * a cover are each one shape the product renders at; offering to change it would be offering to
   * break the layout it was measured for. The row is for the case where the shape is the person's —
   * a picture they are attaching, not a slot they are filling.
   */
  ratios: CropRatio[] | null
  /**
   * Whether the frame's corners may be dragged to a shape nobody listed.
   *
   * ⚠️ **Dragging a corner changes the frame's PROPORTIONS, not its size on screen.** The frame is
   * always fitted as large as the stage allows, because how big it is drawn says nothing — which part
   * of the picture is taken is set by the pan and the zoom, and the frame's only remaining freedom is
   * its shape. A grip that also shrank the frame would be a second, slower way of zooming out.
   */
  resizable: boolean
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
  ratios: null,
  resizable: false,
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

/**
 * The picture's own proportions to begin with, and every other shape within reach.
 *
 * ⚠️ **This is the one preset where the shape belongs to the person, so it is the one that offers the
 * row.** The others each name a slot the product renders at. Here there is no slot: somebody is
 * attaching a picture, and whether they want it square, wide or exactly as it came off the camera is
 * not a question the product has any standing to answer for them.
 */
export const FREE_CROP: Partial<ImageCropSpecification> = {
  shape: "rectangle",
  aspect: null,
  outputWidth: null,
  outputHeight: null,
  format: "png",
  ratios: COMMON_RATIOS,
  resizable: true,
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

  /**
   * ⚠️ **Offering shapes settles the first one — the frame OPENS on it.** A caller that lists
   * `[Square]` and gets a frame the picture's own proportions has been ignored: the list is what that
   * caller thinks this picture is for, and the first entry is its answer. Without this the row drew a
   * *Square* chip nobody had pressed beside a frame that was not square, which reads as a broken
   * control rather than as an offer.
   *
   * It changes nothing for the general case, and deliberately: {@link COMMON_RATIOS} leads with
   * *Original*, whose aspect is `null`, so "let them choose from everything" still opens on the
   * picture's own proportions.
   */
  return specification.ratios?.[0]?.aspect ?? null
}

/**
 * The specification as it stands once somebody has chosen a different shape while framing.
 *
 * ⚠️ **A chosen shape gives up the second output dimension.** A caller asking for 400×300 is asking two
 * things at once — a 4:3 region, and a 400×300 file — and the moment the frame becomes a square those
 * two cannot both be honoured. The one that gives way is the file's second number: `outputSizeOf` then
 * reads the height off the frame, so the result is 400×400 rather than a square wrung out into a
 * landscape box. The width survives because it is the one that carries the *intent* — "about this
 * big" — while the height was only ever the ratio said twice.
 */
export function reshapedTo(
  specification: ImageCropSpecification,
  aspect: number | null
): ImageCropSpecification {
  if (aspect === specification.aspect) {
    return specification
  }

  return {
    ...specification,
    aspect,
    outputHeight: specification.outputWidth ? null : specification.outputHeight,
  }
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

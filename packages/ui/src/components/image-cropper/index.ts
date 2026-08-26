/**
 * The image cropper: one surface, one specification, and the maths behind both kept out of the DOM.
 *
 * ⚠️ **Nothing here calls an API and nothing here knows a product.** A cropper produces bytes; who
 * stores them, under what route, and what happens when that fails, is the caller's — which is exactly
 * why the three copies this replaces could never have been shared as they stood.
 *
 * ⚠️ **The geometry is deliberately not re-exported.** `clamp`, `Point` and `Dimensions` are names a
 * render layer used by three products should not be spending, and nothing outside this folder has a
 * reason for them: a caller frames a picture and asks for the bytes. Import from
 * `@jmouse/ui/…/image-cropper/cropGeometry` knowingly, or not at all.
 */

export {
  ImageCropper,
  type ImageCropperHandle,
  type ImageCropperLabels,
  type ImageCropperProperties,
} from "./ImageCropper"

export {
  ImageCropperDialog,
  type ImageCropperDialogLabels,
  type ImageCropperDialogProperties,
} from "./ImageCropperDialog"

export {
  AVATAR_CROP,
  COVER_CROP,
  DEFAULT_CROP_SPECIFICATION,
  FREE_CROP,
  OPAQUE_FALLBACK,
  SQUARE_CROP,
  cropSpecificationOf,
  extensionForFormat,
  keepingFormatOf,
  mimeTypeForFormat,
  type CropShape,
  type ImageCropSpecification,
  type ImageFormat,
} from "./cropSpecification"

export { isCroppableImage } from "./imageSource"

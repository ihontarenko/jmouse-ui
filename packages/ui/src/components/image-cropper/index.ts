/**
 * The image cropper: one surface, one specification, and the maths behind both in another package.
 *
 * ⚠️ **The cropper itself is `@jmouse/cropping`, and this is only its shadcn clothes.** Every piece of
 * state and behaviour lives in `useImageCropper` there, so a product that draws its own cropper in its
 * own look shares the geometry, the gestures and the encoder rather than re-implementing them. See
 * that package's README for why the split exists at all.
 *
 * ⚠️ **The specification is re-exported here rather than moved out of reach.** `ImageCropSpecification`
 * and the four presets are what a caller of `ImageCropper` names, and asking a screen that already
 * imports from `@jmouse/ui` to reach into a second package for the argument to a component in this one
 * would be a split nobody outside this file has a reason to know about.
 *
 * ⚠️ **Nothing here calls an API and nothing here knows a product.** A cropper produces bytes; who
 * stores them, under what route, and what happens when that fails, is the caller's — which is exactly
 * why the copies this replaced could never have been shared as they stood.
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
  COMMON_RATIOS,
  COVER_CROP,
  DEFAULT_CROP_SPECIFICATION,
  FREE_CROP,
  OPAQUE_FALLBACK,
  SQUARE_CROP,
  cropSpecificationOf,
  extensionForFormat,
  isCroppableImage,
  keepingFormatOf,
  mimeTypeForFormat,
  reshapedTo,
  type CropRatio,
  type CropShape,
  type ImageCropSpecification,
  type ImageFormat,
} from "@jmouse/cropping"

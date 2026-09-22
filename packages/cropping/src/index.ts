/**
 * Framing a picture before it is uploaded — the maths, the encoder, and the behaviour, with no design
 * system anywhere in it.
 *
 * ⚠️ **This package draws nothing.** `useImageCropper` holds every piece of state a cropper has and
 * hands back what a surface needs to lay one out; the buttons, the stage and the slider belong to
 * whichever product is drawing. `@jmouse/ui`'s `ImageCropper` is one such surface and has no privilege
 * over any other — which is what lets an interface with its own look crop a picture without carrying a
 * second implementation of the geometry.
 *
 * ⚠️ **The geometry is deliberately not re-exported.** `clamp`, `Point` and `Dimensions` are names a
 * render layer used by four products should not be spending, and a surface has no reason for them: it
 * is handed a layout and asks for the bytes. `Dimensions` comes through {@link CropperLayout} where it
 * is actually needed. Import from `@jmouse/cropping/…` knowingly, or not at all.
 */

export {
  cropGripHandlers,
  useImageCropper,
  type CropGrip,
  type CropStageProperties,
  type CropperLayout,
  type ImageCropperState,
  type UseImageCropperOptions,
} from "./useImageCropper"

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
  keepingFormatOf,
  mimeTypeForFormat,
  reshapedTo,
  type CropRatio,
  type CropShape,
  type ImageCropSpecification,
  type ImageFormat,
} from "./cropSpecification"

export { isCroppableImage } from "./imageSource"

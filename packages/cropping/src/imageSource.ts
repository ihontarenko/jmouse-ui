/**
 * Getting a picture off somebody's disk and into a shape the cropper can lay out.
 */

/** A decoded picture, and the one thing that has to happen when it stops being displayed. */
export interface LoadedImage {
  element: HTMLImageElement
  width: number
  height: number
  /** Revokes the object URL behind `element`. Call it once, when the picture is no longer shown. */
  release: () => void
}

/**
 * Decodes a file, or takes an address that is already one.
 *
 * ⚠️ **An object URL rather than a data URL.** A data URL base64-encodes the whole file into a string,
 * so an eight-megabyte photograph becomes eleven megabytes of JavaScript string built before anything
 * is drawn. The price of the object URL is having to revoke it, which `release` is for — and a caller
 * that passes an address in gets a `release` that does nothing, because the address was never ours.
 */
export function loadImage(source: File | Blob | string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const ours = typeof source !== "string"
    const address = ours ? URL.createObjectURL(source) : source
    const element = new Image()

    // Only ever set for an address the caller passed in: a picture served from another origin with no
    // permissive header taints the canvas, and `toBlob` then throws a security error at the very end
    // of the flow rather than at the start.
    if (!ours) {
      element.crossOrigin = "anonymous"
    }

    element.onload = () => {
      resolve({
        element,
        width: element.naturalWidth,
        height: element.naturalHeight,
        release: () => {
          if (ours) {
            URL.revokeObjectURL(address)
          }
        },
      })
    }

    element.onerror = () => {
      if (ours) {
        URL.revokeObjectURL(address)
      }

      reject(new Error("That file could not be read as an image."))
    }

    element.src = address
  })
}

/**
 * Whether a file is a picture this cropper can frame.
 *
 * ⚠️ **SVG is deliberately not one.** It would decode and draw, and the result would be a raster of a
 * thing whose whole point is that it is not one — a logo uploaded as SVG and handed back as a 512-pixel
 * PNG is a downgrade nobody asked for. So an offered crop is never offered for it.
 */
export function isCroppableImage(file: File | Blob): boolean {
  return ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(file.type)
}

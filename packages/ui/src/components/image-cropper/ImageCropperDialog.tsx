import * as React from "react"

import { Button } from "../button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog"
import { ImageCropper, type ImageCropperHandle, type ImageCropperLabels } from "./ImageCropper"
import { cropSpecificationOf, type ImageCropSpecification } from "@jmouse/cropping"

export interface ImageCropperDialogLabels extends Partial<ImageCropperLabels> {
  title: string
  /** Shown under the title. Omitted from the defaults when the specification fixes an output size. */
  description: string
  cancel: string
  confirm: string
  skip: string
  working: string
  failed: string
}

const DEFAULT_LABELS: ImageCropperDialogLabels = {
  title: "Frame the picture",
  description: "",
  cancel: "Cancel",
  confirm: "Use this crop",
  skip: "Upload as it is",
  working: "Working…",
  failed: "That crop could not be produced. Try a different area.",
}

export interface ImageCropperDialogProperties {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The picture to frame. `null` closes the flow without asking the cropper to decode anything. */
  source: File | Blob | string | null
  specification?: Partial<ImageCropSpecification>
  /**
   * Whether the crop may be declined.
   *
   * ⚠️ **An offered crop and a required one are the same dialog with one control between them.** A
   * shape a product renders at — a face, a tile, a cover — has to be framed or it will be framed badly
   * by a machine. A file somebody is attaching does not: forcing a crop there turns attaching a
   * screenshot into a chore, and re-encodes an original nobody asked to change.
   */
  skippable?: boolean
  onCropped: (cropped: File) => void
  /** Called instead of `onCropped` when a skippable crop is declined. */
  onSkipped?: () => void
  /** Whether the surrounding screen is saving. The product owns the call, so it owns the spinner. */
  busy?: boolean
  labels?: Partial<ImageCropperDialogLabels>
}

/**
 * The whole flow around {@link ImageCropper}: frame it, confirm it, hand the bytes back.
 *
 * The dialog never uploads anything — it produces a `File` and lets the product save it.
 */
export function ImageCropperDialog({
  open,
  onOpenChange,
  source,
  specification,
  skippable = false,
  onCropped,
  onSkipped,
  busy = false,
  labels,
}: ImageCropperDialogProperties) {
  const settled = React.useMemo(() => cropSpecificationOf(specification), [specification])
  const wording = { ...DEFAULT_LABELS, ...labels }
  const description = wording.description || sizeSentenceOf(settled)

  const cropper = React.useRef<ImageCropperHandle>(null)

  const [ready, setReady] = React.useState(false)
  const [cropping, setCropping] = React.useState(false)
  const [failure, setFailure] = React.useState<string | null>(null)

  const confirm = async () => {
    if (!cropper.current) {
      return
    }

    setCropping(true)
    setFailure(null)

    try {
      onCropped(await cropper.current.toFile())
    } catch {
      setFailure(wording.failed)
    } finally {
      setCropping(false)
    }
  }

  const working = cropping || busy

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{wording.title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {source && (
          <ImageCropper
            ref={cropper}
            source={source}
            specification={specification}
            onReadyChange={setReady}
            labels={labels}
          />
        )}

        {failure && <p className="text-xs text-destructive">{failure}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={working} onClick={() => onOpenChange(false)}>
            {wording.cancel}
          </Button>

          {skippable && (
            <Button type="button" variant="outline" disabled={working} onClick={onSkipped}>
              {wording.skip}
            </Button>
          )}

          <Button type="button" disabled={!ready || working} onClick={() => void confirm()}>
            {working ? wording.working : wording.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * What the result will be, said plainly.
 *
 * Somebody framing a picture is deciding what to keep, and the one fact that changes that decision is
 * how much of it survives — a face framed generously is the wrong call at 256 pixels.
 */
function sizeSentenceOf(specification: ImageCropSpecification): string {
  if (specification.outputWidth && specification.outputHeight) {
    return `Saved at ${specification.outputWidth}×${specification.outputHeight}.`
  }

  if (specification.outputWidth) {
    return `Saved ${specification.outputWidth} pixels wide.`
  }

  return "Saved at the size you choose."
}

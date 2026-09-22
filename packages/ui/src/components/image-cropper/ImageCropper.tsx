import * as React from "react"
import { RotateCcw, RotateCw, Undo2, X, ZoomIn, ZoomOut } from "lucide-react"
import {
  cropGripHandlers,
  useImageCropper,
  type CropRatio,
  type ImageCropSpecification,
} from "@jmouse/cropping"

import { cn } from "../../lib/helpers"
import { Button } from "../button"
import { Skeleton } from "../skeleton"
import { Slider } from "../slider"

/** What the surrounding screen asks the cropper for once somebody is happy with the framing. */
export interface ImageCropperHandle {
  /** The framed region, encoded as the specification asks. */
  toBlob: () => Promise<Blob>
  /** The same bytes as a file, named after the original with the encoded format's extension. */
  toFile: (name?: string) => Promise<File>
  reset: () => void
}

/** Every string the cropper shows, so a product with its own translation layer can supply them. */
export interface ImageCropperLabels {
  hint: string
  zoom: string
  rotateLeft: string
  rotateRight: string
  reset: string
  discard: string
  unreadable: string
  chooseAnother: string
  shape: string
  customShape: string
  reshape: string
}

const DEFAULT_LABELS: ImageCropperLabels = {
  hint: "Drag to move, scroll or pinch to zoom.",
  zoom: "Zoom",
  rotateLeft: "Turn left",
  rotateRight: "Turn right",
  reset: "Start again",
  discard: "Choose a different picture",
  unreadable: "That file could not be read as an image.",
  chooseAnother: "Choose another",
  shape: "Shape",
  customShape: "Custom",
  reshape: "Drag to reshape the frame",
}

export interface ImageCropperProperties {
  /** A file somebody picked, or an address of a picture already stored. */
  source: File | Blob | string
  specification?: Partial<ImageCropSpecification>
  /** Height of the stage in CSS pixels. The frame is fitted inside it; the width follows the layout. */
  stageHeight?: number
  /** Offered as a corner control when given. Omit it and the cropper shows no way out of itself. */
  onDiscard?: () => void
  /** Called as the picture finishes decoding, and again if it fails, so a Save button can follow it. */
  onReadyChange?: (ready: boolean) => void
  labels?: Partial<ImageCropperLabels>
  className?: string
}

const FRAME_RADIUS = "0.375rem"
const CIRCLE_RADIUS = "9999px"

/**
 * Framing a picture: drag to move, scroll or pinch to zoom, turn it if it came off a phone sideways.
 *
 * ⚠️ **This is a surface, and the cropper is `@jmouse/cropping`'s `useImageCropper`.** Everything that
 * is hard — the rotated-basis confinement, the re-baselined gestures, the non-passive wheel listener,
 * the one transform the preview and the encoder both replay — lives in that package, so a product
 * drawing its own cropper in its own look shares all of it. What is here is the shadcn clothes: which
 * button, which slider, which class names.
 *
 * ⚠️ **A real cropper rather than an automatic centre crop.** The cheap version is one `drawImage` and
 * it is wrong often enough to matter: people are rarely centred in their own photographs, and a face
 * sliced down the middle is worse than no picture at all.
 *
 * ⚠️ **The picture is a plain transformed image element and only meets a canvas when it is saved.**
 * Panning a canvas would mean re-drawing a multi-megapixel picture on every pointer move, for a preview
 * the compositor does for free.
 *
 * The component reports nothing on its own — the surrounding screen holds a reference and asks for the
 * bytes when somebody confirms. Four products have four routes, four error shapes and four cache
 * invalidations, and a cropper that knew any of them would be a cropper that could not be shared.
 */
export const ImageCropper = React.forwardRef<ImageCropperHandle, ImageCropperProperties>(
  function ImageCropper(
    { source, specification, stageHeight = 320, onDiscard, onReadyChange, labels, className },
    handle
  ) {
    const cropper = useImageCropper({ source, specification })
    const wording = { ...DEFAULT_LABELS, ...labels }

    const { ready, reset, toBlob, toFile } = cropper

    React.useEffect(() => {
      onReadyChange?.(ready)
    }, [ready, onReadyChange])

    React.useImperativeHandle(handle, () => ({ reset, toBlob, toFile }), [reset, toBlob, toFile])

    if (cropper.failure) {
      return (
        <div
          data-slot="image-cropper-failure"
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-sm text-destructive",
            className
          )}
          style={{ height: stageHeight }}
        >
          {wording.unreadable}
          {onDiscard && (
            <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
              {wording.chooseAnother}
            </Button>
          )}
        </div>
      )
    }

    const { layout } = cropper
    const gripHandlers = cropGripHandlers(cropper.reshapeFrom)

    return (
      <div data-slot="image-cropper" className={cn("flex flex-col gap-3", className)}>
        <div className="relative">
          <div
            {...cropper.stageProperties}
            data-slot="image-cropper-stage"
            aria-label={wording.hint}
            className="relative w-full touch-none overflow-hidden rounded-lg border bg-muted select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            style={{ height: stageHeight, cursor: layout ? "grab" : "default" }}
          >
            {layout ? (
              <>
                {/* The whole picture, dimmed. What is inside the frame is drawn a second time on top of
                    it at full strength — two elements rather than one with a mask, because the shroud
                    has to darken everything the frame does not take and nothing it does, and a single
                    element cannot be both. */}
                <img
                  src={layout.address}
                  alt=""
                  draggable={false}
                  className="absolute top-0 left-0 max-w-none opacity-40"
                  style={{
                    width: layout.imageSize.width,
                    height: layout.imageSize.height,
                    transformOrigin: "center",
                    transform: layout.shroudTransform,
                  }}
                />

                <div
                  className="absolute overflow-hidden"
                  style={framePlacement(layout.framePlacement, cropper.circular)}
                >
                  <img
                    src={layout.address}
                    alt=""
                    draggable={false}
                    className="absolute top-0 left-0 max-w-none"
                    style={{
                      width: layout.imageSize.width,
                      height: layout.imageSize.height,
                      transformOrigin: "center",
                      transform: layout.frameTransform,
                    }}
                  />

                  {cropper.guides && <CropGuides />}
                </div>

                <div
                  aria-hidden
                  className="pointer-events-none absolute ring-2 ring-primary/70"
                  style={framePlacement(layout.framePlacement, cropper.circular)}
                />

                {layout.grips.map((grip) => (
                  <button
                    key={grip.key}
                    type="button"
                    aria-label={wording.reshape}
                    className="absolute size-4 rounded-full border-2 border-primary bg-background shadow-sm transition-transform hover:scale-125 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    style={{ left: grip.left, top: grip.top, cursor: grip.cursor }}
                    {...gripHandlers}
                  />
                ))}
              </>
            ) : (
              <Skeleton className="size-full rounded-lg" />
            )}
          </div>

          {onDiscard && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="absolute -top-2 -right-2 rounded-full"
              onClick={onDiscard}
              aria-label={wording.discard}
            >
              <X />
            </Button>
          )}
        </div>

        {cropper.ratios && cropper.ratios.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={wording.shape}>
            {cropper.ratios.map((ratio) => (
              <RatioChip
                key={ratio.label}
                ratio={ratio}
                active={cropper.isShape(ratio.aspect)}
                disabled={!ready}
                onSelect={() => cropper.chooseAspect(ratio.aspect)}
              />
            ))}

            {/* ⚠️ Shown only when the frame matches nothing on offer, and not selectable. It is a
                readout of what dragging a corner produced, not a way of getting there — pressing a
                shape called "Custom" could only ever mean "the last custom one", which is a state this
                does not keep and should not start keeping. */}
            {cropper.reshaped && (
              <span className="rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
                {wording.customShape}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {cropper.rotatable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={cropper.turnLeft}
              aria-label={wording.rotateLeft}
              disabled={!ready}
            >
              <RotateCcw />
            </Button>
          )}

          <ZoomOut className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />

          <Slider
            value={[cropper.zoom]}
            min={1}
            max={cropper.maximumZoom}
            step={0.01}
            disabled={!ready}
            aria-label={wording.zoom}
            onValueChange={([next]) => cropper.zoomTo(next)}
            className="flex-1"
          />

          <ZoomIn className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />

          {cropper.rotatable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={cropper.turnRight}
              aria-label={wording.rotateRight}
              disabled={!ready}
            >
              <RotateCw />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={reset}
            aria-label={wording.reset}
            disabled={!ready}
          >
            <Undo2 />
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">{wording.hint}</p>
      </div>
    )
  }
)

function RatioChip({
  ratio,
  active,
  disabled,
  onSelect,
}: {
  ratio: CropRatio
  active: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {ratio.label}
    </button>
  )
}

function framePlacement(
  placement: { left: number; top: number; width: number; height: number },
  circular: boolean
): React.CSSProperties {
  return { ...placement, borderRadius: circular ? CIRCLE_RADIUS : FRAME_RADIUS }
}

/** The rule of thirds, drawn faintly enough to frame by and not to look at. */
function CropGuides() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {[1, 2].map((third) => (
        <React.Fragment key={third}>
          <span
            className="absolute top-0 bottom-0 w-px bg-white/25"
            style={{ left: `${(third * 100) / 3}%` }}
          />
          <span
            className="absolute right-0 left-0 h-px bg-white/25"
            style={{ top: `${(third * 100) / 3}%` }}
          />
        </React.Fragment>
      ))}
    </div>
  )
}

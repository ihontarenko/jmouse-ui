import * as React from "react"
import { RotateCcw, RotateCw, Undo2, X, ZoomIn, ZoomOut } from "lucide-react"

import { cn } from "../../lib/helpers"
import { Button } from "../button"
import { Skeleton } from "../skeleton"
import { Slider } from "../slider"
import {
  clamp,
  confinedOffsetOf,
  coverScaleOf,
  frameFittingIn,
  transformOf,
  type Dimensions,
  type Point,
} from "./cropGeometry"
import {
  cropSpecificationOf,
  extensionForFormat,
  frameAspectOf,
  mimeTypeForFormat,
  reshapedTo,
  type CropRatio,
  type ImageCropSpecification,
} from "./cropSpecification"
import { encodeCrop } from "./encodeCrop"
import { loadImage, type LoadedImage } from "./imageSource"
import { useElementSize } from "./useElementSize"

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

/** Breathing room between the stage's edge and the frame, so there is context to drag into view. */
const STAGE_MARGIN = 20

const ZOOM_STEP = 0.2
const QUARTER_TURN = Math.PI / 2
const NUDGE = 8
const FINE_NUDGE = 1
const FRAME_RADIUS = "0.375rem"
const CIRCLE_RADIUS = "9999px"

/**
 * How far a dragged corner may take the frame's proportions.
 *
 * ⚠️ **Bounded because an unbounded ratio is a frame with no area.** A pointer dragged onto the stage's
 * own centre line asks for a strip one pixel tall, and the encoder is then asked for a canvas that no
 * browser will hand out. Five to one either way covers every shape anybody frames a picture to.
 */
const NARROWEST_ASPECT = 1 / 5
const WIDEST_ASPECT = 5

/** Two ratios are the same shape when they agree to here — enough to survive the arithmetic in `4 / 3`. */
const ASPECT_TOLERANCE = 0.001

/**
 * Framing a picture: drag to move, scroll or pinch to zoom, turn it if it came off a phone sideways.
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
 * bytes when somebody confirms. Three products have three routes, three error shapes and three cache
 * invalidations, and a cropper that knew any of them would be a cropper that could not be shared.
 */
export const ImageCropper = React.forwardRef<ImageCropperHandle, ImageCropperProperties>(
  function ImageCropper(
    { source, specification, stageHeight = 320, onDiscard, onReadyChange, labels, className },
    handle
  ) {
    const requested = React.useMemo(() => cropSpecificationOf(specification), [specification])
    const wording = { ...DEFAULT_LABELS, ...labels }

    const [image, setImage] = React.useState<LoadedImage | null>(null)
    const [failure, setFailure] = React.useState<string | null>(null)
    const [zoom, setZoom] = React.useState(1)
    const [rotation, setRotation] = React.useState(0)
    const [offset, setOffset] = React.useState<Point>({ x: 0, y: 0 })

    /**
     * The shape somebody chose, or `undefined` while nobody has chosen one.
     *
     * ⚠️ **`undefined` is a third state and it is load-bearing.** `null` already means "the picture's
     * own proportions", which is a choice a person can make out loud; collapsing the two would make a
     * cropper that had been reshaped and then set back to Original indistinguishable from one nobody
     * touched — and the difference decides whether {@link reshapedTo} gives up the caller's second
     * output dimension.
     */
    const [chosenAspect, setChosenAspect] = React.useState<number | null | undefined>(undefined)

    const [stage, stageSize] = useElementSize<HTMLDivElement>()

    // What the encoder is handed, and what the frame is measured from — one object, so the preview and
    // the bytes cannot disagree about the shape the way they cannot disagree about the placement.
    const settled = React.useMemo(
      () => (chosenAspect === undefined ? requested : reshapedTo(requested, chosenAspect)),
      [requested, chosenAspect]
    )

    const frame = React.useMemo<Dimensions | null>(() => {
      if (!image || !stageSize) {
        return null
      }

      return frameFittingIn(stageSize, frameAspectOf(settled, image), STAGE_MARGIN)
    }, [image, stageSize, settled])

    const scale = image && frame ? coverScaleOf(image, frame, rotation) * zoom : 1

    React.useEffect(() => {
      let abandoned = false
      let loaded: LoadedImage | null = null

      setImage(null)
      setFailure(null)
      setZoom(1)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
      setChosenAspect(undefined)

      loadImage(source)
        .then((result) => {
          loaded = result

          // The effect may have been superseded while the picture decoded; releasing here rather than
          // storing it is what stops the object URL leaking.
          if (abandoned) {
            result.release()
            return
          }

          setImage(result)
        })
        .catch((error: Error) => {
          if (!abandoned) {
            setFailure(error.message)
          }
        })

      return () => {
        abandoned = true
        loaded?.release()
      }
    }, [source])

    React.useEffect(() => {
      onReadyChange?.(image !== null)
    }, [image, onReadyChange])

    // Zooming out, turning, or a stage that changed size can all leave the picture no longer covering
    // the frame, so the pan is pulled back inside the new limits rather than left where it was put.
    //
    // ⚠️ **An unchanged pan has to come back as the same object.** A caller who writes the
    // specification inline gives this component a fresh one on every render, which re-derives the frame
    // on every render, which runs this effect on every render — and an effect that always stores a new
    // object then schedules the render that runs it again. Returning `current` is what makes that
    // ordinary instead of a hang.
    React.useEffect(() => {
      if (!image || !frame) {
        return
      }

      setOffset((current) => {
        const confined = confinedOffsetOf(current, image, frame, scale, rotation)

        return confined.x === current.x && confined.y === current.y ? current : confined
      })
    }, [image, frame, scale, rotation])

    const confine = React.useCallback(
      (next: Point) => {
        if (!image || !frame) {
          return next
        }

        return confinedOffsetOf(next, image, frame, scale, rotation)
      },
      [image, frame, scale, rotation]
    )

    /**
     * Zooming towards a point rather than towards the middle.
     *
     * Keeping whatever is under the cursor — or between two fingers — where it is, is the difference
     * between a zoom that feels like a magnifier and one that throws the subject out of the frame every
     * time. `pivot` is measured from the frame's centre, which is where an offset is measured from too.
     */
    const zoomTowards = React.useCallback(
      (requested: number, pivot: Point, from: { zoom: number; offset: Point }) => {
        const bounded = clamp(requested, 1, settled.maximumZoom)
        const ratio = bounded / from.zoom

        setZoom(bounded)
        setOffset(
          confine({
            x: pivot.x - ratio * (pivot.x - from.offset.x),
            y: pivot.y - ratio * (pivot.y - from.offset.y),
          })
        )
      },
      [confine, settled.maximumZoom]
    )

    const pointers = React.useRef(new Map<number, Point>())
    const gesture = React.useRef<{
      centroid: Point
      spread: number
      offset: Point
      zoom: number
    } | null>(null)

    /** A pointer position measured from the frame's centre, which is also the stage's centre. */
    const fromCentre = React.useCallback(
      (event: { clientX: number; clientY: number }): Point => {
        const box = stage.current?.getBoundingClientRect()

        if (!box) {
          return { x: 0, y: 0 }
        }

        return {
          x: event.clientX - (box.left + box.width / 2),
          y: event.clientY - (box.top + box.height / 2),
        }
      },
      [stage]
    )

    /**
     * ⚠️ **Every gesture is measured from a baseline taken when the number of fingers last changed**,
     * never from the previous move. Accumulating deltas is how a second finger landing mid-drag makes
     * the picture jump, and how a pinch drifts by a pixel a frame.
     */
    const rebaseline = () => {
      const points = [...pointers.current.values()]

      gesture.current = points.length
        ? { centroid: centroidOf(points), spread: spreadOf(points), offset, zoom }
        : null
    }

    const track = (event: React.PointerEvent) => {
      pointers.current.set(event.pointerId, fromCentre(event))
      event.currentTarget.setPointerCapture(event.pointerId)
      rebaseline()
    }

    const untrack = (event: React.PointerEvent) => {
      pointers.current.delete(event.pointerId)
      rebaseline()
    }

    const drag = (event: React.PointerEvent) => {
      const from = gesture.current

      if (!from || !pointers.current.has(event.pointerId)) {
        return
      }

      pointers.current.set(event.pointerId, fromCentre(event))

      const points = [...pointers.current.values()]
      const centroid = centroidOf(points)
      const pinching = points.length > 1 && from.spread > 0
      const nextZoom = pinching
        ? clamp((from.zoom * spreadOf(points)) / from.spread, 1, settled.maximumZoom)
        : from.zoom
      const ratio = nextZoom / from.zoom

      setZoom(nextZoom)
      setOffset(
        confine({
          x: centroid.x - ratio * (from.centroid.x - from.offset.x),
          y: centroid.y - ratio * (from.centroid.y - from.offset.y),
        })
      )
    }

    /**
     * Dragging a corner: the pointer's direction from the middle is the frame's new proportions.
     *
     * ⚠️ **The corner does not follow the pointer, and it must not.** The frame is fitted as large as
     * the stage allows — see {@link ImageCropSpecification.resizable} — so what a grip reports is a
     * shape, not a rectangle. Reading it as `|x| / |y|` means a drag that leaves the stage entirely
     * still says something sensible, and a pointer released outside the window leaves a frame that is
     * a shape rather than a sliver.
     */
    const reshape = (event: React.PointerEvent) => {
      const point = fromCentre(event)

      setChosenAspect(
        clamp(
          Math.abs(point.x) / Math.max(1, Math.abs(point.y)),
          NARROWEST_ASPECT,
          WIDEST_ASPECT
        )
      )
    }

    // ⚠️ Bound by hand rather than as an `onWheel` property, because React registers wheel listeners
    // passively at the root — a handler that calls `preventDefault` there is ignored and warns, so the
    // page scrolls away underneath the cropper instead of the picture zooming.
    React.useEffect(() => {
      const element = stage.current

      if (!element || !image) {
        return
      }

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()

        const step = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP

        zoomTowards(zoom + step, fromCentre(event), { zoom, offset })
      }

      element.addEventListener("wheel", onWheel, { passive: false })

      return () => element.removeEventListener("wheel", onWheel)
    }, [stage, image, zoom, offset, fromCentre, zoomTowards])

    const reset = React.useCallback(() => {
      setZoom(1)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
      setChosenAspect(undefined)
    }, [])

    const turn = (radians: number) => setRotation((current) => current + radians)

    const onKeyDown = (event: React.KeyboardEvent) => {
      const step = event.shiftKey ? FINE_NUDGE : NUDGE
      const nudges: Record<string, Point> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      }

      const nudge = nudges[event.key]

      if (nudge) {
        event.preventDefault()
        setOffset((current) => confine({ x: current.x + nudge.x, y: current.y + nudge.y }))
        return
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        zoomTowards(zoom + ZOOM_STEP, CENTRE, { zoom, offset })
        return
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault()
        zoomTowards(zoom - ZOOM_STEP, CENTRE, { zoom, offset })
      }
    }

    React.useImperativeHandle(
      handle,
      () => {
        const toBlob = async () => {
          if (!image || !frame) {
            throw new Error("The picture has not finished loading.")
          }

          return await encodeCrop({
            image: image.element,
            imageSize: { width: image.width, height: image.height },
            frame,
            placement: { offset, rotation, scale },
            specification: settled,
          })
        }

        return {
          reset,
          toBlob,
          toFile: async (name?: string) => {
            const bytes = await toBlob()
            const given = name ?? (source instanceof File ? source.name : "image")

            return new File([bytes], renamedFor(given, settled), {
              type: mimeTypeForFormat(settled.format),
            })
          },
        }
      },
      [image, frame, offset, rotation, scale, settled, source, reset]
    )

    if (failure) {
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

    const circular = settled.shape === "circle"
    const frameBox = image && stageSize && frame ? framePlacement(stageSize, frame, circular) : null

    // ⚠️ Neither control is offered on a round frame: a circle has one shape, and a row of ratios above
    // one would be a control whose every option does the same nothing.
    const reshapeable = settled.resizable && !circular
    const offeredRatios = circular ? null : settled.ratios

    return (
      <div data-slot="image-cropper" className={cn("flex flex-col gap-3", className)}>
        <div className="relative">
          <div
            ref={stage}
            data-slot="image-cropper-stage"
            tabIndex={0}
            role="application"
            aria-label={wording.hint}
            className="relative w-full touch-none overflow-hidden rounded-lg border bg-muted select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            style={{ height: stageHeight, cursor: image ? "grab" : "default" }}
            onPointerDown={track}
            onPointerMove={drag}
            onPointerUp={untrack}
            onPointerCancel={untrack}
            onKeyDown={onKeyDown}
          >
            {image && stageSize && frame && frameBox ? (
              <>
                {/* The whole picture, dimmed. What is inside the frame is drawn a second time on top of
                    it at full strength — two elements rather than one with a mask, because the shroud
                    has to darken everything the frame does not take and nothing it does, and a single
                    element cannot be both. */}
                <img
                  src={image.element.src}
                  alt=""
                  draggable={false}
                  className="absolute top-0 left-0 max-w-none opacity-40"
                  style={{
                    width: image.width,
                    height: image.height,
                    transformOrigin: "center",
                    transform: transformOf({ offset, rotation, scale }, image, stageSize),
                  }}
                />

                <div className="absolute overflow-hidden" style={frameBox}>
                  <img
                    src={image.element.src}
                    alt=""
                    draggable={false}
                    className="absolute top-0 left-0 max-w-none"
                    style={{
                      width: image.width,
                      height: image.height,
                      transformOrigin: "center",
                      transform: transformOf({ offset, rotation, scale }, image, frame),
                    }}
                  />

                  {settled.guides && !circular && <CropGuides />}
                </div>

                <div
                  aria-hidden
                  className="pointer-events-none absolute ring-2 ring-primary/70"
                  style={frameBox}
                />

                {/* ⚠️ The grips stop the event rather than sharing it. They sit inside the stage, whose
                    own pointer handlers pan the picture, so a corner drag would otherwise reshape the
                    frame and drag the photograph out from under it at the same time. */}
                {reshapeable &&
                  CORNERS.map((corner) => (
                    <button
                      key={corner.key}
                      type="button"
                      aria-label={wording.reshape}
                      className="absolute size-4 rounded-full border-2 border-primary bg-background shadow-sm transition-transform hover:scale-125 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      style={{
                        left:
                          (stageSize.width - frame.width) / 2 + corner.x * frame.width - GRIP_RADIUS,
                        top:
                          (stageSize.height - frame.height) / 2 +
                          corner.y * frame.height -
                          GRIP_RADIUS,
                        cursor: corner.cursor,
                      }}
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        event.currentTarget.setPointerCapture(event.pointerId)
                      }}
                      onPointerMove={(event) => {
                        event.stopPropagation()

                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          reshape(event)
                        }
                      }}
                      onPointerUp={(event) => event.stopPropagation()}
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

        {offeredRatios && offeredRatios.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={wording.shape}>
            {offeredRatios.map((ratio) => (
              <RatioChip
                key={ratio.label}
                ratio={ratio}
                active={sameShape(settled.aspect, ratio.aspect)}
                disabled={!image}
                onSelect={() => setChosenAspect(ratio.aspect)}
              />
            ))}

            {/* ⚠️ Shown only when the frame matches nothing on offer, and not selectable. It is a
                readout of what dragging a corner produced, not a way of getting there — pressing a
                shape called "Custom" could only ever mean "the last custom one", which is a state this
                does not keep and should not start keeping. */}
            {reshapeable && !offeredRatios.some((ratio) => sameShape(settled.aspect, ratio.aspect)) && (
              <span className="rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
                {wording.customShape}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {settled.rotatable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => turn(-QUARTER_TURN)}
              aria-label={wording.rotateLeft}
              disabled={!image}
            >
              <RotateCcw />
            </Button>
          )}

          <ZoomOut className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />

          <Slider
            value={[zoom]}
            min={1}
            max={settled.maximumZoom}
            step={0.01}
            disabled={!image}
            aria-label={wording.zoom}
            onValueChange={([next]) => zoomTowards(next, CENTRE, { zoom, offset })}
            className="flex-1"
          />

          <ZoomIn className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />

          {settled.rotatable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => turn(QUARTER_TURN)}
              aria-label={wording.rotateRight}
              disabled={!image}
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
            disabled={!image}
          >
            <Undo2 />
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">{wording.hint}</p>
      </div>
    )
  }
)

/** The middle of the frame, which is what a control with no pointer behind it zooms towards. */
const CENTRE: Point = { x: 0, y: 0 }

/** Half a grip, so a corner sits on the frame rather than beside it. */
const GRIP_RADIUS = 8

/** Where the four grips sit, as fractions of the frame. */
const CORNERS = [
  { key: "top-left", x: 0, y: 0, cursor: "nwse-resize" },
  { key: "top-right", x: 1, y: 0, cursor: "nesw-resize" },
  { key: "bottom-left", x: 0, y: 1, cursor: "nesw-resize" },
  { key: "bottom-right", x: 1, y: 1, cursor: "nwse-resize" },
]

/**
 * Whether two ratios are the same shape.
 *
 * ⚠️ **`null` is only ever equal to `null`.** It means "the picture's own", which is a different
 * instruction from any number even when the picture happens to be that number — a 4:3 photograph
 * framed as Original and the same one framed as 4:3 keep their shape by different rules, and only the
 * first still fits when somebody swaps the picture.
 */
function sameShape(left: number | null, right: number | null): boolean {
  if (left === null || right === null) {
    return left === right
  }

  return Math.abs(left - right) < ASPECT_TOLERANCE
}

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
  stage: Dimensions,
  frame: Dimensions,
  circular: boolean
): React.CSSProperties {
  return {
    width: frame.width,
    height: frame.height,
    left: (stage.width - frame.width) / 2,
    top: (stage.height - frame.height) / 2,
    borderRadius: circular ? CIRCLE_RADIUS : FRAME_RADIUS,
  }
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

function centroidOf(points: Point[]): Point {
  const total = points.reduce(
    (accumulator, point) => ({ x: accumulator.x + point.x, y: accumulator.y + point.y }),
    { x: 0, y: 0 }
  )

  return { x: total.x / points.length, y: total.y / points.length }
}

/** How far apart two fingers are. Anything past the first two is ignored, as every browser does. */
function spreadOf(points: Point[]): number {
  if (points.length < 2) {
    return 0
  }

  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
}

function renamedFor(name: string, specification: ImageCropSpecification): string {
  const stem = name.replace(/\.[^.]+$/, "") || "image"

  return `${stem}${extensionForFormat(specification.format)}`
}

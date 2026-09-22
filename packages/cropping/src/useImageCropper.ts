import * as React from "react"

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

/**
 * Framing a picture: every piece of state and behaviour, and not one line of markup.
 *
 * ## ⚠️ The hook is the cropper; a surface is only its clothes
 *
 * Cropping is roughly six hundred lines of behaviour under a hundred and fifty of markup, and the six
 * hundred are the part that is hard to get right — pointer capture re-baselined whenever the number of
 * fingers changes, a wheel listener bound by hand because React's is passive, a pan clamped in the
 * image's *rotated* basis, an effect that must return the offset it was given when nothing moved. A
 * product that re-drew the cropper to match its own look would be re-implementing all of that, which is
 * how three products came to carry four croppers before `XP-24`.
 *
 * So the behaviour lives here, in a package with no design system in it, and every product draws its
 * own stage, its own buttons and its own slider over the same state. `@jmouse/ui`'s `ImageCropper` is
 * one such surface and has no privilege over any other.
 *
 * ## ⚠️ Nothing here calls an API and nothing here knows a product
 *
 * A cropper produces bytes; who stores them, under what route, and what happens when that fails, is the
 * caller's. {@link ImageCropperState.toBlob} and {@link ImageCropperState.toFile} are the whole of the
 * output side.
 *
 * ## ⚠️ Hold the specification steady across renders
 *
 * The frame is derived from whatever this is handed, so a fresh object every render re-derives it every
 * render. That is survivable — the confinement effect returns the offset unchanged when nothing moved,
 * which is what stops the re-derivation becoming a loop — but `useMemo` the specification anyway.
 */
export interface UseImageCropperOptions {
  /** A file somebody picked, or an address of a picture already stored. */
  source: File | Blob | string
  specification?: Partial<ImageCropSpecification>
}

/** Where one corner grip sits, and what the pointer becomes over it. Positions are stage pixels. */
export interface CropGrip {
  key: string
  cursor: string
  left: number
  top: number
}

/** What a surface spreads onto the element the picture is dragged inside. */
export interface CropStageProperties {
  ref: (element: HTMLDivElement | null) => void
  tabIndex: number
  role: "application"
  onPointerDown: (event: React.PointerEvent) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
  onPointerCancel: (event: React.PointerEvent) => void
  onKeyDown: (event: React.KeyboardEvent) => void
}

/**
 * Everything a surface needs to draw, once the picture has decoded and the stage has been measured.
 *
 * ⚠️ **The two transforms are one transform written twice over.** The picture is drawn as a whole and
 * dimmed, then drawn again inside the frame at full strength — two elements rather than one with a
 * mask, because the shroud has to darken everything the frame does not take and nothing it does.
 * Neither is composed by a surface: `transformOf` is the only writer, and the encoder replays the same
 * chain into a canvas.
 */
export interface CropperLayout {
  /** The decoded picture's address, for an `<img src>`. */
  address: string
  /** The picture's own pixel size, which is what the transformed element is sized to. */
  imageSize: Dimensions
  stageSize: Dimensions
  frame: Dimensions
  /** Where the frame sits inside the stage — `left`, `top`, `width`, `height` in stage pixels. */
  framePlacement: { left: number; top: number; width: number; height: number }
  /** The whole picture over the stage — the dimmed layer. */
  shroudTransform: string
  /** The same picture over the frame — the layer at full strength. */
  frameTransform: string
  /** Empty unless the frame may be reshaped. */
  grips: readonly CropGrip[]
}

export interface ImageCropperState {
  stageProperties: CropStageProperties
  /** The picture has decoded and the stage has been measured. */
  ready: boolean
  /** Why the picture could not be read, when it could not. */
  failure: string | null
  layout: CropperLayout | null

  /** The specification as it stands, after any shape chosen while framing. */
  specification: ImageCropSpecification
  circular: boolean
  guides: boolean
  rotatable: boolean

  zoom: number
  maximumZoom: number
  /** Zoom towards the middle of the frame — what a slider or a button asks for. */
  zoomTo: (next: number) => void
  zoomBy: (step: number) => void

  turnLeft: () => void
  turnRight: () => void
  reset: () => void

  /**
   * The shapes on offer, or `null` when the caller offers none.
   *
   * ⚠️ Already `null` for a circular frame, whatever was configured: a circle has one shape, and a row
   * of ratios above one would be a control whose every option does the same nothing.
   */
  ratios: CropRatio[] | null
  chooseAspect: (aspect: number | null) => void
  /** Whether the frame currently stands at this shape. */
  isShape: (aspect: number | null) => boolean
  /** The frame was dragged to a shape nothing on offer matches. */
  reshaped: boolean
  /**
   * A corner grip's pointer, read as the frame's new proportions. Pair it with
   * {@link cropGripHandlers}, which is what stops the same drag panning the picture underneath.
   */
  reshapeFrom: (event: { clientX: number; clientY: number }) => void

  toBlob: () => Promise<Blob>
  /** The same bytes as a file, named after the original with the encoded format's extension. */
  toFile: (name?: string) => Promise<File>
}

/** Breathing room between the stage's edge and the frame, so there is context to drag into view. */
const STAGE_MARGIN = 20

const ZOOM_STEP = 0.2
const QUARTER_TURN = Math.PI / 2
const NUDGE = 8
const FINE_NUDGE = 1

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
] as const

export function useImageCropper({ source, specification }: UseImageCropperOptions): ImageCropperState {
  const requested = React.useMemo(() => cropSpecificationOf(specification), [specification])

  const [image, setImage] = React.useState<LoadedImage | null>(null)
  const [failure, setFailure] = React.useState<string | null>(null)
  const [zoom, setZoom] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)
  const [offset, setOffset] = React.useState<Point>({ x: 0, y: 0 })

  /**
   * The shape somebody chose, or `undefined` while nobody has chosen one.
   *
   * ⚠️ **`undefined` is a third state and it is load-bearing.** `null` already means "the picture's own
   * proportions", which is a choice a person can make out loud; collapsing the two would make a cropper
   * that had been reshaped and then set back to Original indistinguishable from one nobody touched —
   * and the difference decides whether {@link reshapedTo} gives up the caller's second output dimension.
   */
  const [chosenAspect, setChosenAspect] = React.useState<number | null | undefined>(undefined)

  const stage = useElementSize<HTMLDivElement>()

  // What the encoder is handed, and what the frame is measured from — one object, so the preview and
  // the bytes cannot disagree about the shape the way they cannot disagree about the placement.
  const settled = React.useMemo(
    () => (chosenAspect === undefined ? requested : reshapedTo(requested, chosenAspect)),
    [requested, chosenAspect]
  )

  const frame = React.useMemo<Dimensions | null>(() => {
    if (!image || !stage.size) {
      return null
    }

    return frameFittingIn(stage.size, frameAspectOf(settled, image), STAGE_MARGIN)
  }, [image, stage.size, settled])

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

  // Zooming out, turning, or a stage that changed size can all leave the picture no longer covering the
  // frame, so the pan is pulled back inside the new limits rather than left where it was put.
  //
  // ⚠️ **An unchanged pan has to come back as the same object.** A caller who writes the specification
  // inline gives this hook a fresh one on every render, which re-derives the frame on every render,
  // which runs this effect on every render — and an effect that always stores a new object then
  // schedules the render that runs it again. Returning `current` is what makes that ordinary instead of
  // a hang.
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
    (asked: number, pivot: Point, from: { zoom: number; offset: Point }) => {
      const bounded = clamp(asked, 1, settled.maximumZoom)
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
      const box = stage.element.current?.getBoundingClientRect()

      if (!box) {
        return { x: 0, y: 0 }
      }

      return {
        x: event.clientX - (box.left + box.width / 2),
        y: event.clientY - (box.top + box.height / 2),
      }
    },
    [stage.element]
  )

  /**
   * ⚠️ **Every gesture is measured from a baseline taken when the number of fingers last changed**,
   * never from the previous move. Accumulating deltas is how a second finger landing mid-drag makes the
   * picture jump, and how a pinch drifts by a pixel a frame.
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
   * ⚠️ **The corner does not follow the pointer, and it must not.** The frame is fitted as large as the
   * stage allows — see {@link ImageCropSpecification.resizable} — so what a grip reports is a shape, not
   * a rectangle. Reading it as `|x| / |y|` means a drag that leaves the stage entirely still says
   * something sensible, and a pointer released outside the window leaves a frame that is a shape rather
   * than a sliver.
   */
  const reshape = React.useCallback(
    (event: { clientX: number; clientY: number }) => {
      const point = fromCentre(event)

      setChosenAspect(
        clamp(Math.abs(point.x) / Math.max(1, Math.abs(point.y)), NARROWEST_ASPECT, WIDEST_ASPECT)
      )
    },
    [fromCentre]
  )

  // ⚠️ Bound by hand rather than as an `onWheel` property, because React registers wheel listeners
  // passively at the root — a handler that calls `preventDefault` there is ignored and warns, so the
  // page scrolls away underneath the cropper instead of the picture zooming.
  React.useEffect(() => {
    const element = stage.element.current

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
  }, [stage.element, stage.size, image, zoom, offset, fromCentre, zoomTowards])

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

  const toBlob = React.useCallback(async () => {
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
  }, [image, frame, offset, rotation, scale, settled])

  const toFile = React.useCallback(
    async (name?: string) => {
      const bytes = await toBlob()
      const given = name ?? (source instanceof File ? source.name : "image")

      return new File([bytes], renamedFor(given, settled), {
        type: mimeTypeForFormat(settled.format),
      })
    },
    [toBlob, source, settled]
  )

  const circular = settled.shape === "circle"

  // ⚠️ Neither control is offered on a round frame: a circle has one shape, and a row of ratios above
  // one would be a control whose every option does the same nothing.
  const reshapeable = settled.resizable && !circular
  const ratios = circular ? null : settled.ratios

  const layout = React.useMemo<CropperLayout | null>(() => {
    if (!image || !stage.size || !frame) {
      return null
    }

    const left = (stage.size.width - frame.width) / 2
    const top = (stage.size.height - frame.height) / 2
    const placement = { offset, rotation, scale }

    return {
      address: image.element.src,
      imageSize: { width: image.width, height: image.height },
      stageSize: stage.size,
      frame,
      framePlacement: { left, top, width: frame.width, height: frame.height },
      shroudTransform: transformOf(placement, image, stage.size),
      frameTransform: transformOf(placement, image, frame),
      grips: reshapeable
        ? CORNERS.map((corner) => ({
            key: corner.key,
            cursor: corner.cursor,
            left: left + corner.x * frame.width - GRIP_RADIUS,
            top: top + corner.y * frame.height - GRIP_RADIUS,
          }))
        : [],
    }
  }, [image, stage.size, frame, offset, rotation, scale, reshapeable])

  const isShape = React.useCallback(
    (aspect: number | null) => sameShape(settled.aspect, aspect),
    [settled.aspect]
  )

  return {
    stageProperties: {
      ref: stage.ref,
      tabIndex: 0,
      role: "application",
      onPointerDown: track,
      onPointerMove: drag,
      onPointerUp: untrack,
      onPointerCancel: untrack,
      onKeyDown,
    },
    ready: image !== null,
    failure,
    layout,

    specification: settled,
    circular,
    guides: settled.guides && !circular,
    rotatable: settled.rotatable,

    zoom,
    maximumZoom: settled.maximumZoom,
    zoomTo: (next) => zoomTowards(next, CENTRE, { zoom, offset }),
    zoomBy: (step) => zoomTowards(zoom + step, CENTRE, { zoom, offset }),

    turnLeft: () => turn(-QUARTER_TURN),
    turnRight: () => turn(QUARTER_TURN),
    reset,

    ratios,
    chooseAspect: setChosenAspect,
    isShape,
    reshaped: reshapeable && !(ratios ?? []).some((ratio) => sameShape(settled.aspect, ratio.aspect)),
    reshapeFrom: reshape,

    toBlob,
    toFile,
  }
}

/**
 * What a surface spreads onto one corner grip.
 *
 * ⚠️ **The grips stop the event rather than sharing it.** They sit inside the stage, whose own pointer
 * handlers pan the picture, so a corner drag would otherwise reshape the frame and drag the photograph
 * out from under it at the same time.
 */
export function cropGripHandlers(reshape: (event: { clientX: number; clientY: number }) => void) {
  return {
    onPointerDown: (event: React.PointerEvent) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove: (event: React.PointerEvent) => {
      event.stopPropagation()

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        reshape(event)
      }
    },
    onPointerUp: (event: React.PointerEvent) => event.stopPropagation(),
  }
}

/**
 * Whether two ratios are the same shape.
 *
 * ⚠️ **`null` is only ever equal to `null`.** It means "the picture's own", which is a different
 * instruction from any number even when the picture happens to be that number — a 4:3 photograph framed
 * as Original and the same one framed as 4:3 keep their shape by different rules, and only the first
 * still fits when somebody swaps the picture.
 */
function sameShape(left: number | null, right: number | null): boolean {
  if (left === null || right === null) {
    return left === right
  }

  return Math.abs(left - right) < ASPECT_TOLERANCE
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

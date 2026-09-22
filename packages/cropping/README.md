# `@jmouse/cropping`

Framing a picture before it is uploaded: the geometry, the canvas encoder, and a headless React hook.
No design system, so a product with its own look can crop without carrying somebody else's.

```tsx
import { AVATAR_CROP, useImageCropper } from "@jmouse/cropping"

const cropper = useImageCropper({ source: picked, specification: AVATAR_CROP })

<div {...cropper.stageProperties} style={{ height: 320 }}>…</div>

const face = await cropper.toFile()
```

## Why this is not in `@jmouse/ui`

Cropping is roughly six hundred lines of behaviour under a hundred and fifty of markup, and the six
hundred are the part that is hard to get right — pointer capture re-baselined whenever the number of
fingers changes, a wheel listener bound by hand because React's is passive, a pan clamped in the
image's *rotated* basis, an effect that must return the offset it was given when nothing moved.

Before `XP-24` three products carried four croppers, and one of them saved every undragged photograph
as its top-left corner because it kept two descriptions of the same rectangle. One cropper is a
standing rule since. But `Innoventa/UI` deliberately carries no `@jmouse/ui` — so a cropper that could
only be had by taking the design system was a cropper that product could not have, and the rule would
have been broken by a fifth implementation. This package is the rule kept instead.

## What is here

| Module | What it is |
|---|---|
| `useImageCropper` | every piece of state and behaviour a cropper has, and no markup |
| `cropSpecification` | `ImageCropSpecification`, the four presets, `keepingFormatOf` |
| `cropGeometry` | **the one transform**, replayed by CSS and by the canvas |
| `encodeCrop` | the encoder — output sizing, halving passes, background fill |
| `imageSource` | `loadImage`, `isCroppableImage` |

## The specification

One object says everything a call site asks of a picture — shape, aspect, output size, format,
quality, maximum zoom, whether it turns, whether shapes are offered, whether corners may be dragged,
guides, background. Four presets cover what products actually ask for:

| Preset | For |
|---|---|
| `AVATAR_CROP` | a face — circle, 256×256 PNG. ⚠️ **A stored contract, not a preference**: every avatar in every product is one, and the backends' upload allow-lists were written around it |
| `SQUARE_CROP` | a square that is not a face — a logo, a tile |
| `COVER_CROP` | the wide strip across the top of something |
| `FREE_CROP` | a picture somebody is attaching, where the shape is theirs — the one preset that offers the row of ratios |

⚠️ **Mandatory versus offered is the caller's line and it is deliberate.** A shape the product renders
at is framed, or a machine frames it badly. A file somebody is attaching is not: offer it, let them
decline, and wrap the preset in `keepingFormatOf(file)` — an accepted offer that turns a 400 kB JPEG
into a six-megabyte PNG has changed something nobody asked it to change.

⚠️ **Never gate a crop on `type.startsWith("image/")`** — use `isCroppableImage`. An SVG passes the
first and must never be framed: what comes back is a raster of the one thing that was not one.

## Drawing a surface

`useImageCropper` returns `layout` once the picture has decoded and the stage has been measured. It
carries both transforms already composed — the whole picture over the stage for the dimmed layer, the
same picture over the frame for the layer at full strength — the frame's placement, and where the
corner grips sit. A surface positions elements and paints them; it composes nothing.

⚠️ **Hold the specification steady across renders.** The frame is derived from whatever the hook is
handed, so a fresh object every render re-derives it every render. It survives that — the confinement
effect returns the offset it was given when nothing moved, which is what stops the re-derivation
becoming a loop — but `useMemo` it anyway.

⚠️ **Nothing here calls an API.** A cropper produces bytes; who stores them, under what route, and what
happens when that fails, is the caller's. Four products have four routes, four error shapes and four
cache invalidations, and a cropper that knew any of them could not be shared.

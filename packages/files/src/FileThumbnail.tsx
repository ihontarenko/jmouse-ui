import { useRef, useState } from "react"
import { cn } from "@jmouse/ui"
import { fileGlyphOf } from "./fileGlyph"
import { canPreview, useFilePreview, useOnScreen } from "./filePreviews"
import type { FileLibraryPort, ManagedFile } from "./types"

/**
 * The picture of a file, at whichever size the layout wants it.
 *
 * <h2>⚠️ Three ways to a picture, tried in order, and the order is the cheap one first</h2>
 *
 * <ol>
 *   <li><strong>the port's public address</strong>, where there is one. Innoventa reaches a file's bytes
 *       through a Sharing Center token — a real URL an `&lt;img&gt;` loads for nothing;
 *   <li><strong>the bytes, fetched</strong>, when there is no address or the address does not answer.
 *       ⚠️ This is what makes previews work in Kiwi at all: its public path is real but answers 404 for
 *       any file no published page points at, which is most of a cabinet. Until this existed, the honest
 *       404 was drawn by the browser as a broken-image frame — which reads as a damaged file rather than
 *       as an unpublished one;
 *   <li><strong>the type's glyph</strong>, which is a real answer and not a failure.
 * </ol>
 *
 * <h2>⚠️ `onError` is load-bearing, not defensive</h2>
 *
 * <p>The public path failing is the ORDINARY case in one of the two products, so the fallback runs
 * constantly rather than never. An `&lt;img&gt;` with no error handler is how a whole grid renders as
 * broken frames while every byte of it is perfectly reachable.</p>
 *
 * <h2>⚠️ A glyph per type, in a colour</h2>
 *
 * <p>See {@link fileGlyphOf}. Three icons across every type there is makes the column decorative, and a
 * decorative column is width spent on nothing.</p>
 */
export function FileThumbnail({
  file,
  port,
  size,
  className,
}: {
  file: ManagedFile
  port: FileLibraryPort
  /** An exact square, in pixels. Omit and size it through `className` instead. */
  size?: number
  className?: string
}) {
  const frame = useRef<HTMLSpanElement>(null)
  const onScreen = useOnScreen(frame)
  const [publicAddressFailed, setPublicAddressFailed] = useState(false)

  const box = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted", className)
  const measured = size ? { width: size, height: size } : undefined

  const publicAddress = canPreview(file) && !publicAddressFailed ? port.thumbnailUrl?.(file) ?? null : null

  // ⚠️ Asked for only once the public address is out of the running — otherwise every file in a product
  // that HAS public addresses would be downloaded a second time through the authenticated route.
  const fetched = useFilePreview(file, port, onScreen && !publicAddress)
  const picture = publicAddress ?? fetched

  if (picture) {
    return (
      // ⚠️ **The frame is on the PICTURE and never on the glyph** (`UIK-17`). A photograph is a sheet
      // and reads as one with a hairline and a shadow under it; the same frame around a type icon is a
      // box drawn around a mark, which is what made the older grid look like a table of empty cells.
      // The component is the only thing that knows which of the two it drew, so it is the only place the
      // distinction can be made.
      <span ref={frame} className={cn(box, PICTURE_FRAME)} style={measured}>
        <img
          src={picture}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setPublicAddressFailed(true)}
        />
      </span>
    )
  }

  const { Icon, tint } = fileGlyphOf(file)

  return (
    <span ref={frame} className={box} style={measured}>
      <Icon
        style={{
          color: tint,
          ...(size ? { width: size * 0.55, height: size * 0.55 } : {}),
        }}
        className={size ? undefined : "size-8"}
      />
    </span>
  )
}

/** ⚠️ See the note at the picture branch — this belongs to a picture and to nothing else. */
const PICTURE_FRAME = "border shadow-[0_1px_3px_rgb(0_0_0_/_0.18)]"

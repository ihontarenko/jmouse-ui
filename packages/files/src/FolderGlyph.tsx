import { cn } from "@jmouse/ui"

/**
 * A folder **drawn** rather than typed.
 *
 * ⚠️ **`📁` was at the mercy of whichever font the platform picked**, so the same folder looked like a
 * different object on every machine — and none of them looked like the thing a file browser is asking
 * you to believe in. Two sheets and a tab cost nothing and look the same everywhere.
 *
 * ⚠️ **Tinted from `--primary`, so it follows every palette a product ships.** A fixed yellow would be the one thing
 * on the screen that ignored the theme — which is exactly what the emoji was.
 *
 * ⚠️ **`color-mix` against the theme token, never a hard-coded pair of colours.** The lighter flap and
 * the darker back have to stay related as the palette moves; two literals would drift apart the first
 * time somebody picked a light theme.
 *
 * ⚠️ **The drop shadow and the lip are not decoration (`UIK-17`).** They are the two things the older
 * interface's folder had that the first port of this dropped, and without them the shape reads as a
 * flat coloured rectangle rather than as an object sitting on the page — which is precisely the
 * complaint that "the file manager used to look better" turned out to be. The shadow is a `filter` on
 * the wrapper rather than a `box-shadow` on the sheets, because the back sheet is clipped and a box
 * shadow would be drawn around the unclipped box.
 */
export function FolderGlyph({
  size = 18,
  muted = false,
  emblem,
  className,
}: {
  /** Width in pixels; the height follows at 0.8× — a folder is wider than it is tall. */
  size?: number
  /** For a folder that is not the point of the row — an ancestor, a disabled target. */
  muted?: boolean
  /**
   * One character badged on the flap, the way a Finder folder is — a product's own icon for the place.
   *
   * ⚠️ **Optional, and the library's own folders have none.** Innoventa's older screen filed files into
   * *categories*, which carry an emoji; the library's directories deliberately do not (`JMF-21`). The
   * slot exists so a product that has such a mark can pass it, never so this package can invent one.
   */
  emblem?: string | null
  className?: string
}) {
  const tint = muted ? "var(--muted-foreground)" : "var(--primary)"

  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block shrink-0 align-middle", className)}
      style={{
        width: size,
        height: size * 0.8,
        filter: `drop-shadow(0 ${Math.max(1, size * 0.03)}px ${Math.max(1, size * 0.045)}px rgb(0 0 0 / 0.22))`,
      }}
    >
      {/* The back sheet, with the tab cut across the left 42% and a short bevel to the shoulder. */}
      <span
        className="absolute inset-0"
        style={{
          borderRadius: size * 0.09,
          background: `color-mix(in srgb, black 26%, ${tint})`,
          clipPath: "polygon(0 0, 42% 0, 49% 15%, 100% 15%, 100% 100%, 0 100%)",
        }}
      />

      {/* The front flap, lit from the top the way a card folder catches the light. */}
      <span
        className="absolute right-0 bottom-0 left-0"
        style={{
          top: "24%",
          borderRadius: `${size * 0.07}px ${size * 0.07}px ${size * 0.09}px ${size * 0.09}px`,
          background: `linear-gradient(170deg, color-mix(in srgb, white 24%, ${tint}), color-mix(in srgb, black 6%, ${tint}))`,
          boxShadow: "inset 0 1px 0 color-mix(in srgb, white 40%, transparent)",
        }}
      />

      {emblem && (
        <span
          className="pointer-events-none absolute right-0 left-0 text-center leading-none"
          style={{
            top: "44%",
            fontSize: size * 0.32,
            color: "#fff",
            textShadow: "0 1px 1px rgb(0 0 0 / 0.35)",
          }}
        >
          {emblem}
        </span>
      )}
    </span>
  )
}

/**
 * The cabinet's own top, which is not a folder.
 *
 * ⚠️ A drawer rather than another folder: the root is where folders *live*, and drawing it as one of
 * them makes the tree look like it has a folder called "Files" inside something else.
 */
export function CabinetGlyph({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block shrink-0 align-middle", className)}
      style={{ width: size, height: size * 0.8 }}
    >
      {/* ⚠️ Inset from the top by the SAME 15% the folder's shoulder sits at. The two glyphs stack in
          one column, and a root drawn edge-to-edge in a box the folders only fill from 15% down reads as
          an icon a size too big, sitting too high — which is what "the icon is not centred" actually is.
          Matching the optical mass is what centres it; the box itself was never off. */}
      <span
        className="absolute right-0 bottom-0 left-0 rounded-[3px] border"
        style={{ top: "15%", borderColor: "var(--border)", background: "var(--muted)" }}
      />
      {/* The handle, centred in the DRAWER rather than in the box — 57% is the middle of 15%..100%. */}
      <span
        className="absolute left-1/2 h-px -translate-x-1/2"
        style={{ top: "57%", width: size * 0.5, background: "var(--muted-foreground)" }}
      />
    </span>
  )
}

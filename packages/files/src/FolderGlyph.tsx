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
 */
export function FolderGlyph({
  size = 18,
  muted = false,
  className,
}: {
  /** Width in pixels; the height follows at 0.8× — a folder is wider than it is tall. */
  size?: number
  /** For a folder that is not the point of the row — an ancestor, a disabled target. */
  muted?: boolean
  className?: string
}) {
  const tint = muted ? "var(--muted-foreground)" : "var(--primary)"

  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block shrink-0 align-middle", className)}
      style={{ width: size, height: size * 0.8 }}
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
        }}
      />
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
      <span
        className="absolute inset-0 rounded-[3px] border"
        style={{ borderColor: "var(--border)", background: "var(--muted)" }}
      />
      <span
        className="absolute left-1/2 h-px -translate-x-1/2"
        style={{ top: "46%", width: size * 0.5, background: "var(--muted-foreground)" }}
      />
    </span>
  )
}

/*
 * The glyphs Parallax's components draw: stroke icons on a 24-unit grid, and the drawing tools on their own 20-unit grid.
 * Exactly the ones the package uses — a host draws its own interface with its own set.
 */
const paths = {
  appearance: "M12 3a9 9 0 0 0 0 18c1.2 0 1.6-.8 1.6-1.6 0-1-.8-1.4-.8-2.3 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.2-4-7.5-9-7.5zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01M17 11h.01",
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  camera: "M4 8h4l2-3h4l2 3h4v11H4zM12 11a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  check: "M5 12l5 5 9-10",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-left": "M15 6l-6 6 6 6",
  "chevron-right": "M9 6l6 6-6 6",
  "chevron-up": "M6 15l6-6 6 6",
  circuit: "M8 8h8v8H8zM8 4v4M16 4v4M8 16v4M16 16v4M4 8h4M4 16h4M16 8h4M16 16h4",
  close: "M6 6l12 12M18 6L6 18",
  copy: "M9 9h11v11H9zM5 15V4h11",
  cursor: "M5 4l14 7-6 2-2 6z",
  cut: "M6 6l12 12M18 6L6 18M6 4a2 2 0 1 0 0 .01M6 20a2 2 0 1 0 0 .01",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  edit: "M4 20h4l11-11-4-4L4 16zM13 7l4 4",
  error: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9 9l6 6M15 9l-6 6",
  external: "M14 4h6v6M20 4l-9 9M18 13v6H5V6h6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  fit: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
  history: "M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5M12 8v4l3 2",
  minus: "M5 12h14",
  move: "M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3",
  pause: "M8 5h2v14H8zM14 5h2v14h-2z",
  "pin-point": "M12 3a5 5 0 0 1 5 5c0 4-5 10-5 10S7 12 7 8a5 5 0 0 1 5-5zM12 8h.01",
  play: "M7 5l12 7-12 7z",
  loop: "M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4",
  replay: "M4 4v6h6M4.5 10A8 8 0 1 1 6 16.5M10 9l5 3-5 3z",
  plus: "M12 5v14M5 12h14",
  record: "M12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12z",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  reset: "M4 10a8 8 0 1 1 2 7M4 4v6h6",
  rotate: "M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5",
  save: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6",
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4",
  step: "M5 5l10 7-10 7zM17 5h2v14h-2z",
  stop: "M6 6h12v12H6z",
  text: "M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6",
  trash: "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6M14 11v6",
  undo: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  unfold: "M4 5h16v14H4zM9 5v14M12 10l2 2-2 2",
  warning: "M12 4l9 16H3zM12 10v4M12 17h.01",
  wire: "M4 18h5l6-12h5M4 18a1 1 0 1 0 0 .01M20 6a1 1 0 1 0 0 .01",
  "zoom-in": "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4M11 8v6M8 11h6",
  "zoom-out": "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4M8 11h6",
} as const;

/** Drawing tools, on their original 20-unit grid. */
const drawingTools = {
  ellipse: "M17 10a7 5 0 1 1-14 0 7 5 0 0 1 14 0z",
  line: "M3 16L17 4M2 15h3v3H2zM15 2h3v3h-3z",
  mirror: "M10 2v16M3 6l4 4-4 4M17 6l-4 4 4 4",
  pan: "M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3",
  rectangle: "M3 4h14v12H3z",
} as const;

export type ParallaxIconName = keyof typeof paths | keyof typeof drawingTools;

/** One glyph, decorative: the control that carries it is named by its own label. */
export function ParallaxIcon({ name, large = false, className }: { name: ParallaxIconName; large?: boolean; className?: string }) {
  const classes = ["parallax-icon", large && "parallax-icon-large", className].filter(Boolean).join(" ");
  if (name in drawingTools) {
    return (
      <svg className={classes} viewBox="0 0 20 20" strokeWidth="1.35" aria-hidden="true">
        <path d={drawingTools[name as keyof typeof drawingTools]} />
      </svg>
    );
  }
  return (
    <svg className={classes} viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name as keyof typeof paths]} />
    </svg>
  );
}

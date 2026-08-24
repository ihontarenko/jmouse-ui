/**
 * The browser-tab mark, redrawn in whichever theme is on.
 *
 * <h2>⚠️ Why this exists at all, when `public/favicon.svg` already ships</h2>
 *
 * <p>That file is requested before any script runs, so it cannot know which theme the reader picked —
 * every product's copy hardcodes one colour for exactly that reason. This does **not** replace it: the
 * static file is still what paints the tab on the first frame and in every context that never runs the
 * application (a bookmark, a link preview, the tab of a page that failed to boot).
 *
 * <p>What this adds is the part a file cannot do. Once the theme is known, the mark is redrawn in that
 * theme's own `--primary`, so somebody running four of these products at once tells them apart by the
 * colour they chose rather than by a glyph four pixels wide at 16px.
 *
 * <h2>⚠️ The mechanism is shared; the DRAWING is not</h2>
 *
 * <p>Each product wears its own mark — Innoventa's chevrons, Tessera's diamond, Kiwi's leaves — so the
 * geometry stays in the product beside the `public/favicon.svg` it has to match. What lives here is
 * everything that was identical: reading the colours that are really in force, encoding the markup, and
 * hanging it on the one `rel="icon"` link.
 *
 * <h2>⚠️ It reads the COMPUTED value, never the palette table</h2>
 *
 * <p>`--primary` is a variable whose value depends on the theme class, the contrast mode and whatever a
 * seasonal effect did to it. Reading the token off the element that actually has them applied is the
 * only way to get the colour that is really on screen; looking the theme up in the catalogue would
 * duplicate the cascade and drift from it the first time anything else touches a token.
 */

/** The two colours a mark is drawn from. */
export interface MarkColours {
  /** What the tile is filled with — the active theme's `--primary`. */
  readonly plate: string
  /**
   * What the glyph is drawn in — the theme's `--primary-foreground`, which every theme sets to its own
   * paper colour, so the mark stays legible on a light or a dark plate without anybody having to decide
   * which one they are looking at.
   */
  readonly ink: string
}

/**
 * The two colours as they actually compute on the themed element.
 *
 * <p>⚠️ Answers `null` when either is missing rather than substituting a default. A tab painted in a
 * guessed colour is worse than the shipped file staying where it is.
 */
export function markColoursInForce(): MarkColours | null {
  if (typeof document === "undefined") {
    return null
  }

  const styles = getComputedStyle(document.documentElement)
  const plate = styles.getPropertyValue("--primary").trim()
  const ink = styles.getPropertyValue("--primary-foreground").trim()

  if (!plate || !ink) {
    return null
  }

  return { plate, ink }
}

/** Hang an SVG document in the tab. */
export function paintFavicon(svg: string): void {
  if (typeof document === "undefined") {
    return
  }

  // ⚠️ `encodeURIComponent` rather than base64: the markup is ASCII, a data URI accepts it percent-
  // encoded, and it stays readable in devtools where a base64 blob is a wall.
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`

  // ⚠️ The existing link is reused where there is one. Appending a second `rel="icon"` leaves the
  // browser choosing between two, and which one it picks is not something to rely on.
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')

  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    document.head.appendChild(link)
  }

  link.type = "image/svg+xml"
  link.href = href
}

/**
 * Build the callback `ThemeProvider`'s `onThemeApplied` wants.
 *
 * <p>⚠️ **Handed to the provider rather than run in a screen's own effect.** The mark is painted from
 * the *computed* `--primary`, so it has to be read once the theme class, the `.dark` toggle and the
 * contrast pass are all in place. Reading it a line earlier gives the outgoing theme's colour, which is
 * the sort of thing that looks like a caching bug for a week.
 *
 * <p>⚠️ Call this **once**, outside the component, and pass the result. Built inline it is a new
 * function on every render.
 *
 * @param draw the product's own mark, given the colours in force
 */
export function themedFaviconPainter(draw: (colours: MarkColours) => string): () => void {
  return () => {
    const colours = markColoursInForce()

    if (colours) {
      paintFavicon(draw(colours))
    }
  }
}

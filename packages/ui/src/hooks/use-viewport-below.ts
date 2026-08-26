import * as React from "react"

/**
 * Whether the viewport is narrower than this many CSS pixels — the hook behind a layout that
 * *rearranges* rather than narrows.
 *
 * <h2>⚠️ A media query, deliberately, and not `window.innerWidth`</h2>
 *
 * <p>The two disagree about a scrollbar, and more importantly a media query is what every Tailwind
 * breakpoint in the application is already evaluating. A component that decided "narrow" from
 * `innerWidth` while the CSS around it decided from `@media` produces the one bug nobody looks for: a
 * panel that thinks it is a sheet inside a layout that is still drawing three columns.
 *
 * <h2>⚠️ The font-scale zoom does NOT have to be reconciled here, and that is a fact worth writing down</h2>
 *
 * <p>`ThemeProvider` applies the text size as `body { zoom }`, which enlarges the CSS pixel and so
 * shrinks the viewport *for layout* while leaving media queries reading the real width. That would make
 * this hook disagree with what the reader sees — except that the same provider **never applies the zoom
 * on a mobile device at all**, so on the screens this hook exists for the multiplier is exactly 1.
 *
 * <p>On a deliberately narrowed desktop window at a large text size the two do drift apart by the zoom
 * factor. That is left alone on purpose: every `md:` and `xl:` in the application drifts by the same
 * amount, and a panel that used its own arithmetic would be the one element on the screen changing at a
 * different width from everything around it.
 *
 * @param pixels the first width at which the layout is considered wide — matches at `pixels - 1` and below
 */
export function useViewportBelow(pixels: number): boolean {
  const query = `(max-width: ${pixels - 1}px)`

  // ⚠️ Read during the first render rather than in an effect. Initialising to `false` and correcting
  // afterwards renders the wide layout once on every phone — which is a visible flash of a three-column
  // screen, and, for anything mounted inside the branch, a mount and an immediate unmount.
  const [below, setBelow] = React.useState(() => window.matchMedia(query).matches)

  React.useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setBelow(event.matches)

    setBelow(list.matches)
    list.addEventListener("change", onChange)

    return () => list.removeEventListener("change", onChange)
  }, [query])

  return below
}

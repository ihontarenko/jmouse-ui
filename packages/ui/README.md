# @jmouse/ui

The render layer three products share: 29 shadcn/ui primitives, the `cn` helper, the mobile hook, and
the theme mechanism.

**Nothing in here knows a domain, and nothing carries a colour value.**

## Install

```bash
npm install @jmouse/ui
```

Peer dependencies the product already has and must keep owning — a second copy of any of them breaks
the context it shares: `react`, `react-dom`, `radix-ui`, `lucide-react`, `react-hook-form`, `sonner`,
`recharts`.

## Wire it up — three lines in the product's CSS

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@jmouse/ui/styles.css";              /* the contract: tokens + the base layer */
@import "@jmouse/ui/presets/themes.css";      /* optional: the shared 29 palettes */

@source "../node_modules/@jmouse/ui/dist";    /* ⚠️ or every primitive renders unstyled */
```

⚠️ **`@source` is not optional.** Tailwind v4 scans source files for class names, and it does not look
inside `node_modules` on its own. Without that line the package's classes are never generated and the
application comes up unstyled with no error anywhere.

And one line in `vite.config.ts`:

```ts
resolve: { dedupe: ['react', 'react-dom'] }
```

⚠️ **Two copies of React are what a locally LINKED package gives you**, and the symptom is
`Invalid hook call` followed by `Cannot read properties of null (reading 'useState')`. While this
package is installed from a path rather than the registry, its own `node_modules` — devDependencies,
React among them — sits inside the link, and the bundler resolves the package's `react` there instead
of in the application. Deduping pins one copy for the whole graph, and stays correct after publication,
where the peer dependency would resolve in the application anyway.

## The theme

```tsx
import { ThemeProvider } from "@jmouse/ui"
import { allThemes } from "@jmouse/ui/presets"

<ThemeProvider themes={allThemes} storagePrefix="tessera">
  <Application />
</ThemeProvider>
```

- `themes` is **required**: the mechanism is shared, the palettes are the product's identity. Hand it
  `allThemes` to take the shared catalogue, or your own list to keep your own.
- `storagePrefix` namespaces the persisted preferences — `tessera.theme-mode`, `tessera.font-scale`
  and so on. ⚠️ Changing it for an existing product forgets everybody's theme, so it is the product's
  name and stays that way.
- `defaultLightTheme` / `defaultDarkTheme` — by name. Kiwi passes `"sage"` rather than taking the
  catalogue's first entry, so adding a theme above it cannot silently re-decide what the product opens
  in.

Two escape hatches for looks a product imposes rather than a reader choosing:

```tsx
<ThemeProvider
  themes={allThemes}
  storagePrefix="kiwi"
  defaultLightTheme="sage"
  initialOverrides={{ themeName: embedded.theme?.name, fontScale: embedded.fontScale }}
  onThemeApplied={repaintFavicon}
>
```

- `initialOverrides` seeds the state and is **never written back** — Kiwi's embedded shares carry
  `?theme=&scale=` in their own address, and a visitor who reads one in Dracula must still find their
  own theme when they sign in. It is read by the provider rather than applied by the screen because the
  provider is the only thing allowed to write the root element; a screen's own effect runs first and is
  overwritten on the next paint.
- `onThemeApplied` fires **after** the theme class, the `.dark` toggle and the contrast pass. Anything
  reading a computed custom property belongs here — Kiwi paints its favicon from `--primary`, and a
  line earlier it would read the outgoing theme.

What the provider does: applies the theme class to `<html>`, toggles `.dark`, blends the ink tiers for
contrast mode, and applies the font scale as `body.style.zoom`.

⚠️ **That zoom is why no overlay here is positioned by JavaScript.** A JS positioner divides a
trigger's measured rect by the zoom and then cannot reconcile a `position: fixed` containing block — a
trigger at y=18 opened its panel at y=654. `anchored.tsx` hands the job to the browser's own anchor
positioning instead, and `.anchored-panel` in `styles.css` is where that lives. Neither is optional,
and neither can be swapped for floating-ui without bringing the bug back.

## What is not here

Navigation, sidebar composition, routing, auth bootstrap, layout shell, i18n keys, theme values.
Access and AI screens are `@jmouse/access-ui` / `@jmouse/ai-ui`.

## Provenance

Seeded from `Kiwi/UI/src/components/ui` on 2026-08-18 — the more advanced of the two copies. Of the 29
primitives, 26 were byte-identical between Tessera and Kiwi; `dialog.tsx` and `dropdown-menu.tsx`
carried fixes only Kiwi had (a `minmax(0,1fr)` grid track that stops one wide child from widening the
whole dialog; `onSelect` and keyboard activation on a menu item, which Tessera's copy silently ignores),
and `anchored.tsx` differed only in a product name inside a comment.

# `@jmouse/parallax-react` — Parallax's interface as React components

The bench, the viewers, the schematic, the oscilloscope and meters, the Graph, the object stand, the document and
symbol editing surfaces — over `@jmouse/parallax`, with **no router, no product and no HTTP client inside**. A host
mounts three providers, maps its tokens, and renders the components; the look is the host's to dictate.

## Install

```json
"@jmouse/parallax": "file:../../../jmouse-ui/packages/parallax",
"@jmouse/parallax-react": "file:../../../jmouse-ui/packages/parallax-react",
"@jmouse/codemirror": "file:../../../jmouse-ui/packages/codemirror"
```

`npm run build` in both packages (`tsc`, then `styles.css` copied into `dist/`). **Peers, not dependencies:** `react`
and `react-dom` ≥ 19, `three`, `katex`, `@jmouse/parallax`, `@jmouse/codemirror`, `@codemirror/{state,view,language,
autocomplete}`, `@lezer/{common,highlight}`.

## Entry points

| Specifier | Holds |
|---|---|
| `@jmouse/parallax-react` | the ports: `ParallaxTransportProvider` (+ `useParallaxTransport`, `useParallaxPartLibrary`, `usePartLibrary`), `ParallaxNavigationProvider` (+ `ParallaxLink`, `useParallaxNavigation`, `ParallaxTarget`), `ParallaxSettingsProvider` (+ `useParallaxSettings`) |
| `/bench` | `Bench` — the composed emulator (sheet, instruments, properties) — `CircuitPanel`, `CircuitProperties` |
| `/viewers` | `VisualView`, `ComputedViewport`, `ComputationProgress`, `SpecimenView`, `ObjectThumbnail`, `DatasetFacts`, `Formula`, `FormulaEditor`, `CodeSourceEditor`, `ParameterSlider`, `ParameterTable`, `RepresentationSwitcher`, `SettingsForm`, `Timeline`; `useComputation`, `useFrames`, `useAnimation`, `useDeeperZoom`, `useFrameRateGuard` |
| `/circuit` | `Schematic`, `SchematicLoads`, `PartPalette`, `SheetToolbar`, `EmulatorInstrument`, `LogicTimingView`, `EmulatorAppearanceControls`; `useSheetEditing`, `useLiveCircuit`, `useTethers`, `useEmulatorAppearance` |
| `/scope` | `ScopeScreen`, `Oscilloscope`, `ComputedOscilloscope` |
| `/meters` | `Instruments`, `MeterTrend` |
| `/graph` | `Graph`, `GraphPanes`, `SpacePane`, `CircuitPane`, `ValuesPane`; `useChecks`, `useLabels`, `useSignals` |
| `/stand` | `Stand` (the object page built from its explanation), `presentations` |
| `/document` | `DocumentEditor`, `DocumentFormView`, `DraftPreview`, `FieldWidget`, `useReferences` |
| `/symbols` | `PartSymbol`, `SymbolDrawing`, `SymbolEditorSurface`, `ComponentPreview`, `ComponentSourceSurface` |
| `/scene` | `useSceneEditor` |
| `/program` | `ProgramSurface` |
| `/controls` | `BenchGrid`, `PaneSplit`, `StageSplit`, `BenchControls` (tools, segments, stepper), `QuantityField`, `Segmented` |
| `/icons` | `ParallaxIcon` — the instrument glyphs |
| `/styles.css` | the one stylesheet, imported explicitly |

## Providers and ports

Mounted once, at the root. ⚠️ The transport and navigation hooks **throw** without their provider — a bench with no
transport would render empty and read as "this circuit has no parts", a link with no router as a dead control.

```tsx
import { ParallaxNavigationProvider, ParallaxSettingsProvider, ParallaxTransportProvider } from "@jmouse/parallax-react";
import "@jmouse/parallax-react/styles.css";

<ParallaxTransportProvider value={parallaxTransport /* transportOver(…) from @jmouse/parallax */}>
  <ParallaxNavigationProvider value={{ renderLink, navigate }}>
    <ParallaxSettingsProvider value={{ computationOwner, minimumFrameRate, emulatorAppearance }}>
      <App />
    </ParallaxSettingsProvider>
  </ParallaxNavigationProvider>
</ParallaxTransportProvider>
```

| Port | Value | Notes |
|---|---|---|
| `ParallaxTransportProvider` | a `ParallaxTransport` | also keeps the part library for that transport (component models, symbol documents) shared by every sheet under it; a second transport gets its own |
| `ParallaxNavigationProvider` | `{ renderLink(target, children, attributes?), navigate(target) }` | `renderLink` returns the host's own anchor (`attributes`: `className`, `role`, `title`, `aria-label`) |
| `ParallaxSettingsProvider` | `ParallaxSettings` | optional: without it, computations run unowned, no drawing is held back, current is drawn as shipped |

**`ParallaxTarget`** — a closed union, so a host maps every one onto its routes and the package names no URL:

| `kind` | Carries | Means |
|---|---|---|
| `object` | `slug` | an object's own page |
| `circuit` | `slug` | a circuit on its bench |
| `circuits` | — | the circuits there are, to choose one |
| `symbol` | `slug` | a symbol in the symbol editor |
| `symbols` | — | the symbols there are |
| `new-symbol` | — | the symbol editor, blank |
| `formula` | `source` | a formula opened on its own |
| `reference` | — | the language reference |

**`ParallaxSettings`** — `computationOwner: ParallaxOwner | null` (the host owner a queued computation runs for, `{ type, id }`; `null` = unowned) ·
`minimumFrameRate: number` (frames per second a viewport keeps before a heavier setting may rise; 0 = off) ·
`emulatorAppearance: EmulatorAppearance` (how current, glow and leads are drawn).

## `<Bench>`

| Prop | Type | Means |
|---|---|---|
| `reference` | `string` | the circuit as a subject, `catalogue:<slug>` |
| `detail` | `ObjectDetail` | the circuit object |
| `editable` | `boolean` | whether the reader may change and save it — the host decides |
| `representation` | `string \| null` | the analysis shown, kept by the host (e.g. in the address); `null` = the circuit's primary |
| `onRepresentation` | `(representation) => void` | |
| `initialView` | `"emulator" \| "schematic"` | default `"emulator"` |
| `onSaved` | `(title) => void` | after a save |
| `onSaveFailed` | `(problem: ApiProblem) => void` | why a save was refused |
| `bar` | `(parts: BenchBarParts) => ReactNode` | **required** — the host draws the bar; `parts`: `view`, `onView`, `context` (analysis, run controls, speed, state), `actions` (unsaved mark, Save), `runText(text)`, `problem` |

The transient runs live on the server through the transport's socket; the other analyses are computed and drawn in
the instrument's place.

## `<Graph>`

Controlled: the host keeps the graph and remounts it (`key`) to open another.

| Prop | Type | Means |
|---|---|---|
| `value` | `GraphState` | `expressions`, `view` (the first plane's), `arrangement` (`layout`, `panes`, `checks`), `clock` (`parameter`, `playing`, `speed`) or `null` |
| `onChange` | `(update: (current) => GraphState) => void` | every change as a step — several may arrive before the host renders |
| `canKeepLines` | `boolean` | whether a line may be kept as an object (e.g. signed in) |
| `onKeepLine` | `(source) => void` | keeps one line, written with the definitions it calls |
| `incoming` | `string` | formulas to add, one per line — once each; an existing slider keeps its value |
| `onIncomingTaken` | `() => void` | the host forgets `incoming` |

## The styling contract

The product dictates the look; there is no `theme` prop and no runtime theming code. Three layers:

1. **Tokens are the contract.** Every colour, line, radius, space, font and stroke is a `--parallax-*` custom
   property with a default under `:where(:root)` (specificity zero), light and dark. The canvases, WebGL and SVG read
   the same tokens from computed style, so a mapped token reaches the pictures too.
2. **The rules sit in `@layer jmouse-parallax`.** Any unlayered host rule wins without `!important`.
3. **Stable parts.** `data-parallax-part="…"` (`bench`, `bench-grid`, `bench-column`, `scope-toolbar`, `scope-screen`,
   `circuit-diagram`, `meter-display`, `segmented`, `button`, `sheet`, `stand`, `graph-pane`, …) and states as
   `data-state` (`bench-instruments`: screen · meters · both; `run-state`: running · stopped · …; `part-load`: within ·
   overloaded · overheated · burnt) or `aria-pressed`. The `parallax-*` class names inside are **not** a contract.

| Group | Tokens |
|---|---|
| page | `background` `surface` `surface-2` `well` `ink` `secondary` `muted` `line` `line-strong` `accent` `accent-soft` `accent-strong` `on-accent` `good` `warn` `danger` (+ `-soft`) `focus-ring` |
| geometry | `space-1…7` `radius-small` `radius-control` `radius-surface` (0 by default) `control` `control-small` `icon` `icon-large` `band` `shadow-surface` `shadow-pop` `ease` |
| type | `font-ui` `font-heading` `font-control` `font-technical` `text-2xs…md` `weight-body` `weight-control` `weight-heading` `ui-scale` |
| layout | `topbar` `panel` `inspector` `bench-bar` `panel-width` `inspector-width` `bench-folded` `scope-height` |
| drawing | `sheet` `sheet-grid` `wire` `wire-live` `node` `stroke-symbol` `stroke-wire` `lead-*` `flow-*` |
| screen | `screen` `screen-grid` `screen-grid-strong` `screen-text` `channel-1…4` |
| owned sets | `probe-1…10` (5–10 fixed, 1–4 follow the channels) `series-1…6` (the Graph's lines, a series' columns) |
| instrument | `instrument-background` `-surface` `-well` `-ink` `-muted` `-line` `-line-strong` `-font` — what schematics, the scope screen, logic timing, part loads and the voltage legend sit on; follows the page unless mapped |

**Dark** is `:where(.dark, .theme-dark, [data-theme="dark"])` — the three ways hosts say it, as
`@jmouse/codemirror/styles.css` does.

**A host mapping** — one file, outside the library, after it, on `:root` (a property built from `var()` is computed
where it is declared):

```css
:root {
  --parallax-background: var(--bg);
  --parallax-surface: var(--surface);
  --parallax-ink: var(--ink);
  --parallax-line: var(--line);
  --parallax-accent: var(--accent);
  --parallax-good: var(--good);
  --parallax-danger: var(--danger);
  --parallax-radius-control: var(--radius-control);
  --parallax-font-technical: var(--font-mono);
}
```

⚠️ **Put your reset BELOW the layer.** An unlayered element reset (`button { background; border; padding }`) beats
`.parallax-button` like any unlayered rule. Declare the order once and put the reset (and KaTeX's sheet) in the lower
layer:

```css
@layer host-base, jmouse-parallax;
@import "katex/dist/katex.min.css" layer(host-base);
@import "@jmouse/parallax-react/styles.css";
@import "./reset.css" layer(host-base);
@import "./parallax-mapping.css";
```

## Vite

Linked packages resolve their peers through their own `node_modules`; the same version twice is two modules —
CodeMirror refuses an editor built across two copies, two `three`s are two WebGL worlds, two Reacts break the hook
rules. Dedupe, and allow the linked directories:

```ts
resolve: {
  dedupe: ["react", "react-dom", "three", "katex", "@jmouse/parallax", "@jmouse/codemirror",
    "@codemirror/state", "@codemirror/view", "@codemirror/language", "@codemirror/autocomplete",
    "@lezer/common", "@lezer/highlight"],
},
server: {
  fs: { allow: [".", "../../../jmouse-ui/packages/codemirror", "../../../jmouse-ui/packages/parallax",
    "../../../jmouse-ui/packages/parallax-react"] },
  proxy: { "/jmouse": { target: "http://localhost:<backend>", changeOrigin: true, ws: true } },
},
```

`ws: true` is the live socket; without it the handshake is never forwarded and no circuit runs live.

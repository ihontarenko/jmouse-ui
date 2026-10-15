# `@jmouse/parallax` — Parallax's machinery, headless

The engine's interface without React and without a product: the wire types and a transport port for the
`jmouse-parallax` routes, the live-circuit session, the drawing library (one stage, WebGL and Canvas drivers), the
circuit and schematic models, the oscilloscope, routing, quantities, graphs and scenes. A canvas page, a worker or a
React package (`@jmouse/parallax-react`) builds on it; it imports nothing back.

Backend counterpart: `jmouse/api-documentation/JMOUSE_PARALLAX.md` — the routes, the problem codes, the live frame.

## Install

Linked from this monorepo, as `@jmouse/codemirror` is:

```json
"@jmouse/parallax": "file:../../../jmouse-ui/packages/parallax"
```

`npm run build` here (`tsc` into `dist/`) before the host type-checks. **Peer:** `three` (≥ 0.180) — one copy in the
bundle, see "Vite" below.

## Entry points

| Specifier | Holds |
|---|---|
| `@jmouse/parallax` | the transport: `ParallaxTransport`, `transportOver`, `liveOver`, `PARALLAX_API_PREFIX`, `PARALLAX_LIVE_PATH`, wire types (`ObjectDetail`, `ObjectDraft`, `ComputationRequest`, `ComputationAnswer`, `Job`, …), `openLiveCircuit` and the live messages, `ApiProblem` / `ProblemBody` / `PageSlice` / `isAbort`, subjects (`catalogueSubject`, `inlineSubject`, `documentSubject`), `draftOf` |
| `/visual` | the one drawing library: `datasets` → `build` → `geometry` → driver (`drivers/webgl` live, `drivers/canvas` thumbnails) → `stage` (plane / space cameras, fit, pinned window, overlay), `controls`, `theme`, `annotations` (labels, bars), `refinement` (deeper zoom), `reveal` (a trace cut at a clock), `animation` |
| `/computation` | capabilities, representation names, the computation request and runner |
| `/circuit` | `SchematicDocument`, `sheetEditing` operations, `sheetStructure`, `circuit` (definition ↔ drawing), `circuitTrace` (`SeriesFlow`, `LiveFlow`), `currentLight`, `currents`, `alternation`, `emulatorAppearance`, `LiveCircuitSession` (owns the socket; a listener port) |
| `/bench` | `benchSetup` (what a bench sets up over a saved circuit), `benchReadings` |
| `/schematic` | the part library (`ParallaxPartLibrary`: component models and symbol documents per transport), symbol drawings, label placement, `autoplace` |
| `/routing` | orthogonal wire routing on a grid: no wire through a body, hops at crossings, dots at branches |
| `/component` | a component's symbol and the source it is read from |
| `/oscilloscope` | `SampleMemory` (fixed ring), `PlaybackClock`, recordings, window, trigger, measurements |
| `/scope` | the screen: channels, time base, trace envelopes, painting |
| `/meters` | what each bench meter reads off a running circuit |
| `/graph` | the graph document: expressions, labels, signals, checks |
| `/scene` | editing a scene document |
| `/document` | references between jMX documents |
| `/playback` | frames of an animation, the frame rate this machine keeps |
| `/quantities` | SI values with metric prefixes, the 1–2–5 ladder |
| `/tether` | the rope a lead hangs by (one Verlet chain) |

## The transport port

⚠️ **No HTTP client lives here, deliberately.** The host already has one, wired to its token, its 401 handling and
its problem documents; a second would be a request that skips all of that. The host hands over one function:

```ts
import { transportOver, PARALLAX_API_PREFIX, PARALLAX_LIVE_PATH, type ParallaxRequest } from "@jmouse/parallax";

// The whole address in, the JSON answer out, a refusal thrown as ApiProblem. All four verbs; undefined for a 204.
const request: ParallaxRequest = (method, url, options) => myHttp(method, url, options);

export const parallaxTransport = transportOver(request, PARALLAX_API_PREFIX, () => session.token(), PARALLAX_LIVE_PATH);
```

| Argument | Default | Means |
|---|---|---|
| `request` | — | the host's request function |
| `prefix` | `/jmouse/parallax/api` | where the REST routes answer (`jmouse.parallax.management.prefix`) |
| `token` | `() => null` | for the live socket only, asked when a socket opens and never kept |
| `livePath` | `/jmouse/parallax/live` | where the socket answers (`jmouse.parallax.live.path`), on the page's own host, `ws`/`wss` by protocol |

`ParallaxTransport` covers the engine's routes only — `catalogue`, `components`, `computations`, `documents` (`/jmx/*`),
`formula`, `subjects`, `live`. The library's other routes (scenes, comparisons, collections, instruments, an owner's
objects and jobs, administration) answer under the same prefix and are called from the host's own API modules.

⚠️ The prefix and the path are told twice — to the backend in configuration, to this port in code — and nothing checks
that they agree. A mismatch renders as an empty catalogue, not as an error.

## Rules

- Nothing here imports React or a product; `@jmouse/parallax-react` imports this, never the other way.
- Drawings read their colours from computed style (`visual/theme`, the screen, probe and series readers) — the
  `--parallax-*` tokens of `@jmouse/parallax-react/styles.css`; no colour is a parameter.
- Caches that used to be module singletons (the part library, references, frame rate) belong to a transport: two
  transports, two caches.

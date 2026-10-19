/**
 * `@jmouse/ui-kit/instruments` — Parallax's instruments (the bench, the oscilloscope, the schematic, meters, the graph,
 * the stand, documents, symbols, scenes, programs) worn in the kit's themes.
 *
 * ⚠️ They are NOT copied here: they are `@jmouse/parallax-react`, re-exported, so there is one implementation. This
 * entry is what makes them optional: `@jmouse/parallax-react` and `three` are optional peers of the kit, so a product
 * that never imports `@jmouse/ui-kit/instruments` never installs or bundles them, and one that imports it without
 * them fails at build time naming what is missing. Import `@jmouse/ui-kit/instruments.css` once beside it — the
 * bridge that maps the kit's tokens onto the instruments' own.
 *
 * The root carries the ports a host mounts once (transport, navigation, settings); the components are in subpaths by
 * domain: `@jmouse/ui-kit/instruments/scope`, `/circuit`, `/bench`, `/meters`, …
 */
export * from "@jmouse/parallax-react"
export { InstrumentGate, type InstrumentGateProperties } from "./InstrumentGate"

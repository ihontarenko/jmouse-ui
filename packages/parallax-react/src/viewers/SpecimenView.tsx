import { useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ComponentModelView, ParameterDefinition, SymbolView } from "@jmouse/parallax";
import { useAsync } from "../support/useAsync";
import { VisualView } from "./VisualView";
import { AnimationPlayer, FrameBuffer, onOneAxis, type Dataset, type PlayerFrame } from "@jmouse/parallax/visual";
import { type CircuitDefinition, drawingOfCircuit, withShownValues } from "@jmouse/parallax/circuit";
import { Schematic } from "../circuit/Schematic";

/*
 * What Parallax shows where nobody is signed in yet — the landing and the account pages. The platform is closed to the
 * anonymous, so these are shipped: datasets and frames its own engine computed once (the host reads them, `loadSpecimen`), drawn and
 * played by the same library as every other picture.
 */

/** A still specimen: one dataset, turning slowly. */
export type StillSpecimen = "torus" | "lorenz";

/** An animated specimen: the frames of one computation over one parameter. */
export type AnimatedSpecimen = "fourier" | "low-pass";

interface Animation {
  parameter: string;
  values: number[];
  frames: Dataset[];
}

/**
 * Reads one shipped specimen by its name — `torus`, `lorenz`, `fourier`, `low-pass`, `low-pass-circuit`, `symbols`,
 * `component-models` —, wherever the host keeps them (Parallax: `/specimens/{name}.json`).
 */
export type SpecimenLoader = <T>(name: string, signal: AbortSignal) => Promise<T>;

/** A still specimen turning slowly. */
export function SpecimenView({ name, title, interactive = false, loadSpecimen }: {
  name: StillSpecimen;
  title: string;
  interactive?: boolean;
  loadSpecimen: SpecimenLoader;
}) {
  const specimen = useAsync((signal) => loadSpecimen<Dataset>(name, signal), [name]);
  const layers = useMemo(() => (specimen.data ? [{ id: name, dataset: onOneAxis(specimen.data) }] : []), [specimen.data, name]);
  return <VisualView layers={layers} title={title} interactive={interactive} readout={false} spin={0.25} fitKey={name} />;
}

/**
 * An animated specimen: its frames played forth and back by the drawing library's player, each blended into the next.
 * Told the parameter's value as it plays, for a caption.
 */
function AnimatedView({ animation: given, title, onValue }: { animation: Animation; title: string; onValue?: (value: number) => void }) {
  // One axis, one unit: the step response's source current (A) is not drawn flat at zero under its volts.
  const animation = useMemo(() => ({ ...given, frames: given.frames.map(onOneAxis) }), [given]);
  // Forth and back, so the loop never jumps from the last frame to the first.
  const order = useMemo(() => [...animation.frames.keys(), ...[...animation.frames.keys()].slice(1, -1).reverse()], [animation]);
  const player = useMemo(() => {
    const grid = order.map((index) => animation.values[index]);
    const buffer = new FrameBuffer<Dataset>(grid, async (values) => ({ frames: values.map((value) => animation.frames[animation.values.indexOf(value)]), complete: true }));
    buffer.fill(0);
    return new AnimationPlayer(new Map([["specimen", buffer]]), grid.length, { secondsPerLoop: order.length * SECONDS_PER_SPECIMEN_FRAME, loop: true });
  }, [animation, order]);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stop = player.onIndex((index) => onValue?.(animation.values[order[index]]));
    if (!reduced) {
      player.play();
    }
    return () => {
      stop();
      player.destroy();
    };
  }, [player]);
  const playback = useMemo(() => ({ subscribe: (listener: (frame: PlayerFrame<Dataset>) => void) => player.subscribe(listener) }), [player]);
  const layers = useMemo(() => [{ id: "specimen", dataset: animation.frames[0] }], [animation]);
  return <VisualView layers={layers} title={title} interactive={false} readout={false} compact={false} playback={playback} fitKey={title} />;
}

/**
 * How long a specimen stays on one frame while blending into the next. It was 0.28 s: twenty harmonics took over five
 * seconds to build up and the loop ten — the two animated tiles read as stuck next to the turning ones.
 */
const SECONDS_PER_SPECIMEN_FRAME = 0.12;

function format(value: number): string {
  return value >= 1000 ? `${Number((value / 1000).toPrecision(3))} k` : String(Number(value.toPrecision(3)));
}

/** One tile of the grid: a picture and, under it, what it is, what is moving, and what it is defined by — the one thing written. */
function SpecimenTile({ title, caption, definition, children }: { title: string; caption: string; definition?: string; children: ReactNode }) {
  return (
    <figure className="parallax-specimen-tile">
      <div data-parallax-part="specimen-view" className="parallax-specimen-view">{children}</div>
      <figcaption>
        <strong>{title}</strong>
        <span className="parallax-technical">{caption}</span>
        {definition ? <code className="parallax-specimen-definition" title={definition}>{definition}</code> : null}
      </figcaption>
    </figure>
  );
}

function StillTile({ name, title, caption, definition, loadSpecimen }: { name: StillSpecimen; title: string; caption: string; definition: string; loadSpecimen: SpecimenLoader }) {
  return <SpecimenTile title={title} caption={caption} definition={definition}><SpecimenView name={name} title={title} loadSpecimen={loadSpecimen} /></SpecimenTile>;
}

function FourierTile({ loadSpecimen }: { loadSpecimen: SpecimenLoader }) {
  const animation = useAsync((signal) => loadSpecimen<Animation>("fourier", signal), []);
  const [harmonics, setHarmonics] = useState(1);
  return (
    <SpecimenTile title="Fourier synthesis" caption={`square wave · ${harmonics} ${harmonics === 1 ? "harmonic" : "harmonics"}`}
      definition="y = 4/π · Σ sin((2k + 1) x) / (2k + 1),  k = 0 … N">
      {animation.data ? <AnimatedView animation={animation.data} title="A square wave summed from sines" onValue={setHarmonics} /> : null}
    </SpecimenTile>
  );
}

/**
 * The circuit drawn from its own document, and its step response playing as its resistance grows — the specimen a
 * circuit bench shows on its own, and the fourth tile of {@link SpecimenGrid}.
 */
export function CircuitSpecimen({ loadSpecimen }: { loadSpecimen: SpecimenLoader }) {
  const library = useParallaxPartLibrary();
  const animation = useAsync((signal) => loadSpecimen<Animation>("low-pass", signal), []);
  const circuit = useAsync((signal) => loadSpecimen<{ definition: CircuitDefinition; parameters: ParameterDefinition[] }>("low-pass-circuit", signal), []);
  const symbols = useAsync((signal) => loadSpecimen<SymbolView[]>("symbols", signal), []);
  const models = useAsync((signal) => loadSpecimen<Record<string, ComponentModelView>>("component-models", signal), []);
  const [resistance, setResistance] = useState(250);
  useEffect(() => {
    if (symbols.data) {
      library.rememberSymbols(symbols.data);
    }
  }, [symbols.data]);
  useEffect(() => {
    Object.entries(models.data ?? {}).forEach(([reference, model]) => library.rememberComponentModel(reference, model));
  }, [models.data]);
  const elements = useMemo(() => (circuit.data
    ? withShownValues(circuit.data.definition.elements, circuit.data.parameters, { ...Object.fromEntries(circuit.data.parameters.map((parameter) => [parameter.name, parameter.defaultValue])), R: resistance })
    : []), [circuit.data, resistance]);
  return (
    <SpecimenTile title="RC low-pass filter" caption={`step response · R = ${format(resistance)}Ω`}
      definition="V1 step → R1 → C1 to ground,  τ = RC">
      <div className="parallax-specimen-circuit">
        {circuit.data ? <div className="parallax-specimen-schematic" aria-hidden="true"><Schematic elements={elements} drawing={drawingOfCircuit(circuit.data.definition)} readings={false} /></div> : null}
        <div className="parallax-specimen-trace">{animation.data ? <AnimatedView animation={animation.data} title="The filter's output following a step" onValue={setResistance} /> : null}</div>
      </div>
    </SpecimenTile>
  );
}

/** Four specimens — a surface, an attractor, a sum of sines, a circuit — each live, each from the engine. */
export function SpecimenGrid({ compact = false, loadSpecimen }: { compact?: boolean; loadSpecimen: SpecimenLoader }) {
  return (
    <div data-parallax-part="specimen-grid" className={compact ? "parallax-specimen-grid parallax-compact" : "parallax-specimen-grid"}>
      <StillTile name="torus" title="Torus" caption="parametric surface · turning"
        definition="((R + r cos v) cos u,  (R + r cos v) sin u,  r sin v)" loadSpecimen={loadSpecimen} />
      <StillTile name="lorenz" title="Lorenz attractor" caption="differential system · turning"
        definition="ẋ = σ(y − x),  ẏ = x(ρ − z) − y,  ż = xy − βz" loadSpecimen={loadSpecimen} />
      <FourierTile loadSpecimen={loadSpecimen} />
      <CircuitSpecimen loadSpecimen={loadSpecimen} />
    </div>
  );
}

/** The shipped `representations` specimen: one object's computed datasets, one per representation. */
interface RepresentationsSpecimen {
  object: string;
  items: { representation: string; dataset: Dataset }[];
}

/** What each representation of the strip is called, and what it shows of the object. */
const REPRESENTATION_TILES: { representation: string; title: string; caption: string; over?: string; spin?: number }[] = [
  { representation: "SURFACE", title: "Surface", caption: "the graph of z · turning", spin: 0.2 },
  { representation: "LEVEL_SET", title: "Level sets", caption: "fourteen heights of z" },
  { representation: "GRADIENT", title: "Gradient", caption: "the way up, at every point" },
  { representation: "CRITICAL_POINTS", title: "Critical points", caption: "minima · saddles · maximum", over: "SURFACE", spin: 0.2 },
];

/**
 * One object seen four ways — its surface, its level sets, its gradient and its critical points — each computed by the
 * engine from the same definition. What Parallax is, shown rather than said: an object is written once, and every
 * picture of it is a representation. The critical points are drawn on the surface they belong to.
 */
export function SpecimenRepresentations({ definition, loadSpecimen }: { definition: string; loadSpecimen: SpecimenLoader }) {
  const specimen = useAsync((signal) => loadSpecimen<RepresentationsSpecimen>("representations", signal), []);
  const datasets = useMemo(() => new Map(specimen.data?.items.map((item) => [item.representation, item.dataset]) ?? []), [specimen.data]);
  return (
    <div data-parallax-part="specimen-representations" className="parallax-specimen-representations">
      {REPRESENTATION_TILES.map((tile) => {
        const found = datasets.get(tile.representation);
        const dataset = found ? onOneAxis(found) : undefined;
        const under = tile.over ? datasets.get(tile.over) : undefined;
        const layers = [...(under ? [{ id: tile.over!, dataset: under }] : []), ...(dataset ? [{ id: tile.representation, dataset }] : [])];
        return (
          <SpecimenTile key={tile.representation} title={tile.title} caption={tile.caption}>
            {dataset ? <VisualView layers={layers} title={`${tile.title} of ${definition}`} interactive={false} readout={false} spin={tile.spin}
              fitKey={tile.representation} /> : null}
          </SpecimenTile>
        );
      })}
    </div>
  );
}

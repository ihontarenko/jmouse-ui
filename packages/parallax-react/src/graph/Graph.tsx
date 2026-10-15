import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { computationRequest } from "@jmouse/parallax/computation";
import { bufferFor, datasetPlayback, type FrameSource } from "@jmouse/parallax/playback";
import {
  computationWindow, evaluateConstant, GRAPH_COLOR_COUNT, type GraphCheck, type GraphExpression, type GraphPaneDocument, isGeometrySource, isLabelSource, type LabelSource, labelText, libraryOf, nearestListed, newExpression, nextColorIndex, parseLabel, planeDrawingOf, pointOf, roleOf, roleOfLine, sliderRange, type SliderRange, sliderValues, spaceDrawingOf, withLibrary,
} from "@jmouse/parallax/graph";
import { AnimationPlayer, frameGrid, nearestFrame, visibleWindow, type PlaneView, type PlaneWindow, type Size, type StageLayer } from "@jmouse/parallax/visual";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { useParallaxSettings } from "../providers/ParallaxSettings";
import { ParallaxLink } from "../providers/ParallaxNavigation";
import { humanize } from "../support/humanize";
import { useAsync, useDebouncedValue } from "../support/useAsync";
import { Formula } from "../viewers/Formula";
import { FormulaEditor } from "../viewers/FormulaEditor";
import { useComputation } from "../viewers/useComputation";
import { usePlayerProgress } from "../viewers/useFrames";
import { Timeline } from "../viewers/Timeline";
import { ComputationProgress } from "../viewers/ComputationProgress";
import { BenchGrid } from "../controls/BenchGrid";
import { Tool } from "../controls/BenchControls";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { GraphPanes, type PaneContent } from "./GraphPanes";
import { useSignalLayer } from "./useSignals";
import { useGraphChecks } from "./useChecks";
import { useLabelValues, useReportLabel } from "./useLabels";

/**
 * How many frames one pass over a slider's range is cut into. Enough to play without a morph between them: frames
 * far apart are not blended (`blendBatches`), since a straight line between two phases of a curve is not the curve.
 */
const GRAPH_FRAMES_PER_LOOP = 160;

/** The panes a graph is drawn in and how they share the screen, with what the graph claims. */
export interface GraphArrangement {
  layout: string;
  panes: GraphPaneDocument[];
  checks?: GraphCheck[];
}

/** The one clock: which slider plays, whether it plays, how fast. */
export interface GraphClock {
  parameter: string;
  playing: boolean;
  speed: number;
}

/** A graph as the host keeps it: its lines, the first plane's view, its panes and its clock — what a save writes. */
export interface GraphState {
  expressions: GraphExpression[];
  view: PlaneView;
  arrangement: GraphArrangement;
  clock: GraphClock | null;
}

const colorOf = (index: number) => `var(--parallax-series-${(index % GRAPH_COLOR_COUNT) + 1})`;

/**
 * The graph: a list of expressions on one plane, the way a graphing calculator works — sliders, definitions the other
 * lines call, curves, equations and regions together, panned and zoomed freely. Every line is computed by the backend
 * over the window the plane shows. Controlled: the host keeps the graph (Parallax: in the browser, or as a saved object)
 * and draws the bar above it; it remounts the graph (`key`) when it opens another one.
 */
export function Graph({ value: graph, onChange, canKeepLines = false, onKeepLine, incoming, onIncomingTaken }: {
  value: GraphState;
  /** Told of every change, as a step from the current graph — several may arrive before the host draws again. */
  onChange: (update: (current: GraphState) => GraphState) => void;
  /** Whether a line may be kept as an object of its own (Parallax: when someone is signed in). */
  canKeepLines?: boolean;
  /** Keeps one line, written with the definitions it calls, as an object of its own. */
  onKeepLine?: (source: string) => void;
  /** Formulas to add as new lines, one per line of the text — once each; a slider the graph has keeps its value. */
  incoming?: string;
  /** Told once the incoming formulas are on the graph, so the host can forget them. */
  onIncomingTaken?: () => void;
}) {
  const { arrangement, clock } = graph;
  const setClock = (next: GraphClock | null) => onChange((current) => ({ ...current, clock: next }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<string, StageLayer>>({});
  /** The labels the lines report, by line id; each pane draws its own over its plane. */
  const [labels, setLabels] = useState<Record<string, LabelSource>>({});
  /** The line just added, which takes the caret as it appears. */
  const [focusId, setFocusId] = useState<string | null>(null);
  const [planeSize, setPlaneSize] = useState<Size>({ width: 1000, height: 700 });
  /** Each plane pane but the first, panned and zoomed on its own; the first pane's view is the graph's `view`. */
  const [paneViews, setPaneViews] = useState<Record<string, { view: PlaneView; size: Size }>>({});
  /** What each line that depends on the playing slider asks the backend for, frame by frame. */
  const [frameSources, setFrameSources] = useState<Record<string, FrameSource>>({});
  const { computationOwner } = useParallaxSettings();

  // A formula sent here becomes a new line, once; the host then forgets it so a reload does not add it again.
  const taken = useRef<string | null>(null);
  useEffect(() => {
    if (!incoming || taken.current === incoming) {
      return;
    }
    taken.current = incoming;
    const sources = incoming.split("\n").map((line) => line.trim()).filter(Boolean);
    onChange((current) => {
      const kept = current.expressions.filter((expression) => expression.source.trim());
      const added: GraphExpression[] = [];
      for (const source of sources) {
        // A slider the graph already has keeps its value; the object's default does not overwrite the reader's.
        const role = roleOf(source);
        if (role.kind === "slider" && kept.some((expression) => {
          const existing = roleOfLine(expression);
          return existing.kind === "slider" && existing.name === role.name;
        })) {
          continue;
        }
        added.push(newExpression(source, nextColorIndex([...kept, ...added])));
      }
      setSelectedId(added.at(-1)?.id ?? null);
      return { ...current, expressions: [...kept, ...added] };
    });
    onIncomingTaken?.();
  }, [incoming]);

  // The view moves under the reader's hand dozens of times a second; the graph hears of it only once it settles, so
  // panning and zooming never render the expression list.
  const settle = useRef(new Map<string, number>());
  const firstPane = arrangement.panes[0]?.name ?? "main";
  const onView = useCallback((pane: string, next: PlaneView, size: Size) => {
    const waiting = settle.current.get(pane);
    if (waiting !== undefined) {
      window.clearTimeout(waiting);
    }
    settle.current.set(pane, window.setTimeout(() => {
      settle.current.delete(pane);
      if (pane === firstPane) {
        onChange((current) => ({ ...current, view: next }));
        setPlaneSize(size);
      } else {
        setPaneViews((current) => ({ ...current, [pane]: { view: next, size } }));
      }
    }, 160));
  }, [firstPane, onChange]);
  // A view still settling when the graph goes is dropped with it.
  useEffect(() => {
    const timers = settle.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);
  const settledView = graph.view;
  const computedWindow = useMemo(() => computationWindow(settledView, planeSize), [settledView, planeSize]);
  const visible = useMemo(() => visibleWindow(settledView, planeSize), [settledView, planeSize]);
  /** The pane a line is drawn in: the one it names, else the first. */
  const paneOf = (expression: GraphExpression) => {
    const named = expression.written?.pane;
    return named && arrangement.panes.some((pane) => pane.name === named) ? named : firstPane;
  };
  const windowsOf = (pane: string) => {
    const own = paneViews[pane];
    return own && pane !== firstPane
      ? { computed: computationWindow(own.view, own.size), visible: visibleWindow(own.view, own.size) }
      : { computed: computedWindow, visible };
  };
  const library = libraryOf(graph.expressions);
  const geometryLibrary = libraryOf(graph.expressions, true);
  const values = sliderValues(graph.expressions);
  const names = ["x", "y", ...graph.expressions.map((expression) => roleOfLine(expression)).flatMap((role) => ("name" in role ? [role.name] : []))];

  const playingSlider = clock ? graph.expressions.find((expression) => {
    const role = roleOfLine(expression);
    return role.kind === "slider" && role.name === clock.parameter;
  }) : undefined;
  const playingRole = playingSlider ? roleOfLine(playingSlider) : null;
  const range = playingRole?.kind === "slider" ? sliderRange(playingRole.value, playingSlider?.range) : null;
  // A slider over listed values plays them, one frame each; any other plays its range in even steps.
  const grid = useMemo(() => (range?.values?.length ? range.values : range ? frameGrid(range.minimum, range.maximum, GRAPH_FRAMES_PER_LOOP) : []),
    [range?.minimum, range?.maximum, range?.values?.join()]);
  const sourcesKey = JSON.stringify(frameSources);
  const transport = useParallaxTransport();
  const player = useMemo(() => {
    const entries = Object.entries(frameSources);
    if (!clock || entries.length === 0 || grid.length === 0) {
      return null;
    }
    const start = playingRole?.kind === "slider" ? nearestFrame(grid, playingRole.value) : 0;
    return new AnimationPlayer(new Map(entries.map(([id, source]) => [id, bufferFor(transport, source)])), grid.length, { secondsPerLoop: 8 / clock.speed, loop: true, whole: true }, start);
  }, [transport, sourcesKey, grid, clock?.parameter]);
  const progress = usePlayerProgress(player);
  // What the graph claims, checked by the engine at every frame of the clock (or at the sliders, without one).
  const checkResults = useGraphChecks(arrangement.checks ?? [], library, values, clock && grid.length ? { parameter: clock.parameter, grid } : null,
    computationOwner ?? undefined);
  const lastValue = useRef<number | null>(null);
  useEffect(() => {
    if (!player) {
      return;
    }
    const stopIndex = player.onIndex((index) => {
      lastValue.current = grid[index] ?? null;
    });
    return () => {
      stopIndex();
      player.destroy();
    };
  }, [player]);
  useEffect(() => {
    if (clock?.playing) {
      player?.play();
    } else {
      player?.pause();
    }
  }, [player, clock?.playing]);
  useEffect(() => {
    player?.update({ secondsPerLoop: 8 / (clock?.speed ?? 1) });
  }, [player, clock?.speed]);
  const playback = useMemo(() => (player && clock?.playing ? datasetPlayback(player) : undefined), [player, clock?.playing]);
  // Every screen frame, the clock between two frames of its grid: what moves smoothly follows this, not the frame index.
  const subscribeFrame = useCallback((listener: (value: number) => void) => {
    if (!player) {
      return () => {};
    }
    const stop = player.subscribe((frame) => {
      const here = grid[frame.index] ?? 0;
      const next = grid[frame.index + 1];
      listener(next === undefined ? here : here + frame.phase * (next - here));
    });
    return () => {
      stop();
    };
  }, [player, grid]);
  const subscribeValue = useCallback((listener: (value: number) => void) => player?.onIndex((index) => listener(grid[index] ?? 0)) ?? (() => {}), [player, grid]);
  const onFrameSource = useCallback((id: string, source: FrameSource | null) => {
    setFrameSources((current) => {
      if (!source) {
        return withoutEntry(current, id);
      }
      return JSON.stringify(current[id]) === JSON.stringify(source) ? current : { ...current, [id]: source };
    });
  }, []);
  /** Stops the clock and writes where it stopped into the slider's line, so what is seen is what is kept. */
  const pauseClock = () => {
    if (playingSlider && playingRole?.kind === "slider" && lastValue.current !== null) {
      update(playingSlider.id, { source: `${playingRole.name} = ${Math.round(lastValue.current * 1000) / 1000}` });
    }
    onChange((current) => ({ ...current, clock: current.clock ? { ...current.clock, playing: false } : current.clock }));
  };

  const update = (id: string, changes: Partial<GraphExpression>) =>
    onChange((current) => ({ ...current, expressions: current.expressions.map((expression) => (expression.id === id ? { ...expression, ...changes } : expression)) }));
  const addAfter = (id: string | null, source = "") => {
    const added = newExpression(source, nextColorIndex(graph.expressions));
    onChange((current) => {
      const index = id ? current.expressions.findIndex((expression) => expression.id === id) : current.expressions.length - 1;
      const expressions = [...current.expressions];
      expressions.splice(index + 1, 0, added);
      return { ...current, expressions };
    });
    setSelectedId(added.id);
    setFocusId(added.id);
  };
  const remove = (id: string) => {
    onChange((current) => ({ ...current, expressions: current.expressions.filter((expression) => expression.id !== id) }));
    setLayers((current) => withoutEntry(current, id));
  };
  const onLabel = useCallback((id: string, label: LabelSource | null) => {
    setLabels((current) => {
      if (!label) {
        return withoutEntry(current, id);
      }
      return { ...current, [id]: label };
    });
  }, []);
  const onLayer = useCallback((id: string, layer: StageLayer | null) => {
    setLayers((current) => {
      if (!layer) {
        return withoutEntry(current, id);
      }
      return { ...current, [id]: layer };
    });
  }, []);

  const paneContents: PaneContent[] = useMemo(() => arrangement.panes.map((pane) => {
    const inPane = graph.expressions.filter((expression) => paneOf(expression) === pane.name);
    return {
      pane,
      layers: inPane.map((expression) => layers[expression.id]).filter((layer): layer is StageLayer => Boolean(layer)),
      until: Object.fromEntries(inPane.filter((expression) => expression.written?.until).map((expression) => [expression.id, expression.written!.until!.trim()])),
      labels: Object.values(labels).filter((label) => label.pane === pane.name),
    };
  }), [arrangement, graph.expressions, layers, labels]);

  return (
    <BenchGrid
      storageKey="graph"
      sideLabel="Expressions"
      sideWidth={360}
      side={
        <>
          <ol data-parallax-part="graph-lines" className="parallax-graph-lines" aria-label="Expressions">
            {graph.expressions.map((expression, index) => (
              <ExpressionLine
                key={expression.id}
                expression={expression}
                position={index + 1}
                library={library}
                geometryLibrary={geometryLibrary}
                values={values}
                names={names}
                planeWindow={windowsOf(paneOf(expression)).computed}
                visible={windowsOf(paneOf(expression)).visible}
                selected={expression.id === selectedId}
                autoFocus={expression.id === focusId}
                onSelect={() => setSelectedId(expression.id)}
                onChange={(changes) => update(expression.id, changes)}
                onSubmit={() => addAfter(expression.id)}
                onRemove={() => remove(expression.id)}
                onAddSlider={(name) => addAfter(expression.id, `${name} = 1`)}
                onKeep={canKeepLines && onKeepLine ? (source) => onKeepLine(withLibrary(library, source)) : undefined}
                onLayer={onLayer}
                pane={paneOf(expression)}
                paneKind={arrangement.panes.find((pane) => pane.name === paneOf(expression))?.kind ?? "PLANE"}
                paneAxes={numericAxesOf(arrangement.panes.find((pane) => pane.name === paneOf(expression)))}
                signalPane={expression.written?.from ? arrangement.panes.find((pane) => pane.name === expression.written?.from && pane.kind === "CIRCUIT") ?? null : null}
                clockRange={range ? { minimum: range.minimum, maximum: range.maximum } : null}
                onLabel={onLabel}
                animated={clock?.playing && grid.length ? { parameter: clock.parameter, grid } : null}
                onFrameSource={onFrameSource}
                sliderPlaying={clock?.playing === true && playingSlider?.id === expression.id}
                onSliderPlay={(name) => {
                  if (clock?.playing && clock.parameter === name) {
                    pauseClock();
                  } else {
                    lastValue.current = null;
                    setClock({ parameter: name, playing: true, speed: clock?.speed ?? 1 });
                  }
                }}
              />
            ))}
          </ol>
          {checkResults.length ? (
            <section className="parallax-side-group parallax-graph-checks" aria-label="What the graph claims">
              <h2 className="parallax-side-label">Claims, checked over the clock</h2>
              <ul>
                {checkResults.map((result) => (
                  <li key={result.check.title} className={result.passed === null ? "parallax-pending" : result.passed ? "parallax-holds" : "parallax-fails"}>
                    <span className="parallax-graph-check-state" aria-hidden="true">{result.passed === null ? "…" : result.passed ? "✓" : "✗"}</span>
                    <span>
                      <strong>{result.check.title}</strong>
                      <span className="parallax-muted"> · {result.passed === null ? "checking" : result.passed ? "holds" : "does not hold"}</span>
                      <code className="parallax-inline">{result.check.measure}</code> <span className="parallax-muted">{result.check.criterion}</span>
                      {result.worst ? <span className="parallax-muted"> · furthest: {Number(result.worst.value.toPrecision(5))}{result.worst.at !== null ? ` at ${clock?.parameter} = ${Number(result.worst.at.toPrecision(4))}` : ""}</span> : null}
                      {result.problem ? <span className="parallax-error-text"> · {result.problem}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <div className="parallax-side-group">
            <Tool onClick={() => addAfter(null)}><ParallaxIcon name="plus" />Add an expression</Tool>
            <p>
              <code className="parallax-inline">y = …</code> draws a curve, an equation in x and y draws where it holds, an
              inequality shades a region, <code className="parallax-inline">a = 2</code> makes a slider and{" "}
              <code className="parallax-inline">f(x) = …</code> a function every line can call.{" "}
              <ParallaxLink to={{ kind: "reference" }}>Language reference</ParallaxLink>
            </p>
          </div>
        </>
      }
      stage={
        <div data-parallax-part="stage-body" className="parallax-stage-body parallax-graph-stage">
          <GraphPanes panes={paneContents} layout={arrangement.layout} playback={playback} values={values} initialView={graph.view} onView={onView}
            clock={clock && range && playingRole?.kind === "slider" ? { name: clock.parameter, value: playingRole.value, minimum: range.minimum, maximum: range.maximum,
              subscribe: clock.playing ? subscribeValue : null, subscribeFrame: clock.playing ? subscribeFrame : null, secondsPerLoop: 8 / (clock.speed ?? 1) } : null} />
          {clock?.playing ? <ComputationProgress job={null} computing={false} frames={progress} /> : null}
          {clock && range && playingRole?.kind === "slider" ? (
            <Timeline name={clock.parameter} value={playingRole.value} live={clock.playing ? subscribeValue : null}
              minimum={range.minimum} maximum={range.maximum} playing={clock.playing}
              onPlaying={(next) => (next ? setClock({ ...clock, playing: true }) : pauseClock())}
              onValue={(value) => {
                if (clock.playing && player) {
                  player.seek(nearestFrame(grid, value));
                } else if (playingSlider) {
                  update(playingSlider.id, { source: `${clock.parameter} = ${Math.round(value * 1000) / 1000}` });
                }
              }}
              buffered={clock.playing ? progress : null}
              speed={clock.speed} onSpeed={(speed) => setClock({ ...clock, speed })} />
          ) : null}
        </div>
      }
    />
  );
}

/**
 * One line of the graph: its colour (which also shows or hides it), the formula, what the backend reads it as,
 * and — chosen — its typeset form and what can be done with it. A slider line is a slider.
 */
function ExpressionLine({ expression, position, library, geometryLibrary, values, names, planeWindow, visible, selected, autoFocus, onSelect, onChange, onSubmit, onRemove, onAddSlider, onKeep, onLayer, pane, paneKind, paneAxes, signalPane, clockRange, onLabel, animated, onFrameSource, sliderPlaying, onSliderPlay }: {
  expression: GraphExpression;
  position: number;
  library: string;
  /** The library a geometry line is read against: the definitions and the graph's named points and shapes. */
  geometryLibrary: string;
  values: Record<string, number>;
  names: string[];
  planeWindow: PlaneWindow;
  visible: PlaneWindow;
  selected: boolean;
  autoFocus: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<GraphExpression>) => void;
  onSubmit: () => void;
  onRemove: () => void;
  onAddSlider: (name: string) => void;
  /** Keeps the line as an object of its own; absent when it may not be kept. */
  onKeep?: (source: string) => void;
  onLayer: (id: string, layer: StageLayer | null) => void;
  /** The pane the line is drawn in, which its label goes to. */
  pane: string;
  /** What the line's pane draws: in a values pane a line is a bar, not a curve. */
  paneKind: string;
  /** The x and y a space pane fixes, which its surfaces are computed over. */
  paneAxes: { x?: [number, number]; y?: [number, number] };
  /** The circuit pane a signal line (`p from sheet`) reads; null for any other line. */
  signalPane: GraphPaneDocument | null;
  /** The clock's range, which a circuit's time is laid onto. */
  clockRange: { minimum: number; maximum: number } | null;
  onLabel: (id: string, label: LabelSource | null) => void;
  /** The slider the clock plays and its frames' values, while it plays. */
  animated: { parameter: string; grid: readonly number[] } | null;
  onFrameSource: (id: string, source: FrameSource | null) => void;
  sliderPlaying: boolean;
  onSliderPlay: (name: string) => void;
}) {
  const { computationOwner } = useParallaxSettings();
  const transport = useParallaxTransport();
  const role = roleOfLine(expression);
  // A text in quotes is a label: its `{…}` parts are read one by one, the line itself is not a formula.
  const label = isLabelSource(expression.source);
  // In a values pane an expression is a bar: one value, read the way a label's parts are.
  const bar = !label && role.kind === "expression" && paneKind === "VALUES";
  // `p from sheet`: a circuit's own signal, drawn from its transient rather than read as a formula.
  const signal = Boolean(expression.written?.from);
  const signalState = useSignalLayer({ enabled: signal, id: expression.id, source: expression.source, pane: signalPane, clock: clockRange,
    values, color: colorOf(expression.colorIndex), visible: expression.visible, onLayer });
  const read = !label && !bar && !signal && (role.kind === "expression" || role.kind === "definition")
    ? withLibrary(isGeometrySource(expression.source) ? geometryLibrary : library, expression.source) : "";
  const settled = useDebouncedValue(read, 250);
  const reading = useAsync((signal) => transport.formula.interpret(settled, signal), [settled], role.kind === "expression" && settled.length > 0);
  const interpretation = role.kind === "expression" && settled ? reading.data : null;
  const typeset = useAsync((signal) => transport.formula.render([expression.source], signal), [expression.source], role.kind === "definition");
  const drawing = paneKind === "SPACE" ? spaceDrawingOf(interpretation ?? null, paneAxes) : planeDrawingOf(interpretation ?? null);
  const parameterNames = new Set(interpretation?.parameters.map((parameter) => parameter.name) ?? []);
  const lineValues = Object.fromEntries(Object.entries(values).filter(([name]) => parameterNames.has(name)));
  const missing = [...parameterNames].filter((name) => !(name in values));

  const target = interpretation?.definition && drawing
    ? { definition: drawing.definition(interpretation.definition, planeWindow, visible), parameters: interpretation.parameters }
    : interpretation?.definition && interpretation.kind === "VALUE"
      ? { definition: interpretation.definition, parameters: interpretation.parameters }
      : null;
  const representation = drawing?.representation ?? (interpretation?.kind === "VALUE" ? "VALUE" : null);
  const computation = useComputation(target, representation, lineValues, target !== null, drawing?.settings ?? {});
  const coverages = useRef(new Map<string, PlaneWindow>());
  if (target && representation && drawing) {
    const key = `${JSON.stringify(target)}/${representation}/${JSON.stringify(lineValues)}/${JSON.stringify(drawing.settings)}`;
    if (!coverages.current.has(key)) {
      coverages.current.set(key, drawing.coverage(planeWindow, visible));
    }
  }

  useEffect(() => {
    const ready = computation.ready;
    const coverage = computation.readyFor ? coverages.current.get(computation.readyFor) : undefined;
    if (signal) {
      return;
    }
    if (!expression.visible || !drawing || !ready || !coverage || ready.dataset.format === "MEASUREMENTS") {
      onLayer(expression.id, null);
      return;
    }
    onLayer(expression.id, { id: expression.id, color: colorOf(expression.colorIndex), dataset: ready.dataset, extent: coverage, opacity: paneKind === "SPACE" ? undefined : 0.3, emphasized: selected });
  }, [computation.ready, computation.readyFor, expression.visible, expression.colorIndex, selected, drawing !== null, paneKind]);

  useEffect(() => () => onLayer(expression.id, null), []);

  // While the clock plays a slider this line reads, the line's frames are computed ahead over the slider's range.
  const plays = animated !== null && parameterNames.has(animated.parameter) && target !== null && representation !== null && drawing !== null && expression.visible;
  const frameSource: FrameSource | null = plays && target && representation
    ? {
      computation: computationRequest(target, representation, Object.fromEntries(Object.entries(lineValues).filter(([name]) => name !== animated!.parameter)), drawing?.settings ?? {}, computationOwner ?? undefined),
      parameter: animated!.parameter,
      grid: animated!.grid,
    }
    : null;
  const frameKey = frameSource ? JSON.stringify(frameSource) : null;
  useEffect(() => {
    onFrameSource(expression.id, frameSource);
  }, [frameKey]);
  useEffect(() => () => onFrameSource(expression.id, null), []);

  const parsedLabel = label ? parseLabel(expression.source) : bar ? { parts: [0], expressions: [expression.source] } : null;
  const point = label && expression.written?.at ? pointOf(expression.written.at) : null;
  const labelExpressions = parsedLabel ? [...parsedLabel.expressions, ...(point ?? [])] : [];
  const labelValues = useLabelValues(labelExpressions, library, values, animated, computationOwner ?? undefined);
  const labelSource: LabelSource | null = parsedLabel && expression.visible ? {
    id: expression.id,
    pane,
    colorIndex: expression.colorIndex,
    parts: parsedLabel.parts,
    at: point ? [parsedLabel.expressions.length, parsedLabel.expressions.length + 1] : null,
    values: labelValues,
    grid: animated?.grid ?? null,
    bar: bar ? { name: expression.written?.name ?? `line ${position}` } : undefined,
  } : null;
  useReportLabel(labelSource, onLabel, expression.id);

  const value = computation.ready?.dataset.format === "MEASUREMENTS" ? computation.ready.dataset.values.value : undefined;
  const refusal = role.kind === "expression" && !label ? (interpretation?.refusal ?? (reading.error ? reading.error.detail : null)) : null;
  const computingError = computation.error?.detail ?? null;
  const editorId = `graph-line-${expression.id}`;

  return (
    <li data-parallax-part="graph-line" className="parallax-graph-line" aria-current={selected ? "true" : undefined} onFocusCapture={onSelect} onClick={onSelect}>
      <button type="button" className="parallax-graph-line-color" style={{ "--parallax-line-color": colorOf(expression.colorIndex) } as CSSProperties}
        aria-pressed={expression.visible} aria-label={`${expression.visible ? "Hide" : "Show"} line ${position}`}
        onClick={(event) => {
          event.stopPropagation();
          onChange({ visible: !expression.visible });
        }}>
        <span>{position}</span>
      </button>
      <div className="parallax-graph-line-body">
        <FormulaEditor id={editorId} labelledBy={`${editorId}-label`} value={expression.source} names={names}
          invalid={Boolean(refusal)} errorPosition={interpretation?.position != null && interpretation.position >= 0 ? interpretation.position - (read.length - expression.source.trim().length) : null}
          placeholder="y = …, x² + y² = 4, a = 1, f(x) = …"
          onChange={(source) => onChange({ source })} onSubmit={onSubmit} autoFocus={autoFocus} />
        <span id={`${editorId}-label`} className="parallax-screen-reader-only">Expression {position}</span>
        {role.kind === "slider" ? (
          <SliderLine name={role.name} value={role.value} range={expression.range} playing={sliderPlaying} onPlay={() => onSliderPlay(role.name)}
            onValue={(next) => onChange({ source: `${role.name} = ${next}` })} />
        ) : null}
        <div className="parallax-graph-line-status">
          {role.kind === "definition" ? <span className="parallax-muted">defines <code className="parallax-inline">{role.name}</code></span> : null}
          {signal ? <span className="parallax-muted">signal of {expression.written?.from}{signalState.computing ? " · computing" : ""}</span> : null}
          {signal && signalState.problem ? <span className="parallax-error-text" role="alert">{signalState.problem}</span> : null}
          {labelSource?.bar ? <span className="parallax-muted">bar · <strong className="parallax-graph-line-value">= {labelText(labelSource, (index) => labelSource.values[index]?.now ?? null)}</strong></span> : null}
          {labelSource && !labelSource.bar ? <span className="parallax-muted">label · <span className="parallax-graph-line-label">{labelText(labelSource, (index) => labelSource.values[index]?.now ?? null)}</span></span> : null}
          {role.kind === "expression" && interpretation?.kind ? <span className="parallax-muted">{humanize(interpretation.kind).toLowerCase()}</span> : null}
          {value !== undefined ? <strong className="parallax-graph-line-value">= {formatValue(value)}</strong> : null}
          {role.kind === "expression" && interpretation?.definition && !drawing && interpretation.kind !== "VALUE"
            ? <span className="parallax-muted">· not a plane object</span> : null}
          {computation.computing && drawing ? <span className="parallax-muted" aria-live="polite">· computing</span> : null}
          {refusal ? <span className="parallax-error-text" role="alert">{refusal}</span> : null}
          {!refusal && computingError ? <span className="parallax-error-text" role="alert">{computingError}</span> : null}
        </div>
        {missing.length > 0 ? (
          <div className="parallax-graph-line-sliders">
            <span className="parallax-muted">add a slider:</span>
            {missing.map((name) => (
              <button key={name} type="button" className="parallax-chip" onClick={(event) => {
                event.stopPropagation();
                onAddSlider(name);
              }}>{name}</button>
            ))}
          </div>
        ) : null}
        {selected && role.kind !== "empty" ? (
          <div className="parallax-graph-line-detail">
            {interpretation?.latex ? <Formula latex={interpretation.latex} /> : null}
            {role.kind === "definition" && typeset.data?.[0]?.notation ? <Formula notation={typeset.data[0].notation} /> : null}
            {role.kind === "expression" && interpretation?.definition ? (
              <div className="parallax-row-wrap">
                <ParallaxLink data-parallax-part="button" className="parallax-button parallax-small" to={{ kind: "formula", source: read }}>
                  <ParallaxIcon name="eye" />{drawing ? "Analyse" : "Open in space"}
                </ParallaxLink>
                {onKeep ? (
                  <Tool onClick={(event) => {
                    event.stopPropagation();
                    onKeep(expression.source);
                  }}><ParallaxIcon name="save" />Keep in my library</Tool>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-quiet parallax-icon-only parallax-graph-line-remove" aria-label={`Delete line ${position}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}>
        <ParallaxIcon name="close" />
      </button>
    </li>
  );
}

/** A slider line: the number moves the slider and the slider rewrites the number; the range widens to hold it. */
function SliderLine({ name, value, range, playing, onPlay, onValue }: { name: string; value: number; range?: SliderRange; playing: boolean; onPlay: () => void; onValue: (value: number) => void }) {
  const { minimum, maximum, values } = sliderRange(value, range);
  if (values?.length) {
    // Listed values: the slider moves from one to the next, nowhere between.
    const position = values.indexOf(nearestListed(values, value));
    return (
      <div className="parallax-graph-slider">
        <SliderPlayButton name={name} playing={playing} onPlay={onPlay} />
        <span className="parallax-technical">{values[0]}</span>
        <input type="range" aria-label={`Slider ${name}`} aria-valuetext={String(values[position])} min={0} max={values.length - 1} step={1} value={position}
          disabled={playing} onChange={(event) => onValue(values[Number(event.target.value)])} />
        <span className="parallax-technical">{values[values.length - 1]}</span>
      </div>
    );
  }
  return (
    <div className="parallax-graph-slider">
      <SliderPlayButton name={name} playing={playing} onPlay={onPlay} />
      <span className="parallax-technical">{minimum}</span>
      <input type="range" aria-label={`Slider ${name}`} min={minimum} max={maximum} step={0.01} value={value} disabled={playing}
        onChange={(event) => onValue(Number(event.target.value))} />
      <span className="parallax-technical">{maximum}</span>
    </div>
  );
}

/** Plays or stops the clock on a slider. */
function SliderPlayButton({ name, playing, onPlay }: { name: string; playing: boolean; onPlay: () => void }) {
  return (
    <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-quiet parallax-icon-only" aria-label={playing ? `Stop ${name}` : `Animate ${name}`} aria-pressed={playing}
      onClick={(event) => {
        event.stopPropagation();
        onPlay();
      }}>
      <ParallaxIcon name={playing ? "pause" : "play"} />
    </button>
  );
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "undefined";
  }
  const magnitude = Math.abs(value);
  return (magnitude !== 0 && (magnitude >= 1e9 || magnitude < 1e-6) ? value.toExponential(6) : String(Math.round(value * 1e10) / 1e10)).replace(/-/g, "−");
}

/** A record without `id`; the same record when it has none, so a state that did not change is not set again. */
function withoutEntry<T>(current: Record<string, T>, id: string): Record<string, T> {
  if (!(id in current)) {
    return current;
  }
  const { [id]: _removed, ...rest } = current;
  return rest;
}

/** The axes a pane fixes, as numbers; an axis written with a name (`0 .. L`) is left to the data. */
function numericAxesOf(pane: GraphPaneDocument | undefined): { x?: [number, number]; y?: [number, number] } {
  const axis = (written: [string, string] | undefined): [number, number] | undefined => {
    const minimum = written ? evaluateConstant(written[0]) : null;
    const maximum = written ? evaluateConstant(written[1]) : null;
    return minimum !== null && maximum !== null && maximum > minimum ? [minimum, maximum] : undefined;
  };
  return { x: axis(pane?.axes.x), y: axis(pane?.axes.y) };
}

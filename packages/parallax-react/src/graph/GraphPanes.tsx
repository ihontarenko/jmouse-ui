import { useEffect, useMemo, useRef, useState } from "react";
import { revealUntil, type Dataset, type PlaneView, type PlayerFrame, type Size, type StageLabel, type StageLayer } from "@jmouse/parallax/visual";
import { VisualView, type VisualViewHandle } from "../viewers/VisualView";
import { CircuitPane, type PaneClock } from "./CircuitPane";
import { SpacePane } from "./SpacePane";
import { ValuesPane } from "./ValuesPane";
import {
  evaluateConstant, type GraphPaneDocument, type LabelSource, labelText, labelValueAt,
} from "@jmouse/parallax/graph";

/** One pane's lines: what it draws, and which of them are traces cut at the clock (`until`). */
export interface PaneContent {
  pane: GraphPaneDocument;
  layers: readonly StageLayer[];
  /** Layer id → the name its `until` reads; only a clock's name is followed today. */
  until: Record<string, string>;
  /** Texts drawn over the pane, their values looked up at the clock. */
  labels: readonly LabelSource[];
}

/**
 * The panes of a graph in their layout, every one moved by the same clock. A plane pane is a stage of its own, panned
 * and zoomed alone, first showing the axes its line fixes; the panes the page does not draw yet say so in place.
 */
export function GraphPanes({ panes, layout, playback, clock, values, initialView, onView }: {
  panes: readonly PaneContent[];
  /** Every slider's value, for a trace cut at a slider that is not playing. */
  values: Record<string, number>;
  layout: string;
  playback?: { subscribe: (listener: (frame: PlayerFrame<Dataset>) => void) => () => void };
  /** The clock: its name, its value now told on every change, and its range — traces are cut at it, circuits play on it. */
  clock: PaneClock | null;
  initialView: PlaneView;
  onView: (pane: string, view: PlaneView, size: Size) => void;
}) {
  return (
    <div data-parallax-part="graph-panes" className={`parallax-graph-panes parallax-graph-panes-${layout.toLowerCase()}`} data-count={panes.length}>
      {panes.map((content) => (
        <section key={content.pane.name} data-parallax-part="graph-pane" className="parallax-graph-pane" aria-label={`Pane ${content.pane.name}`}>
          {panes.length > 1 ? <header className="parallax-graph-pane-name parallax-technical">{content.pane.name}</header> : null}
          {content.pane.kind === "PLANE"
            ? <PlanePane content={content} playback={playback} clock={clock} values={values} initialView={initialView} onView={onView} />
            : content.pane.kind === "CIRCUIT"
              ? <CircuitPane pane={content.pane} clock={clock} values={values} />
              : content.pane.kind === "VALUES"
                ? <ValuesPane bars={content.labels} clock={clock} />
                : <SpacePane content={content} playback={playback} />}
        </section>
      ))}
    </div>
  );
}


function PlanePane({ content, playback, clock, values, initialView, onView }: {
  content: PaneContent;
  values: Record<string, number>;
  playback?: { subscribe: (listener: (frame: PlayerFrame<Dataset>) => void) => () => void };
  clock: PaneClock | null;
  initialView: PlaneView;
  onView: (pane: string, view: PlaneView, size: Size) => void;
}) {
  const handle = useRef<VisualViewHandle>(null);
  const fitted = useRef(false);
  const fitFrame = useRef<number | null>(null);
  const [clockValue, setClockValue] = useState<number | null>(clock?.value ?? null);
  useEffect(() => setClockValue(clock?.value ?? null), [clock?.value]);
  useEffect(() => (clock?.subscribe ? clock.subscribe(setClockValue) : undefined), [clock?.subscribe]);
  // The fit waits a frame for the stage; stop the wait if the pane unmounts before the stage reports its view.
  useEffect(() => () => {
    if (fitFrame.current !== null) {
      cancelAnimationFrame(fitFrame.current);
    }
  }, []);

  const traced = Object.keys(content.until).length > 0;
  const valuesKey = JSON.stringify(values);
  const layers = useMemo(() => content.layers.map((layer) => {
    const name = content.until[layer.id];
    const until = name === undefined ? undefined : clock?.name === name && clockValue !== null ? clockValue : values[name];
    return until === undefined || !layer.dataset ? layer : { ...layer, dataset: revealUntil(layer.dataset, until) };
  }), [content.layers, content.until, traced ? clockValue : null, clock?.name, traced ? valuesKey : null]);

  /**
   * A pane that fixes its axes shows them first; after that the view is the reader’s. The stage tells its size while
   * it is still being made, before it can be moved, so the fit waits a frame for it — and then says where it looks,
   * since a view set from outside is not announced.
   */
  const fitToAxes = (size: Size) => {
    const window = axesWindow(content.pane);
    if (!window) {
      fitted.current = true;
      return;
    }
    if (size.width <= 0 || size.height <= 0) {
      return;
    }
    if (!handle.current?.view()) {
      fitFrame.current = requestAnimationFrame(() => fitToAxes(size));
      return;
    }
    fitFrame.current = null;
    const view = {
      centerX: (window.xMinimum + window.xMaximum) / 2,
      centerY: (window.yMinimum + window.yMaximum) / 2,
      unitX: size.width / (window.xMaximum - window.xMinimum),
      unitY: size.height / (window.yMaximum - window.yMinimum),
    };
    fitted.current = true;
    handle.current.setView({ plane: view });
    onView(content.pane.name, view, size);
  };
  // The labels of the moment, in data coordinates: the stage draws them, and only its overlay moves when they change.
  const labels = useMemo<StageLabel[]>(() => content.labels.map((label) => {
    const x = label.at ? labelValueAt(label, label.at[0], clockValue) : null;
    const y = label.at ? labelValueAt(label, label.at[1], clockValue) : null;
    return {
      id: label.id,
      text: labelText(label, (index) => labelValueAt(label, index, clockValue)),
      at: x !== null && y !== null ? [x, y] : null,
      color: `var(--parallax-series-${(label.colorIndex % 6) + 1})`,
    };
  }), [content.labels, clockValue]);

  const axes = content.pane.axes;
  return (
    <VisualView ref={handle} layers={layers} labels={labels} tools units={axes.x && axes.y ? "free" : "equal"} initialView={{ plane: initialView }} playback={playback}
      title={`Pane ${content.pane.name}: a plane with ${layers.length} drawn lines`}
      onView={(stageView, size) => {
        if (!fitted.current) {
          fitToAxes(size);
          return;
        }
        onView(content.pane.name, stageView.plane, size);
      }} />
  );
}

/** The rectangle a pane's `x a .. b  y c .. d` fixes, or null when it does not fix both. */
function axesWindow(pane: GraphPaneDocument) {
  const x = pane.axes.x?.map(evaluateConstant);
  const y = pane.axes.y?.map(evaluateConstant);
  if (!x || !y || x.some((value) => value === null) || y.some((value) => value === null)) {
    return null;
  }
  const [xMinimum, xMaximum] = x as number[];
  const [yMinimum, yMaximum] = y as number[];
  return xMaximum > xMinimum && yMaximum > yMinimum ? { xMinimum, xMaximum, yMinimum, yMaximum } : null;
}

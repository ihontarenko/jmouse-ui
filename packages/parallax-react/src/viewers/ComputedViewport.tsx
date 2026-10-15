import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { hasDrawable } from "./DatasetFacts";
import { describeDataset, partition, seriesByUnit, unitAxisName, type Dataset, type PlayerFrame, type StageLabel, type StageView, type TimeSeriesDataset } from "@jmouse/parallax/visual";
import { VisualView, type VisualViewHandle } from "./VisualView";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { ComputationProgress } from "./ComputationProgress";
import { Formula } from "./Formula";
import type { Computation, ComputationTarget } from "@jmouse/parallax/computation";
import { useComputation } from "./useComputation";
import { useDeeperZoom, type Refinement } from "./useDeeperZoom";

/**
 * `thumbnail` fills the host it is put in (a card's `.preview`, a row's `.thumb`); `scene` is the template's
 * `.viewport` (16:10 on a page); `fill` is a `.viewport` that fills a workbench stage; `linked` is one of several
 * views side by side.
 */
type Variant = "thumbnail" | "scene" | "fill" | "linked";

const variantClasses: Record<Variant, string> = {
  thumbnail: "parallax-computed-frame",
  scene: "parallax-viewport",
  fill: "parallax-viewport parallax-viewport-fill",
  linked: "parallax-viewport parallax-viewport-linked",
};

interface FrameProperties {
  /** Texts at points of a series — a frequency response's peak and edges —, asked of each pane's own series. */
  annotate?: (series: TimeSeriesDataset) => StageLabel[];
  computation: Computation;
  title: string;
  variant: Variant;
  latex?: string | null;
  overlay?: ReactNode;
  projection?: "perspective" | "orthographic";
  material?: "wireframe" | "surface";
  showGrid?: boolean;
  showAxes?: boolean;
  view?: "primary" | "series";
  axisLabel?: string;
  viewRef?: Ref<VisualViewHandle>;
  onViewChange?: (view: StageView) => void;
  /** The picture is fitted again when this changes; by default when the title or the kind of data does. */
  fitKey?: string;
  /** A playing animation: frames pushed straight to the view, each tagged with the layer id `result`. */
  playback?: { subscribe: (listener: (frame: PlayerFrame<Dataset>) => void) => () => void };
  /** An animation's frames as they arrive; the one status shows them and the timeline is locked until all are in. */
  frames?: { loaded: number; total: number } | null;
  /** What the picture was computed from: given, a plane picture zoomed past its detail is computed again closer. */
  refinement?: Refinement;
  /** More buttons in the frame's tool strip, before Fit and Save image. */
  tools?: ReactNode;
}

function assignReference<T>(reference: Ref<T> | undefined, value: T | null) {
  if (typeof reference === "function") {
    reference(value);
  } else if (reference) {
    (reference as { current: T | null }).current = value;
  }
}

/**
 * The template's `.viewport` around a computed dataset, with every state a computation passes through: the drawing,
 * the job's progress, a refusal, and a status line (`.viewport-status`) saying what is drawn and what it cost.
 */
export function ComputedFrame({ computation, title, variant, latex, overlay, projection, material, showGrid, showAxes, view, axisLabel = "x · y · z", viewRef, onViewChange, fitKey, playback, tools, refinement, frames, annotate }: FrameProperties) {
  const dataset = computation.ready?.dataset ?? null;
  const [flipBinaryX, setFlipBinaryX] = useState(false);
  const [flipBinaryY, setFlipBinaryY] = useState(false);
  const handle = useRef<VisualViewHandle | null>(null);
  const deeper = useDeeperZoom(refinement, dataset);
  // One axis holds one unit: a series of several is drawn as panes one above another, a card shows its first unit.
  const unitParts = useMemo(() => (dataset?.format === "TIME_SERIES" ? seriesByUnit(dataset) : null), [dataset]);
  const split = unitParts !== null && unitParts.length > 1;
  const layers = useMemo(() => {
    if (!dataset) {
      return [];
    }
    const shown = split && unitParts ? unitParts[0].series : dataset;
    return [{ id: "result", dataset: shown }, ...(deeper.layer ? [deeper.layer] : [])];
  }, [dataset, deeper.layer, split, unitParts]);
  const binary = dataset ? partition(dataset).drawable.some(([, part]) => part.format === "BINARY_GRID") : false;
  const drawable = dataset !== null && hasDrawable(dataset);
  const thumbnail = variant === "thumbnail";
  const attach = useCallback((value: VisualViewHandle | null) => {
    handle.current = value;
    assignReference(viewRef, value);
  }, [viewRef]);

  const saveImage = () => {
    const image = handle.current?.snapshot();
    if (!image) {
      return;
    }
    const link = document.createElement("a");
    link.href = image;
    link.download = `${title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "parallax"}.png`;
    link.click();
  };

  return (
    <figure className={variantClasses[variant]} aria-busy={computation.computing} aria-label={thumbnail ? undefined : title}>
      {drawable && split && !thumbnail && unitParts ? (
        <UnitPanes parts={unitParts} title={title} attach={attach} annotate={annotate} fitKey={fitKey ?? `${title}/${dataset.format}/${dataset.canvas}`} onViewChange={onViewChange} />
      ) : drawable ? (
        <VisualView ref={attach} layers={layers} labels={annotate && !thumbnail && dataset?.format === "TIME_SERIES" ? annotate(dataset) : undefined}
          title={`${title}: ${describeDataset(dataset)}`} projection={projection} material={material} grid={showGrid} axes={showAxes}
          flipX={flipBinaryX} flipY={flipBinaryY} interactive={!thumbnail} compact={thumbnail} view={view}
          fitKey={fitKey ?? `${title}/${dataset.format}/${dataset.canvas}`} playback={playback} onView={(stageView, size) => {
            deeper.onView(stageView, size);
            onViewChange?.(stageView);
          }} />
      ) : (
        <div className="parallax-viewport-message">
          {computation.error && !thumbnail ? (
            <div className="parallax-notice parallax-danger" role="alert">
              <ParallaxIcon name="error" />
              <div>
                <strong>Could not compute</strong>
                <p>{computation.error.detail}</p>
              </div>
            </div>
          ) : dataset && !thumbnail ? (
            <p className="parallax-muted parallax-small">The result is numeric — it is listed beside the view.</p>
          ) : (
            <Formula latex={latex ?? null} display />
          )}
        </div>
      )}
      {thumbnail ? null : <ComputationProgress job={computation.job ?? deeper.refined.job} computing={computation.computing || deeper.refined.computing} frames={frames} />}
      {overlay}
      {thumbnail ? null : (
        <>
          <div className="parallax-viewport-tools">
            {binary ? (
              <div data-parallax-part="segmented" className="parallax-segmented parallax-small" role="group" aria-label="Bitmap orientation">
                <button type="button" aria-pressed={flipBinaryX} onClick={() => setFlipBinaryX((value) => !value)}>Mirror X</button>
                <button type="button" aria-pressed={flipBinaryY} onClick={() => setFlipBinaryY((value) => !value)}>Flip Y</button>
              </div>
            ) : null}
            {tools}
            {drawable ? (
              <>
                <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-icon-only" aria-label="Zoom in" title="Zoom in" onClick={() => handle.current?.zoom(1.25)}>
                  <ParallaxIcon name="zoom-in" />
                </button>
                <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-icon-only" aria-label="Zoom out" title="Zoom out" onClick={() => handle.current?.zoom(0.8)}>
                  <ParallaxIcon name="zoom-out" />
                </button>
                <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-icon-only" aria-label="Show the whole picture" title="Show the whole picture" onClick={() => handle.current?.fit()}>
                  <ParallaxIcon name="fit" />
                </button>
                <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-icon-only" aria-label="Save as an image" title="Save as an image" onClick={saveImage}>
                  <ParallaxIcon name="camera" />
                </button>
              </>
            ) : null}
          </div>
          <figcaption className="parallax-viewport-status">
            {dataset ? <span>{dataset.shape} · {dataset.canvas}</span> : null}
            {dataset ? <span>{describeDataset(dataset)}</span> : null}
            {computation.ready ? <span>{computation.ready.cached ? "cached" : `computed in ${computation.ready.computeMillis} ms`}</span> : null}
            <span>{axisLabel}</span>
          </figcaption>
        </>
      )}
    </figure>
  );
}


/**
 * A series of several units as panes one above another, one unit to an axis, read against one horizontal axis: moving
 * or zooming one moves the others along it — a Bode plot's gain and phase stay over the same frequencies. The frame's
 * tools act on every pane through one handle.
 */
function UnitPanes({ parts, title, attach, fitKey, onViewChange, annotate }: {
  parts: { unit: string; series: TimeSeriesDataset }[];
  title: string;
  attach: (handle: VisualViewHandle | null) => void;
  fitKey: string;
  onViewChange?: (view: StageView) => void;
  annotate?: (series: TimeSeriesDataset) => StageLabel[];
}) {
  const panes = useRef<(VisualViewHandle | null)[]>([]);
  useEffect(() => {
    const every = () => panes.current.filter((pane): pane is VisualViewHandle => pane !== null);
    attach({
      fit: () => every().forEach((pane) => pane.fit()),
      zoom: (factor) => every().forEach((pane) => pane.zoom(factor)),
      snapshot: () => every()[0]?.snapshot() ?? "",
      view: () => every()[0]?.view() ?? null,
      setView: (view) => every().forEach((pane) => pane.setView(view)),
      turnTo: () => {},
    });
    // Fitted together once the grid has laid them out: each pane fitted on its own while the others were still
    // unsized, and the link copied an unfitted pane's scale into a fitted one — a gain pane read 10⁻¹⁹ … 10¹⁹ Hz.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => every().forEach((pane) => pane.fit()));
    });
    return () => {
      cancelAnimationFrame(frame);
      attach(null);
    };
  }, [attach, parts]);
  const follow = (moved: number, view: StageView, size: { width: number; height: number }) => {
    // A pane not laid out yet fits to nothing; its scale must not become the others'.
    if (!(size.width > 0 && size.height > 0)) {
      return;
    }
    panes.current.forEach((pane, index) => {
      const own = pane?.view();
      if (index !== moved && pane && own) {
        pane.setView({ plane: { ...own.plane, centerX: view.plane.centerX, unitX: view.plane.unitX } });
      }
    });
    onViewChange?.(view);
  };
  return (
    <div data-parallax-part="unit-panes" className="parallax-unit-panes" style={{ gridTemplateRows: `repeat(${parts.length}, minmax(0, 1fr))` }}>
      {parts.map((part, index) => {
        const name = unitAxisName(part.unit);
        return (
          <section key={part.unit} className="parallax-unit-pane" aria-label={name}>
            <VisualView ref={(handle) => { panes.current[index] = handle; }} layers={[{ id: `unit-${index}`, dataset: part.series }]}
              title={`${title}, ${name}: ${part.series.columns.join(", ")}`} view="series" fitKey={`${fitKey}/${part.unit}`}
              labels={annotate ? annotate(part.series) : undefined} onView={(view, size) => follow(index, view, size)} />
          </section>
        );
      })}
    </div>
  );
}

/**
 * A catalogue card's preview: the object's primary representation, computed only once the card scrolls near
 * the screen. Until then — and when the result has nothing to draw — the formula stands in.
 */
export function ComputedThumbnail({ target, representation, title, latex, overlay }: { target: ComputationTarget; representation: string; title: string; latex: string | null; overlay?: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element || visible) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);
  const computation = useComputation(target, representation, {}, visible);
  return (
    <div ref={host} className="parallax-computed-thumbnail">
      <ComputedFrame computation={computation} title={title} variant="thumbnail" latex={latex} overlay={overlay} material="surface" />
    </div>
  );
}

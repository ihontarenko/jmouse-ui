import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Stage, formatReadout, type Dataset, type FrameStatistics, type PlayerFrame, type Size, type StageBars, type StageContent, type StageLabel, type StageLayer, type StageView, type TracedPoint } from "@jmouse/parallax/visual";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { reportFrame } from "@jmouse/parallax/playback";

export interface VisualViewHandle {
  /** Back to the whole picture. */
  fit(): void;
  zoom(factor: number): void;
  snapshot(): string;
  view(): StageView | null;
  /** Moves the camera without announcing it — how a second view follows the first. */
  setView(view: Partial<StageView>): void;
  /** Turns the space camera in a short eased turn — at once under reduced motion. */
  turnTo(target: { azimuth: number; elevation: number }): void;
}

export interface VisualViewProperties extends Omit<StageContent, "layers"> {
  layers: readonly StageLayer[];
  /** What is drawn, for the canvas's accessible name. */
  title: string;
  interactive?: boolean;
  /** A thumbnail: no numbers, no legends, drawn by the CPU. */
  compact?: boolean;
  projection?: "perspective" | "orthographic";
  /** Zoom buttons over the canvas, for a view without a tool strip of its own. */
  tools?: boolean;
  /** The coordinates of the pointed or traced point, on the plane. */
  readout?: boolean;
  className?: string;
  initialView?: Partial<StageView>;
  /** Turns space slowly, radians a second; still when the reader asked for reduced motion. */
  spin?: number;
  /** A playing animation: per layer id the frame to show and the next one, and the phase between them, every frame. */
  playback?: { subscribe: (listener: (frame: PlayerFrame<Dataset>) => void) => () => void };
  onView?: (view: StageView, size: Size) => void;
  /** Texts at points of the plane, drawn over it; they change without the geometry being built again. */
  labels?: readonly StageLabel[];
  /** Values drawn as bars on a zero line. */
  bars?: StageBars | null;
  ref?: Ref<VisualViewHandle>;
}

/**
 * The product's one view of computed mathematics — an object page, a scene, a comparison, a thumbnail, the graph. A
 * React shell around the drawing library's stage: it forwards props, follows the theme, and shows the read-out.
 */
export function VisualView({ layers, title, interactive = true, compact = false, projection = "perspective", tools = false, readout: showReadout = interactive, className, initialView, spin, playback, onView, labels, bars, ref, ...content }: VisualViewProperties) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const viewListener = useRef(onView);
  viewListener.current = onView;
  const [readout, setReadout] = useState<{ traced: TracedPoint; unit: number } | null>(null);
  const [mode, setMode] = useState<"plane" | "space">("plane");
  const [driver, setDriver] = useState<"webgl" | "canvas" | null>(null);
  const [statistics, setStatistics] = useState<FrameStatistics | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const instance = new Stage(element, {
      // The GPU for every full view, still or moving; the CPU only for thumbnails, which outnumber GPU contexts.
      driver: compact ? "canvas" : "webgl",
      interactive,
      compact,
      view: initialView,
      spin: spin && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? spin : undefined,
      onView: (view, size) => viewListener.current?.(view, size),
      onTrace: (traced) => setReadout(traced ? { traced, unit: instance.view.plane.unitX } : null),
      onFrame: reportFrame,
      onStatistics: compact ? undefined : setStatistics,
    });
    stage.current = instance;
    setDriver(instance.driver);
    const observer = new MutationObserver(() => instance.refreshTheme());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-palette", "data-intensity", "data-contrast", "data-scale", "data-font", "style"] });
    return () => {
      observer.disconnect();
      instance.destroy();
      stage.current = null;
    };
  }, [interactive, compact]);

  useEffect(() => {
    const instance = stage.current;
    if (!instance) {
      return;
    }
    instance.setContent({ layers, ...content });
    setMode(instance.mode);
  }, [layers, content.view, content.material, content.grid, content.axes, content.flipX, content.flipY, content.units, content.fitKey, interactive, compact]);

  useEffect(() => {
    stage.current?.setLabels(labels ?? []);
  }, [labels, interactive, compact]);

  useEffect(() => {
    stage.current?.setBars(bars ?? null);
  }, [bars, interactive, compact]);

  useEffect(() => {
    const instance = stage.current;
    if (instance && instance.view.space.projection !== projection) {
      instance.setView({ space: { ...instance.view.space, projection } });
    }
  }, [projection, interactive, compact]);

  // A playing animation draws straight into the stage, every frame, without a React render.
  useEffect(() => {
    if (!playback) {
      stage.current?.setBlend(0);
      return;
    }
    return playback.subscribe((frame) => {
      const instance = stage.current;
      if (!instance) {
        return;
      }
      frame.frames.forEach((shown, layerId) => instance.showFrame(layerId, shown.frame, shown.next));
      instance.setBlend(frame.phase);
    });
  }, [playback]);

  useImperativeHandle(ref, () => ({
    fit: () => stage.current?.fit(),
    zoom: (factor) => stage.current?.zoomBy(factor),
    snapshot: () => stage.current?.snapshot() ?? "",
    view: () => stage.current?.view ?? null,
    setView: (view) => stage.current?.setView(view),
    turnTo: (target) => stage.current?.turnTo(target),
  }), []);

  const label = `${title}.${interactive ? mode === "plane" ? " Drag or arrow keys pan, wheel or plus and minus zoom, 0 shows the whole picture." : " Drag or arrow keys turn the camera, wheel or plus and minus zoom." : ""}`;

  return (
    <div data-parallax-part="visual-view" className={["parallax-visual-view", className].filter(Boolean).join(" ")}>
      <div ref={host} className="parallax-visual-host" role="img" aria-label={label} />
      {tools ? (
        <div className="parallax-visual-tools" role="toolbar" aria-label="View">
          <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-icon-only" aria-label="Zoom in" onClick={() => stage.current?.zoomBy(1.25)}><ParallaxIcon name="zoom-in" /></button>
          <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-icon-only" aria-label="Zoom out" onClick={() => stage.current?.zoomBy(0.8)}><ParallaxIcon name="zoom-out" /></button>
          <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-icon-only" aria-label="Show the whole picture" onClick={() => stage.current?.fit()}><ParallaxIcon name="fit" /></button>
        </div>
      ) : null}
      {!compact && driver ? <DriverLabel driver={driver} statistics={statistics} /> : null}
      {showReadout && mode === "plane" ? (
        <div className="parallax-visual-readout" aria-live="off">
          {readout ? <span>({formatReadout(readout.traced.x, readout.unit)}, {formatReadout(readout.traced.y, readout.unit)})</span>
            : <span className="parallax-muted">drag to pan · wheel to zoom · point at a curve to read it</span>}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Which driver draws the view and how fast it really is: frames drawn in the last second and the median time one
 * took — "still" when nothing moved, which is no frames by design, not a slow screen.
 */
export function DriverLabel({ driver, statistics }: { driver: "webgl" | "canvas"; statistics: FrameStatistics | null }) {
  const name = driver === "webgl" ? "WebGL" : "Canvas";
  const measured = statistics && statistics.framesPerSecond > 0;
  return (
    <span className="parallax-visual-driver" title={driver === "webgl" ? "Drawn on the GPU" : "Drawn on the CPU"}>
      {name} · {measured ? (
        <><span className="parallax-steady parallax-width-3">{statistics.framesPerSecond}</span> fps · <span className="parallax-steady parallax-width-4">{statistics.drawMilliseconds.toFixed(1)}</span> ms</>
      ) : "still"}
    </span>
  );
}

import { buildDrawing, drawableParts, readsInDecades, seriesEntries, type LayerStyle, type Mode } from "./build";
import { css, type Rgb } from "./color";
import { connectGestures } from "./controls";
import { unitAxisName, type Dataset, type DrawableDataset, type ScalarGridDataset, type TimeSeriesDataset } from "./datasets";
import { CanvasDriver } from "./drivers/canvas";
import type { Driver } from "./drivers/driver";
import { ThreeDriver } from "./drivers/three";
import { blendBatches, type Batch, type Drawing, type Marker } from "./geometry";
import { defaultPlaneView, drawDivisions, drawPlaneGrid, drawPlaneLabels, drawRampLegend, drawSeriesLegend, fittedView, pannedBy, toPixels, zoomedAt, type PlaneView, type PlaneWindow, type Size } from "./plane";
import { defaultSpaceCamera, drawSpaceFloor, SpaceFrame, type SpaceCamera } from "./space";
import { readTheme, resolveColor, type Surface, type VisualTheme } from "./theme";
import { drawBars, drawLabels, type StageBars, type StageLabel } from "./annotations";
import { boxProjectorOf, projectorOf, type Transform } from "./transform";

/*
 * The stage: one canvas host that draws any number of datasets as layers, on the plane or in space — the only code in
 * the product that draws mathematics. It owns the driver, the camera, the fit, the gestures and the traced point.
 */

/**
 * One thing drawn: a dataset, built into geometry by the library — or geometry already built, for an instrument that
 * turns its own acquisition into lines every frame. Either way the same driver draws it.
 */
export interface StageLayer {
  id: string;
  dataset?: Dataset;
  /** The frame after this one, while an animation plays: the stage draws between the two by `setBlend`. */
  next?: Dataset;
  batches?: readonly Batch[];
  /** A CSS colour or `var(--token)`; without one the accent, or the ramp where the data carries values. */
  color?: string;
  emphasized?: boolean;
  /** For a raster without its own coordinates (a region's bitmap): the window it covers. */
  extent?: PlaneWindow;
  /** How strongly a mask raster covers what is under it; 1 by default. */
  opacity?: number;
}

export interface StageContent {
  layers: readonly StageLayer[];
  /** `series` shows only the time series a composite carries beside its picture. */
  view?: "primary" | "series";
  material?: "surface" | "wireframe";
  grid?: boolean;
  axes?: boolean;
  flipX?: boolean;
  flipY?: boolean;
  /** Equal units keep geometry honest; `auto` stretches a window far from square. */
  units?: "equal" | "free" | "auto";
  /** A window the view always shows exactly, whatever the size — an instrument's screen. */
  pinned?: PlaneWindow;
  /** An instrument's graticule of divisions in place of the numbered grid. */
  divisions?: { horizontal: number; vertical: number };
  /** The instrument's own marks over the geometry — zero markers, trigger level, cursors — in screen pixels. */
  overlay?: (context: CanvasRenderingContext2D, size: Size, theme: VisualTheme) => void;
  /**
   * The view is fitted to the data when this changes — a new object, a new representation. Without one the view is
   * the reader's alone, as on the graph.
   */
  fitKey?: string;
}

/** The units of the axes a series is swept along, by the axis' name. */
const AXIS_UNITS: Record<string, string> = { f: "Hz", t: "s" };

export interface StageView {
  plane: PlaneView;
  space: SpaceCamera;
}

export interface TracedPoint {
  layerId: string;
  x: number;
  y: number;
}

export interface StageOptions {
  /** `webgl` for a live view; `canvas` for a thumbnail, of which a page may hold more than the GPU has contexts. */
  driver: "webgl" | "canvas";
  interactive: boolean;
  /** No numbers or legends: a thumbnail's picture speaks alone. */
  compact?: boolean;
  /** The page's sheet, or an instrument's screen. */
  surface?: Surface;
  view?: Partial<StageView>;
  /** Turns space around its vertical axis, radians a second — a specimen shown, not studied. */
  spin?: number;
  onView?: (view: StageView, size: Size) => void;
  onTrace?: (traced: TracedPoint | null) => void;
  onFrame?: (milliseconds: number) => void;
  /** Once a second: frames drawn in it, and the median time one took on the CPU. Zero frames means a still picture. */
  onStatistics?: (statistics: FrameStatistics) => void;
}

export interface FrameStatistics {
  framesPerSecond: number;
  drawMilliseconds: number;
}

/**
 * The most device pixels a canvas is drawn at. A 4K screen at its full density asks an integrated GPU for tens of
 * millions of pixels a frame; past this the canvas is drawn a little coarser and the browser scales it up.
 */
const MAXIMUM_DEVICE_PIXELS = 2_500_000;

interface DrawnLayer {
  layer: StageLayer;
  mode: Mode;
  parts: DrawableDataset[];
  drawing: Drawing;
  /** The next frame's drawing, when there is one of the same shape to blend toward. */
  next: Drawing | null;
}

const TRACE_RADIUS = 10;

export class Stage {
  readonly #host: HTMLElement;
  readonly #options: StageOptions;
  readonly #driver: Driver;
  readonly #disconnect: () => void;
  readonly #resizeObserver: ResizeObserver;
  #theme: VisualTheme;
  #themeGeneration = 0;
  #content: StageContent = { layers: [] };
  #drawn: DrawnLayer[] = [];
  #mode: Mode = "plane";
  #frame = new SpaceFrame([-1, -1, -1], [1, 1, 1]);
  #view: StageView;
  #fittedFor: string | null = null;
  #size: Size = { width: 0, height: 0 };
  #traced: TracedPoint | null = null;
  #renderRequest: number | null = null;
  #drawings = new WeakMap<Dataset, Map<string, { mode: Mode; parts: DrawableDataset[]; drawing: Drawing }>>();
  #destroyed = false;
  #spinRequest: number | null = null;
  #blend = 0;
  #frameTimes: number[] = [];
  /** What the 2-D layers were last drawn for; a frame that changes neither keeps them as they are. */
  #underDrawnFor = "";
  #overDrawnFor = "";
  #drawnVersion = 0;
  #labels: readonly StageLabel[] = [];
  #bars: StageBars | null = null;
  /** Moves on every change of the labels or the bars, so the overlay is drawn again for it and only for it. */
  #annotationsVersion = 0;
  #turnRequest: number | null = null;
  #statisticsTimer: number | null = null;

  constructor(host: HTMLElement, options: StageOptions) {
    this.#host = host;
    this.#options = options;
    this.#driver = Stage.#createDriver(host, options.driver);
    this.#theme = readTheme(host, options.surface);
    this.#view = { plane: options.view?.plane ?? defaultPlaneView, space: options.view?.space ?? defaultSpaceCamera };
    this.#disconnect = options.interactive ? connectGestures(host, this.#gestures()) : () => {};
    if (options.onStatistics) {
      this.#statisticsTimer = window.setInterval(() => {
        const times = [...this.#frameTimes].sort((first, second) => first - second);
        this.#frameTimes = [];
        options.onStatistics?.({ framesPerSecond: times.length, drawMilliseconds: times.length ? times[Math.floor(times.length / 2)] : 0 });
      }, 1000);
    }
    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(host);
    this.#resize();
    if (options.spin) {
      this.#spin(options.spin);
    }
  }

  #spin(radiansPerSecond: number) {
    let last = performance.now();
    const turn = (now: number) => {
      if (this.#destroyed) {
        return;
      }
      if (this.#mode === "space") {
        this.#view = { ...this.#view, space: { ...this.#view.space, azimuth: this.#view.space.azimuth + (radiansPerSecond * (now - last)) / 1000 } };
        this.#render();
      }
      last = now;
      this.#spinRequest = requestAnimationFrame(turn);
    };
    this.#spinRequest = requestAnimationFrame(turn);
  }

  static #createDriver(host: HTMLElement, preferred: "webgl" | "canvas"): Driver {
    if (preferred === "webgl") {
      try {
        return new ThreeDriver(host);
      } catch {
        // No WebGL 2 here: the same frame, drawn by the CPU.
      }
    }
    return new CanvasDriver(host);
  }

  /** The driver drawing this stage — WebGL, or Canvas when the GPU was not given. */
  get driver(): "webgl" | "canvas" {
    return this.#driver.kind;
  }

  get mode(): Mode {
    return this.#mode;
  }

  get view(): StageView {
    return { plane: { ...this.#view.plane }, space: { ...this.#view.space } };
  }

  get size(): Size {
    return { ...this.#size };
  }

  /** Moves the camera without announcing it — how a second view follows the first. */
  /** Texts at points of the plane, drawn over the geometry; replacing them redraws the overlay only. */
  setLabels(labels: readonly StageLabel[]) {
    this.#labels = labels;
    this.#annotationsVersion++;
    this.#schedule();
  }

  /** Values as bars on a zero line, drawn over an empty plane; replacing them redraws the overlay only. */
  setBars(bars: StageBars | null) {
    this.#bars = bars;
    this.#annotationsVersion++;
    this.#schedule();
  }

  /**
   * Turns the space camera to an azimuth and an elevation in a short eased turn, the shorter way round; at once when
   * the reader asked for reduced motion. A new turn replaces one under way.
   */
  turnTo(target: { azimuth: number; elevation: number }, milliseconds = 600) {
    if (this.#turnRequest !== null) {
      cancelAnimationFrame(this.#turnRequest);
      this.#turnRequest = null;
    }
    const from = this.#view.space;
    if (milliseconds <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.setView({ space: { ...from, ...target } });
      return;
    }
    const azimuthChange = Math.atan2(Math.sin(target.azimuth - from.azimuth), Math.cos(target.azimuth - from.azimuth));
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / milliseconds);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
      this.setView({ space: { ...from, azimuth: from.azimuth + azimuthChange * eased, elevation: from.elevation + (target.elevation - from.elevation) * eased } });
      this.#turnRequest = progress < 1 && !this.#destroyed ? requestAnimationFrame(step) : null;
    };
    this.#turnRequest = requestAnimationFrame(step);
  }

  setView(view: Partial<StageView>) {
    this.#view = { plane: view.plane ?? this.#view.plane, space: view.space ?? this.#view.space };
    this.#schedule();
  }

  setContent(content: StageContent) {
    this.#content = content;
    this.#rebuild();
    this.#pin();
    const fitKey = content.fitKey;
    // A canvas with no area yet cannot be fitted to: the fit waits for its first real size (#resize).
    if (fitKey !== undefined && this.#fittedFor !== fitKey && this.#hasBounds() && this.#size.width > 0 && this.#size.height > 0) {
      this.#fittedFor = fitKey;
      this.#fitPlane();
    }
    this.#schedule();
  }

  /** The theme is read again from the page — after the reader changed it. */
  refreshTheme() {
    this.#theme = readTheme(this.#host, this.#options.surface);
    this.#themeGeneration++;
    this.#rebuild();
    this.#schedule();
  }

  /** Zooms around the middle of the canvas, as the + and − buttons do. */
  zoomBy(factor: number) {
    if (this.#mode === "plane") {
      this.#changePlane(zoomedAt(this.#view.plane, this.#size, factor, factor, this.#size.width / 2, this.#size.height / 2));
    } else {
      this.#changeSpace({ zoom: this.#view.space.zoom * factor });
    }
  }

  /** Back to the whole picture: the plane fitted to the data, space to its first camera. */
  fit() {
    this.#fitPlane();
    this.#view = { ...this.#view, space: { ...defaultSpaceCamera, projection: this.#view.space.projection } };
    this.#announce();
    this.#schedule();
  }

  /**
   * Puts a layer's frame on screen, and the next one to blend toward, without a new content — what a playing
   * animation does every frame. Drawings are cached per dataset, so a frame seen before costs nothing to show again.
   */
  showFrame(layerId: string, dataset: Dataset | null, next: Dataset | null) {
    let changed = false;
    const layers = this.#content.layers.map((layer) => {
      if (layer.id !== layerId || !dataset || (layer.dataset === dataset && (layer.next ?? null) === next)) {
        return layer;
      }
      changed = true;
      return { ...layer, dataset, next: next ?? undefined };
    });
    if (changed) {
      this.#content = { ...this.#content, layers };
      this.#rebuild();
      this.#schedule();
    }
  }

  /** How far between each layer's frame and its next one to draw, 0 to 1 — set by the animation clock every frame. */
  setBlend(amount: number) {
    const bounded = Math.max(0, Math.min(1, amount));
    if (bounded !== this.#blend) {
      this.#blend = bounded;
      this.#schedule();
    }
  }

  /** Draws now rather than at the next animation frame — for an instrument already inside its own frame loop. */
  renderNow() {
    if (this.#renderRequest !== null) {
      cancelAnimationFrame(this.#renderRequest);
      this.#renderRequest = null;
    }
    this.#render();
  }

  snapshot(): string {
    this.#render();
    return this.#driver.snapshot();
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    if (this.#turnRequest !== null) {
      cancelAnimationFrame(this.#turnRequest);
    }
    if (this.#renderRequest !== null) {
      cancelAnimationFrame(this.#renderRequest);
    }
    if (this.#spinRequest !== null) {
      cancelAnimationFrame(this.#spinRequest);
    }
    if (this.#statisticsTimer !== null) {
      window.clearInterval(this.#statisticsTimer);
    }
    this.#resizeObserver.disconnect();
    this.#disconnect();
    this.#driver.destroy();
  }

  // ─── content ───────────────────────────────────────────────────────────────────────────────────────

  #style(layer: StageLayer): LayerStyle {
    return {
      theme: this.#theme,
      color: layer.color ? resolveColor(this.#host, layer.color, this.#theme.accent) : null,
      emphasized: layer.emphasized ?? false,
      opacity: layer.opacity ?? 1,
      extent: layer.extent ?? null,
      material: this.#content.material ?? "surface",
      flipX: this.#content.flipX ?? false,
      flipY: this.#content.flipY ?? false,
      view: this.#content.view ?? "primary",
    };
  }

  /** Builds what changed: a drawing is kept per dataset and style, so moving a slider rebuilds one layer, not all. */
  #rebuild() {
    const drawn: DrawnLayer[] = [];
    for (const layer of this.#content.layers) {
      if (!layer.dataset) {
        drawn.push({ layer, mode: "plane", parts: [], drawing: { batches: [...(layer.batches ?? [])], markers: [], bounds: null }, next: null });
        continue;
      }
      const style = this.#style(layer);
      const built = this.#built(layer.dataset, style);
      const next = layer.next ? this.#built(layer.next, style).drawing : null;
      drawn.push({ layer, ...built, next });
    }
    this.#drawnVersion++;
    this.#mode = drawn.some((entry) => entry.mode === "space") ? "space" : "plane";
    this.#drawn = drawn.filter((entry) => entry.mode === this.#mode);
    const bounds = this.#union();
    if (bounds && this.#mode === "space") {
      this.#frame = new SpaceFrame(bounds.minimum, bounds.maximum);
    }
  }

  /** A pinned window is the view, exactly, at any size. */
  #pin() {
    const pinned = this.#content.pinned;
    if (!pinned || this.#size.width === 0) {
      return;
    }
    this.#view = {
      ...this.#view,
      plane: {
        centerX: (pinned.xMinimum + pinned.xMaximum) / 2,
        centerY: (pinned.yMinimum + pinned.yMaximum) / 2,
        unitX: this.#size.width / (pinned.xMaximum - pinned.xMinimum),
        unitY: this.#size.height / (pinned.yMaximum - pinned.yMinimum),
      },
    };
  }

  /** A dataset's drawing in a style, built once and kept while the dataset lives. */
  #built(dataset: Dataset, style: LayerStyle): { mode: Mode; parts: DrawableDataset[]; drawing: Drawing } {
    const key = [this.#themeGeneration, style.color?.join(","), style.emphasized, style.opacity, JSON.stringify(style.extent), style.material, style.flipX, style.flipY, style.view].join("|");
    const byStyle = this.#drawings.get(dataset) ?? new Map();
    this.#drawings.set(dataset, byStyle);
    let built = byStyle.get(key);
    if (!built) {
      const { mode, parts } = drawableParts(dataset, style.view);
      built = { mode, parts, drawing: buildDrawing(parts, mode, style) };
      byStyle.set(key, built);
    }
    return built;
  }

  #union(): Drawing["bounds"] {
    let union: Drawing["bounds"] = null;
    for (const entry of this.#drawn) {
      const bounds = entry.drawing.bounds;
      if (!bounds) {
        continue;
      }
      union = union
        ? { minimum: [0, 1, 2].map((axis) => Math.min(union!.minimum[axis], bounds.minimum[axis])) as [number, number, number],
            maximum: [0, 1, 2].map((axis) => Math.max(union!.maximum[axis], bounds.maximum[axis])) as [number, number, number] }
        : { minimum: [...bounds.minimum], maximum: [...bounds.maximum] };
    }
    return union;
  }

  #hasBounds(): boolean {
    return this.#union() !== null && this.#size.width > 0;
  }

  #fitPlane() {
    const bounds = this.#union();
    if (!bounds || this.#size.width === 0) {
      return;
    }
    const padX = (bounds.maximum[0] - bounds.minimum[0]) * 0.06 || 1;
    const padY = (bounds.maximum[1] - bounds.minimum[1]) * 0.06 || 1;
    const window = { xMinimum: bounds.minimum[0] - padX, xMaximum: bounds.maximum[0] + padX, yMinimum: bounds.minimum[1] - padY, yMaximum: bounds.maximum[1] + padY };
    const series = this.#drawn.some((entry) => entry.parts.some((part) => part.format === "TIME_SERIES"));
    const units = this.#content.units ?? (series ? "free" : "auto");
    this.#view = { ...this.#view, plane: fittedView(window, this.#size, units, this.#options.compact ? 6 : 28) };
  }

  // ─── frames ────────────────────────────────────────────────────────────────────────────────────────

  #resize() {
    const bounds = this.#host.getBoundingClientRect();
    const size = { width: Math.round(bounds.width), height: Math.round(bounds.height) };
    if (size.width === this.#size.width && size.height === this.#size.height) {
      return;
    }
    // Without area before — not laid out yet, or a pane of a grid whose rows were not sized — it was never really fitted:
    // a pane of a Bode plot fitted at zero height showed 10⁻¹⁹ … 10¹⁹ Hz until «show the whole picture».
    const first = this.#size.width === 0 || this.#size.height === 0;
    this.#size = size;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const budget = Math.sqrt(MAXIMUM_DEVICE_PIXELS / Math.max(1, size.width * size.height));
    this.#driver.resize(size, Math.max(1, Math.min(density, budget)));
    this.#underDrawnFor = "";
    this.#overDrawnFor = "";
    // A live view keeps the reader's camera through a resize; a thumbnail is always the whole picture.
    this.#pin();
    if ((first || !this.#options.interactive) && this.#content.fitKey !== undefined && this.#hasBounds()) {
      this.#fitPlane();
      this.#fittedFor = this.#content.fitKey;
    }
    this.#announce();
    this.#render();
  }

  #schedule() {
    if (this.#destroyed || this.#renderRequest !== null) {
      return;
    }
    this.#renderRequest = requestAnimationFrame(() => {
      this.#renderRequest = null;
      this.#render();
    });
  }

  #transform(): Transform {
    return this.#mode === "plane"
      ? { kind: "plane", size: this.#size, view: this.#view.plane }
      : { kind: "space", size: this.#size, camera: this.#view.space, frame: this.#frame };
  }

  #render() {
    if (this.#destroyed || this.#size.width === 0 || this.#size.height === 0) {
      return;
    }
    const started = performance.now();
    const theme = this.#theme;
    const transform = this.#transform();
    const decoration = { grid: this.#content.grid ?? true, axes: this.#content.axes ?? true, labels: !this.#options.compact, axisNames: this.#axisNames(),
      horizontalDecades: this.#horizontalDecades() };
    // The grid beneath and the labels above change with the view, not with the frame of an animation.
    const underFor = JSON.stringify([this.#mode, this.#view, this.#size, this.#themeGeneration, decoration, this.#content.divisions, this.#drawn.length > 0, this.#frame.center, this.#frame.scaleHorizontal]);
    const hasMarkers = this.#drawn.some((entry) => entry.drawing.markers.length > 0);
    const overFor = JSON.stringify([underFor, this.#traced, hasMarkers ? this.#drawnVersion : 0, this.#mode === "plane" ? this.#drawnVersion : 0, this.#annotationsVersion]);
    const overChanges = overFor !== this.#overDrawnFor || this.#content.overlay !== undefined;
    const { under, over } = this.#driver.begin(theme.background, { under: underFor !== this.#underDrawnFor, over: overChanges });
    this.#underDrawnFor = underFor;
    this.#overDrawnFor = overFor;
    if (under && transform.kind === "plane" && this.#content.divisions) {
      drawDivisions(under, this.#size, theme, this.#content.divisions.horizontal, this.#content.divisions.vertical);
    } else if (under && transform.kind === "plane") {
      drawPlaneGrid(under, this.#size, transform.view, theme, decoration);
    } else if (under && transform.kind === "space" && this.#drawn.length > 0) {
      drawSpaceFloor(under, boxProjectorOf(transform), theme, decoration);
    }
    const batches: Batch[] = this.#drawn.flatMap((entry) => (entry.next && this.#blend > 0 ? blendBatches(entry.drawing.batches, entry.next.batches, this.#blend) : entry.drawing.batches));
    this.#driver.draw(batches, transform, theme.background);
    this.#driver.retain(batches);
    if (over) {
      this.#drawMarkers(over, transform);
      if (transform.kind === "plane" && !this.#content.divisions) {
        drawPlaneLabels(over, this.#size, transform.view, theme, decoration);
        this.#drawLegends(over);
        this.#drawTraced(over, transform);
      }
      if (transform.kind === "plane") {
        const resolve = (color: string | undefined) => (color ? resolveColor(this.#host, color, theme.ink) : theme.ink);
        if (this.#labels.length > 0) {
          drawLabels(over, this.#size, theme, transform.view, this.#labels, resolve);
        }
        if (this.#bars) {
          drawBars(over, this.#size, theme, this.#bars, resolve);
        }
      }
      this.#content.overlay?.(over, this.#size, theme);
    }
    const took = performance.now() - started;
    if (this.#drawn.length > 0) {
      this.#options.onFrame?.(took);
    }
    this.#frameTimes.push(took);
  }

  /** A series read in decades: the unit of its axis, by the axis' name — a frequency response sweeps `f`, in Hz. */
  #horizontalDecades(): { unit: string } | undefined {
    const series = this.#drawn.flatMap((entry) => entry.parts).find((part) => part.format === "TIME_SERIES") as TimeSeriesDataset | undefined;
    return series && readsInDecades(series) ? { unit: AXIS_UNITS[series.axis] ?? "" } : undefined;
  }

  /** What a series' vertical axis measures, by its one unit — a pane of a Bode plot says «gain, dB»; nothing when mixed. */
  #seriesQuantity(): string {
    const series = this.#drawn.flatMap((entry) => entry.parts).find((part) => part.format === "TIME_SERIES") as TimeSeriesDataset | undefined;
    const units = new Set(series?.units ?? []);
    return units.size === 1 ? unitAxisName([...units][0]) : "";
  }

  #axisNames(): [string, string] | undefined {
    const parts = this.#drawn.flatMap((entry) => entry.parts);
    const series = parts.find((part) => part.format === "TIME_SERIES") as TimeSeriesDataset | undefined;
    if (series) {
      // The vertical axis is named in the legend's row (#seriesQuantity), not inside the plot.
      return [series.axis, ""];
    }
    if (parts.some((part) => part.format === "COMPLEX_GRID" || part.format === "ITERATION_GRID")) {
      return ["Re", "Im"];
    }
    return undefined;
  }

  #drawLegends(context: CanvasRenderingContext2D) {
    if (this.#options.compact) {
      return;
    }
    const parts = this.#drawn.flatMap((entry) => entry.parts);
    const scalar = parts.find((part) => part.format === "SCALAR_GRID") as ScalarGridDataset | undefined;
    if (scalar) {
      drawRampLegend(context, this.#size, this.#theme, scalar.minimum, scalar.maximum, scalar.quantity);
    }
    const entries = seriesEntries(parts, this.#theme);
    if (entries.length > 0) {
      drawSeriesLegend(context, this.#theme, entries, this.#seriesQuantity());
    }
  }

  #drawMarkers(context: CanvasRenderingContext2D, transform: Transform) {
    const project = projectorOf(transform);
    const markers: Marker[] = this.#drawn.flatMap((entry) => entry.drawing.markers);
    context.font = this.#theme.labelFont;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    for (const marker of markers) {
      const [x, y] = project(marker.position[0], marker.position[1], marker.position[2]);
      context.beginPath();
      if (marker.shape === "triangle") {
        context.moveTo(x, y - 6);
        context.lineTo(x + 5.5, y + 4);
        context.lineTo(x - 5.5, y + 4);
      } else if (marker.shape === "diamond") {
        context.moveTo(x, y - 6);
        context.lineTo(x + 6, y);
        context.lineTo(x, y + 6);
        context.lineTo(x - 6, y);
      } else if (marker.shape === "circle") {
        context.arc(x, y, 5, 0, Math.PI * 2);
      } else {
        context.rect(x - 4.5, y - 4.5, 9, 9);
      }
      context.closePath();
      context.fillStyle = `rgba(${marker.color.slice(0, 3).map((channel) => Math.round(channel * 255)).join(",")},${marker.color[3]})`;
      context.strokeStyle = css(this.#theme.background);
      context.lineWidth = 1.5;
      context.fill();
      context.stroke();
      if (marker.label) {
        context.fillStyle = this.#theme.label;
        context.fillText(marker.label, x + 9, y + 3);
      }
    }
  }

  #drawTraced(context: CanvasRenderingContext2D, transform: Extract<Transform, { kind: "plane" }>) {
    if (!this.#traced) {
      return;
    }
    const entry = this.#drawn.find((candidate) => candidate.layer.id === this.#traced!.layerId);
    const color: Rgb = entry?.layer.color ? resolveColor(this.#host, entry.layer.color, this.#theme.accent) : this.#theme.accent;
    const [x, y] = toPixels(transform.view, transform.size, this.#traced.x, this.#traced.y);
    context.fillStyle = css(this.#theme.background);
    context.strokeStyle = css(color);
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(x, y, 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  /** The point of any drawn line or point nearest a pixel of the plane, within a few pixels. */
  #traceAt(pixelX: number, pixelY: number): TracedPoint | null {
    if (this.#mode !== "plane") {
      return null;
    }
    const view = this.#view.plane;
    let best: TracedPoint | null = null;
    let bestDistance = TRACE_RADIUS * TRACE_RADIUS;
    for (const entry of this.#drawn) {
      for (const batch of entry.drawing.batches) {
        if (batch.kind !== "segments" && batch.kind !== "points") {
          continue;
        }
        for (let index = 0; index + 1 < batch.positions.length; index += 3) {
          const x = batch.positions[index];
          const y = batch.positions[index + 1];
          const [candidateX, candidateY] = toPixels(view, this.#size, x, y);
          const distance = (candidateX - pixelX) ** 2 + (candidateY - pixelY) ** 2;
          if (distance < bestDistance) {
            bestDistance = distance;
            best = { layerId: entry.layer.id, x, y };
          }
        }
      }
    }
    return best;
  }

  // ─── gestures ──────────────────────────────────────────────────────────────────────────────────────

  #announce() {
    this.#options.onView?.(this.view, this.size);
  }

  #changePlane(plane: PlaneView) {
    this.#view = { ...this.#view, plane };
    this.#traced = null;
    this.#announce();
    this.#schedule();
  }

  #changeSpace(changes: Partial<SpaceCamera>) {
    const space = { ...this.#view.space, ...changes };
    space.elevation = Math.max(-0.4, Math.min(1.4, space.elevation));
    space.zoom = Math.max(0.3, Math.min(5, space.zoom));
    this.#view = { ...this.#view, space };
    this.#announce();
    this.#schedule();
  }

  #gestures() {
    const plane = () => this.#mode === "plane";
    const center = () => [this.#size.width / 2, this.#size.height / 2] as const;
    const zoom = (factor: number, x: number, y: number) => {
      if (plane()) {
        this.#changePlane(zoomedAt(this.#view.plane, this.#size, factor, factor, x, y));
      } else {
        this.#changeSpace({ zoom: this.#view.space.zoom * factor });
      }
    };
    return {
      drag: (deltaX: number, deltaY: number) => {
        if (plane()) {
          this.#changePlane(pannedBy(this.#view.plane, deltaX, deltaY));
        } else {
          this.#changeSpace({ azimuth: this.#view.space.azimuth + deltaX * 0.008, elevation: this.#view.space.elevation + deltaY * 0.006 });
        }
      },
      zoom,
      key: (key: string) => {
        const step = 48;
        const [centerX, centerY] = center();
        const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
        if (moves[key]) {
          if (plane()) {
            this.#changePlane(pannedBy(this.#view.plane, moves[key][0], moves[key][1]));
          } else {
            this.#changeSpace({ azimuth: this.#view.space.azimuth - moves[key][0] / 480, elevation: this.#view.space.elevation - moves[key][1] / 600 });
          }
          return true;
        }
        if (key === "+" || key === "=") {
          zoom(1.25, centerX, centerY);
          return true;
        }
        if (key === "-" || key === "_") {
          zoom(0.8, centerX, centerY);
          return true;
        }
        if (key === "0") {
          this.fit();
          return true;
        }
        return false;
      },
      hover: (x: number, y: number) => {
        const traced = this.#traceAt(x, y);
        if (traced?.x !== this.#traced?.x || traced?.y !== this.#traced?.y) {
          this.#traced = traced;
          this.#options.onTrace?.(traced ?? (plane() ? { layerId: "", ...this.#pointAt(x, y) } : null));
          this.#schedule();
        } else if (!traced && plane()) {
          this.#options.onTrace?.({ layerId: "", ...this.#pointAt(x, y) });
        }
      },
      leave: () => {
        this.#traced = null;
        this.#options.onTrace?.(null);
        this.#schedule();
      },
      doubleClick: (x: number, y: number, shift: boolean) => zoom(shift ? 0.5 : 2, x, y),
    };
  }

  #pointAt(x: number, y: number): { x: number; y: number } {
    const view = this.#view.plane;
    return { x: view.centerX + (x - this.#size.width / 2) / view.unitX, y: view.centerY - (y - this.#size.height / 2) / view.unitY };
  }
}

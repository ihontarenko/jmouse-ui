import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  HORIZONTAL_DIVISIONS, VERTICAL_DIVISIONS, holdsWholeRecord, ScreenWindow,
  type ChannelId, type PlaybackClock, type SampleMemory, type ScopeChannel, type ScopeSettings, type Window,
} from "@jmouse/parallax/oscilloscope";
import { ladderStep } from "@jmouse/parallax/quantities";
import { Stage } from "@jmouse/parallax/visual";
import { cursorAt, paintScreenMarks, Persistence, probeColors, SCREEN, ScreenAnalysis, screenTraces } from "@jmouse/parallax/scope";
import { useEmulatorAppearance } from "../circuit/useEmulatorAppearance";

/**
 * The oscilloscope's screen: the acquisition memory drawn through the drawing library's stage on the instrument
 * screen, at every animation frame the memory or the playback clock moved, never through React.
 *
 * The wheel scales the axis the reader chose (time, or the active channel's volts), Shift+wheel the other one;
 * dragging sideways looks back in time, up and down moves the active trace; a double click fits every trace.
 */
export function ScopeScreen({ memory, settings, back, onSettings, onBack, onChannel, onFit, onTriggered, label, waiting, idle, clock }: {
  memory: SampleMemory;
  /** Samples stream in: the screen plays them from this clock, smoothly, instead of jumping with each frame. */
  clock?: PlaybackClock;
  settings: ScopeSettings;
  /** Seconds the view is shifted into the past; 0 follows the newest sample. */
  back: number;
  onSettings: (changes: Partial<ScopeSettings>) => void;
  onBack: (back: number) => void;
  onChannel: (id: ChannelId, changes: Partial<ScopeChannel>) => void;
  onFit: () => void;
  /** Told when the trigger fires, with the window it fired in — single shot stops on it. */
  onTriggered?: (window: Window) => void;
  label: string;
  /** Shown instead of the screen's content while nothing has been measured. */
  waiting?: string | null;
  /**
   * Shown while the memory holds nothing — decided by the screen on every frame, never by the one rendering it: the
   * memory fills without a render, and a message chosen from its length at render time stayed over a running trace.
   */
  idle?: string;
}) {
  const appearance = useEmulatorAppearance();
  const stageHost = useRef<HTMLDivElement>(null);
  const [driver, setDriver] = useState<"webgl" | "canvas" | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const state = useRef({ settings, back, waiting, idle, onTriggered, clock, trails: { count: 8, intensity: 0.5 }, drawn: -1, drawnMemory: null as SampleMemory | null, drawnTime: Number.NaN, drawnStart: Number.NaN, heldKey: "" });
  state.current.settings = settings;
  state.current.trails = { count: appearance.scopeTrails ?? 8, intensity: appearance.scopeTrailIntensity ?? 0.5 };
  state.current.back = back;
  state.current.waiting = waiting;
  state.current.idle = idle;
  state.current.onTriggered = onTriggered;
  state.current.clock = clock;
  state.current.drawn = -1;

  useEffect(() => {
    const host = stageHost.current;
    if (!host) {
      return;
    }
    // The renderer and its frame rate are not shown on the instrument: on the screen they covered the trigger's mark,
    // and a reader of an oscilloscope reads the signal, not the renderer. The driver is kept on the element for a look.
    const stage = new Stage(host, { driver: "webgl", interactive: false, surface: "screen" });
    setDriver(stage.driver);
    let colors = probeColors(host);
    let themeChanged = false;
    const observer = new MutationObserver(() => {
      themeChanged = true;
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-screen", "data-palette", "style"] });
    // The phosphor's afterglow: past traces fading under the live one while the screen is a phosphor screen.
    const persistence = new Persistence();
    // The FFT and phasor displays read a few times a second and averaged, not at every frame: they shook otherwise.
    const analysis = new ScreenAnalysis();
    const screenWindow = new ScreenWindow();
    let animation = 0;
    const draw = () => {
      animation = requestAnimationFrame(draw);
      const current = state.current;
      // Where the screen looks is decided in one place, apart from drawing: `ScreenWindow`.
      const now = performance.now();
      const { view, shownTime, newlyTriggered } = screenWindow.frame(memory, current.settings, { back: current.back, clock: current.clock, now });
      if (newlyTriggered) {
        current.onTriggered?.(view);
      }
      // The memory is compared too: a fresh one can carry the same version number as the one it replaced.
      const unchanged = !themeChanged && current.drawn === memory.version && current.drawnMemory === memory && current.drawnTime === shownTime
        && current.drawnStart === view.start && stage.size.width > 0;
      const glowing = current.settings.phosphor && persistence.glowing(now);
      if (unchanged && !glowing && !analysis.pending) {
        return;
      }
      if (themeChanged) {
        themeChanged = false;
        stage.refreshTheme();
        colors = probeColors(host);
      }
      current.drawnTime = shownTime;
      current.drawnStart = view.start;
      current.drawn = memory.version;
      current.drawnMemory = memory;
      const empty = Boolean(current.waiting) || memory.length === 0;
      const columns = Math.max(1, stage.size.width);
      const settingsNow = current.settings;
      const waitingText = empty ? current.waiting ?? current.idle ?? "No samples yet" : null;
      const readout = empty ? undefined : analysis.read(memory, settingsNow, view, now);
      const traces = empty ? [] : screenTraces(memory, settingsNow, view, columns, colors, readout);
      // What the kept traces were drawn against: another scale, zero, time base or display would leave them on the wrong axes.
      const heldKey = JSON.stringify([settingsNow.display, settingsNow.horizontal, settingsNow.secondsPerDivision, settingsNow.channels.map((channel) => [channel.enabled, channel.voltsPerDivision, channel.position]), settingsNow.math]);
      // Trails belong to traces against time or against each other; a spectrum or a phasor diagram is a reading, not a sweep.
      const trails = settingsNow.trails && (settingsNow.display ?? "time") !== "fft" && settingsNow.display !== "phasors" ? current.trails : null;
      if ((settingsNow.hold || trails) && current.heldKey !== heldKey) {
        current.heldKey = heldKey;
        persistence.forget();
      }
      if (settingsNow.hold && !empty && !unchanged && traces.length) {
        persistence.hold(traces[traces.length - 1], now);
      }
      if ((!settingsNow.phosphor && !settingsNow.hold && !trails) || empty) {
        persistence.forget();
      } else if (!unchanged && traces.length) {
        if (settingsNow.phosphor) {
          persistence.remember(traces[traces.length - 1], now);
        }
        if (trails) {
          persistence.trail(traces[traces.length - 1], trails.count);
        }
      }
      const layers = [
        ...(settingsNow.hold && !empty ? [{ id: "held", batches: persistence.heldLayer() }] : []),
        ...(trails && !empty ? [{ id: "trails", batches: persistence.trailLayer(trails.count, trails.intensity) }] : []),
        ...(settingsNow.phosphor && !settingsNow.hold && !empty ? [{ id: "afterglow", batches: persistence.layer(now) }] : []),
        { id: "traces", batches: traces },
      ];
      stage.setContent({
        layers,
        ...screenGrid(settingsNow.display === "xy" || settingsNow.display === "phasors", stage.size),
        overlay: (context, size, theme) => paintScreenMarks(context, size, theme, settingsNow, view, colors, waitingText, memory.length ? memory.firstTime() : Number.NaN, shownTime,
          (channel, time) => memory.length ? memory.reading(channel, Math.min(memory.length - 1, memory.indexAt(time))) : Number.NaN, readout),
      });
      stage.renderNow();
    };
    animation = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animation);
      observer.disconnect();
      stage.destroy();
    };
  }, [memory]);

  // The wheel has to be a non-passive listener to keep the page from scrolling under it.
  useEffect(() => {
    const host = frame.current;
    if (!host) {
      return;
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = state.current.settings;
      const direction = event.deltaY > 0 ? 1 : -1;
      const axis = event.shiftKey ? (current.wheel === "time" ? "volts" : "time") : current.wheel;
      // XY has no time to scale: the wheel zooms the figure, both its channels together, as a graph zooms.
      if (current.display === "xy") {
        current.channels.filter((candidate) => candidate.enabled).slice(0, 2).forEach((channel) =>
          onChannel(channel.id, { voltsPerDivision: Math.min(1000, Math.max(1e-9, ladderStep(channel.voltsPerDivision, direction))) }));
        return;
      }
      if (axis === "time") {
        onSettings({ secondsPerDivision: Math.min(1, Math.max(1e-9, ladderStep(current.secondsPerDivision, direction))) });
      } else {
        const channel = current.channels.find((candidate) => candidate.id === current.active);
        if (channel) {
          onChannel(channel.id, { voltsPerDivision: Math.min(1000, Math.max(1e-4, ladderStep(channel.voltsPerDivision, direction))) });
        }
      }
    };
    host.addEventListener("wheel", wheel, { passive: false });
    return () => host.removeEventListener("wheel", wheel);
  }, [onSettings, onChannel]);

  const drag = useRef<{ x: number; y: number; back: number; position: number; replayed: number | null; figure: [number, number] | null } | null>(null);
  /** Dragging the trigger's level marker on the right edge: the level follows the pointer in the source's volts. */
  const levelDrag = useRef(false);
  /** The cursor being dragged by its line. */
  const cursorDrag = useRef<"first" | "second" | null>(null);
  // Where a pointer is along the cursors' axis, as a share of the screen, and how long that axis is in pixels.
  const cursorFraction = (point: { offsetX: number; offsetY: number }, box: HTMLElement) => settings.cursors.axis === "volts"
    ? point.offsetY / Math.max(1, box.clientHeight) : point.offsetX / Math.max(1, box.clientWidth);
  const cursorLength = (box: HTMLElement) => Math.max(1, settings.cursors.axis === "volts" ? box.clientHeight : box.clientWidth);
  const triggerSource = settings.trigger.mode === "free" ? undefined : settings.channels.find((channel) => channel.id === settings.trigger.source && channel.enabled);
  const levelAt = (offsetY: number, height: number) => {
    const source = triggerSource!;
    const volts = ((height / 2 - offsetY) / (height / VERTICAL_DIVISIONS) - source.position) * source.voltsPerDivision;
    return Number(volts.toPrecision(3));
  };
  const onLevelMarker = (offsetX: number, offsetY: number, width: number, height: number) => {
    if (!triggerSource) {
      return false;
    }
    const markerY = height / 2 - (settings.trigger.level / triggerSource.voltsPerDivision + triggerSource.position) * (height / VERTICAL_DIVISIONS);
    return offsetX > width - 24 && Math.abs(offsetY - markerY) < 10;
  };
  const activeChannel = settings.channels.find((channel) => channel.id === settings.active);
  const secondsPerPixel = () => settings.secondsPerDivision * HORIZONTAL_DIVISIONS / Math.max(1, frame.current?.clientWidth ?? 1);
  const divisionsPerPixel = () => VERTICAL_DIVISIONS / Math.max(1, frame.current?.clientHeight ?? 1);
  const maximumBack = () => Math.max(0, memory.lastTime() - memory.firstTime() - settings.secondsPerDivision * HORIZONTAL_DIVISIONS);
  // A drag ends on release and on a cancelled pointer alike: a touch taken over by the browser left the screen panning.
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    levelDrag.current = false;
    cursorDrag.current = null;
    event.currentTarget.classList.remove("parallax-is-panning");
  };

  return (
    <div
      ref={frame}
      data-parallax-part="scope-screen" className="parallax-scope-screen" data-driver={driver ?? undefined}
      role="application"
      aria-roledescription="oscilloscope screen"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        const box = event.currentTarget;
        if (onLevelMarker(event.nativeEvent.offsetX, event.nativeEvent.offsetY, box.clientWidth, box.clientHeight)) {
          levelDrag.current = true;
          box.setPointerCapture(event.pointerId);
          return;
        }
        // A cursor is grabbed by its line and dragged; anywhere else the screen pans as always — clicking with the
        // cursors on used to move the nearer one and pan nothing, a mode nobody could see.
        const grabbed = cursorAt(settings, cursorFraction(event.nativeEvent, box), CURSOR_REACH_PIXELS / cursorLength(box));
        if (grabbed) {
          cursorDrag.current = grabbed;
          box.setPointerCapture(event.pointerId);
          return;
        }
        const [across, up] = settings.channels.filter((channel) => channel.enabled);
        drag.current = { x: event.clientX, y: event.clientY, back, position: activeChannel?.position ?? 0, replayed: clock?.replay?.time ?? null,
          figure: settings.display === "xy" && across && up ? [across.position, up.position] : null };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add("parallax-is-panning");
      }}
      onPointerMove={(event) => {
        const box = event.currentTarget;
        if (levelDrag.current) {
          onSettings({ trigger: { ...settings.trigger, level: levelAt(event.nativeEvent.offsetY, box.clientHeight) } });
          return;
        }
        if (cursorDrag.current) {
          const fraction = Math.max(0, Math.min(1, cursorFraction(event.nativeEvent, box)));
          onSettings({ cursors: { ...settings.cursors, [cursorDrag.current]: fraction } });
          return;
        }
        const start = drag.current;
        if (!start) {
          const overCursor = cursorAt(settings, cursorFraction(event.nativeEvent, box), CURSOR_REACH_PIXELS / cursorLength(box)) !== null;
          box.style.cursor = onLevelMarker(event.nativeEvent.offsetX, event.nativeEvent.offsetY, box.clientWidth, box.clientHeight) ? "ns-resize"
            : overCursor ? (settings.cursors.axis === "volts" ? "ns-resize" : "ew-resize") : "";
          return;
        }
        // In XY a drag moves the figure, as a graph is moved: the across channel's zero with the pointer's x, the up
        // channel's with its y — a division of the square grid being the screen's height over eight.
        if (start.figure) {
          const [across, up] = settings.channels.filter((channel) => channel.enabled);
          const division = Math.max(1, box.clientHeight) / VERTICAL_DIVISIONS;
          const round = (value: number) => Math.max(-40, Math.min(40, Math.round(value * 10) / 10));
          onChannel(across.id, { position: round(start.figure[0] + (event.clientX - start.x) / division) });
          onChannel(up.id, { position: round(start.figure[1] - (event.clientY - start.y) / division) });
          return;
        }
        // A replay is scrolled like a tape under the screen; the stream is looked back into.
        const replay = clock?.replay;
        if (replay && start.replayed !== null) {
          replay.seek(start.replayed - (event.clientX - start.x) * secondsPerPixel());
        } else if (!holdsWholeRecord(settings)) {
          onBack(Math.min(maximumBack(), Math.max(0, start.back + (event.clientX - start.x) * secondsPerPixel())));
        }
        if (activeChannel) {
          const position = Math.round((start.position - (event.clientY - start.y) * divisionsPerPixel()) * 10) / 10;
          if (position !== activeChannel.position) {
            onChannel(activeChannel.id, { position: Math.max(-4, Math.min(4, position)) });
          }
        }
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onFit}
      onKeyDown={(event) => {
        const step = settings.secondsPerDivision;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const replay = clock?.replay;
          if (replay) {
            replay.seek(replay.time + (event.key === "ArrowLeft" ? -step : step));
          } else {
            onBack(Math.min(maximumBack(), Math.max(0, back + (event.key === "ArrowLeft" ? step : -step))));
          }
        } else if ((event.key === "ArrowUp" || event.key === "ArrowDown") && activeChannel) {
          event.preventDefault();
          onChannel(activeChannel.id, { position: Math.max(-4, Math.min(4, activeChannel.position + (event.key === "ArrowUp" ? 0.5 : -0.5))) });
        } else if (event.key === "+" || event.key === "-") {
          event.preventDefault();
          const direction = event.key === "+" ? -1 : 1;
          if (settings.wheel === "time") {
            onSettings({ secondsPerDivision: Math.min(1, Math.max(1e-9, ladderStep(settings.secondsPerDivision, direction))) });
          } else if (activeChannel) {
            onChannel(activeChannel.id, { voltsPerDivision: Math.max(1e-4, ladderStep(activeChannel.voltsPerDivision, direction)) });
          }
        } else if (event.key === "Home") {
          onBack(0);
        }
      }}
    >
      <div ref={stageHost} className="parallax-visual-host parallax-scope-stage" aria-hidden="true" />
    </div>
  );
}

/**
 * The screen's window and grid: ten divisions by eight against time; against another signal, square divisions — a volt
 * across as long as a volt up —, as many across as the screen's width holds, or two sines of one frequency a quarter
 * turn apart would draw an ellipse instead of the circle they make.
 */
function screenGrid(xy: boolean, size: { width: number; height: number }) {
  if (!xy || !(size.width > 0) || !(size.height > 0)) {
    return { pinned: SCREEN, divisions: { horizontal: HORIZONTAL_DIVISIONS, vertical: VERTICAL_DIVISIONS } };
  }
  const across = Math.max(2, 2 * Math.round(VERTICAL_DIVISIONS * size.width / size.height / 2));
  const middle = HORIZONTAL_DIVISIONS / 2;
  return {
    pinned: { ...SCREEN, xMinimum: middle - across / 2, xMaximum: middle + across / 2 },
    divisions: { horizontal: across, vertical: VERTICAL_DIVISIONS },
  };
}

/** How near a cursor's line, in pixels, the pointer grabs it. */
const CURSOR_REACH_PIXELS = 7;

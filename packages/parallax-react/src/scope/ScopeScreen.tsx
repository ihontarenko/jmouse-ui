import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  HORIZONTAL_DIVISIONS, POSITION_LIMIT, VERTICAL_DIVISIONS, holdsWholeRecord, ScreenWindow, zoomedChannel,
  type ChannelId, type PlaybackClock, type SampleMemory, type ScopeChannel, type ScopeSettings, type Window,
} from "@jmouse/parallax/oscilloscope";
import { ladderStep } from "@jmouse/parallax/quantities";
import { Stage } from "@jmouse/parallax/visual";
import { cursorAt, cursorPlates, paintScreenMarks, Persistence, phasorPlate, probeColors, SCREEN, ScreenAnalysis, screenTraces, spectrumPlate, type CursorPlate, type ReadoutPlate } from "@jmouse/parallax/scope";
import { CursorReadouts, ScreenReadout } from "./ScreenReadout";
import { useSimulatorAppearance } from "../circuit/useSimulatorAppearance";

/**
 * The oscilloscope's screen: the acquisition memory drawn through the drawing library's stage on the instrument
 * screen, at every animation frame the memory or the playback clock moved, never through React.
 *
 * The wheel scales the axis the reader chose (time, or the active channel's volts), Shift+wheel the other one;
 * dragging sideways looks back in time, up and down moves the active trace; a double click fits every trace.
 */
export function ScopeScreen({ memory, settings, back, onSettings, onBack, onChannel, onFit, onTriggered, label, waiting, idle, clock, shown, legend }: {
  /**
   * The readout against time — each trace's scale and readings, the time base, the trigger —, drawn as the screen's one
   * table in its top left corner. A spectrum's and a phasor diagram's tables are the screen's own, in the same place.
   */
  legend?: ReadoutPlate | null;
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
  /** Where the screen looked at its last frame, and what it drew it from — for the readings to measure what is shown. */
  shown?: { current: { view: Window; source: SampleMemory } | null };
  label: string;
  /** Shown instead of the screen's content while nothing has been measured. */
  waiting?: string | null;
  /**
   * Shown while the memory holds nothing — decided by the screen on every frame, never by the one rendering it: the
   * memory fills without a render, and a message chosen from its length at render time stayed over a running trace.
   */
  idle?: string;
}) {
  const appearance = useSimulatorAppearance();
  const stageHost = useRef<HTMLDivElement>(null);
  const [driver, setDriver] = useState<"webgl" | "canvas" | null>(null);
  // A spectrum's or a phasor diagram's table, handed up from the frame loop only when what it says changes.
  const [analysisPlate, setAnalysisPlate] = useState<ReadoutPlate | null>(null);
  const readoutHost = useRef<HTMLDivElement>(null);
  // The cursors' tags, handed up the same way: their readings move with the signal, so at most ten times a second.
  const [cursorTags, setCursorTags] = useState<CursorPlate[]>([]);
  const frame = useRef<HTMLDivElement>(null);
  const state = useRef({ settings, back, waiting, idle, onTriggered, clock, trails: { count: 8, intensity: 0.5 }, drawn: -1, drawnMemory: null as SampleMemory | null, drawnTime: Number.NaN, drawnStart: Number.NaN, heldKey: "" });
  state.current.settings = settings;
  state.current.trails = { count: appearance.scopeTrails ?? 8, intensity: appearance.scopeTrailIntensity ?? 0.5 };
  state.current.back = back;
  state.current.waiting = waiting;
  state.current.idle = idle;
  state.current.onTriggered = onTriggered;
  const shownFrame = useRef(shown);
  shownFrame.current = shown;
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
    let plateKey = "";
    const handPlate = (plate: ReadoutPlate | null) => {
      const key = plate ? JSON.stringify(plate) : "";
      if (key !== plateKey) {
        plateKey = key;
        setAnalysisPlate(plate);
      }
    };
    let tagsKey = "";
    let tagsAt = 0;
    const handTags = (tags: CursorPlate[], now: number) => {
      const key = tags.length ? JSON.stringify(tags) : "";
      if (key !== tagsKey && (key === "" || tagsKey === "" || now - tagsAt > 100)) {
        tagsKey = key;
        tagsAt = now;
        setCursorTags(tags);
      }
    };
    let animation = 0;
    const draw = () => {
      animation = requestAnimationFrame(draw);
      const current = state.current;
      // Where the screen looks is decided in one place, apart from drawing: `ScreenWindow`.
      const now = performance.now();
      const { view, shownTime, newlyTriggered, source } = screenWindow.frame(memory, current.settings, { back: current.back, clock: current.clock, now });
      if (shownFrame.current) {
        shownFrame.current.current = { view, source };
      }
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
      // A held picture the memory has rolled past is drawn from its copy.
      const readout = empty ? undefined : analysis.read(source, settingsNow, view, now);
      handPlate(!readout ? null : settingsNow.display === "fft" ? spectrumPlate(settingsNow, readout) : settingsNow.display === "phasors" ? phasorPlate(readout) : null);
      const timeDisplay = (settingsNow.display ?? "time") === "time";
      handTags(empty || !timeDisplay ? [] : cursorPlates(settingsNow, view,
        (channel, time) => source.length ? source.reading(channel, Math.min(source.length - 1, source.indexAt(time))) : Number.NaN), now);
      const plateBox = readoutHost.current;
      const reserved = plateBox && settingsNow.display === "phasors" ? { width: plateBox.offsetWidth, height: plateBox.offsetHeight } : { width: 0, height: 0 };
      const traces = empty ? [] : screenTraces(source, settingsNow, view, columns, colors, readout);
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
        ...(trails && !empty ? [{ id: "trails", batches: persistence.trailLayer(trails.count, trails.intensity, settingsNow.phosphor) }] : []),
        ...(settingsNow.phosphor && !settingsNow.hold && !empty ? [{ id: "afterglow", batches: persistence.layer(now) }] : []),
        { id: "traces", batches: traces },
      ];
      stage.setContent({
        layers,
        ...screenGrid(settingsNow.display === "xy" || settingsNow.display === "phasors", stage.size),
        overlay: (context, size, theme) => paintScreenMarks(context, size, theme, settingsNow, view, colors, waitingText, memory.length ? memory.firstTime() : Number.NaN, shownTime,
          readout, reserved),
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
          // The level under the pointer stays under it: the trace is zoomed into where the reader looks, not off the screen.
          const box = host.getBoundingClientRect();
          const anchor = (box.height / 2 - (event.clientY - box.top)) / (box.height / VERTICAL_DIVISIONS);
          const zoomed = zoomedChannel(channel, Math.min(1000, Math.max(1e-9, ladderStep(channel.voltsPerDivision, direction))), anchor);
          onChannel(channel.id, { voltsPerDivision: zoomed.voltsPerDivision, position: zoomed.position });
        }
      }
    };
    host.addEventListener("wheel", wheel, { passive: false });
    return () => host.removeEventListener("wheel", wheel);
  }, [onSettings, onChannel]);

  /**
   * A drag in hand. `axis` is decided by its first few pixels — sideways looks back in time, up and down moves the active
   * trace — and then kept: a drag that moved a trace up also crept a pixel sideways, which looked into the past and
   * switched the trigger off until «Back to live».
   */
  const drag = useRef<{ x: number; y: number; back: number; position: number; replayed: number | null; figure: [number, number] | null; axis: "time" | "level" | null } | null>(null);
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
          figure: settings.display === "xy" && across && up ? [across.position, up.position] : null, axis: null };
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
        if (start.axis === null) {
          const across = Math.abs(event.clientX - start.x);
          const up = Math.abs(event.clientY - start.y);
          if (Math.max(across, up) < DRAG_DECIDES_PIXELS) {
            return;
          }
          start.axis = across > up ? "time" : "level";
        }
        // A replay is scrolled like a tape under the screen; the stream is looked back into.
        const replay = clock?.replay;
        if (start.axis === "time") {
          if (replay && start.replayed !== null) {
            replay.seek(start.replayed - (event.clientX - start.x) * secondsPerPixel());
          } else if (!holdsWholeRecord(settings)) {
            onBack(Math.min(maximumBack(), Math.max(0, start.back + (event.clientX - start.x) * secondsPerPixel())));
          }
        }
        if (activeChannel && start.axis === "level") {
          const position = Math.round((start.position - (event.clientY - start.y) * divisionsPerPixel()) * 10) / 10;
          if (position !== activeChannel.position) {
            onChannel(activeChannel.id, { position: Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, position)) });
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
          onChannel(activeChannel.id, { position: Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, activeChannel.position + (event.key === "ArrowUp" ? 0.5 : -0.5))) });
        } else if (event.key === "+" || event.key === "-") {
          event.preventDefault();
          const direction = event.key === "+" ? -1 : 1;
          if (settings.wheel === "time") {
            onSettings({ secondsPerDivision: Math.min(1, Math.max(1e-9, ladderStep(settings.secondsPerDivision, direction))) });
          } else if (activeChannel) {
            const zoomed = zoomedChannel(activeChannel, Math.max(1e-9, ladderStep(activeChannel.voltsPerDivision, direction)), 0);
            onChannel(activeChannel.id, { voltsPerDivision: zoomed.voltsPerDivision, position: zoomed.position });
          }
        } else if (event.key === "Home") {
          onBack(0);
        } else if (/^[1-4]$/.test(event.key)) {
          // 1–4 take the n-th channel on in hand: the one the wheel scales and a drag moves.
          const chosen = settings.channels.filter((channel) => channel.enabled)[Number(event.key) - 1];
          if (chosen) {
            event.preventDefault();
            onSettings({ active: chosen.id });
          }
        }
      }}
    >
      <div ref={stageHost} className="parallax-visual-host parallax-scope-stage" aria-hidden="true" />
      <ScreenReadout ref={readoutHost} plate={settings.display === "fft" || settings.display === "phasors" ? analysisPlate : waiting ? null : legend ?? null}
        active={settings.active} onActivate={(active) => onSettings({ active })} foldable />
      <CursorReadouts tags={cursorTags} screen={frame} corner={readoutHost} />
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

/** How far a drag goes, in pixels, before it is known whether it pans time or moves a trace. */
const DRAG_DECIDES_PIXELS = 4;

/** How near a cursor's line, in pixels, the pointer grabs it. */
const CURSOR_REACH_PIXELS = 7;

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { Segments, Stepper, Tool } from "../controls/BenchControls";
import { ExpandTool } from "../controls/BenchGrid";
import { ToolMenu, ToolMenuCheck, ToolMenuSection } from "../controls/ToolMenu";
import { QuantityField } from "../controls/QuantityField";
import {
  channelName, channelSource, channelUnit, compileReadingExpression, holdsWholeRecord, isIdentityExpression, measure, POSITION_LIMIT, windowOf, zoomedChannel,
  type ReadingTransform,
  type ChannelId, type Measurement, type PlaybackClock, type Recording, type SampleMemory, type ScopeChannel, type ScopeSettings, type TriggerEdge, type TriggerMode, type Window,
} from "@jmouse/parallax/oscilloscope";
import { formatQuantity, ladderAtLeast } from "@jmouse/parallax/quantities";
import {
  cursorsStretchAvailable, cursorVolts, DEFAULT_SPECTRUM_RANGE, fittedSpectrumRange, initialSettings, outOfShape, periodicTimeBase,
  SPECTRUM_DECIBELS_PER_DIVISION, spectrumOf, withinNodes, type ReadoutPlate, type ReadoutRow, type ReplayStretchKind,
} from "@jmouse/parallax/scope";
import type { BenchProbe } from "@jmouse/parallax/circuit";
import { ReplayBar } from "./ReplayBar";
import { MathSection, MathTools, useMathReading } from "./MathSection";
import { ScopeScreen } from "./ScopeScreen";
import { TraceColor } from "./TraceColor";

/**
 * The whole record's length and what a division of it is, read twice a second: the memory grows without React being
 * told, and a legend is a reading, not an animation.
 */
function useRecordSpan(memory: SampleMemory, whole: boolean): number {
  const [span, setSpan] = useState(0);
  useEffect(() => {
    if (!whole) {
      return;
    }
    const read = () => setSpan(memory.length > 1 ? memory.lastTime() - memory.firstTime() : 0);
    read();
    const timer = window.setInterval(read, 500);
    return () => window.clearInterval(timer);
  }, [memory, whole]);
  return span;
}

/** A screen without a playback clock has no replay to follow. */
const noReplay = () => () => {};

/**
 * A channel's heading: its colour is the bar before its name (`TraceColor`, as every trace has it), and its name is
 * written in place; taking the name into hand makes it the active trace.
 */
function ChannelHeading({ channel, active, onChange, onActivate }: {
  channel: ScopeChannel;
  active: boolean;
  onChange: (changes: Partial<ScopeChannel>) => void;
  onActivate: () => void;
}) {
  return <div className="parallax-channel-heading">
    <TraceColor color={channel.color} name={channelName(channel)} onChange={(color) => onChange({ color })} />
    <input className={`parallax-channel-name${active ? " parallax-active" : ""}`} value={channel.name} placeholder={channel.id} maxLength={16} spellCheck={false}
      aria-label={`${channel.id} name`} title={`${channel.id} — write a name; taking it into hand makes it the active trace`}
      onFocus={onActivate} onChange={(event) => onChange({ name: event.target.value })} />
  </div>;
}

export interface OscilloscopeState {
  settings: ScopeSettings;
  back: number;
  update: (changes: Partial<ScopeSettings>) => void;
  channel: (id: ChannelId, changes: Partial<ScopeChannel>) => void;
  setBack: (back: number) => void;
  fit: (memory: SampleMemory) => void;
  /** The circuit's `probes` block set the scales: a fresh run is not fitted over them. */
  writtenScales: boolean;
  /** Whether the circuit names the time base it opens on (`time 1 ms/div`): a fresh run then keeps it. */
  writtenTimeBase: boolean;
}

/** The instrument's settings: channels, time base, trigger, what the wheel scales, and how far the view looks back. */
export function useOscilloscope(nodes: readonly string[], written: readonly BenchProbe[] = [], timePerDivision?: number | null): OscilloscopeState {
  const nodesKey = nodes.join("|");
  const [settings, setSettings] = useState<ScopeSettings>(() => ({ ...initialSettings(nodes, written, timePerDivision), trails: readTrails(), acquisition: readAcquisition() }));
  const [back, setBack] = useState(0);
  // A circuit's nodes arrive with its first answer, and change when it is rewired: a channel on a node the circuit no
  // longer has is taken off it; a scope left with nothing to probe starts again from what the circuit writes.
  useEffect(() => {
    setSettings((current) => {
      const kept = withinNodes(current, nodes);
      return kept.channels.some((channel) => channel.enabled && nodes.includes(channel.node)) ? kept
        : { ...initialSettings(nodes, written, timePerDivision), trails: current.trails, acquisition: current.acquisition };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesKey]);
  const update = useCallback((changes: Partial<ScopeSettings>) => {
    if (changes.trails !== undefined) {
      keepTrails(changes.trails);
    }
    if (changes.acquisition !== undefined) {
      keepAcquisition(changes.acquisition);
    }
    setSettings((current) => ({ ...current, ...changes }));
  }, []);
  const channel = useCallback((id: ChannelId, changes: Partial<ScopeChannel>) => setSettings((current) => ({
    ...current,
    channels: current.channels.map((candidate) => candidate.id === id ? { ...candidate, ...changes } : candidate),
  })), []);
  // One scale and one zero for every DC trace, from their joint swing: the traces of one circuit are read against one
  // grid, so 5 V on one is level with 5 V on another. A trace on AC coupling is centred on its own mean instead.
  const fit = useCallback((memory: SampleMemory) => setSettings((current) => {
    const view = windowOf(memory, current, 0);
    const shown = current.channels.filter((candidate) => candidate.enabled);
    // A spectrum is fitted in decibels: its strongest peak just under the top. Its channels keep their scales.
    if (current.display === "fft") {
      return { ...current, spectrum: fittedSpectrumRange(shown.map((candidate) => spectrumOf(memory, candidate.id, view)), current.spectrum ?? DEFAULT_SPECTRUM_RANGE) };
    }
    const readings = shown.map((candidate) => [candidate, measure(memory, candidate.id, view)] as const);
    // One scale and one zero per UNIT: volts are read against volts, amperes against amperes. Fitted together, a current
    // clamp took the collector's 2 V/div as «2 A/div» and its trace lay flat on the zero line.
    const fitted = new Map<string, { scale: number; position: number }>();
    for (const unit of new Set(shown.map(channelUnit))) {
      const ofUnit = readings.filter(([candidate]) => channelUnit(candidate) === unit);
      const direct = ofUnit.filter(([candidate, reading]) => candidate.coupling === "DC" && reading);
      const low = Math.min(0, ...direct.map(([, reading]) => reading!.minimum));
      const high = Math.max(0, ...direct.map(([, reading]) => reading!.maximum));
      const alternating = ofUnit.filter(([candidate, reading]) => candidate.coupling === "AC" && reading)
        .map(([, reading]) => reading!.maximum - reading!.minimum);
      // Nothing measured in this unit yet — Fit pressed before the first samples — leaves its scale as it is: fitted to
      // nothing, every channel fell to the smallest step and the traces ran off the screen when the samples came.
      if (!direct.length && !alternating.length) {
        continue;
      }
      const smallest = unit === "A" ? 1e-6 : 1e-3;
      const scale = ladderAtLeast(Math.max(smallest, (high - low) / 6, ...alternating.map((swing) => swing / 6)));
      fitted.set(unit, { scale, position: Math.max(-4, Math.min(4, Math.round(-(high + low) / 2 / scale * 2) / 2)) });
    }
    // In XY a one-sided signal — a swept collector, its current — is drawn from the corner, as a curve tracer draws it:
    // its zero at the edge and its scale filling the screen. Centred, the curves sat in one quarter of it.
    const perChannel = new Map<string, { scale: number; position: number }>();
    if (current.display === "xy") {
      shown.slice(0, 2).forEach((candidate, index) => {
        const reading = readings.find(([channel]) => channel.id === candidate.id)?.[1];
        if (!reading || candidate.coupling !== "DC" || reading.maximum <= 0 || reading.minimum < -0.02 * reading.maximum) {
          return;
        }
        // Across, nine divisions right of a zero four left of the middle; up, seven and a half above one at the bottom.
        perChannel.set(candidate.id, { scale: ladderAtLeast(reading.maximum / (index === 0 ? 9 : 7.5)), position: -4 });
      });
    }
    const source = measure(memory, current.trigger.source, view);
    const level = source ? Number(((source.maximum + source.minimum) / 2).toPrecision(2)) : current.trigger.level;
    return { ...current, secondsPerDivision: periodicTimeBase(memory, current.trigger.source) ?? current.secondsPerDivision,
      trigger: { ...current.trigger, level },
      channels: current.channels.map((candidate) => {
        const fit = perChannel.get(candidate.id) ?? fitted.get(channelUnit(candidate));
        return candidate.enabled && fit ? { ...candidate, voltsPerDivision: fit.scale, position: candidate.coupling === "AC" ? 0 : fit.position } : candidate;
      }) };
  }), []);
  const writtenScales = written.some((probe) => /^CH[1-4]$/.test(probe.id) && probe.scale !== null);
  // A circuit that names its time base keeps it: a fresh run does not take one from the trigger's period instead.
  const writtenTimeBase = Boolean(timePerDivision && timePerDivision > 0);
  return { settings, back, update, channel, setBack, fit, writtenScales, writtenTimeBase };
}

/**
 * Each channel's expression (`X * pi / 2`) compiled and handed to the memory, which applies it as it is read: the trace,
 * the trigger, the measurements and M all see the channel as written. An expression that does not compile leaves the
 * reading as it is — the panel says why.
 */
function useReadingExpressions(memory: SampleMemory, channels: readonly ScopeChannel[]) {
  const key = JSON.stringify(channels.map((channel) => [channel.id, channel.enabled, channel.expression ?? ""]));
  useEffect(() => {
    const transforms = new Map<string, ReadingTransform>();
    for (const channel of channels) {
      if (!channel.enabled || isIdentityExpression(channel.expression)) {
        continue;
      }
      const compiled = compileReadingExpression(channel.expression!);
      if (compiled.ok) {
        transforms.set(channel.id, compiled.transform);
      }
    }
    memory.setTransforms(transforms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memory, key]);
}

const PLOTS: { value: NonNullable<ScopeSettings["display"]>; label: string; title: string }[] = [
  { value: "time", label: "YT", title: "YT — each channel against time" },
  { value: "xy", label: "XY", title: "XY — the first channel on, across, against the second, up: two signals as one figure — the time base sets how much of them it holds" },
  { value: "phasors", label: "Phasors", title: "Phasors — every channel at the first one's fundamental as an arrow from the centre: its length the amplitude, its angle how far it leads — the math channel too, so U_R, U_C and U_in close a triangle" },
  { value: "fft", label: "FFT", title: "FFT — each channel's spectrum over the window shown: amplitude in dBV against frequency, Hann window — harmonics stand as peaks; a longer time base, a finer resolution" },
];

/**
 * How the screen draws, behind one Display button at the end of the strip: what it plots, how a trace persists, how a
 * live run is acquired, and the math channel — chosen now and then, so they do not take a second row from the screen.
 */
function ScreenDisplayMenu({ settings, live, onChange }: { settings: ScopeSettings; live: boolean; onChange: (changes: Partial<ScopeSettings>) => void }) {
  const plot = PLOTS.find((choice) => choice.value === (settings.display ?? "time")) ?? PLOTS[0];
  const spectrumRange = settings.spectrum ?? DEFAULT_SPECTRUM_RANGE;
  const persistence = [settings.phosphor && "phosphor", settings.trails && "trails", settings.hold && "hold"].filter(Boolean).join(", ");
  const math = settings.math?.enabled ? "math on" : "";
  const summary = [plot.label, persistence, math].filter(Boolean).join(" · ");
  return (
    <ToolMenu label={plot.label} icon={plot.value === "fft" ? "display-spectrum" : plot.value === "xy" ? "display-xy" : plot.value === "phasors" ? "display-phasors" : "display-time"}
      part="scope-display" title={`Display: ${summary}`}>
      <ToolMenuSection title="The screen plots">
        <Segments wide label="What the screen plots" value={plot.value} onChange={(display) => onChange({ display })} options={PLOTS} />
      </ToolMenuSection>
      {plot.value === "fft" ? (
        <ToolMenuSection title="Spectrum levels">
          <div className="parallax-tool-menu-controls">
            <Stepper label="Top of the spectrum screen" value={spectrumRange.top} unit="dB" step={10} minimum={-200} maximum={200}
              format={(value) => `top ${value} dB`} onChange={(top) => onChange({ spectrum: { ...spectrumRange, top } })} />
          </div>
          <Segments wide label="Decibels per division" value={String(spectrumRange.decibelsPerDivision)}
            onChange={(value) => onChange({ spectrum: { ...spectrumRange, decibelsPerDivision: Number(value) } })}
            options={SPECTRUM_DECIBELS_PER_DIVISION.map((decibels) => ({ value: String(decibels), label: `${decibels} dB`, title: `${decibels} dB a division: ${decibels * 8} dB on the screen` }))} />
        </ToolMenuSection>
      ) : null}
      <ToolMenuSection title="Persistence">
        <ToolMenuCheck label="Phosphor" description="each trace glows and fades a moment after it is drawn (P)"
          checked={settings.phosphor} onChange={(phosphor) => onChange({ phosphor })} />
        <ToolMenuCheck label="Trails" description="the last sweeps stay under the live trace, each older one fainter (T)"
          checked={Boolean(settings.trails)} onChange={(trails) => onChange({ trails })} />
        <ToolMenuCheck label="Hold" description="every trace stays until a scale or a zero changes — step a knob to draw a family of curves"
          checked={Boolean(settings.hold)} onChange={(hold) => onChange({ hold })} />
      </ToolMenuSection>
      {live ? (
        <ToolMenuSection title="Acquisition">
          <Segments wide label="How the run is acquired" value={settings.acquisition ?? "gapless"} onChange={(acquisition) => onChange({ acquisition })}
            options={[{ value: "gapless", label: "Every sample", title: "Every sample read: an unbroken record at any time base; the run slows as far as a fine time base needs" },
              { value: "realtime", label: "Real time", title: "Real time first: at a fine time base the screen keeps one block of samples a frame, with gaps between" }]} />
        </ToolMenuSection>
      ) : null}
      <ToolMenuSection title="Math channel">
        <div className="parallax-tool-menu-controls">
          <MathTools settings={settings} onChange={(math) => onChange({ math })} />
        </div>
        <small className="parallax-tool-menu-note">Two channels combined sample by sample, drawn as a trace of its own.</small>
      </ToolMenuSection>
    </ToolMenu>
  );
}

/** Auto refits at most this often, so a trace that wanders is followed, not chased. */
const AUTO_EVERY_MILLISECONDS = 1000;

/** Auto on or off is this browser's habit. */
const AUTO_KEY = "parallax.scope.auto";

/** Trails on or off is this browser's habit, like Auto; how many and how bright are the reader's appearance. */
const TRAILS_KEY = "parallax.scope.trails";

function readTrails(): boolean {
  try {
    return localStorage.getItem(TRAILS_KEY) === "on";
  } catch {
    return false;
  }
}

/** How a live run is acquired is this browser's habit too: every sample, unless the reader chose real time. */
const ACQUISITION_KEY = "parallax.scope.acquisition";

function readAcquisition(): ScopeSettings["acquisition"] {
  try {
    return localStorage.getItem(ACQUISITION_KEY) === "realtime" ? "realtime" : "gapless";
  } catch {
    return "gapless";
  }
}

function keepAcquisition(acquisition: NonNullable<ScopeSettings["acquisition"]>) {
  try {
    localStorage.setItem(ACQUISITION_KEY, acquisition);
  } catch {
    // A private window keeps no habit.
  }
}

function keepTrails(trails: boolean) {
  try {
    localStorage.setItem(TRAILS_KEY, trails ? "on" : "off");
  } catch {
    // A private window keeps no habit.
  }
}

/**
 * The measurements of every channel shown, a few times a second — a reading, not an animation. A fresh acquisition
 * (a new run, new probes) is fitted to the screen once its first samples are in, as an instrument's auto set does;
 * with Auto on, it is fitted again whenever a trace runs off the screen or shrinks to a sliver of it.
 */
function useMeasurements(memory: SampleMemory, scope: OscilloscopeState, auto: boolean,
  shown?: { current: { view: Window; source: SampleMemory } | null }) {
  const [measured, setMeasured] = useState<Partial<Record<ChannelId, Measurement | null>>>({});
  const fittedGeneration = useRef(-1);
  const timedGeneration = useRef(-1);
  const fittedAt = useRef(0);
  useEffect(() => {
    let seen = -1;
    const read = () => {
      if (memory.version === seen) {
        return;
      }
      seen = memory.version;
      if (fittedGeneration.current !== memory.generation && memory.length >= 40 && !scope.writtenScales) {
        fittedGeneration.current = memory.generation;
        scope.fit(memory);
      }
      // A fresh run's time base waits for two whole periods of its source, which the first fit is often too early for.
      if (timedGeneration.current !== memory.generation && !scope.writtenTimeBase) {
        const timeBase = periodicTimeBase(memory, scope.settings.trigger.source);
        if (timeBase !== null) {
          timedGeneration.current = memory.generation;
          scope.update({ secondsPerDivision: timeBase });
        }
      }
      // What the screen shows, held picture included; before its first frame, where it will look.
      const frame = shown?.current ?? { view: windowOf(memory, scope.settings, scope.back), source: memory };
      const view = frame.view;
      const readings = scope.settings.channels.filter((channel) => channel.enabled)
        .map((channel) => [channel, measure(frame.source, channel.id, view)] as const);
      setMeasured(Object.fromEntries(readings.map(([channel, reading]) => [channel.id, reading])));
      if (auto && performance.now() - fittedAt.current > AUTO_EVERY_MILLISECONDS && readings.some(([channel, reading]) => reading && outOfShape(channel, reading))) {
        fittedAt.current = performance.now();
        scope.fit(memory);
      }
    };
    read();
    const timer = window.setInterval(read, 300);
    return () => window.clearInterval(timer);
  }, [memory, scope.settings, scope.back, auto]);
  return measured;
}

/**
 * The screen with its strip above (what the wheel scales, which trace is active, fit, cursors, back to live) and its
 * legend below (each trace's scale and readings, the time base, the trigger, the memory).
 */
export function OscilloscopeScreen({ memory, scope, waiting, idle, onSingleShot, live = false, clock, leading, replaying }: {
  memory: SampleMemory;
  /**
   * A live bench's replay: which stretch is played, how to start one and how to leave it. The replay itself is the
   * clock's — the screen plays it as it plays the stream.
   */
  replaying?: { stretch: ReplayStretchKind; start: (stretch: ReplayStretchKind) => void; end: () => void };
  /** What the frame shows first in its strip: the bench's switch between the screen and the meters. */
  leading?: ReactNode;
  /** A live circuit's playback clock; the screen plays the stream from it. */
  clock?: PlaybackClock;
  scope: OscilloscopeState;
  waiting?: string | null;
  /** Shown while the memory holds nothing; the screen decides when, frame by frame. */
  idle?: string;
  onSingleShot?: () => void;
  live?: boolean;
}) {
  const { settings, back } = scope;
  const replay = useSyncExternalStore(clock?.subscribeReplay ?? noReplay, () => clock?.replay ?? null);
  const whole = holdsWholeRecord(settings);
  const enabled = settings.channels.filter((channel) => channel.enabled);
  // Auto keeps every trace on the screen as the signal changes; Fit does it once. Kept per browser.
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) === "on";
    } catch {
      return false;
    }
  });
  const toggleAuto = () => setAuto((current) => {
    try {
      localStorage.setItem(AUTO_KEY, current ? "off" : "on");
    } catch {
      // A private window keeps no habit.
    }
    return !current;
  });
  const shown = useRef<{ view: Window; source: SampleMemory } | null>(null);
  const measured = useMeasurements(memory, scope, auto, shown);
  useReadingExpressions(memory, settings.channels);
  const triggered = useCallback(() => {
    if (settings.trigger.mode === "single") {
      onSingleShot?.();
    }
  }, [settings.trigger.mode, onSingleShot]);
  const span = settings.secondsPerDivision * 10;
  const cursorTime = Math.abs(settings.cursors.second - settings.cursors.first) * span;
  const activeChannel = enabled.find((channel) => channel.id === settings.active);
  const triggerSource = settings.channels.find((channel) => channel.id === settings.trigger.source);
  const triggerUnit = triggerSource ? channelUnit(triggerSource) : "V";
  const recordSpan = useRecordSpan(memory, whole);
  const mathRow = useMathReading(memory, settings, back);
  // The readout against time: one row a trace — its name, what it probes, its scale, then its readings in columns of their
  // own, so a figure that moves keeps its place —, and one line for the time base, the trigger, the cursors, the memory.
  const legend: ReadoutPlate = {
    rows: [
      ...enabled.map((channel): ReadoutRow => {
        const reading = measured[channel.id];
        const unit = channelUnit(channel);
        return {
          key: channel.id, color: channel.color, channel: channel.id,
          cells: [
            { text: channelName(channel), tone: "name" },
            { text: `${channelSource(channel)}${isIdentityExpression(channel.expression) ? "" : ` · ${channel.expression!.trim()}`}`, tone: "note" },
            { text: `${formatQuantity(channel.voltsPerDivision, unit)}/div${channel.coupling === "AC" ? " AC" : ""}`, tone: "setting", numeric: true },
            { text: reading ? `${formatQuantity(reading.maximum - reading.minimum, unit)} pp` : "—", tone: "reading", numeric: true,
              title: reading ? `${formatQuantity(reading.rms, unit)} rms · ${formatQuantity(reading.minimum, unit)} … ${formatQuantity(reading.maximum, unit)}` : undefined },
            { text: reading ? `${formatQuantity(reading.mean, unit)} avg` : "", tone: "reading", numeric: true },
            { text: reading?.frequency ? formatQuantity(reading.frequency, "Hz") : "", tone: "reading", numeric: true },
            { text: reading && reading.duty !== null ? `${(reading.duty * 100).toFixed(1)} %` : "", tone: "reading", numeric: true },
          ],
        };
      }),
      ...(mathRow ? [mathRow] : []),
    ],
    notes: [
      { text: whole ? `whole record · ${formatQuantity(recordSpan, "s")}` : `${formatQuantity(settings.secondsPerDivision, "s")}/div`, tone: "setting" },
      { text: whole ? "no trigger" : settings.trigger.mode === "free" ? "free running" : `${settings.trigger.mode} · ${settings.trigger.source} ${EDGE_MARKS[settings.trigger.edge]} ${formatQuantity(settings.trigger.level, triggerUnit)}`, tone: "setting" },
      ...(settings.cursors.enabled && settings.cursors.axis !== "volts"
        ? [{ text: `Δt ${formatQuantity(cursorTime, "s")} · 1/Δt ${formatQuantity(cursorTime > 0 ? 1 / cursorTime : Number.NaN, "Hz")}`, tone: "reading" as const }] : []),
      ...(settings.cursors.enabled && settings.cursors.axis === "volts" && activeChannel
        ? [{ text: `${channelName(activeChannel)} A ${formatQuantity(cursorVolts(settings.cursors.first, activeChannel), channelUnit(activeChannel))} · B ${formatQuantity(cursorVolts(settings.cursors.second, activeChannel), channelUnit(activeChannel))} · Δ ${formatQuantity(Math.abs(cursorVolts(settings.cursors.first, activeChannel) - cursorVolts(settings.cursors.second, activeChannel)), channelUnit(activeChannel))}`, tone: "reading" as const }] : []),
      { text: `memory ${memory.length.toLocaleString("en")} / ${memory.capacity.toLocaleString("en")}`, tone: "note" },
    ],
  };
  const screenLabel = `Oscilloscope: ${enabled.map((channel) => `${channelName(channel)} on ${channel.node}`).join(", ") || "no channel on"}`;

  return (
    <section data-parallax-part="scope" className="parallax-scope" aria-label="Oscilloscope">
      <div data-parallax-part="scope-toolbar" className="parallax-scope-toolbar">
        {leading}
        {/* One row of what a hand goes to all the time: the time base first — the knob a bench scope puts beside its
            screen —, what Fit scales, the cursors. The active trace is chosen by its name in the screen's readout (or
            keys 1–4), not by a second row of the same names here. How the screen draws (YT, XY, phasors, FFT; phosphor,
            trails, hold), how a run is acquired and the math channel are chosen now and then: they are the Display menu
            at the strip's end. The inspector's Time base keeps the rest: memory, the wheel. */}
        <div role="group" aria-label="Time base" className="parallax-scope-toolbar-group">
          <span className="parallax-scope-toolbar-caption" aria-hidden="true">Time</span>
          <Stepper label="Time per division" value={settings.secondsPerDivision} unit="s" minimum={1e-9} maximum={1}
            format={(value) => whole ? "whole record" : `${formatQuantity(value, "s")}/div`}
            onChange={(secondsPerDivision) => scope.update({ secondsPerDivision, horizontal: "divisions" })} />
        </div>
        <div role="group" aria-label="Scale" className="parallax-scope-toolbar-group">
          <span className="parallax-scope-toolbar-caption" aria-hidden="true">Scale</span>
          <Tool label="Fit every trace to the screen once (double click on the screen)" onClick={() => scope.fit(memory)}><ParallaxIcon name="fit" />Fit</Tool>
          <Tool aria-pressed={auto} onClick={toggleAuto} label="Keep fitting every trace to the screen as the signal changes">Auto</Tool>
        </div>
        <div role="group" aria-label="Measure" className="parallax-scope-toolbar-group">
          <span className="parallax-scope-toolbar-caption" aria-hidden="true">Cursors</span>
          <Segments label="Cursors" value={!settings.cursors.enabled ? "off" : settings.cursors.axis ?? "time"}
            onChange={(choice) => scope.update({ cursors: choice === "off" ? { ...settings.cursors, enabled: false } : { ...settings.cursors, enabled: true, axis: choice } })}
            options={[{ value: "off", label: "Off", title: "No cursors" },
              { value: "time", label: "Δt", title: "Two time cursors, A and B: drag their lines; each reads the moment and every channel there" },
              { value: "volts", label: "ΔV", title: "Two level cursors on the active channel, A and B: drag their lines; each reads its level" }]} />
        </div>
        {back > 0 && !replay ? <Tool tone="primary" onClick={() => scope.setBack(0)}>{live ? "Back to live" : "To the end"} · <span className="parallax-monospace">−{formatQuantity(back, "s")}</span></Tool> : null}
        <ScreenDisplayMenu settings={settings} live={live} onChange={scope.update} />
        <ExpandTool />
      </div>
      <ScopeScreen memory={memory} settings={settings} back={back} waiting={waiting} idle={idle} clock={clock} shown={shown}
        onSettings={(changes) => scope.update(whole && changes.secondsPerDivision !== undefined ? { ...changes, horizontal: "divisions" } : changes)} onBack={scope.setBack} onChannel={scope.channel} onFit={() => scope.fit(memory)} onTriggered={triggered}
        label={screenLabel} legend={legend} />
      {replay && replaying ? (
        <ReplayBar replay={replay} stretch={replaying.stretch} cursorsAvailable={cursorsStretchAvailable(settings)}
          onStretch={replaying.start} onEnd={replaying.end} />
      ) : null}
    </section>
  );
}

/**
 * What the channel's screen shows instead of the reading, written by hand — `X * pi / 2`, `abs(X)`, `X - 1` —, X being
 * the reading. Saved with the circuit in its `probes` block. A line that does not compile says why under it, and the
 * screen goes on showing the reading.
 */
function ChannelExpression({ channel, onChange }: { channel: ScopeChannel; onChange: (expression: string) => void }) {
  const expression = channel.expression ?? "";
  const compiled = isIdentityExpression(expression) ? null : compileReadingExpression(expression);
  const problemId = `${channel.id}-expression-problem`;
  const failed = compiled !== null && !compiled.ok;
  return (
    <div className="parallax-control-row parallax-channel-expression">
      <label htmlFor={`${channel.id}-expression`}>Shows</label>
      <input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" id={`${channel.id}-expression`}
        value={expression} placeholder="X" spellCheck={false} autoComplete="off" maxLength={80}
        aria-invalid={failed || undefined} aria-describedby={failed ? problemId : undefined}
        title="What the screen draws, X being the reading: X * pi / 2, abs(X), 20 * log(X), X - 1. The trigger and the readings follow it; saved in the circuit's probes"
        onChange={(event) => onChange(event.target.value)} />
      {compiled && !compiled.ok ? <p id={problemId} className="parallax-error-text parallax-channel-expression-problem">{compiled.message}</p> : null}
    </div>
  );
}

export interface Recorder {
  recordings: readonly Recording[];
  /** The recording in progress: how many of how many samples. */
  progress: { received: number; target: number } | null;
  record: (count: number) => void;
  cancel: () => void;
  /** The screen's current window, kept as a recording. */
  keep: () => void;
  remove: (id: number) => void;
  download: (recording: Recording) => void;
  viewing: number | null;
  view: (id: number | null) => void;
}

const MEMORY_SIZES = [2_000, 10_000, 50_000, 200_000];
const RECORD_SIZES = [1_000, 10_000, 100_000];

/**
 * A group of the panel that folds — time base, trigger, record —, remembered open or closed per group in this browser,
 * with what it is set to beside its title, so a folded group still says it.
 */
function PanelGroup({ id, title, meta, children }: { id: string; title: string; meta?: string; children: ReactNode }) {
  const key = `parallax.scope.${id}.open`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== "false";
    } catch {
      return true;
    }
  });
  return (
    <details data-parallax-part="disclosure" className="parallax-disclosure" open={open} onToggle={(event) => {
      const now = event.currentTarget.open;
      setOpen(now);
      try {
        localStorage.setItem(key, String(now));
      } catch {
        // A private window keeps no preference; the group simply opens next time.
      }
    }}>
      <summary>{title}{meta ? <span className="parallax-metadata">{meta}</span> : null}<ParallaxIcon name="chevron-down" className="parallax-chevron" /></summary>
      <div className="parallax-disclosure-body">{children}</div>
    </details>
  );
}

const EDGE_MARKS: Record<TriggerEdge, string> = { rising: "↑", falling: "↓", either: "↕" };

/** The instrument panel: channels, time base and memory, trigger, acquisition and recordings. */
export function OscilloscopePanel({ scope, nodes, parts = [], nodeLabels = {}, sampleInterval, capacity, onCapacity, recorder }: {
  scope: OscilloscopeState;
  nodes: readonly string[];
  /** The circuit's parts, which a channel may clamp a current probe around. */
  parts?: readonly string[];
  /** What each node is wired to — "V1 +, D1 anode" —, which the probe lists name it by. */
  nodeLabels?: Record<string, string>;
  /** The time between two samples: what the memory's size means in time. */
  sampleInterval?: number;
  capacity: number;
  onCapacity: (capacity: number) => void;
  recorder?: Recorder;
}) {
  const { settings } = scope;
  const whole = holdsWholeRecord(settings);
  const triggerSource = settings.channels.find((channel) => channel.id === settings.trigger.source);
  // A trigger on a current clamp is set in amperes.
  const triggerUnit = triggerSource ? channelUnit(triggerSource) : "V";
  const [recordSize, setRecordSize] = useState(10_000);
  // A part's inner nodes (`D1.j`, `U1.lower`) are measurable, but listed apart: they are not points of the drawing.
  const outerNodes = nodes.filter((node) => !node.includes("."));
  const innerNodes = nodes.filter((node) => node.includes("."));
  const nodeOptions = (excluded: string) => <>
    {["ground", ...outerNodes].filter((node) => node !== excluded).map((node) => <option key={node} value={node}>{nodeLabels[node] ? `${node} — ${nodeLabels[node]}` : node}</option>)}
    {innerNodes.length ? <optgroup label="Inside parts">{innerNodes.filter((node) => node !== excluded).map((node) => <option key={node} value={node}>{node}</option>)}</optgroup> : null}
  </>;
  return (
    <>
      {settings.channels.map((channel) => {
        const active = settings.active === channel.id;
        const state = !channel.enabled ? "off" : channel.shown === false ? "hidden" : "on";
        return (
        <section key={channel.id} data-parallax-part="channel" className={`parallax-channel parallax-probe-channel parallax-probe-${channel.color}${channel.enabled ? "" : " parallax-off"}${active ? " parallax-active" : ""}`}
          aria-label={`Channel ${channelName(channel)}`}>
          <header>
            <ChannelHeading channel={channel} active={active} onChange={(changes) => scope.channel(channel.id, changes)}
              onActivate={() => scope.update({ active: channel.id })} />
            {active && channel.enabled ? <span className="parallax-badge parallax-accent">active</span> : null}
            <Segments label={`${channelName(channel)} on the screen`} value={state}
              onChange={(chosen) => scope.channel(channel.id, { enabled: chosen !== "off", shown: chosen !== "hidden" })}
              options={[{ value: "off", label: "Off", title: "Not read and not drawn" },
                { value: "hidden", label: "Hide", title: "Read — measured, triggered on, fed into M — but its trace not drawn" },
                { value: "on", label: "On", title: "Read and drawn on the screen" }]} />
          </header>
          {/* Only the active channel is open: four channels of settings pushed the time base and trigger off the panel. A
              folded one says what it reads and at what scale, and opens — becoming the active one — at a press. */}
          {channel.enabled && !active ? (
            <button type="button" className="parallax-channel-summary" onClick={() => scope.update({ active: channel.id })}
              title={`Make ${channelName(channel)} the active channel and open its settings`}>
              <span>{channel.quantity === "current" ? `${channel.part ?? "?"} current` : channelSource(channel)}</span>
              <span className="parallax-technical">{formatQuantity(channel.voltsPerDivision, channelUnit(channel))}/div · {channel.coupling}{channel.position ? ` · ${channel.position > 0 ? "+" : ""}${channel.position} div` : ""}</span>
            </button>
          ) : null}
          {channel.enabled && active ? (
            <>
              <div className="parallax-control-row">
                <label htmlFor={`${channel.id}-node`}>Probe</label>
                <select data-parallax-part="input" className="parallax-input parallax-small" id={`${channel.id}-node`}
                  value={channel.quantity === "current" ? `current:${channel.part ?? ""}` : channel.node}
                  onChange={(event) => {
                    const chosen = event.target.value;
                    // A current clamp reads amperes: its scale starts where a small signal current is readable.
                    scope.channel(channel.id, chosen.startsWith("current:")
                      ? { quantity: "current", part: chosen.slice("current:".length), voltsPerDivision: channel.quantity === "current" ? channel.voltsPerDivision : 0.01, coupling: "DC" }
                      : { quantity: "voltage", node: chosen, voltsPerDivision: channel.quantity === "current" ? 1 : channel.voltsPerDivision });
                  }}>
                  {nodeOptions("")}
                  {parts.length ? <optgroup label="Current through (a clamp on the part)">{parts.map((part) => <option key={part} value={`current:${part}`}>{part} current</option>)}</optgroup> : null}
                </select>
              </div>
              {channel.quantity === "current" ? null : <div className="parallax-control-row">
                <label htmlFor={`${channel.id}-reference`}>Against</label>
                <select data-parallax-part="input" className="parallax-input parallax-small" id={`${channel.id}-reference`} value={channel.reference} onChange={(event) => scope.channel(channel.id, { reference: event.target.value })}>
                  {nodeOptions(channel.node)}
                </select>
              </div>}
              <div className="parallax-control-row">
                <span>Scale</span>
                <Stepper label={`${channel.id} ${channel.quantity === "current" ? "amperes" : "volts"} per division`} value={channel.voltsPerDivision} unit={channelUnit(channel)} minimum={1e-9} maximum={1000}
                  format={(value) => `${formatQuantity(value, channelUnit(channel))}/div`} onChange={(voltsPerDivision) => {
                    // Scaled about the screen's centre: what stands there stays there.
                    const zoomed = zoomedChannel(channel, voltsPerDivision, 0);
                    scope.channel(channel.id, { voltsPerDivision: zoomed.voltsPerDivision, position: zoomed.position });
                  }} />
              </div>
              <div className="parallax-control-row">
                <span>Position</span>
                <Stepper label={`${channel.id} position`} value={channel.position} unit="div" step={0.5} minimum={-POSITION_LIMIT} maximum={POSITION_LIMIT}
                  format={(value) => `${value > 0 ? "+" : ""}${value} div`} onChange={(position) => scope.channel(channel.id, { position })} />
              </div>
              <div className="parallax-control-row">
                <span>Coupling</span>
                <Segments label={`${channel.id} coupling`} value={channel.coupling} onChange={(coupling) => scope.channel(channel.id, { coupling })}
                  options={[{ value: "DC", label: "DC" }, { value: "AC", label: "AC" }]} />
              </div>
              <ChannelExpression channel={channel} onChange={(expression) => scope.channel(channel.id, { expression })} />
            </>
          ) : null}
        </section>
        );
      })}
      <MathSection settings={settings} onChange={(math) => scope.update({ math })} />

      <PanelGroup id="time-base" title="Time base" meta={whole ? "whole record" : `${formatQuantity(settings.secondsPerDivision, "s")}/div`}>
        <div className="parallax-control-row">
          <span>Shows</span>
          <Segments label="How much time the screen holds" value={settings.horizontal ?? "divisions"} onChange={(horizontal) => { scope.setBack(0); scope.update({ horizontal }); }}
            options={[{ value: "divisions", label: "10 div", title: "The time base times ten divisions" },
              { value: "record", label: "Whole record", title: "Everything recorded since this was chosen, the axis compressing as the run goes on" }]} />
        </div>
        <div className="parallax-control-row">
          <span>Scale</span>
          {/* Choosing a time base is choosing ten divisions: from the whole record it goes back to them. */}
          <Stepper label="Time per division" value={settings.secondsPerDivision} unit="s" minimum={1e-9} maximum={1}
            format={(value) => `${formatQuantity(value, "s")}/div`} onChange={(secondsPerDivision) => scope.update({ secondsPerDivision, horizontal: "divisions" })} />
        </div>
        <div className="parallax-control-row">
          <span>Wheel</span>
          <Segments label="The mouse wheel over the screen scales" value={settings.wheel} onChange={(wheel) => scope.update({ wheel })}
            options={[{ value: "time", label: "↔ Time", title: "The wheel scales time per division; Shift+wheel the active channel" }, { value: "volts", label: "↕ Volts", title: "The wheel scales the active channel; Shift+wheel the time" }]} />
        </div>
        <div className="parallax-control-row">
          <span>Memory</span>
          <Segments label="Samples kept" value={String(capacity)} onChange={(value) => onCapacity(Number(value))}
            options={MEMORY_SIZES.map((size) => ({ value: String(size),
              label: sampleInterval && !whole ? formatQuantity(size * sampleInterval, "s") : `${size / 1000}k`,
              title: `Keep the last ${size.toLocaleString("en")} samples${sampleInterval ? ` — ${formatQuantity(size * sampleInterval, "s")} of the circuit, one every ${formatQuantity(sampleInterval, "s")}` : ""}: how far back the screen can be dragged, and what "keep the screen" saves` }))} />
        </div>
        <p className="parallax-side-note">{whole
          ? "The whole record starts where the memory stood when it was chosen and is never cut: when the memory fills, every two samples fold into one, their peaks and mean kept — the record keeps its start at half the detail, and the run is sampled more sparsely as it grows."
          : "Memory is how much of the past is kept: drag the screen back through it. It holds samples, so a slower time base keeps more time."}</p>
      </PanelGroup>

      <PanelGroup id="trigger" title="Trigger" meta={settings.trigger.mode === "free" ? "free running" : `${settings.trigger.mode} · ${settings.trigger.source} ${EDGE_MARKS[settings.trigger.edge]}`}>
        <div className="parallax-control-row">
          <span>Mode</span>
          <Segments label="Trigger mode" value={settings.trigger.mode} onChange={(mode: TriggerMode) => scope.update({ trigger: { ...settings.trigger, mode } })}
            options={[{ value: "auto", label: "Auto", title: "Holds a trigger when there is one, runs without when there is not" },
              { value: "normal", label: "Normal", title: "Draws only what a trigger caught, and keeps it until the next" },
              { value: "single", label: "Single", title: "Catches one trigger and stops" },
              { value: "free", label: "Free", title: "No trigger: the newest sample at the right edge — a slowed circuit is seen flowing" }]} />
        </div>
        {settings.trigger.mode === "free" ? null : <>
        <div className="parallax-control-row">
          <span>Source</span>
          <Segments label="Trigger source" value={settings.trigger.source} onChange={(source) => scope.update({ trigger: { ...settings.trigger, source } })}
            options={settings.channels.filter((channel) => channel.enabled).map((channel) => ({ value: channel.id, label: channelName(channel) }))} />
        </div>
        <div className="parallax-control-row">
          <span>Edge</span>
          <Segments label="Trigger edge" value={settings.trigger.edge} onChange={(edge) => scope.update({ trigger: { ...settings.trigger, edge } })}
            options={[{ value: "rising", label: "↑", title: "Rising edge" }, { value: "falling", label: "↓", title: "Falling edge" },
              { value: "either", label: "↕", title: "Either edge" }]} />
        </div>
        <QuantityField compact label="Level" unit={triggerUnit} value={settings.trigger.level} minimum={-1000} maximum={1000}
          onChange={(level) => scope.update({ trigger: { ...settings.trigger, level } })} />
        <div className="parallax-control-row">
          <span>Position</span>
          <Segments label="Where the trigger stands on the screen" value={String(settings.trigger.position)}
            onChange={(position) => scope.update({ trigger: { ...settings.trigger, position: Number(position) } })}
            options={[{ value: "0.1", label: "10 %", title: "Near the left edge: mostly what follows the trigger" },
              { value: "0.5", label: "50 %", title: "In the middle: as much before as after" },
              { value: "0.9", label: "90 %", title: "Near the right edge: mostly what led to it" }]} />
        </div>
        </>}
      </PanelGroup>

      {recorder ? (
        <PanelGroup id="record" title="Record" meta={recorder.progress ? `${recorder.progress.received.toLocaleString("en")} / ${recorder.progress.target.toLocaleString("en")}` : recorder.recordings.length ? `${recorder.recordings.length} kept · CSV` : "CSV"}>
          <div className="parallax-control-row">
            <span>Samples</span>
            <Segments label="Samples to record" value={String(recordSize)} onChange={(value) => setRecordSize(Number(value))}
              options={RECORD_SIZES.map((size) => ({ value: String(size), label: `${size / 1000}k` }))} />
          </div>
          <div className="parallax-row">
            {recorder.progress
              ? <Tool className="parallax-grow" onClick={recorder.cancel}><ParallaxIcon name="stop" />Stop recording</Tool>
              : <Tool tone="primary" className="parallax-grow" onClick={() => recorder.record(recordSize)}><ParallaxIcon name="record" />Record {recordSize.toLocaleString("en")}</Tool>}
            <Tool icon label="Keep the screen as a recording" onClick={recorder.keep}><ParallaxIcon name="camera" /></Tool>
          </div>
          {recorder.progress ? (
            <progress className="parallax-progress" aria-label="Recording" max={recorder.progress.target} value={recorder.progress.received} />
          ) : null}
          {recorder.recordings.length ? (
            <div className="parallax-list parallax-dense parallax-recordings">
              {recorder.recordings.map((recording) => (
                <div key={recording.id} className="parallax-list-item" aria-current={recorder.viewing === recording.id ? "true" : undefined}>
                  <span className="parallax-grow parallax-ellipsis" title={recording.label}><strong className="parallax-monospace">{recording.label}</strong>
                    <span className="parallax-technical"> · {recording.time.length.toLocaleString("en")} · {formatQuantity((recording.time.at(-1) ?? 0) - (recording.time[0] ?? 0), "s")}</span></span>
                  <Tool tone="quiet" icon label={recorder.viewing === recording.id ? "Back to the live screen" : "Show it on the screen"} aria-pressed={recorder.viewing === recording.id}
                    onClick={() => recorder.view(recorder.viewing === recording.id ? null : recording.id)}><ParallaxIcon name="eye" /></Tool>
                  <Tool tone="quiet" icon label="Save as CSV" onClick={() => recorder.download(recording)}><ParallaxIcon name="download" /></Tool>
                  <Tool tone="quiet" icon label="Remove" onClick={() => recorder.remove(recording.id)}><ParallaxIcon name="trash" /></Tool>
                </div>
              ))}
            </div>
          ) : <p>Record the next samples as they arrive, or keep what is on the screen.</p>}
        </PanelGroup>
      ) : null}
    </>
  );
}

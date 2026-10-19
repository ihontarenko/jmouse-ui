import { useParallaxTransport, useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { draftOf, type ObjectDetail, ApiProblem } from "@jmouse/parallax";
import { useAsync } from "../support/useAsync";
import { ParallaxLink } from "../providers/ParallaxNavigation";
import { SimulatorInstrument } from "../circuit/SimulatorInstrument";
import {
  type BenchProbe, type CircuitDefinition, type CircuitElement, circuitFromDrawing, drawCircuit, drawingOfCircuit, elementTypes, isCircuit, layoutOfDrawing, type LiveTelemetry, parametersOf, rewiredElements, type SchematicDocument, serializeDrawing, type SheetProbe, SIMULATION_SPEEDS, wiringOf, withShownValues,
} from "@jmouse/parallax/circuit";
import { CircuitDetailsForm, circuitDetailsOf, circuitDetailsProblems, PartProperties, type CircuitDetails } from "./CircuitProperties";
import { CircuitReadings, Schematic, type SheetMeter } from "../circuit/Schematic";
import { InstrumentsPanel, MeterStrip, useInstruments, useMeterReadings } from "../meters/Instruments";
import { instrumentComponents, meterProbe, meterText } from "@jmouse/parallax/meters";
import { useSheetEditing, type SheetEditing } from "../circuit/useSheetEditing";
import { SHEET_TOOLS } from "../circuit/sheetTools";
import { EDITOR_HOTKEYS } from "../editor/editorKeys";
import { SheetToolbar } from "../circuit/SheetToolbar";
import { SheetViewMenu, useSheetLabels, type SheetOverlay } from "../circuit/SheetViewMenu";
import { BenchEnvironment } from "./BenchEnvironment";
import { PartPalette, useAvailableComponentModels } from "../circuit/PartPalette";
import { usePartLibrary } from "../providers/usePartLibrary";
import { useLiveCircuit, useLiveReading } from "../circuit/useLiveCircuit";
import { channelName, holdsWholeRecord, isIdentityExpression, measure, PlaybackClock, Recording, windowOf, type ChannelId, type SampleMemory } from "@jmouse/parallax/oscilloscope";
import { formatQuantity, ladderStep, parseQuantity } from "@jmouse/parallax/quantities";
import { OscilloscopePanel, OscilloscopeScreen, useOscilloscope, type Recorder } from "../scope/Oscilloscope";
import { cursorsStretchAvailable, nodeConnections, probesOf, replayStretch, type ReplayStretchKind } from "@jmouse/parallax/scope";
import type { PhaseDialsData } from "../circuit/PhaseDials";
import { representationLabel } from "@jmouse/parallax/computation";
import { useComputation } from "../viewers/useComputation";
import { useSpiceTransient } from "../viewers/useSpiceTransient";
import { ChoiceStepper, Segments, Tool } from "../controls/BenchControls";
import { HotkeyHelp, useHotkeys, type Hotkey } from "../controls/Hotkeys";
import { ComponentWorkbench, NEW_COMPONENT_SOURCE, type ComponentHost, type ComponentSubject } from "./ComponentWorkbench";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import {
  benchCircuit, type BenchSetup, initialSetup, netName, nodesOfCircuit, samplesForScreen, setupProblem, shareOfRealTime, terminalsOf,
} from "@jmouse/parallax/bench";
import { CircuitPanel } from "./CircuitPanel";
import { BenchGrid, PaneSplit, StageSplit } from "../controls/BenchGrid";

/**
 * The bench's views of one circuit: its sheet; the SIMULATOR, the circuit running live in time with the instruments on
 * it; and ANALYSIS, what is computed around the circuit — its frequency response, its operating point, a sweep, a
 * transient worked out at once. Live and computed were one switch on the simulator once, and it read as one thing.
 */
export type BenchView = "schematic" | "simulator" | "analysis";

/** What the bench puts in the bar its host draws around it. */
export interface BenchBarParts {
  view: BenchView;
  /** Switches between the bench's views without leaving it. */
  onView: (view: BenchView) => void;
  /** The bench's context: on the simulator the analysis, the run controls, the speed and the run's state; on the schematic its revision and size. */
  context: ReactNode;
  /** The bench's own actions, first among the bar's: whether the circuit is unsaved, and Save — only when it may be changed. */
  actions: ReactNode;
  /** Runs an edited text of the circuit on the live bench at once, from zero; nothing is saved. */
  runText: (text: string) => void;
  /** Why the live run stopped, for a text editor beside it. */
  problem: string | null;
}

export interface BenchProperties {
  /** The circuit as a subject (`catalogue:<slug>`), which a computed analysis is asked of. */
  reference: string;
  detail: ObjectDetail;
  /** Whether the reader may change and save this circuit — the host decides (Parallax: their own circuit, or a curator). */
  editable: boolean;
  /** The analysis on the bench, kept by the host (Parallax: in the address); null takes the circuit's primary one. */
  representation: string | null;
  onRepresentation: (representation: string) => void;
  /** The view the bench opens on. */
  initialView?: BenchView;
  /** Told once the circuit is saved, with the title it was saved under. */
  onSaved?: (title: string) => void;
  /** Told why a save was refused. */
  onSaveFailed?: (problem: ApiProblem) => void;
  /** The bar above the bench, drawn by the host around what the bench puts in it. */
  bar: (parts: BenchBarParts) => ReactNode;
  /** Whether the reader may change a component, and where a new one is kept — without it, components open read only. */
  components?: ComponentHost;
  /** Opens the host's own settings for how a sheet draws current, glow and leads — offered at the foot of the View menu. */
  onSheetAppearance?: () => void;
}

const LIVE = "TRANSIENT_RESPONSE";
const SAMPLE_INTERVAL_AT_START = 1e-5;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * One circuit on the workbench (Html/Parallax-UI/workbench.html, tabs Schematic and Simulator). The simulator: the
 * circuit's values and sources on the left; its drawing above the instrument in the middle; the instrument's own
 * controls on the right. The transient runs live on the server; the other analyses are computed and drawn in the
 * instrument's place. The schematic: its parts and nets, the sheet, and the chosen part.
 */
export function Bench({ reference, detail, editable, representation, onRepresentation, initialView = "simulator", onSaved, onSaveFailed, bar, components, onSheetAppearance }: BenchProperties) {
  const transport = useParallaxTransport();
  const library = useParallaxPartLibrary();
  const summary = detail.summary;
  const saved = isCircuit(detail.definition) ? detail.definition : null;
  const defaults = () => Object.fromEntries(detail.parameters.map((parameter) => [parameter.name, parameter.defaultValue]));

  // An address that names a computed analysis opens on Analysis, whatever view the bench was asked to open on.
  const [view, setView] = useState<BenchView>(() => (representation && representation !== LIVE ? "analysis" : initialView));
  const [setup, setSetup] = useState<BenchSetup | null>(() => saved ? initialSetup(saved) : null);
  const [applied, setApplied] = useState<CircuitDefinition | null>(null);
  const [values, setValues] = useState<Record<string, number>>(defaults);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  /** The component open on the bench, to read, change, import or export. */
  const [componentSubject, setComponentSubject] = useState<ComponentSubject | null>(null);
  const [circuitView, setCircuitView] = useState<"drawing" | "readings">("drawing");
  // Which texts each part carries on the sheet, and how much of its readings: the reader's habit, kept in this browser.
  const [sheetLabels, setSheetLabels] = useSheetLabels();
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const problem = setup ? setupProblem(setup) : null;

  // The analyses the circuit declares in its `view` block, in its order and with its settings — a circuit with no AC
  // source declares no frequency response, and offering one drew its DC levels as flat "gains". A circuit that declares
  // none yet is offered every analysis the engine can run on it.
  const declared = detail.representations.filter((declaration) => detail.applicableRepresentations.includes(declaration.kind));
  const analyses = declared.length ? declared.map((declaration) => declaration.kind) : detail.applicableRepresentations;
  // The simulator is the live run, always; Analysis computes what the address names, else the first the circuit declares
  // other than the transient — which it also offers, worked out at once rather than run.
  const computedChoice = representation && analyses.includes(representation) ? representation
    : analyses.find((kind) => kind !== LIVE) ?? (analyses.includes(LIVE) ? LIVE : null);
  const analysis = view === "analysis" ? computedChoice : (analyses.includes(LIVE) ? LIVE : computedChoice);
  const live = view === "simulator" && analysis === LIVE;
  const running = applied ?? saved;

  // A change of the bench is applied after a pause in typing, never on every keystroke; a bench set back to how it
  // started runs the saved circuit again.
  const untouched = useMemo(() => saved ? JSON.stringify(initialSetup(saved)) : "", [saved]);
  useEffect(() => {
    if (!setup || problem) {
      return;
    }
    const back = JSON.stringify(setup) === untouched;
    const timer = window.setTimeout(() => setApplied(back ? null : benchCircuit(setup)), 350);
    return () => window.clearTimeout(timer);
  }, [setup, problem, untouched]);

  const computation = useComputation(applied ? { objectId: summary.id, definition: applied } : { subject: reference }, analysis, values, view === "analysis",
    declared.find((declaration) => declaration.kind === analysis)?.settings);
  // The computed transient by either engine: ours, or SPICE over the saved text at the sliders' values — a second
  // opinion, so the bench's unsaved changes are not in it.
  const [engine, setEngine] = useState<"parallax" | "spice">("parallax");
  const spiceShown = view === "analysis" && analysis === LIVE && engine === "spice";
  const spice = useSpiceTransient(detail.source ?? null, values, spiceShown);
  const kept = useCallback((recording: Recording) => setRecordings((current) => [recording, ...current].slice(0, 12)), []);
  const [liveInterval, setLiveInterval] = useState(SAMPLE_INTERVAL_AT_START);
  const circuit = useLiveCircuit(summary.id, running, values, liveInterval, view !== "analysis", kept);
  const nodes = circuit.nodes.length ? circuit.nodes : nodesOfCircuit(running);
  const scope = useOscilloscope(nodes, running?.probes, running?.timePerDivision);

  // The time base decides how finely a live circuit is sampled, as on a bench oscilloscope: a thousand samples a
  // screen, asked for a moment after the wheel stops, and the circuit goes on rather than starting again.
  const timeBase = scope.settings.secondsPerDivision;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const interval = samplesForScreen(timeBase);
      setLiveInterval(interval);
      circuit.sample(interval);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `circuit.sample` is stable
  }, [timeBase]);

  // How the run is acquired is the oscilloscope's choice: every sample read — the run slowed as a fine time base needs —
  // or real time first.
  const gapless = scope.settings.acquisition !== "realtime";
  useEffect(() => {
    circuit.acquire(gapless);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `circuit.acquire` is stable
  }, [gapless]);

  // The whole record: the memory keeps the run from its start, folding when full, and the samples grow sparser as the
  // record grows — a thousand a screen still, the screen now being the record. Asked again only when the record has
  // doubled, so the run is not re-sampled every moment.
  const wholeRecord = holdsWholeRecord(scope.settings);
  const sampledEvery = useRef(liveInterval);
  sampledEvery.current = liveInterval;
  useEffect(() => {
    circuit.memory.keepWhole(wholeRecord);
    if (!wholeRecord) {
      // Back to divisions: the time base's own sampling again, not the record's sparse one.
      const interval = samplesForScreen(timeBase);
      if (interval !== sampledEvery.current) {
        setLiveInterval(interval);
        circuit.sample(interval);
      }
      return;
    }
    const timer = window.setInterval(() => {
      const memory = circuit.memory;
      const recordBase = memory.length > 1 ? (memory.lastTime() - memory.firstTime()) / 10 : 0;
      const interval = samplesForScreen(Math.max(timeBase, recordBase));
      if (interval >= sampledEvery.current * 1.9) {
        sampledEvery.current = interval;
        setLiveInterval(interval);
        circuit.sample(interval);
      }
    }, 500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `circuit.memory` and `circuit.sample` are stable
  }, [wholeRecord, timeBase]);

  const shownElements = useMemo(() => running ? withShownValues(running.elements, detail.parameters, values) : [], [running, detail.parameters, values]);
  // The meters are the instrument parts the run has: what the server reads.
  const savedDrawing = useMemo(() => saved ? drawingOfCircuit(saved) : undefined, [saved]);
  const libraryRevision = usePartLibrary(saved?.elements.map((element) => element.component ?? "").filter(Boolean) ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `libraryRevision` re-lays out a circuit placed before its symbols arrived
  const baseSheet = useMemo(() => drawCircuit(library, saved?.elements ?? [], savedDrawing), [saved, savedDrawing, libraryRevision]);
  const rewire = (document: SchematicDocument) => {
    const drawn = circuitFromDrawing(library, document);
    setSetup((current) => current && wiringOf(drawn) !== wiringOf(current.circuit.elements)
      ? { ...current, circuit: { ...current.circuit, elements: rewiredElements(current.circuit.elements, drawn), layout: layoutOfDrawing(serializeDrawing(document)) } }
      : current);
  };
  const editing = useSheetEditing(baseSheet, rewire);
  const instruments = useInstruments(shownElements, editing.document.items, editing.setItemShows);
  const meterReadings = useMeterReadings(circuit.memory, instruments.meters, circuit.playback, circuit.speed);
  const [inspectorView, setInspectorView] = useState<"oscilloscope" | "instruments" | "properties">("oscilloscope");
  // What the frame under the sheet shows: the oscilloscope's screen, the meters, or both side by side — kept per browser.
  const [instrumentView, setInstrumentView] = useState<"screen" | "meters" | "both">(() => {
    try {
      const kept = localStorage.getItem("parallax.bench.instruments");
      return kept === "meters" || kept === "both" ? kept : "screen";
    } catch {
      return "screen";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("parallax.bench.instruments", instrumentView);
    } catch {
      // A private window keeps no habit.
    }
  }, [instrumentView]);
  const instrumentSwitch = <Segments label="What the frame shows" value={instrumentView} onChange={setInstrumentView}
    options={[{ value: "screen", label: "Screen", title: "The oscilloscope's screen" },
      { value: "meters", label: instruments.meters.length ? `Meters · ${instruments.meters.length}` : "Meters", title: "The meters' displays" },
      { value: "both", label: "Both", title: "The screen and the meters side by side" }]} />;

  // The oscilloscope's channels and the meters are read alike: each a probe the server samples on every step.
  const probeKey = JSON.stringify([...probesOf(scope.settings), ...instruments.meters.map(meterProbe)]);
  useEffect(() => {
    circuit.probe(JSON.parse(probeKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeKey]);
  const drawing = useMemo(() => running ? drawingOfCircuit(running) : undefined, [running]);
  // The bench's sheet is the circuit as saved, worked on here: where a part stands is its layout and leaves the run alone;
  // a wire drawn, a part placed or removed changes the circuit, and the bench runs the circuit as drawn. What the left
  // column changes is the bench's and never reaches the sheet, so a save writes only what was drawn and set here.
  // A part's value or model values set in its properties run at once, as a moved slider does.
  const changePart = (id: string, changes: Partial<CircuitElement>) => setSetup((current) => current && {
    ...current, circuit: { ...current.circuit, elements: current.circuit.elements.map((element) => element.id === id ? { ...element, ...changes } : element) },
  });
  const sheetChanged = editing.touched;
  const categories = useAsync((signal) => transport.catalogue.categories(signal), []);
  const [details, setDetails] = useState<CircuitDetails>(() => circuitDetailsOf(detail));
  const [detailsChanged, setDetailsChanged] = useState(false);
  const detailProblems = circuitDetailsProblems(details);
  const changeDetails = (changes: Partial<CircuitDetails>) => {
    setDetails((current) => ({ ...current, ...changes }));
    setDetailsChanged(true);
    // The window is what every analysis on the bench runs over, so a new one is run at once, as a part's value is.
    const analysisWindow = changes.duration === undefined ? NaN : Number(changes.duration);
    if (analysisWindow > 0) {
      setSetup((current) => current && { ...current, circuit: { ...current.circuit, time: { minimum: 0, maximum: analysisWindow } } });
    }
  };
  const unsaved = sheetChanged || detailsChanged;
  const sheetElements = useMemo(() => editing.touched && running
    ? withShownValues(rewiredElements(running.elements, circuitFromDrawing(library, editing.document)), detail.parameters, values) : shownElements,
  [editing.touched, editing.document, running, detail.parameters, values, shownElements]);
  const sheetDrawing = useMemo(() => editing.touched ? serializeDrawing(editing.document) : drawing, [editing.touched, editing.document, drawing]);
  // Which contact of its node each probe is drawn on: where it was put, by channel — the bench's, never saved.
  const [probeContacts, setProbeContacts] = useState<Record<string, { tip?: string; clip?: string }>>({});
  const sheetProbes = useMemo<SheetProbe[]>(() => scope.settings.channels.filter((channel) => channel.enabled).map((channel) => ({
    id: channel.id, channel: channelName(channel), node: channel.node === "ground" ? "0" : channel.node,
    reference: channel.reference === "ground" ? null : channel.reference, color: channel.color,
    contact: probeContacts[channel.id]?.tip, referenceContact: probeContacts[channel.id]?.clip,
  })), [scope.settings.channels, probeContacts]);
  const placeContact = (channel: string, end: "tip" | "clip", contact: string) =>
    setProbeContacts((current) => ({ ...current, [channel]: { ...current[channel], [end]: contact } }));
  // A tip carried to another contact reads there from now on.
  const moveProbe = (channel: string, node: string, contact: string) => {
    scope.channel(channel as ChannelId, { node: node === "0" ? "ground" : node, enabled: true });
    placeContact(channel, "tip", contact);
  };
  const sheetMeters = useMemo<SheetMeter[]>(() => instruments.meters.map((meter) => ({
    id: meter.id, text: meterText(meter, instruments.modeOf(meter.id), meterReadings.now[meter.id]),
    part: meter.part,
  })), [instruments, meterReadings]);
  const [probedNets, setProbedNets] = useState(false);
  // Phase dials: every part's voltage and current at the circuit's own frequency — measured on the first channel, the
  // fundamental of what the oscilloscope sees —, worked out by the engine as a steady state and drawn by each part.
  const [phaseDials, setPhaseDials] = useState(false);
  const [measuredFrequency, setMeasuredFrequency] = useState(0);
  // The frequency the circuit is driven at, as its generator says it — `frequency = F` on its part, F as the sliders set
  // it —; measured on the first channel only when no part declares one.
  const drivenAt = useMemo(() => declaredFrequency(running?.elements ?? [], values), [running, values]);
  const dialFrequency = drivenAt?.frequency ?? measuredFrequency;
  useEffect(() => {
    if (!phaseDials || !live || drivenAt) {
      return;
    }
    const measureNow = () => {
      // The frequency is read off the first channel's crossings over whole periods, as the measurement under the screen
      // reads it — and when the screen holds too few of them it says nothing, and the last good reading stays: a
      // spectrum's peak over one period of a slowed run read 1.76 kHz for 1.2, across the resonance, and every dial
      // turned the other way.
      const reference = scope.settings.channels.find((channel) => channel.enabled);
      const reading = reference ? measure(circuit.memory, reference.id, windowOf(circuit.memory, scope.settings, 0)) : null;
      if (reading?.frequency && reading.frequency > 0) {
        // Three figures: a fundamental that wanders in its last digit asks the engine again for nothing.
        setMeasuredFrequency(Number(reading.frequency.toPrecision(3)));
      }
    };
    measureNow();
    const timer = window.setInterval(measureNow, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the memory is the session's, read on the timer
  }, [phaseDials, live, scope.settings, drivenAt]);
  const phasorComputation = useComputation(applied ? { objectId: summary.id, definition: applied } : { subject: reference }, "PHASOR_DIAGRAM", values,
    phaseDials && live && dialFrequency > 0, { frequency: dialFrequency });
  const dials = useMemo<PhaseDialsData | undefined>(() => {
    const dataset = phasorComputation.ready?.dataset;
    if (!phaseDials || dataset?.format !== "FEATURE_POINTS") {
      return undefined;
    }
    const phasors: PhaseDialsData["phasors"] = {};
    for (const feature of dataset.features) {
      const facts = feature.facts as Record<string, number | boolean>;
      if (feature.classification) {
        phasors[feature.classification] = {
          voltage: { real: Number(facts.voltage_real), imaginary: Number(facts.voltage_imaginary) },
          current: { real: Number(facts.current_real), imaginary: Number(facts.current_imaginary) },
          source: facts.source === true,
        };
      }
    }
    return {
      phasors,
      // The dials turn with the circuit's time when a turn takes longer than half a second of the screen; faster, a turn
      // would be a blur or a stroboscope's standstill, and they stand at the angle the steady state gives.
      turn: () => {
        if (dialFrequency * circuit.speed > 2) {
          return 0;
        }
        const shown = circuit.playback.shownTime(performance.now());
        return Number.isFinite(shown) ? 2 * Math.PI * dialFrequency * shown : 0;
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the playback clock is the session's
  }, [phasorComputation.ready, phaseDials, dialFrequency, circuit.speed]);
  const nodeLabels = useMemo(() => nodeConnections(shownElements), [shownElements]);

  const shown = recordings.find((recording) => recording.id === viewing) ?? null;
  const shownMemory = useMemo<SampleMemory>(() => shown ? shown.toMemory() : circuit.memory, [shown, circuit.memory]);

  const recorder: Recorder = {
    recordings,
    progress: circuit.recording,
    record: (count) => {
      setViewing(null);
      circuit.record(count);
      if (!circuit.running) {
        circuit.run();
      }
    },
    cancel: () => circuit.stopRecording(),
    keep: () => {
      const visible = windowOf(shownMemory, scope.settings, scope.back);
      const slice = shownMemory.slice(visible.start, visible.start + visible.span);
      const recording = new Recording(Date.now() % 100000, slice.time.length, `SCREEN ${formatQuantity(visible.start, "s")}`);
      recording.append(slice.time, slice.channels);
      kept(recording);
    },
    remove: (id) => {
      setRecordings((current) => current.filter((recording) => recording.id !== id));
      if (viewing === id) {
        setViewing(null);
      }
    },
    download: (recording) => download(`${summary.slug}-${recording.label.toLowerCase().replace(/\W+/g, "-")}.csv`,
      recording.toCsv(JSON.stringify({ circuit: `${summary.slug}@${detail.definitionRevision}`, values, probes: probesOf(scope.settings) }),
        // A meter's channel is in its figure's unit; an oscilloscope channel reads volts.
        (channel) => instruments.meters.find((meter) => meter.id === channel)?.unit ?? "V")),
    viewing,
    view: (id) => {
      if (id !== null) {
        circuit.pause();
      }
      scope.setBack(0);
      setViewing(id);
    },
  };

  // A probe goes on as a bench probe does: its tip on one node, then its clip — offered at once, on the next click; the
  // same node again, or Escape, leaves the clip on ground.
  const [probing, setProbing] = useState<{ channel: ChannelId; tip: string } | null>(null);
  // An instrument is a part: put in hand, placed with a click, wired as on a bench — its displays show beside the screen.
  const placeInstrument = (reference: string) => {
    setProbing(null);
    void editing.placeComponent(reference);
    setInstrumentView((view) => view === "screen" ? "both" : view);
  };
  const placingInstrument = editing.placement?.component ?? null;
  const attachProbe = (node: string, contact: string) => {
    const picked = node === "0" ? "ground" : node;
    if (!probing) {
      scope.channel(scope.settings.active, { node: picked, reference: "ground", enabled: true });
      placeContact(scope.settings.active, "tip", contact);
      setProbing({ channel: scope.settings.active, tip: picked });
      return;
    }
    scope.channel(probing.channel, { reference: picked === probing.tip ? "ground" : picked });
    placeContact(probing.channel, "clip", contact);
    setProbing(null);
  };
  useEffect(() => {
    if (!probing) {
      return;
    }
    const groundTheClip = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProbing(null);
      }
    };
    window.addEventListener("keydown", groundTheClip);
    return () => window.removeEventListener("keydown", groundTheClip);
  }, [probing]);
  const probingName = probing ? channelName(scope.settings.channels.find((channel) => channel.id === probing.channel)!) : "";
  // What the right column shows: a panel the analysis has, or the properties — which a part chosen on the sheet opens,
  // unless the click was placing a meter on it.
  const shownInspector = !live && inspectorView !== "properties" ? "properties" : !editable && inspectorView === "properties" ? "oscilloscope" : inspectorView;
  const chosenPart = editing.selection?.kind === "item" ? editing.selection.id : null;
  useEffect(() => {
    if (editable && chosenPart) {
      setInspectorView("properties");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a newly chosen part opens its properties
  }, [chosenPart]);
  // The left column holds the circuit's values, or — for whoever may change the circuit — the parts to build it from.
  // A circuit with nothing drawn yet opens on its parts.
  const [sideView, setSideView] = useState<"values" | "parts">(() => editable && !saved?.elements.length ? "parts" : "values");
  // The palette and the instruments a bench can place come from one list of components.
  const componentModels = useAvailableComponentModels(detail.owner, editable);
  // What a component is comes with its model, so the instruments are known once the models have arrived.
  const componentLibrary = usePartLibrary(componentModels.map((model) => model.reference));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `componentLibrary` is the moment the models arrived
  const instrumentModels = useMemo(() => instrumentComponents(library, componentModels), [componentModels, componentLibrary]);
  const removePart = (part: string) => editing.removeItem(part);
  const sideSwitch = <div className="parallax-inspector-switch">
    <Segments wide label="What the column holds" value={sideView} onChange={setSideView}
      options={[{ value: "values", label: "Values" }, { value: "parts", label: "Parts", title: "Components to place on the sheet" }]} />
  </div>;
  const [saving, setSaving] = useState(false);
  // One save for the circuit: the sheet as drawn (parts, wires, layout), its own fields and parameters, and the
  // oscilloscope's channels and the meters, which are its `probes` block — patched line by line, so a comment or a
  // hand-aligned line in its text survives.
  const saveCircuit = async () => {
    if (!detail.source || !saved) {
      return;
    }
    if (Object.keys(detailProblems).length) {
      editing.select(null);
      setInspectorView("properties");
      return;
    }
    const probes: BenchProbe[] = [
      // A current clamp is saved as one — `CH2 current R1` —: written as a voltage on ground, it came back as a probe on 0.
      ...scope.settings.channels.filter((channel) => channel.enabled).map((channel): BenchProbe => ({
        id: channel.id, scale: channel.voltsPerDivision, mode: null, expression: isIdentityExpression(channel.expression) ? null : channel.expression!.trim(),
        ...(channel.quantity === "current"
          ? { measure: "current", target: channel.part ?? "", reference: null }
          : { measure: "voltage", target: channel.node === "ground" ? "0" : channel.node, reference: channel.reference === "ground" ? null : channel.reference }) })),
    ];
    const definition: CircuitDefinition = {
      // The time base is saved as the channels' scales are: the circuit opens on the screen it was saved with.
      ...saved, probes, timePerDivision: scope.settings.secondsPerDivision, time: { minimum: 0, maximum: Number(details.duration) },
      ...(sheetChanged ? { elements: circuitFromDrawing(library, editing.document), layout: layoutOfDrawing(serializeDrawing(editing.document)) } : {}),
    };
    const title = details.title.trim();
    setSaving(true);
    try {
      const patched = await transport.documents.schematic(detail.source, definition, parametersOf(definition, details.parameters), title,
        details.summary.trim() || title, details.category);
      await transport.catalogue.update(summary.id, detail.version, { ...draftOf(detail), source: patched.source });
      onSaved?.(title);
    } catch (failure) {
      if (failure instanceof ApiProblem) {
        onSaveFailed?.(failure);
      }
    } finally {
      setSaving(false);
    }
  };
  const failure = live ? circuit.problem : computation.error?.detail ?? null;
  // A replay plays a stretch of the memory again through the playback clock; the run is paused under it.
  const replay = useSyncExternalStore(circuit.playback.subscribeReplay, () => circuit.playback.replay);
  const [replayKind, setReplayKind] = useState<ReplayStretchKind>("memory");
  const startReplay = (kind: ReplayStretchKind) => {
    const stretch = replayStretch(circuit.memory, scope.settings, kind, scope.back, circuit.playback.shownTime(performance.now()));
    if (stretch) {
      setReplayKind(kind);
      scope.setBack(0);
      circuit.replay(stretch);
    }
  };
  const state = live
    ? (circuit.problem ? "Stopped" : circuit.busy ? "Starting" : circuit.running ? "Running" : replay ? "Replaying" : circuit.memory.length ? "Paused" : "Ready")
    : (computation.computing ? "Computing" : computation.error ? "Failed" : "Computed");
  const stateTone = state === "Running" ? "parallax-badge parallax-good parallax-live" : state === "Stopped" || state === "Failed" ? "parallax-badge parallax-danger" : state === "Starting" || state === "Computing" ? "parallax-badge parallax-accent" : "parallax-badge";

  const sheet = live
    ? (circuitView === "drawing"
      ? <LiveSchematic telemetry={circuit.telemetry} ambient={setup?.temperature ?? 25} flow={circuit.flow} recent={circuit.recent} elements={sheetElements} drawing={sheetDrawing} onProbeSelect={attachProbe} onProbeMove={moveProbe} editing={editable ? editing : undefined} probes={sheetProbes} meters={sheetMeters} probedNets={probedNets} dials={dials} sheetLabels={sheetLabels} probeHint=""
        caption={`${summary.title} · r${detail.definitionRevision}`} />
      : <div data-parallax-part="sheet" className="parallax-sheet parallax-readings-sheet"><LiveReadings telemetry={circuit.telemetry} /></div>)
    : <Schematic elements={shownElements} drawing={drawing} sheetLabels={sheetLabels} caption={`${summary.title} · r${detail.definitionRevision}`} />;

  // The frame under the sheet: the oscilloscope's screen, the meters, or both side by side.
  const screen = <OscilloscopeScreen memory={shownMemory} scope={scope} live={!shown} clock={shown ? undefined : circuit.playback} onSingleShot={circuit.pause}
    replaying={live && !shown ? { stretch: replayKind, start: startReplay, end: () => circuit.replay(null) } : undefined}
    leading={instrumentSwitch}
    waiting={shown ? null : circuit.problem ? circuit.problem : circuit.busy ? "Solving the first steps…" : null}
    idle="Press Run — the circuit starts on the server" />;
  const meterStrip = <MeterStrip instruments={instruments} readings={meterReadings} components={instrumentModels} onPlace={placeInstrument} placing={placingInstrument}
    onRemove={editable ? removePart : undefined}
    leading={instrumentView === "meters" ? instrumentSwitch : undefined} />;

  // The sheet's toolbar holds what is DONE to the sheet — the tools, the edits, the history; how it LOOKS is one View
  // menu at its end. What the pointer will do next is the status line's, under the stage, where it does not push the
  // tools onto a second row.
  const drawingShown = live && circuitView === "drawing";
  const overlays: SheetOverlay[] = drawingShown ? [
    { label: "Probed nets", description: "every wire of a probed node banded in its probe's colour", on: probedNets, onChange: setProbedNets },
    { label: "Phase dials", on: phaseDials, onChange: setPhaseDials,
      description: dialFrequency
        ? `U and I by every part at ${formatQuantity(dialFrequency, "Hz")} — ${drivenAt ? `${drivenAt.part}'s frequency` : "measured on the first channel"}, turning in slow motion`
        : "U and I by every part — no frequency yet: no part declares one and the screen holds too few periods to measure it" },
  ] : [];
  const stageHint = drawingShown ? (probing
    ? <span className="parallax-hint parallax-probing" role="status"><strong>{probingName}</strong> tip on <strong>{probing.tip}</strong> — now click where its clip goes,
      or <Tool tone="quiet" onClick={() => setProbing(null)}>clip on ground</Tool></span>
    : editable && !editing.document.items.length && !editing.placement ? <span className="parallax-hint" role="status">An empty sheet: choose a part on the left, then click where it goes.</span>
    : editable && (editing.tool !== "select" || editing.placement) ? <span className="parallax-hint" role="status">{editing.message}</span>
    : <span className="parallax-hint">Click a node: <strong>{channelName(scope.settings.channels.find((channel) => channel.id === scope.settings.active)!)}</strong>'s tip, then its clip</span>)
    : <span className="parallax-hint">{live ? "Every node's voltage and every part's power, current and temperature" : analysis ? representationLabel(analysis) : "No analysis"}</span>;

  const simulatorStage = (
    <>
      <div data-parallax-part="stage-toolbar" className="parallax-stage-toolbar">
        {drawingShown && editable ? <SheetToolbar editing={editing} /> : <span className="parallax-title">{live && circuitView === "readings" ? "Readings" : "Circuit"}</span>}
        <SheetViewMenu shows={live ? circuitView : "drawing"} onShows={live ? setCircuitView : undefined} labels={sheetLabels} onLabels={setSheetLabels}
          overlays={overlays} appearance={onSheetAppearance ? { label: "Current, glow and leads…", open: onSheetAppearance } : undefined} />
      </div>
      {running ? (
        <StageSplit storageKey="simulator" topName="Circuit sheet" label={live ? "Resize the oscilloscope" : "Resize the analysis"} name={live ? "Oscilloscope and meters" : "Analysis"}
          top={sheet}
          bottom={live ? (
            <div className="parallax-bench-instruments" data-parallax-part="bench-instruments" data-state={instrumentView}>
              {instrumentView === "both" ? <PaneSplit storageKey="simulator.meters" label="Resize the meters" left={screen} right={meterStrip} />
                : instrumentView === "screen" ? screen : meterStrip}
            </div>
          ) : (
            <section data-parallax-part="stage-instrument" className="parallax-stage-instrument" aria-label={analysis ? representationLabel(analysis) : "Analysis"}>
              {analysis ? <SimulatorInstrument representation={analysis} computation={spiceShown ? spice : computation} title={spiceShown ? `${summary.title} · ngspice` : summary.title} facts
                focus={scope.settings.channels.filter((channel) => channel.enabled).map((channel) => channel.node)}
                context={{ circuit: `${summary.slug}@${detail.definitionRevision}`, settings: JSON.stringify({ values }) }} />
                : <p className="parallax-side-note">This circuit admits no analysis yet.</p>}
            </section>
          )} />
      ) : <div data-parallax-part="stage-body" className="parallax-stage-body"><p className="parallax-side-note">This circuit has no netlist to draw.</p></div>}
      <div data-parallax-part="stage-foot" className="parallax-stage-foot">
        {failure ? <span className="parallax-diagnostic parallax-danger" role="alert"><ParallaxIcon name="error" />{failure}</span> : stageHint}
        <span className="parallax-push">{shownElements.length} parts · {nodes.length} nodes · {live ? `${scope.settings.channels.filter((channel) => channel.enabled).length} channels · ${formatQuantity(liveInterval, "s")} a sample` : "computed on the server"}</span>
      </div>
    </>
  );

  // The part chosen on the sheet being worked on, edited — one inspector, whichever view the sheet is worked on in.
  const partProperties = editing.selectedItem ? (
    <PartProperties key={editing.selectedItem.id} item={editing.selectedItem} editing={editing}
      onOpenComponent={(componentReference) => setComponentSubject({ kind: "saved", reference: componentReference })}
      onElementChange={(changes) => changePart(editing.selectedItem!.id, changes)} />
  ) : null;

  const simulator = (
    <BenchGrid storageKey="simulator"
      sideLabel="Values and simulation"
      side={setup ? (sideView === "parts" && editable ? <>{sideSwitch}<PartPalette models={componentModels} editing={editing} actions={<>
        <Tool onClick={() => setComponentSubject({ kind: "text", source: NEW_COMPONENT_SOURCE, title: "New component" })}><ParallaxIcon name="plus" />New component</Tool>
        <label className="parallax-button parallax-small" title="A .jmx component, or a SPICE netlist or .subckt — converted to jMX">
          <ParallaxIcon name="upload" />Import…
          <input type="file" accept=".jmx,.cir,.sp,.spice,.net,.lib,.sub,.txt" className="parallax-screen-reader-only" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void openFile(file);
            }
          }} />
        </label>
      </>} /></> : <>{editable ? sideSwitch : null}
        <CircuitPanel parameters={detail.parameters} values={values}
          onValue={(name, value) => setValues((current) => ({ ...current, [name]: value }))} onResetValues={() => setValues(defaults())}
          controls={live ? circuit.controls : []} onControl={circuit.set}
          setup={setup} onSetup={(change) => setSetup((current) => current && change(current))} problem={problem}
          onResetSetup={() => { setApplied(null); setSetup(saved ? initialSetup(saved) : null); editing.reset(); }} live={live} saved={saved ?? setup.circuit} /></>
      ) : <div className="parallax-side-note"><span>This circuit has no netlist to set up.</span></div>}
      stage={simulatorStage}
      inspectorLabel={inspectorView === "oscilloscope" ? "Oscilloscope controls" : inspectorView === "instruments" ? "Instruments" : "Properties"}
      inspector={live || editable ? (
        <>
          <div className="parallax-inspector-switch">
            <Segments wide label="What the panel holds" value={shownInspector} onChange={setInspectorView}
              options={[
                ...(live ? [{ value: "oscilloscope" as const, label: "Oscilloscope" },
                  { value: "instruments" as const, label: instruments.meters.length ? `Instruments · ${instruments.meters.length}` : "Instruments" }] : []),
                ...(editable ? [{ value: "properties" as const, label: "Properties", title: "The part chosen on the sheet, or the circuit's own fields" }] : []),
              ]} />
          </div>
          {shownInspector === "oscilloscope" ? (
            <OscilloscopePanel scope={scope} nodes={nodes} parts={(running?.elements ?? []).map((element) => element.id)} nodeLabels={nodeLabels} sampleInterval={liveInterval} capacity={circuit.memory.capacity}
              onCapacity={(capacity) => { circuit.resize(capacity); scope.setBack(0); }}
              recorder={recorder} />
          ) : shownInspector === "instruments" ? (
            <InstrumentsPanel instruments={instruments} readings={meterReadings} components={instrumentModels} onPlace={placeInstrument} placing={placingInstrument}
              onRemove={editable ? removePart : undefined} />
          ) : partProperties ? partProperties : (
            <CircuitDetailsForm details={details} onChange={changeDetails} categories={categories.data} problems={detailProblems} />
          )}
        </>
      ) : undefined} />
  );

  const schematic = (
    <SchematicView summaryTitle={summary.title} revision={detail.definitionRevision} description={summary.summary} elements={shownElements} drawing={drawing}
      telemetry={circuit.telemetry} selected={selectedPart} onSelect={setSelectedPart}
      editing={editable ? editing : undefined} editedElements={sheetElements} editedDrawing={sheetDrawing} partProperties={partProperties} />
  );

  /** A file read in from the palette: a jMX component as it is, anything else as SPICE, converted. */
  const openFile = async (file: File) => {
    const text = await file.text();
    if (/\.jmx$/i.test(file.name)) {
      setComponentSubject({ kind: "text", source: text, title: file.name.replace(/\.jmx$/i, "") });
      return;
    }
    try {
      const imported = await transport.documents.spiceImport(text, file.name.replace(/\.[^.]+$/, ""));
      setComponentSubject({ kind: "text", source: imported.source, title: file.name, notes: imported.notes });
    } catch (failure) {
      setComponentSubject({ kind: "text", source: text, title: file.name,
        notes: [failure instanceof ApiProblem ? failure.detail : `${file.name} could not be read as SPICE.`] });
    }
  };

  // Every shortcut of the bench in one list: what runs them, and what the help lists — the sheet's and the screen's
  // own keys are listed beside them, so the list is the whole truth.
  const speedIndex = SIMULATION_SPEEDS.findIndex((choice) => Number(choice.value) === circuit.speed);
  const paceBy = (step: 1 | -1) => {
    const next = SIMULATION_SPEEDS[Math.max(0, Math.min(SIMULATION_SPEEDS.length - 1, speedIndex + step))];
    if (next) {
      circuit.pace(Number(next.value));
    }
  };
  const cursorModes = ["off", "time", "volts"] as const;
  const cursorMode = !scope.settings.cursors.enabled ? "off" : scope.settings.cursors.axis ?? "time";
  const hotkeys: Hotkey[] = [
    { keys: "Space", label: replay ? "Play or pause the replay" : circuit.running ? "Pause" : "Run", group: "Run", enabled: live && view === "simulator" && Boolean(running),
      run: () => (replay ? replay.play(!replay.playing) : circuit.running ? circuit.pause() : (setViewing(null), circuit.run())) },
    { keys: "L", label: replay ? "Leave the replay, back to live" : "Replay the memory — or A–B with the Δt cursors on", group: "Run",
      enabled: live && view === "simulator" && (Boolean(replay) || circuit.memory.length > 1),
      run: () => (replay ? circuit.replay(null) : startReplay(cursorsStretchAvailable(scope.settings) ? "cursors" : "memory")) },
    { keys: ".", label: "Step, while paused", group: "Run", enabled: live && view === "simulator" && !circuit.running && !circuit.busy, run: circuit.step },
    { keys: "Home", label: "Restart from zero", group: "Run", enabled: live && view === "simulator", run: () => { circuit.reset(); scope.setBack(0); } },
    { keys: "[", label: "Slower", group: "Run", enabled: live, run: () => paceBy(-1) },
    { keys: "]", label: "Faster", group: "Run", enabled: live, run: () => paceBy(1) },
    { keys: "-", label: "More time per division", group: "Oscilloscope", enabled: view === "simulator",
      run: () => scope.update({ secondsPerDivision: Math.min(1, ladderStep(scope.settings.secondsPerDivision, 1)), horizontal: "divisions" }) },
    { keys: "=", label: "Less time per division", group: "Oscilloscope", enabled: view === "simulator",
      run: () => scope.update({ secondsPerDivision: Math.max(1e-9, ladderStep(scope.settings.secondsPerDivision, -1)), horizontal: "divisions" }) },
    { keys: "O", label: "Whole record (overview) or ten divisions", group: "Oscilloscope", enabled: view === "simulator",
      run: () => { scope.setBack(0); scope.update({ horizontal: holdsWholeRecord(scope.settings) ? "divisions" : "record" }); } },
    { keys: "F", label: "Fit every trace", group: "Oscilloscope", enabled: view === "simulator", run: () => scope.fit(circuit.memory) },
    { keys: "Y", label: "YT or XY", group: "Oscilloscope", enabled: view === "simulator",
      run: () => scope.update({ display: scope.settings.display === "xy" ? "time" : "xy" }) },
    { keys: "P", label: "Phosphor on or off", group: "Oscilloscope", enabled: view === "simulator", run: () => scope.update({ phosphor: !scope.settings.phosphor }) },
    { keys: "T", label: "Trails on or off", group: "Oscilloscope", enabled: view === "simulator", run: () => scope.update({ trails: !scope.settings.trails }) },
    { keys: "C", label: "Cursors: off, Δt, ΔV", group: "Oscilloscope", enabled: view === "simulator", run: () => {
      const next = cursorModes[(cursorModes.indexOf(cursorMode) + 1) % cursorModes.length];
      scope.update({ cursors: next === "off" ? { ...scope.settings.cursors, enabled: false } : { ...scope.settings.cursors, enabled: true, axis: next } });
    } },
    { keys: "← / →", label: "Look back or forward in time (screen focused)", group: "Oscilloscope" },
    { keys: "↑ / ↓", label: "Move the active channel (screen focused)", group: "Oscilloscope" },
    { keys: "Double click", label: "Fit every trace", group: "Oscilloscope" },
    { keys: "1", label: "Schematic", group: "Bench", run: () => setView("schematic") },
    { keys: "2", label: "Simulator", group: "Bench", run: () => setView("simulator") },
    { keys: "3", label: "Analysis", group: "Bench", run: () => setView("analysis") },
    { keys: "E", label: "Expand the oscilloscope or the plot over the whole stage, or give the sheet back", group: "Bench" },
    { keys: "Ctrl+S", label: "Save the circuit", group: "Bench", enabled: Boolean(editable && detail.source), run: () => void saveCircuit() },
    { keys: "?", label: "This list", group: "Bench", run: () => setShortcutsOpen(true) },
    // The sheet's keys from the editor's own table: listed from what the keys do, so the list cannot drift from them.
    ...EDITOR_HOTKEYS.map((hotkey) => ({ ...hotkey, group: "Sheet (sheet focused)" })),
    ...SHEET_TOOLS.filter((tool) => tool.key !== "v" && tool.key !== "h").map((tool) => ({ keys: tool.key.toUpperCase(), label: tool.label, group: "Sheet (sheet focused)" })),
  ];
  useHotkeys(hotkeys);

  const context = view !== "schematic" ? (
    <>
      {view === "analysis" && analyses.length > 0 && analysis ? (
        <Segments label="Analysis" value={analysis} onChange={onRepresentation}
          options={analyses.map((kind) => ({ value: kind, label: representationLabel(kind),
            title: kind === LIVE ? "The transient worked out at once over the analysis window — the live run is the Simulator" : representationLabel(kind) }))} />
      ) : null}
      {view === "analysis" && analysis === LIVE ? (
        <Segments label="Engine" value={engine} onChange={setEngine}
          options={[{ value: "parallax", label: "Parallax", title: "The transient by this engine" },
            { value: "spice", label: "ngspice", title: spice.notes.length
              ? `The same circuit run by ngspice, at the sliders' values, from the saved text. The deck leaves out: ${spice.notes.join("; ")}`
              : "The same circuit run by ngspice, at the sliders' values, from the saved text — a second opinion on this engine's answer" }]} />
      ) : null}
      {live ? (
        <div className="parallax-button-group">
          <Tool tone={circuit.running ? "stop" : "go"} aria-pressed={circuit.running} disabled={!running} onClick={() => circuit.running ? circuit.pause() : (setViewing(null), circuit.run())}>
            <ParallaxIcon name={circuit.running ? "pause" : "play"} /><span>{circuit.running ? "Pause" : "Run"}</span>
          </Tool>
          <Tool disabled={circuit.running || circuit.busy} onClick={circuit.step}><ParallaxIcon name="step" /><span>Step</span></Tool>
          <Tool icon label="Restart from zero" onClick={() => { circuit.reset(); scope.setBack(0); }}><ParallaxIcon name="reset" /></Tool>
          {/* Replay is a way of playing the run, so it stands with Run and Step, not on the screen's strip. */}
          <Tool icon aria-pressed={Boolean(replay)} disabled={!replay && circuit.memory.length < 2}
            onClick={() => (replay ? circuit.replay(null) : startReplay(cursorsStretchAvailable(scope.settings) ? "cursors" : "memory"))}
            label={replay ? "Leave the replay, back to live (L)" : cursorsStretchAvailable(scope.settings)
              ? "Replay the stretch between the cursors A and B, round and round — the run pauses (L)"
              : "Replay what the memory holds, round and round — the screen, the sheet and the meters play it again; the run pauses (L)"}>
            <ParallaxIcon name="loop" />
          </Tool>
        </div>
      ) : null}
      {live ? <ChoiceStepper label="Simulation speed" value={String(circuit.speed)} onChange={(value) => circuit.pace(Number(value))} choices={SIMULATION_SPEEDS} /> : null}
      <span data-parallax-part="run-status" className="parallax-run-status">
        <span data-parallax-part="run-state" data-state={state.toLowerCase()} className={stateTone} role="status">{state}</span>
        {live ? <LiveTime telemetry={circuit.telemetry} /> : null}
      </span>
      {live && circuit.running ? <LiveTempo telemetry={circuit.telemetry} playback={circuit.playback} requested={circuit.speed} /> : null}
      {setup ? <Segments label="How parts take overheating" value={setup.realistic ? "realistic" : "ideal"}
        onChange={(mode) => setSetup((current) => current && ({ ...current, realistic: mode === "realistic" }))}
        options={[{ value: "ideal", label: "Ideal", title: "A part past its temperature limit is only marked" },
          { value: "realistic", label: "Realistic", title: "A part past its temperature limit fails as its component says: open or short" }]} /> : null}
      {setup ? <BenchEnvironment setup={setup} onSetup={(change) => setSetup((current) => current && change(current))} /> : null}
    </>
  ) : (
    <span data-parallax-part="run-status" className="parallax-run-status"><span className="parallax-badge">Revision r{detail.definitionRevision}</span><span>{shownElements.length} parts · {nodesOfCircuit(running).length + 1} nets · {running?.layout ? "routed from the layout block" : "placed automatically"}</span></span>
  );
  const actions = editable && detail.source ? (
    <>
      {unsaved ? <span className="parallax-badge parallax-warn">Unsaved</span> : null}
      <Tool tone="primary" busy={saving} onClick={() => void saveCircuit()}
        title="Write the sheet as drawn, the circuit's fields and parameters, and the bench's probes and meters into the circuit"><ParallaxIcon name="save" /><span>Save</span></Tool>
    </>
  ) : null;
  const runText = (text: string) => {
    setView("simulator");
    void circuit.runText(text);
  };

  return (
    <div className="parallax-workbench" data-parallax-part="workbench">
      {bar({ view, onView: setView, context, runText, problem: circuit.problem, actions: <>
        {actions}
        <Tool icon label="Keyboard shortcuts (?)" aria-haspopup="dialog" onClick={() => setShortcutsOpen(true)}><span aria-hidden="true">?</span></Tool>
      </> })}
      <HotkeyHelp hotkeys={hotkeys} open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {componentSubject ? <ComponentWorkbench key={componentSubject.kind === "saved" ? componentSubject.reference : componentSubject.title}
        subject={componentSubject} host={components} onClose={() => setComponentSubject(null)}
        onSaved={(componentReference) => {
          // The sheet's parts were pinned to the revision they were placed with: they move to the one just saved.
          editing.retarget(componentReference.split("@")[0], componentReference);
          setComponentSubject({ kind: "saved", reference: componentReference });
        }} /> : null}
      {view === "schematic" ? schematic : simulator}
    </div>
  );
}

/** The circuit's own time: how far it has run. */
function LiveTime({ telemetry }: { telemetry: LiveTelemetry }) {
  const { reached } = useLiveReading(telemetry);
  return <span>t <strong className="parallax-steady parallax-width-9">{formatQuantity(reached, "s")}</strong></span>;
}

/**
 * How the run keeps the pace it was asked for, each figure named, beside the speed chosen: the speed it really plays
 * at, how busy the server is, and the buffer — what the server computed that the screen has not played yet. When it
 * plays slower than asked it says why: the server at its limit, or frames reaching the screen late while the server
 * idles — the browser or the network.
 */
function LiveTempo({ telemetry, playback, requested }: { telemetry: LiveTelemetry; playback: PlaybackClock; requested: number }) {
  const { speed, load, held, interval } = useLiveReading(telemetry);
  const buffered = playback.bufferedMilliseconds();
  const fill = Math.min(1, buffered / (2 * PlaybackClock.LEAD_MILLISECONDS));
  const behind = speed !== null && speed < requested * 0.9;
  // The server says when it holds a lower speed; a run slower than the server plays is the browser's or the network's.
  const serverBound = behind && held !== null && held < requested * 0.9;
  const samples = interval ? `${Math.round(requested / interval).toLocaleString()} samples a second, one every ${formatQuantity(interval, "s")}` : null;
  const verdict = !behind ? null : serverBound && held !== null
    ? `held at ${shareOfRealTime(held)} — the fastest the server keeps up with on this circuit`
    : `${slowdownOf(requested, speed)} slower than asked, not from the server — frames reach the screen late`;
  const serverShare = load !== null ? Math.round(Math.min(1, load) * 100) : null;
  // One readout of a fixed width: the speed reached, the buffer under it as a hairline, the server's share. Each figure
  // is explained in its title; spelled out with labels and a "slow" badge, it took 400 px that appeared only while a
  // circuit ran, and pushed the bar's end over the bench mode and Save.
  const explanation = [
    `Plays ${speed !== null ? shareOfRealTime(speed) : "…"} of ${shareOfRealTime(requested)} asked${samples ? ` — ${samples}` : ""}.`,
    verdict ? `Behind: ${verdict}.` : null,
    `Server: ${serverShare ?? "…"} % of each 40 ms frame spent on this circuit; near 100 % it cannot play faster.`,
    `Buffer: ${Math.round(buffered)} ms computed ahead and not yet played — empty, the screen waits for the server.`,
  ].filter(Boolean).join("\n");
  return (
    <span className="parallax-tempo" role="group" aria-label={explanation} title={explanation} data-behind={behind || undefined}>
      <span className={`parallax-tempo-figure${behind ? " parallax-limited" : ""}`}>
        {behind ? <ParallaxIcon name="warning" /> : null}
        <strong className="parallax-steady parallax-width-5">{speed !== null ? shareOfRealTime(speed) : "…"}</strong>
        <span data-parallax-part="meter" className={`parallax-meter parallax-buffer-meter${fill < 0.25 ? " parallax-low" : ""}`} role="meter" aria-label="Buffer" aria-valuemin={0}
          aria-valuemax={2 * PlaybackClock.LEAD_MILLISECONDS} aria-valuenow={Math.round(buffered)}><span style={{ width: `${fill * 100}%` }} /></span>
      </span>
      <span className={`parallax-tempo-figure parallax-tempo-server${serverBound ? " parallax-limited" : ""}`}>
        <small>server</small><strong><span className="parallax-steady parallax-width-3">{serverShare ?? "…"}</span>%</strong>
      </span>
    </span>
  );
}

/** How many times slower a run plays than it was asked to: «7×». */
function slowdownOf(requested: number, speed: number | null): string {
  return speed && speed > 0 ? `${Number((requested / speed).toPrecision(2))}×` : "far";
}

/**
 * The drawing following the running circuit — wires coloured by voltage, current moving along them, parts glowing by
 * their power —, redrawn as it changes; nothing else on the bench is.
 */
function LiveSchematic({ telemetry, ...properties }: Omit<ComponentProps<typeof Schematic>, "levels" | "loads"> & { telemetry: LiveTelemetry }) {
  const { levels, parts } = useLiveReading(telemetry);
  return <Schematic {...properties} levels={Object.keys(levels).length ? levels : undefined}
    loads={Object.keys(parts).length ? parts : undefined} readings={false} />;
}

/**
 * The frequency a circuit is driven at, as a part declares it: the first part with a `frequency` setting — a generator —,
 * the setting read as written (`1.2 kHz`) or as the parameter it names, at the value the sliders give it. Null when no
 * part declares one, or it is an expression this cannot read.
 */
function declaredFrequency(elements: readonly CircuitDefinition["elements"][number][], values: Record<string, number>): { part: string; frequency: number } | null {
  for (const element of elements) {
    const written = element.overrides?.frequency ?? null;
    if (!written) {
      continue;
    }
    const named = values[written.trim()];
    if (Number.isFinite(named) && named > 0) {
      return { part: element.id, frequency: named };
    }
    try {
      const frequency = parseQuantity(written, "Hz");
      if (frequency > 0) {
        return { part: element.id, frequency };
      }
    } catch {
      // An expression: not this function's to evaluate.
    }
  }
  return null;
}

/** The running circuit's readings as text, following it like the drawing does. */
function LiveReadings({ telemetry }: { telemetry: LiveTelemetry }) {
  const { levels, parts } = useLiveReading(telemetry);
  if (!Object.keys(levels).length) {
    return <p className="parallax-side-note">Run the circuit to read its voltages and loads.</p>;
  }
  return <CircuitReadings levels={levels} loads={parts} />;
}

/**
 * The schematic tab: the parts and the nets on the left, the sheet in the middle, and the chosen part on the right —
 * its pins and their nets (with the voltage while the circuit runs), what it is, and the circuit's description.
 */
function SchematicView({ summaryTitle, revision, description, elements, drawing, telemetry, selected, onSelect, editing, editedElements, editedDrawing, partProperties }: {
  summaryTitle: string;
  revision: number;
  description?: string | null;
  elements: readonly CircuitElement[];
  drawing?: string;
  telemetry: LiveTelemetry;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /**
   * The sheet being worked on — the same one the Simulator edits —, when the reader may edit the circuit: Edit turns the
   * drawing here into that editor, with its toolbar and its part inspector. Absent, the view only shows.
   */
  editing?: SheetEditing;
  editedElements: readonly CircuitElement[];
  editedDrawing?: string;
  /** The inspector of the part chosen on the sheet being worked on, as the Simulator shows it. */
  partProperties: ReactNode;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const editingNow = mode === "edit" ? editing : undefined;
  const { levels } = useLiveReading(telemetry);
  const nets = useMemo(() => {
    const byNet = new Map<string, string[]>();
    for (const element of elements) {
      for (const [terminal, node] of terminalsOf(element)) {
        const name = netName(node);
        byNet.set(name, [...(byNet.get(name) ?? []), element.type === "MODEL" ? `${element.id}.${terminal}` : element.id]);
      }
    }
    return [...byNet.entries()].sort(([first], [second]) => first === "ground" ? 1 : second === "ground" ? -1 : first.localeCompare(second));
  }, [elements]);
  const part = elements.find((element) => element.id === selected) ?? null;
  const component = part?.type === "MODEL" ? part.component ?? "" : part ? elementTypes[part.type].component : "";
  const componentSlug = component.split("@")[0];
  const voltage = (node: string) => node === "0" || node === "" ? 0 : levels[node];
  return (
    <BenchGrid storageKey="schematic"
      sideLabel="Parts and nets"
      side={
        <>
          <div className="parallax-side-group parallax-flush">
            <h3>Parts <span className="parallax-push">{elements.length}</span></h3>
            <div className="parallax-list parallax-dense" role="listbox" aria-label="Parts">
              {elements.map((element) => (
                <button key={element.id} type="button" role="option" className="parallax-list-item" aria-selected={selected === element.id} onClick={() => onSelect(element.id)}>
                  <span className="parallax-kind">{elementTypes[element.type].prefix}</span>{element.id}
                  <span className="parallax-muted parallax-ellipsis">{element.type === "MODEL" ? element.component : elementTypes[element.type].label.toLowerCase()}</span>
                  <span className="parallax-value">{element.value ?? "—"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="parallax-side-group parallax-flush">
            <h3>Nets <span className="parallax-push">{nets.length}</span></h3>
            <div className="parallax-list parallax-dense">
              {nets.map(([net, members]) => (
                <div key={net} className="parallax-list-item">
                  <span className="parallax-swatch" style={{ background: net === "ground" ? "var(--parallax-muted)" : "var(--parallax-wire)" }} />{net}
                  <span className="parallax-value" title={members.join(", ")}>{members.join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="parallax-side-note">
            <span>Every part is drawn from its symbol document; the wires follow the circuit's <code className="parallax-inline">layout</code> block.</span>

          </div>
        </>
      }
      stage={
        <>
          <div data-parallax-part="stage-toolbar" className="parallax-stage-toolbar">
            <span className="parallax-title">Circuit</span>
            {editing ? <Segments label="View or edit the sheet" value={mode} onChange={setMode}
              options={[{ value: "view", label: "View", title: "Look at the circuit and inspect its parts" },
                { value: "edit", label: "Edit", title: "Work on the sheet — the same editor as the Simulator's" }]} /> : null}
            {editingNow ? <SheetToolbar editing={editingNow} /> : <span className="parallax-hint">click a part to inspect it</span>}
          </div>
          <div data-parallax-part="stage-body" className="parallax-stage-body">
            {editingNow
              ? <Schematic elements={editedElements} drawing={editedDrawing} caption={`${summaryTitle} · r${revision}`} editing={editingNow} readings={false} />
              : <Schematic elements={elements} drawing={drawing} caption={`${summaryTitle} · r${revision}`} selectedElement={selected} onElementSelect={onSelect}
                levels={Object.keys(levels).length ? levels : undefined} readings={false} />}
          </div>
          <div data-parallax-part="stage-foot" className="parallax-stage-foot">
            <span>sheet 1 of 1</span><span>grid 20</span><span className="parallax-push">{drawing ? "routed: layout block" : "autoplaced"}</span>
          </div>
        </>
      }
      inspectorLabel="Part inspector"
      inspectorClassName="parallax-inspector"
      inspector={editingNow && partProperties ? partProperties : part ? (
        <>
          <div data-parallax-part="panel-head" className="parallax-panel-head">
            <div data-parallax-part="inspector-title" className="parallax-inspector-title">
              <h2>{part.id} · {part.type === "MODEL" ? componentSlug : elementTypes[part.type].label.toLowerCase()}</h2>
              <span className="parallax-technical">{part.type === "MODEL" ? `component · pinned to ${component}` : `${elementTypes[part.type].label.toLowerCase()} · primitive`}</span>
            </div>
            {componentSlug ? <div className="parallax-actions"><ParallaxLink data-parallax-part="button" className="parallax-button parallax-small parallax-quiet parallax-icon-only" to={{ kind: "object", slug: componentSlug }} aria-label="Open the component's page"><ParallaxIcon name="external" /></ParallaxLink></div> : null}
          </div>
          <div data-parallax-part="inspector-group" className="parallax-inspector-group">
            <h3>Pins</h3>
            <table className="parallax-table parallax-dense parallax-pins-table">
              <thead><tr><th scope="col">Pin</th><th scope="col">Net</th><th scope="col" className="parallax-numeric">V</th></tr></thead>
              <tbody>
                {terminalsOf(part).map(([terminal, node]) => {
                  const value = voltage(node);
                  return <tr key={terminal}><td>{terminal}</td><td>{netName(node)}</td><td className="parallax-numeric">{value === undefined ? "—" : value.toFixed(2)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <div data-parallax-part="inspector-group" className="parallax-inspector-group">
            <h3>Model</h3>
            <dl className="parallax-facts">
              <dt>Component</dt><dd>{componentSlug ? <ParallaxLink to={{ kind: "object", slug: componentSlug }}>{component}</ParallaxLink> : "—"}</dd>
              {part.type !== "MODEL" ? <><dt>Value</dt><dd>{part.value ?? "—"} {elementTypes[part.type].unit.split(",")[0]}</dd></> : null}
              <dt>Symbol</dt><dd>{part.symbol ?? "default"}</dd>
              {Object.keys(part.overrides ?? {}).length ? <><dt>Overrides</dt><dd>{Object.entries(part.overrides ?? {}).map(([name, value]) => `${name} = ${value}`).join(", ")}</dd></> : null}
            </dl>
          </div>
          {description ? (
            <div data-parallax-part="inspector-group" className="parallax-inspector-group">
              <h3>Description</h3>
              <p className="parallax-small parallax-secondary">{description}</p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="parallax-side-note"><span>Choose a part on the sheet or in the list to see its pins, the nets they are on and what it is.</span>
          {description ? <p className="parallax-small parallax-secondary">{description}</p> : null}</div>
      )} />
  );
}

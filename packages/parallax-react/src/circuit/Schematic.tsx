import type { PartLibraryView } from "@jmouse/parallax/schematic";
import { useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { PartLabels, PartSymbol } from "../symbols/PartSymbol";
import {
  type LabelPlacement, type PartText, placeLabels, READING_LINE, READING_RESERVE, type SheetObstacle,
} from "@jmouse/parallax/schematic";
import { usePartLibrary } from "../providers/usePartLibrary";
import { wirePath } from "@jmouse/parallax/routing";
import { formatReadout } from "@jmouse/parallax/quantities";
import type { PartLoad } from "@jmouse/parallax";
import { boxBetween, panned, zoomedAbout, zoomedAtCentre, type Box } from "@jmouse/parallax/editor";
import { ViewControls, ZOOM_STEP } from "../editor/EditorControls";
import {
  alternatingWires, alternationSummary, bodyOf, DEFAULT_SHEET_LABELS, type ReadingLine, reservedReadingLines, type SheetLabels, shownReadingLines, itemBox, keysInBox, selectedItemIds, type CircuitElement, COMMON_TERMINAL, LABEL_TERMINAL, componentReferenceOf, drawCircuit, type DrawingItem, type DrawingWire, elementTypes, type FlowFeed, frameOf, GROUND_TERMINAL, groundNodeOf, isLead, leadHolds, leadLookOf, leaderOptionsOf, electronDashes, ELECTRON_LAYERS, lightDashes, loadState, loadText, magnetAt, movedItem, nodeOfContact, nodesByPort, parsePort, partDrawingOf, type PartMove, placeAlternatingLight, type PlacedLight, placeLight, portKey, portsOf, positionOf, type ProbeMarker, probeMarkers, probeOn, type RecentFlowFeed, ropeOptionsOf, routedSheet, type SchematicDocument, SHEET_HEIGHT, SHEET_WIDTH, type SheetProbe, snap, structureOf, type WireAlternation, wireCurrents, type WireEnd, wirePoints, type WireTarget, withCurrentElements, withText,
} from "@jmouse/parallax/circuit";
import { flowStyle, useSimulatorAppearance } from "./useSimulatorAppearance";
import { CurrentFlow, PartHeatLayer, PartLoadTable } from "./SchematicLoads";
import { PhaseDials, type PhaseDialsData } from "./PhaseDials";
import type { SheetEditing } from "./useSheetEditing";
import { useTethers, type Tethers, type TetherSpec } from "./useTethers";

/** An instrument's reading, written in its part's readings block. */
export interface SheetMeter {
  id: string;
  text: string;
  part: string;
}

/**
 * A named-node netlist rendered as one connected sheet: the circuit's own drawing (its `layout` block), or one
 * placed for it (`schematic/autoplace.ts`); either way every wire is routed by `lib/schematic-routing` and every part
 * is drawn from its symbol document.
 */
export function Schematic({ elements, drawing, editing, caption, probes = [], meters = [], probedNets = false, onProbeSelect, onProbeMove, probeHint, selectedElement, onElementSelect, levels, loads, ambient = 25, flow, recent, readings = true, dials, sheetLabels = DEFAULT_SHEET_LABELS }: {
  elements: readonly CircuitElement[];
  /** The bench's temperature, °C: what a part warms up from, so its glow is the share of its headroom it has used. */
  ambient?: number;
  drawing?: string;
  /**
   * When given, the sheet is worked on — a running circuit's too: parts dragged, wires drawn, parts placed, all through
   * `editing`, which owns the document; `elements` and `drawing` are then that document as the sheet should show it.
   */
  editing?: SheetEditing;
  caption?: string;
  probes?: readonly SheetProbe[];
  meters?: readonly SheetMeter[];
  /** Whether each probed node's whole net is banded in its probe's colour, not only its contacts. */
  probedNets?: boolean;
  /** A contact chosen to attach a probe to: its node, and the contact itself. */
  onProbeSelect?: (node: string, contact: string) => void;
  /** A probe's tip dragged onto another contact: the channel, its new node, and that contact. */
  onProbeMove?: (channel: string, node: string, contact: string) => void;
  probeHint?: string;
  selectedElement?: string | null;
  onElementSelect?: (id: string) => void;
  /** Every node's voltage while the circuit runs: wires are coloured by it, and say it when hovered or focused. */
  levels?: Record<string, number>;
  /** Every part's power and temperature while it runs: parts glow by power and say it. */
  loads?: Record<string, PartLoad>;
  /** The circuit at the moment a clock is at, every screen frame: current moves along the wires by it. */
  flow?: FlowFeed;
  /** The flow just before the clock: a wire whose current reverses too fast to be shown moving is drawn as alternating. */
  recent?: RecentFlowFeed;
  /** Whether the voltages and the part loads are listed beneath the drawing; a bench shows them in a view of their own. */
  readings?: boolean;
  /** Every part's voltage and current as phasors, drawn as a dial beside it: who lags whom. */
  dials?: PhaseDialsData;
  /** Which texts each part carries — its name, its value — and how much of its readings block. */
  sheetLabels?: SheetLabels;
}) {
  const gridId = useId().replace(/:/g, "");
  const voltages = levels ? new Voltages(levels) : null;
  return <>
    <DrawnSchematic elements={elements} drawing={drawing} editing={editing} caption={caption} probes={probes} meters={meters} probedNets={probedNets}
      onProbeSelect={onProbeSelect} onProbeMove={onProbeMove} probeHint={probeHint} selectedElement={selectedElement} onElementSelect={onElementSelect} gridId={gridId}
      voltages={voltages} loads={loads} ambient={ambient} flow={flow} recent={recent} dials={dials} sheetLabels={sheetLabels} />
    {readings ? <CircuitReadings levels={levels} loads={loads} /> : null}
  </>;
}

/** Every node's voltage and every part's load, as text: what the drawing shows in colour and motion, to be read. */
export function CircuitReadings({ levels, loads }: { levels?: Record<string, number>; loads?: Record<string, PartLoad> }) {
  return <>
    {levels ? <VoltageLegend voltages={new Voltages(levels)} /> : null}
    {loads ? <PartLoadTable loads={loads} /> : null}
  </>;
}

function DrawnSchematic({ elements, drawing, editing, caption, probes, meters, probedNets, onProbeSelect, onProbeMove, probeHint, selectedElement, onElementSelect, gridId, voltages, loads, ambient, flow, recent, dials, sheetLabels }: {
  elements: readonly CircuitElement[]; drawing?: string; editing?: SheetEditing; caption?: string; probes: readonly SheetProbe[]; meters: readonly SheetMeter[]; probedNets: boolean;
  onProbeSelect?: (node: string, contact: string) => void; onProbeMove?: (channel: string, node: string, contact: string) => void;
  probeHint?: string; selectedElement?: string | null;
  onElementSelect?: (id: string) => void; gridId: string; voltages: Voltages | null; loads?: Record<string, PartLoad>; ambient: number; flow?: FlowFeed; recent?: RecentFlowFeed;
  dials?: PhaseDialsData; sheetLabels: SheetLabels;
}) {
  const library = useParallaxPartLibrary();
  // The parts whose readings the reader opened — clicked, or Enter on the block —: every line, whatever the depth chosen.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const toggleOpened = useCallback((id: string) => setOpened((current) => {
    const next = new Set(current);
    if (!next.delete(id)) {
      next.add(id);
    }
    return next;
  }), []);
  // The library comes first: where a part's pins are, and so where it is placed, depends on its symbol.
  const references = elements.map((element) => element.type === "MODEL" ? element.component ?? "" : elementTypes[element.type].component ?? "").filter(Boolean);
  const libraryRevision = usePartLibrary(references);
  // Nothing is drawn until the library has answered for every part: drawn before, each part was a grey box with its
  // lowercase reference for a moment, and the whole sheet jumped when the symbols arrived.
  const answered = library.holds(references);
  // Placing and routing depend on what is connected to what, never on the values: a moved slider or a running circuit
  // re-renders this many times a second, and each time used to place and route the whole sheet again.
  const structure = structureOf(elements);
  const drawn = useMemo(() => answered ? drawCircuit(library, elements, drawing) : drawCircuit(library, [], undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `structure` stands for the elements' connections
    [structure, drawing, libraryRevision]);
  const svg = useRef<SVGSVGElement>(null);
  const tetherRef = useRef<Tethers | null>(null);
  const probeDrop = useRef<(channel: string, at: { x: number; y: number }) => void>(() => {});
  const gestures = useSheetGestures(svg, editing, tetherRef, probeDrop);
  const moving = gestures.moving;
  const textDrag = gestures.textDrag;
  const placed = useMemo(() => withText(moving ? movedItem(drawn, moving) : drawn, textDrag), [drawn, moving, textDrag]);
  // A wire to an instrument hangs as a rope: its shape is the rope's — kept here at rest, written into every element
  // marked with its id while it swings —, held at its ends and at every point it was hung through.
  const leads = useMemo<TetherSpec[]>(() => placed.wires.filter((wire) => isLead(library, placed, wire))
    .map((wire) => ({ id: wire.id, holds: leadHolds(library, placed, wire) })), [placed]);
  const leadIds = useMemo(() => new Set(leads.map((lead) => lead.id)), [leads]);
  const { suppressesClick } = gestures;
  const selectItem = useCallback((item: DrawingItem, adding: boolean) => {
    if (suppressesClick()) {
      return;
    }
    if (adding) {
      editing?.toggle({ kind: "item", id: item.id });
      return;
    }
    editing?.select({ kind: "item", id: item.id });
    if (item.type !== "GROUND" && item.type !== "JUNCTION") {
      onElementSelect?.(item.id);
    }
  }, [editing, onElementSelect, suppressesClick]);
  const document = useMemo(() => withCurrentElements(placed, elements), [placed, elements]);
  // What is selected, as the parts layer marks it: the editor's set, or the one part a viewer chose.
  const selectedIds = useMemo(() => new Set(editing ? selectedItemIds(editing.selected) : selectedElement ? [selectedElement] : []),
    [editing?.selected, selectedElement]);
  const movingIds = useMemo(() => new Set(moving ? [moving.id, ...(moving.together ?? [])] : []), [moving]);
  const sheet = routedSheet(library, placed);
  const nodeByPort = useMemo(() => nodesByPort(elements), [elements]);
  // Every text a part carries is placed by one rule, clear of wires and pins as of bodies: its name, its value, and —
  // while it runs — a readings block of a line for what it takes and one for each meter on it.
  const markers = useMemo(() => probeMarkers(library, placed, probes, nodeByPort), [placed, probes, nodeByPort]);
  const obstacles = useMemo<SheetObstacle[]>(() => [
    ...[...sheet.paths.values()].flatMap((path) => path.slice(1).map((point, index) => {
      const from = path[index];
      return { left: Math.min(from.x, point.x) - 3, right: Math.max(from.x, point.x) + 3, top: Math.min(from.y, point.y) - 3, bottom: Math.max(from.y, point.y) + 3 };
    })),
    ...placed.items.flatMap((item) => portsOf(library, item).map((port) => {
      const point = positionOf(library, item, port.name);
      return { left: point.x - 6, right: point.x + 6, top: point.y - 6, bottom: point.y + 6 };
    })),
    // A probe's tag stands up and to the right of the one contact its tip is drawn on.
    ...markers.map(({ tip, stack }) => ({ left: tip.point.x + 5, right: tip.point.x + 40, top: tip.point.y - 18 - stack * 12, bottom: tip.point.y - 4 - stack * 12 })),
  ], [sheet, placed, markers]);
  // Room is made for each block at the depth shown — a brief block one line and its meters, an opened one every line.
  const readingKey = flow ? placed.items.map((item) => {
    const meterCount = meters.filter((meter) => meter.part === item.id).length;
    const lineCount = 1 + writtenFigures(library, item).length + meterCount;
    return `${item.id}:${reservedReadingLines(lineCount, meterCount, sheetLabels.readings, opened.has(item.id))}`;
  }).join("|") : "";
  const labels = useMemo(() => placeLabels(library, placed.items, (item) => bodyOf(library, item), obstacles,
    new Map(readingKey ? readingKey.split("|").map((entry) => [entry.split(":")[0], Number(entry.split(":")[1])] as [string, number]) : [])),
  [placed, obstacles, readingKey]);
  // A text that stands away from its part is tied back to it by the same rope as a lead: one kind of tether on a sheet.
  // The parts whose readings block has a line now: what it takes or gives, a figure it displays, a meter on it.
  const readingParts = new Set(placed.items.filter((item) => shownReadingLines(readingLinesOf(library, item, loads, meters), opened.has(item.id) ? "full" : sheetLabels.readings).length > 0).map((item) => item.id));
  const readingKeyNow = [...readingParts].sort().join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `readingKeyNow` stands for the set
  const leaders = useMemo(() => leadersOf(labels, readingParts), [labels, readingKeyNow]);
  const ropes = useMemo(() => [...leads, ...leaders], [leads, leaders]);
  const appearance = useSimulatorAppearance();
  const ropeBounds = useMemo(() => leadBoundsOf(placed.items), [placed.items]);
  const leadOptions = useMemo(() => ropeOptionsOf(appearance, ropeBounds), [appearance, ropeBounds]);
  const tethers = useTethers(svg, ropes, leadOptions);
  tetherRef.current = tethers;
  const shapeOf = (wire: DrawingWire) => tethers.shapes.get(wire.id) ?? wirePath(wirePoints(library, placed, wire), sheet.hops.get(wire.id));
  const tetherOf = (wire: DrawingWire) => leadIds.has(wire.id) ? wire.id : undefined;
  // How each lead looks is its instrument's to say (`leads { plus red stripes black }`); the sheet only paints it.
  const lookOf = (wire: DrawingWire) => leadIds.has(wire.id) ? leadLookOf(library, placed, wire) : null;
  // A sheet fits its drawing until it is worked on; from the first gesture it keeps its frame — a frame following a
  // dragged part would slide away under the pointer — until it is zoomed, panned or fitted again.
  const fitted = useMemo(() => frameOf(library, placed, labels), [placed, labels]);
  const frame = gestures.view ?? fitted;
  gestures.frame.current = frame;
  const [alternation, setAlternation] = useState<string | null>(null);
  probeDrop.current = (channel, at) => {
    const target = magnetAt(library, placed, at);
    const node = target?.kind === "port" ? nodeOfContact(library, placed, target.key, nodeByPort) : null;
    if (target?.kind === "port" && node) {
      onProbeMove?.(channel, node, target.key);
    }
  };
  const nodeOfPort = (key: string) => {
    const mark = [GROUND_TERMINAL, COMMON_TERMINAL, LABEL_TERMINAL].includes(parsePort(key).name) ? placed.items.find((item) => item.id === parsePort(key).id && item.type === "GROUND") : undefined;
    return mark ? groundNodeOf(mark) : nodeByPort.get(key) ?? null;
  };
  return <figure data-parallax-part="circuit-diagram" className="parallax-circuit-diagram parallax-circuit-diagram-authored">
    <div data-parallax-part="circuit-diagram-head" className="parallax-circuit-diagram-head"><strong>{caption ?? "Circuit under test"}</strong>
      {alternation ? <span className="parallax-circuit-diagram-alternation" role="status" title={alternation}>{alternation}</span> : null}
      <span>{elements.length} elements · drawn schematic</span>
      {editing ? <ViewControls onFit={gestures.fit} onZoom={gestures.zoomBy} /> : null}</div>
    <svg ref={svg} viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
      className={editing ? `parallax-circuit-diagram-editing parallax-tool-${editing.tool}${editing.placement ? " parallax-placing" : ""}` : undefined}
      {...(editing
        ? { role: "application", tabIndex: 0, "aria-label": `Schematic with ${elements.length} elements. V select, W wire, R rotate, M mirror, Delete removes, Ctrl Z undoes, Ctrl C copies, Ctrl V pastes, Ctrl D duplicates.`,
          onKeyDown: editing.keys,
          // The sheet takes the keyboard whenever it is pressed, in the capture phase: a part's own handler stops the
          // event, and a part clicked left the focus where it was — R, M and Delete went nowhere.
          onPointerDownCapture: (event: ReactPointerEvent<SVGSVGElement>) => event.currentTarget.focus({ preventScroll: true }) }
        : { role: "img", "aria-label": `Drawn schematic with ${elements.length} elements` })}
      onPointerDown={gestures.sheetDown} onPointerMove={gestures.pointerMove} onPointerUp={gestures.pointerUp}
      onPointerCancel={gestures.pointerUp} onPointerLeave={gestures.pointerLeave}>
      <defs><pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" /></pattern></defs>
      {/* The grid reaches past the frame on every side: the sheet fits its frame into the box with room to spare on the
          wider side, and a grid the size of the frame left that room bare — dots on part of the sheet only. */}
      <rect className="parallax-circuit-diagram-grid" x={frame.x - frame.width * 2} y={frame.y - frame.height * 2} width={frame.width * 5}
        height={frame.height * 5} fill={`url(#${gridId})`} />
      {probedNets ? placed.wires.map((wire) => {
        const probe = probeOn(probes, nodeOfPort(wire.from) ?? nodeOfPort(wire.to));
        return probe ? <path key={`net-${wire.id}`} className={`parallax-circuit-diagram-probe-net parallax-probe-${probe.color}`}
          d={shapeOf(wire)} data-tether={tetherOf(wire)} /> : null;
      }) : null}
      {placed.wires.map((wire) => {
        const look = lookOf(wire);
        return look ? <LeadWire key={wire.id} d={shapeOf(wire)} marks={tethers.stripes.get(wire.id) ?? ""} tether={wire.id} look={look} />
          : <VoltageWire key={wire.id} d={shapeOf(wire)} tether={tetherOf(wire)} node={nodeOfPort(wire.from) ?? nodeOfPort(wire.to)} voltages={voltages} />;
      })}
      {flow ? <CurrentFlows document={placed} shapeOf={shapeOf} tetherOf={tetherOf} flow={flow} recent={recent} onAlternation={setAlternation} /> : null}
      {sheet.junctions.map((point) => <circle key={`${point.x},${point.y}`} className="parallax-circuit-diagram-junction" cx={point.x} cy={point.y} r="3.5" />)}
      {loads ? <PartHeatLayer document={document} loads={loads} ambient={ambient} /> : null}
      {loads ? <PartIndicators document={document} loads={loads} voltages={voltages} /> : null}
      {dials ? <PhaseDials document={document} dials={dials} /> : null}
      <TextLeaders leaders={leaders} shapes={tethers.shapes} />
      {flow ? <PartReadings document={document} labels={labels} loads={loads} meters={meters} detail={sheetLabels.readings} opened={opened}
        onToggle={(id) => { if (!gestures.suppressesClick()) { toggleOpened(id); } }}
        onTextDown={editing?.tool === "select" ? gestures.textDown : undefined} onTextReset={editing ? (id) => editing.setItemLabel(id, "readings", null) : undefined} /> : null}
      {editing ? <SheetWireHits document={placed} editing={editing} shapeOf={shapeOf} tetherOf={tetherOf} onWireDown={gestures.wireDown}
        onLeadDown={gestures.leadDown} onHoldDown={gestures.holdDown} heldBend={gestures.heldBend} /> : null}
      <SheetParts document={document} labels={labels} sheetLabels={sheetLabels} nodeByPort={nodeByPort}
        onProbeSelect={editing?.tool === "wire" ? undefined : onProbeSelect}
        selectedIds={selectedIds} onItemSelect={selectItem}
        onPartDown={editing?.tool === "select" ? gestures.partDown : undefined} movingIds={movingIds}
        onTextDown={editing?.tool === "select" ? gestures.textDown : undefined}
        onTextReset={editing ? (id, which) => editing.setItemLabel(id, which, null) : undefined} />
      {editing ? <SheetEditingLayer document={placed} editing={editing} onPortDown={gestures.portDown}
        onEndDown={gestures.endDown} carriedEnd={gestures.carriedEnd} /> : null}
      <ProbeMarkers markers={markers} dragged={gestures.probeDrag} onDown={gestures.probeDown} />
      {gestures.selecting ? <rect className="parallax-selection-box" x={gestures.selecting.x} y={gestures.selecting.y}
        width={gestures.selecting.width} height={gestures.selecting.height} /> : null}
    </svg>
    {onProbeSelect ? <figcaption>{probeHint ?? "Choose a contact on the sheet to attach the selected oscilloscope channel."}</figcaption> : null}
  </figure>;
}

/** Each wire's electron scatter, by wire and spacing: made once, so a redraw of the sheet does not re-place every wire. */
const electronScatters = new Map<string, readonly { dashes: string; length: number }[]>();

function electronLayers(wireId: string, spacing: number): readonly { dashes: string; length: number }[] {
  const key = `${wireId}|${spacing}`;
  let layers = electronScatters.get(key);
  if (!layers) {
    layers = Array.from({ length: ELECTRON_LAYERS }, (_, layer) => electronDashes(wireId, layer, spacing));
    electronScatters.set(key, layers);
  }
  return layers;
}

/**
 * Current along every wire at the moment the clock is at: each light stands where the charge that has passed along its
 * wire puts it — Kirchhoff's sums over charges as over currents —, so it moves exactly as far as the circuit's time
 * moved, and runs back when the current does; it is as bright as the wire's current now against the largest the run
 * has had. Placed every screen frame without React.
 */
function CurrentFlows({ document, shapeOf, tetherOf, flow: feed, recent, onAlternation }: {
  document: SchematicDocument; shapeOf: (wire: DrawingWire) => string; tetherOf: (wire: DrawingWire) => string | undefined;
  flow: FlowFeed; recent?: RecentFlowFeed;
  onAlternation: (summary: string | null) => void;
}) {
  const placed = useRef(new Map<string, PlacedLight>());
  const alternating = useRef(new Map<string, WireAlternation>());
  const appearance = useSimulatorAppearance();
  // Four times a second, which wires reverse too fast to be shown moving: classified over the last quarter second of
  // wall time, so slowing the run down brings their lights back within a moment.
  useEffect(() => {
    if (!recent) {
      return;
    }
    const classify = () => {
      const flow = recent(ALTERNATION_WINDOW_SECONDS);
      alternating.current = flow ? alternatingWires(document, flow, appearance.alternatingThreshold) : new Map();
      onAlternation(flow ? alternationSummary(alternating.current, flow.speed, appearance.alternatingThreshold) : null);
    };
    classify();
    const timer = window.setInterval(classify, ALTERNATION_WINDOW_SECONDS * 1000);
    return () => {
      window.clearInterval(timer);
      onAlternation(null);
    };
  }, [recent, document, onAlternation, appearance.alternatingThreshold]);
  useEffect(() => feed((moment) => {
    const passed = wireCurrents(document, moment.charges);
    const now = wireCurrents(document, moment.strengths ?? moment.currents);
    placed.current.forEach((light, id) => {
      const fast = alternating.current.get(id);
      light.tube.parentElement?.classList.toggle("parallax-alternating", fast?.kind === "alternating");
      light.tube.parentElement?.classList.toggle("parallax-pulsing", fast?.kind === "pulsing");
      if (fast?.kind === "alternating") {
        // Too fast to be shown moving: the same neon, two rows running calmly against each other, as strong as its RMS.
        const share = moment.reference > 0 ? Math.min(1, fast.rms / moment.reference) : 0;
        placeAlternatingLight(light, performance.now() / 1000, share, appearance.lightSpacing, appearance.currentIntensity);
        return;
      }
      const charge = passed.get(id);
      const current = now.get(id);
      // Its share of the largest current the run has had, by its RMS where the moment is a stretch's mean — a current
      // alternating within it moves no charge and still flows —: the same scale for every wire, so branches compare. A wire
      // switching faster than a frame is lit by its RMS, steady — lit by the current now it would flicker at the frame
      // rate —; its lights still go as far as the charge it carried, in its direction.
      const amperes = fast ? fast.rms : current?.amperes ?? 0;
      const share = moment.reference > 0 ? Math.min(1, amperes / moment.reference) : 0;
      placeLight(light, charge ? (charge.forward ? charge.amperes : -charge.amperes) : 0, share, appearance.lightSpacing, appearance.currentIntensity);
    });
  }), [feed, document, appearance]);
  const filter = `flow-glow-${useId().replace(/:/g, "")}`;
  const style = appearance.currentStyle ?? "LIGHT";
  const dashes = lightDashes(appearance.lightSpacing);
  return <g className={`parallax-circuit-diagram-flows parallax-flow-${style.toLowerCase()}`} style={flowStyle(appearance)}>
    <defs><filter id={filter} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" /></filter></defs>
    {document.wires.map((wire) => <CurrentFlow key={`${wire.id}-${style}`} d={shapeOf(wire)} tether={tetherOf(wire)} filter={filter} dashes={dashes}
      electrons={style === "ELECTRONS" ? electronLayers(wire.id, appearance.lightSpacing) : undefined}
      onPlaced={(light) => (light ? placed.current.set(wire.id, light) : placed.current.delete(wire.id))} />)}
  </g>;
}

/**
 * The parts, their labels and their contacts: everything on the sheet that does not follow the voltages, kept out of
 * the redraw a running circuit asks for several times a second.
 */
const SheetParts = memo(function SheetParts({ document, labels, sheetLabels, nodeByPort, onProbeSelect, selectedIds, onItemSelect, onPartDown, movingIds,
  onTextDown, onTextReset }: {
  document: SchematicDocument; labels: ReturnType<typeof placeLabels>; sheetLabels: SheetLabels; nodeByPort: Map<string, string>;
  onProbeSelect?: (node: string, contact: string) => void; selectedIds: ReadonlySet<string>; onItemSelect: (item: DrawingItem, adding: boolean) => void;
  onPartDown?: (event: ReactPointerEvent<SVGGElement>, item: DrawingItem) => void; movingIds: ReadonlySet<string>;
  onTextDown?: (event: ReactPointerEvent<SVGElement>, item: DrawingItem, text: PartText, at: { x: number; y: number }) => void;
  onTextReset?: (id: string, text: PartText) => void;
}) {
  const library = useParallaxPartLibrary();
  return <>
    {document.items.map((item) => <g key={item.id}
      className={`parallax-circuit-diagram-element${selectedIds.has(item.id) ? " parallax-selected" : ""}${onPartDown ? " parallax-movable" : ""}${movingIds.has(item.id) ? " parallax-moving" : ""}`}
      transform={`translate(${item.x} ${item.y})`} onPointerDown={onPartDown ? (event) => onPartDown(event, item) : undefined}
      onClick={(event) => onItemSelect(item, event.shiftKey || event.ctrlKey || event.metaKey)}>
      {item.type === "JUNCTION" ? <circle r="4" className="parallax-circuit-diagram-junction" />
        : <g transform={`rotate(${item.rotation}) scale(${item.mirrored ? -1 : 1} 1)`}>
          {/* The whole body takes the pointer, not only its strokes: a meter is a circle and a letter, and a click inside
              the circle fell through to the sheet — the part could not be selected, rotated or moved. */}
          <BodyTarget library={library} item={item} />
          <PartSymbol item={item} className="parallax-drawing-symbol" />
        </g>}
      <PartLabels item={item} nameClassName="parallax-circuit-diagram-name" valueClassName="parallax-circuit-diagram-value" placement={labels.get(item.id)}
        showName={sheetLabels.names} showValue={sheetLabels.values}
        onTextDown={onTextDown ? (event, which, at) => onTextDown(event, item, which, at) : undefined}
        onTextReset={onTextReset ? (which) => onTextReset(item.id, which) : undefined} />
    </g>)}
    {document.items.flatMap((item) => portsOf(library, item).map((port) => {
      const key = portKey(item.id, port.name), node = item.type === "GROUND" ? groundNodeOf(item) : nodeByPort.get(key);
      const point = positionOf(library, item, port.name);
      return <g key={key} className="parallax-circuit-diagram-node">
        {/* A junction is its dot alone: a contact ring on it would read as a pin standing in the wire. */}
        {item.type !== "JUNCTION" ? <circle cx={point.x} cy={point.y} r="5" /> : null}
        {node && onProbeSelect ? <circle className="parallax-circuit-diagram-hit" cx={point.x} cy={point.y} r="16" role="button" tabIndex={0}
          aria-label={`Connect probe to node ${node}`} onClick={() => onProbeSelect(node, key)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onProbeSelect(node, key); } }} /> : null}
      </g>;
    }))}
  </>;
});

/**
 * Each part's live figures in the indicators its symbol marks — a capacitor's charge between its plates, and whatever
 * a component's `display` block writes —: the box fills along its longer side, in one colour for each sign. A figure
 * is a voltage over the part's pins, so it is read against the largest voltage the circuit has had in the run: a
 * capacitor charging towards its supply fills from empty to full. Nothing here knows a component.
 */
function PartIndicators({ document, loads, voltages }: { document: SchematicDocument; loads: Record<string, PartLoad>; voltages: Voltages | null }) {
  const library = useParallaxPartLibrary();
  const largest = useRef(new Map<string, number>());
  const circuitLargest = useRef(0);
  circuitLargest.current = Math.max(circuitLargest.current, voltages?.maximum ?? 0);
  return <g className="parallax-circuit-diagram-indicators" aria-hidden="true">
    {document.items.map((item) => {
      const shown = loads[item.id]?.displays;
      const indicators = shown ? partDrawingOf(library, item)?.drawing.indicators ?? [] : [];
      if (!shown || !indicators.length) {
        return null;
      }
      return <g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.mirrored ? -1 : 1} 1)`}>
        {indicators.map((indicator) => {
          const value = shown[indicator.name];
          if (value === undefined) {
            return null;
          }
          const key = `${item.id}:${indicator.name}`;
          const scale = Math.max(largest.current.get(key) ?? 0, Math.abs(value), circuitLargest.current);
          largest.current.set(key, scale);
          const share = scale > 0 ? Math.abs(value) / scale : 0;
          const width = indicator.right - indicator.left;
          const height = indicator.bottom - indicator.top;
          const tall = height >= width;
          const box = tall
            ? { x: indicator.left, y: indicator.bottom - height * share, width, height: height * share }
            : { x: indicator.left, y: indicator.top, width: width * share, height };
          return <g key={indicator.name}>
            <rect className="parallax-circuit-diagram-indicator-well" x={indicator.left} y={indicator.top} width={width} height={height} />
            <rect className={`parallax-circuit-diagram-indicator ${value < 0 ? "parallax-negative" : "parallax-positive"}`} {...box} />
          </g>;
        })}
      </g>;
    })}
  </g>;
}

/**
 * The lines of a part's readings block now: what it takes or gives — none for a power a millionth of the sheet's
 * largest, the solver's rounding —, each figure its component displays, and each meter on it. The one rule for what
 * the block shows and whether its leader is drawn.
 */
function readingLinesOf(library: PartLibraryView, item: DrawingItem, loads: Record<string, PartLoad> | undefined, meters: readonly SheetMeter[]): ReadingLine[] {
  const floor = 1e-6 * Math.max(0, ...Object.values(loads ?? {}).map((load) => Math.abs(load.power ?? 0)));
  const load = loadText(library, item, loads?.[item.id], floor);
  const shown = loads?.[item.id]?.displays ?? {};
  const figures = writtenFigures(library, item).filter(([name]) => shown[name] !== undefined)
    .map(([name, unit, caption]) => ({ key: `display:${name}`, text: `${name} ${formatReadout(shown[name], unit, 3)}${caption ? ` ${caption}` : ""}`, meter: false,
      ...(STRESS_FIGURES.has(name) ? { stress: shown[name] } : {}) }));
  return [...(load ? [{ key: "load", text: load, meter: false }] : []), ...figures,
    ...meters.filter((meter) => meter.part === item.id).map((meter) => ({ key: meter.id, text: `${meter.id} ${meter.text}`, meter: true }))];
}

/**
 * Each part's readings block where the label rule put it: what it takes and how warm it is, then each meter on it,
 * framed so a meter's figure reads as an instrument's display and not as the part's own.
 */
/** The figures a component displays as a share of a limit: the realistic bench fails a part when one reaches 100 %. */
const STRESS_FIGURES = new Set(["overvoltage", "overcurrent"]);

/**
 * Each part's readings block where the label rule put it, at the depth the reader chose: what it takes and how warm it
 * is, the figures its component displays, then each meter on it — framed so a meter's figure reads as an instrument's
 * display and not as the part's own. A brief block opens over the sheet while the pointer is on it, and stays open
 * when clicked (Enter or Space from the keyboard); clicked again it folds back.
 */
function PartReadings({ document, labels, loads, meters, detail, opened, onToggle, onTextDown, onTextReset }: {
  document: SchematicDocument; labels: Map<string, LabelPlacement>; loads?: Record<string, PartLoad>; meters: readonly SheetMeter[];
  detail: SheetLabels["readings"]; opened: ReadonlySet<string>; onToggle: (id: string) => void;
  onTextDown?: (event: ReactPointerEvent<SVGElement>, item: DrawingItem, text: PartText, at: { x: number; y: number }) => void;
  onTextReset?: (id: string) => void;
}) {
  const library = useParallaxPartLibrary();
  const [hovered, setHovered] = useState<string | null>(null);
  return <g className="parallax-circuit-diagram-readings">
    {document.items.map((item) => {
      const block = labels.get(item.id)?.readings;
      if (!block) {
        return null;
      }
      const all = readingLinesOf(library, item, loads, meters);
      const open = opened.has(item.id);
      const lines = shownReadingLines(all, open || hovered === item.id ? "full" : detail);
      if (!lines.length) {
        return null;
      }
      const folds = all.length > shownReadingLines(all, detail).length || open;
      // Opened past the room the sheet made for it, the block stands on a plate so it reads over wires and parts.
      const plate = lines.length > shownReadingLines(all, detail).length;
      const widest = Math.max(...lines.map((line) => line.text.length * 6 + 8));
      const plateLeft = block.anchor === "start" ? block.point.x - 3 : block.anchor === "end" ? block.point.x - widest + 3 : block.point.x - widest / 2;
      return <g key={item.id} className={`parallax-circuit-diagram-reading-block${onTextDown ? " parallax-circuit-diagram-text-movable" : ""}`}
        data-open={open || undefined} role={folds ? "button" : undefined} tabIndex={folds ? 0 : undefined}
        aria-expanded={folds ? open : undefined} aria-label={`${item.id}: ${all.map((line) => line.text).join("; ")}`}
        onPointerEnter={() => setHovered(item.id)} onPointerLeave={() => setHovered((current) => current === item.id ? null : current)}
        onClick={folds ? () => onToggle(item.id) : undefined}
        onKeyDown={folds ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle(item.id);
          }
        } : undefined}
        onPointerDown={onTextDown ? (event) => onTextDown(event, item, "readings", block.anchor === "start" ? block.point
          : { x: block.point.x - (block.anchor === "end" ? READING_RESERVE : READING_RESERVE / 2), y: block.point.y }) : undefined}
        onDoubleClick={onTextReset && item.labels?.readings ? () => onTextReset(item.id) : undefined}>
        {plate ? <rect className="parallax-circuit-diagram-reading-plate" x={plateLeft} y={block.point.y - 11} width={widest} height={lines.length * READING_LINE + 4} /> : null}
        {lines.map((line, index) => {
          const y = block.point.y + index * READING_LINE;
          const width = line.text.length * 6 + 8;
          const left = block.anchor === "start" ? block.point.x : block.anchor === "end" ? block.point.x - width : block.point.x - width / 2;
          return line.meter
            ? <g key={line.key} className="parallax-circuit-diagram-meter"><rect x={left} y={y - 10} width={width} height={13} /><text x={left + 4} y={y}>{line.text}</text></g>
            : <text key={line.key} className="parallax-circuit-diagram-load" data-state={loadState(loads?.[item.id])} x={block.point.x} y={y} textAnchor={block.anchor}>{line.text}</text>;
        })}
      </g>;
    })}
  </g>;
}

/**
 * The display figures a part's component writes beside it: each name, its unit and what it is of —
 * `charge = … unit % "of the rated voltage"` reads «charge 19.0 % of the rated voltage».
 */
function writtenFigures(library: PartLibraryView, item: DrawingItem): [string, string, string | null][] {
  const reference = item.type === "MODEL" ? componentReferenceOf(item) : item.element ? elementTypes[item.element.type].component ?? null : null;
  const model = reference ? library.componentModelOf(reference) : null;
  return Object.entries(model?.displayUnits ?? {}).map(([name, unit]) => [name, unit, model?.displayCaptions?.[name] ?? null]);
}

/** The ropes that tie texts standing away from their parts back to them, with a dot where each arrives. */
function TextLeaders({ leaders, shapes }: { leaders: readonly TetherSpec[]; shapes: ReadonlyMap<string, string> }) {
  return <g className="parallax-circuit-diagram-leaders" aria-hidden="true">
    {leaders.map((leader) => {
      const to = leader.holds[leader.holds.length - 1];
      return <g key={leader.id} className="parallax-circuit-diagram-leader">
        <path d={shapes.get(leader.id) ?? `M${leader.holds[0].x} ${leader.holds[0].y}L${to.x} ${to.y}`} data-tether={leader.id} />
        <circle cx={to.x} cy={to.y} r={1.8} />
      </g>;
    })}
  </g>;
}

/**
 * Every leader the label rule drew, as a rope from the text to what it describes — a readings block's only while it
 * has a line to show: the block's place is kept from the start, and its leader hung from nothing before the run did.
 */
function leadersOf(labels: Map<string, LabelPlacement>, reading: ReadonlySet<string>): TetherSpec[] {
  const leaders: TetherSpec[] = [];
  labels.forEach((placement, id) => {
    const add = (text: PartText, leader: { from: { x: number; y: number }; to: { x: number; y: number } } | null | undefined) => {
      if (leader) {
        leaders.push({ id: `leader:${id}:${text}`, holds: [leader.from, leader.to], options: LEADER_OPTIONS });
      }
    };
    add("name", placement.nameLeader);
    add("value", placement.valueLeader);
    add("readings", reading.has(id) ? placement.readings?.leader : null);
  });
  return leaders;
}

/**
 * Where a lead may lie: around every part on the sheet with room to spare, in steps of 400 so it stays the same while
 * a part is moved — a fixed 1200 × 760 clipped every lead to a part placed past it.
 */
function leadBoundsOf(items: readonly DrawingItem[]): { left: number; top: number; right: number; bottom: number } {
  const step = 400;
  const xs = items.map((item) => item.x);
  const ys = items.map((item) => item.y);
  const down = (value: number) => Math.floor(value / step) * step;
  const up = (value: number) => Math.ceil(value / step) * step;
  return items.length
    ? { left: down(Math.min(...xs)) - step, top: down(Math.min(...ys)) - step, right: up(Math.max(...xs)) + step, bottom: up(Math.max(...ys)) + step }
    : { left: 0, top: 0, right: SHEET_WIDTH, bottom: SHEET_HEIGHT };
}
/** A text's leader: the same rope as a lead, drawn taut — it stands still, as a line to its part. */
const LEADER_OPTIONS = leaderOptionsOf();

/** How often, and over how much wall time, the wires are classified as flowing or alternating. */
const ALTERNATION_WINDOW_SECONDS = 0.25;

/**
 * Each probe as one point: its tip, in its channel's colour with its name, and its clip as a ring when it is not on
 * ground. A tip is taken with the pointer and dropped on any contact; while it is carried it follows the pointer.
 */
function ProbeMarkers({ markers, dragged, onDown }: {
  markers: readonly ProbeMarker[];
  dragged: { channel: string; at: { x: number; y: number } } | null;
  onDown: (event: ReactPointerEvent<SVGElement>, channel: string) => void;
}) {
  return <g className="parallax-circuit-diagram-probes">
    {markers.map(({ probe, tip, clip, stack }) => {
      const at = dragged?.channel === probe.id ? dragged.at : tip.point;
      return <g key={probe.id} className={`parallax-circuit-diagram-probe parallax-probe-${probe.color}${dragged?.channel === probe.id ? " parallax-carried" : ""}`}>
        {clip ? <circle className="parallax-circuit-diagram-probe-clip" cx={clip.point.x} cy={clip.point.y} r="7"><title>{`${probe.channel} clip`}</title></circle> : null}
        <g onPointerDown={(event) => onDown(event, probe.id)}>
          <circle className="parallax-circuit-diagram-probe-tip" cx={at.x} cy={at.y} r="7" />
          <text className="parallax-circuit-diagram-probe-tag" x={at.x + 9} y={at.y - 9 - stack * 12}>{probe.channel}</text>
          <title>{`${probe.channel} — drag onto another contact`}</title>
        </g>
      </g>;
    })}
  </g>;
}

/** The voltages of a running circuit, and the largest of them, which the colours are scaled to. */
class Voltages {
  readonly maximum: number;
  readonly levels: Record<string, number>;
  constructor(levels: Record<string, number>) {
    this.levels = levels;
    this.maximum = Math.max(1e-9, ...Object.values(levels).filter(Number.isFinite).map(Math.abs));
  }
  of(node: string | null | undefined): number | null {
    if (!node) {
      return null;
    }
    if (node === "0" || node === "ground") {
      return 0;
    }
    const value = this.levels[node];
    return value === undefined || !Number.isFinite(value) ? null : value;
  }
}

const shownVoltage = (value: number) => `${Number(value.toPrecision(3))} V`;

/** A wire coloured by its node's voltage — warm for positive, accent for negative, plain at 0 V — that says it on hover. */
function VoltageWire({ d, tether, node, voltages }: { d: string; tether?: string; node: string | null | undefined; voltages: Voltages | null }) {
  const value = voltages?.of(node) ?? null;
  if (value === null) {
    return <path className={`parallax-circuit-diagram-wire${tether ? " parallax-circuit-diagram-lead" : ""}`} d={d} data-tether={tether} />;
  }
  const share = Math.round(Math.min(1, Math.abs(value) / voltages!.maximum) * 100);
  const stroke = value >= 0 ? `color-mix(in srgb, var(--parallax-warn) ${share}%, var(--parallax-line-strong))` : `color-mix(in srgb, var(--parallax-accent) ${share}%, var(--parallax-line-strong))`;
  return <path className={`parallax-circuit-diagram-wire parallax-circuit-diagram-wire-live${tether ? " parallax-circuit-diagram-lead" : ""}`} d={d} data-tether={tether} style={{ stroke }}><title>{`${node === "0" ? "ground" : node}: ${shownVoltage(value)}`}</title></path>;
}

/**
 * A test lead: its instrument's colour for that pin, and its stripes over it — marks slanted to the lead itself, worked
 * out from the rope's own points, so they run with it however it bends or swings. One rope, drawn twice.
 */
function LeadWire({ d, marks, tether, look }: { d: string; marks: string; tether: string; look: { colour: string; stripes: string | null } }) {
  return <g className="parallax-circuit-diagram-lead-look">
    <path className="parallax-circuit-diagram-wire parallax-circuit-diagram-lead" d={d} data-tether={tether} style={{ stroke: `var(--parallax-lead-${look.colour})` }} />
    {look.stripes ? <path className="parallax-circuit-diagram-lead-stripes" d={marks} data-tether-stripes={tether}
      style={{ stroke: `var(--parallax-lead-${look.stripes})` }} /> : null}
  </g>;
}

/** What the colours mean, and every node's voltage as text — colour is never the only way to read it. */
function VoltageLegend({ voltages }: { voltages: Voltages }) {
  const nodes = Object.entries(voltages.levels).filter(([, value]) => Number.isFinite(value));
  return <div data-parallax-part="voltage-legend" className="parallax-voltage-legend" aria-label="Node voltages">
    <span className="parallax-voltage-legend-scale" aria-hidden="true"><i style={{ background: "linear-gradient(90deg, var(--parallax-accent), var(--parallax-line-strong), var(--parallax-warn))" }} /></span>
    <span className="parallax-voltage-legend-range">−{shownVoltage(voltages.maximum)} · 0 V · +{shownVoltage(voltages.maximum)}</span>
    <ul>{nodes.map(([node, value]) => <li key={node}><code>{node}</code> {shownVoltage(value)}</li>)}</ul>
  </div>;
}

/** A pointer that travels less than this, in screen pixels, clicked the part rather than dragged it. */
const DRAG_THRESHOLD = 4;
/** How far a sheet zooms in and out: its window from 120 to 4800 sheet units wide. */
const FRAME_LIMITS = { minimumWidth: 120, maximumWidth: 4800 };

type SheetFrame = { x: number; y: number; width: number; height: number };

/** A wire's end being carried: where the pointer is, and the contact or wire it would be plugged into there. */
type CarriedEnd = { id: string; end: WireEnd; at: { x: number; y: number }; target: WireTarget | null };

type SheetGesture =
  | { kind: "part"; id: string; pointer: number; startX: number; startY: number; originX: number; originY: number; dragged: boolean; together: readonly string[] }
  | { kind: "box"; pointer: number; from: { x: number; y: number }; adding: boolean; dragged: boolean }
  | { kind: "pan"; pointer: number; startX: number; startY: number; view: SheetFrame }
  | { kind: "lead"; id: string; pointer: number; startX: number; startY: number; dragged: boolean }
  | { kind: "hold"; id: string; index: number; pointer: number }
  | { kind: "end"; id: string; end: WireEnd; pointer: number }
  | { kind: "probe"; channel: string; pointer: number }
  | { kind: "text"; id: string; text: PartText; pointer: number; startX: number; startY: number; origin: { x: number; y: number }; dragged: boolean };

/**
 * The pointer on a sheet that is worked on: a part dragged on the grid, the sheet panned and zoomed, and every other
 * press handed to `editing` at its place on the sheet. A sheet nobody works on answers nothing.
 */
function useSheetGestures(svg: RefObject<SVGSVGElement | null>, editing: SheetEditing | undefined, tethers: RefObject<Tethers | null>,
                          probeDrop: RefObject<(channel: string, at: { x: number; y: number }) => void>) {
  const library = useParallaxPartLibrary();
  const [probeDrag, setProbeDrag] = useState<{ channel: string; at: { x: number; y: number } } | null>(null);
  const [textDrag, setTextDrag] = useState<{ id: string; text: PartText; offset: { x: number; y: number } } | null>(null);
  const [heldBend, setHeldBend] = useState<{ id: string; index: number; at: { x: number; y: number } } | null>(null);
  const [carriedEnd, setCarriedEnd] = useState<CarriedEnd | null>(null);
  const frame = useRef<SheetFrame>({ x: 0, y: 0, width: SHEET_WIDTH, height: SHEET_HEIGHT });
  const [view, setView] = useState<SheetFrame | null>(null);
  const [moving, setMoving] = useState<PartMove | null>(null);
  /** The box being drawn to select with, in sheet units. */
  const [selecting, setSelecting] = useState<Box | null>(null);
  const gesture = useRef<SheetGesture | null>(null);
  const latest = useRef<PartMove | null>(null);
  const clickSuppressed = useRef(false);

  // A dragged part keeps the frame still under the pointer; otherwise the sheet fits its drawing until zoomed or panned.
  const [dragFrame, setDragFrame] = useState<SheetFrame | null>(null);
  // Anything carried across the sheet — a lead, a point it hangs through, a wire's end, a probe — holds the frame too:
  // the fitted frame follows the drawing, so a frame left to fit moved the sheet under the pointer and the carried point
  // flew off wherever the new frame mapped the pointer to.
  const holdFrame = () => setDragFrame(frame.current);
  const sheetPoint = (event: { clientX: number; clientY: number }) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) {
      return null;
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  const zoomAround = useCallback((factor: number, around?: { x: number; y: number }) => {
    const current = frame.current;
    setView(around ? zoomedAbout(current, factor, around, FRAME_LIMITS) : zoomedAtCentre(current, factor, FRAME_LIMITS));
  }, []);

  const interactive = Boolean(editing);
  useEffect(() => {
    const canvas = svg.current;
    if (!canvas || !interactive) {
      return;
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const matrix = canvas.getScreenCTM();
      const point = matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : undefined;
      zoomAround(event.deltaY < 0 ? 1 / ZOOM_STEP : ZOOM_STEP, point ? { x: point.x, y: point.y } : undefined);
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [svg, interactive, zoomAround]);

  const partDown = (event: ReactPointerEvent<SVGGElement>, item: DrawingItem) => {
    if (!editing || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    svg.current?.focus({ preventScroll: true });
    // A part of a selection carries the whole selection; any other part goes alone.
    const selectedIds = selectedItemIds(editing.selected);
    const together = selectedIds.includes(item.id) ? selectedIds.filter((id) => id !== item.id) : [];
    gesture.current = { kind: "part", id: item.id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
      originX: item.x, originY: item.y, dragged: false, together };
    latest.current = null;
    clickSuppressed.current = false;
  };
  const portDown = (event: ReactPointerEvent<SVGElement>, key: string) => {
    if (!editing || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    svg.current?.focus({ preventScroll: true });
    editing.pressPort(key);
  };
  const wireDown = (event: ReactPointerEvent<SVGElement>, id: string) => {
    const point = sheetPoint(event);
    if (!editing || event.button !== 0 || !point) {
      return;
    }
    event.stopPropagation();
    svg.current?.focus({ preventScroll: true });
    if (editing.tool === "select" && (event.shiftKey || event.ctrlKey || event.metaKey)) {
      editing.toggle({ kind: "wire", id });
      return;
    }
    editing.pressWire(id, point);
  };
  // A part's text is put where the reader wants it — its name, its value, its readings —, and stays there.
  const textDown = (event: ReactPointerEvent<SVGElement>, item: DrawingItem, text: PartText, at: { x: number; y: number }) => {
    if (!editing || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    gesture.current = { kind: "text", id: item.id, text, pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
      origin: { x: at.x - item.x, y: at.y - item.y }, dragged: false };
  };
  // A probe is moved on any bench, worked on or not: where it reads is the bench's, not the circuit's.
  const probeDown = (event: ReactPointerEvent<SVGElement>, channel: string) => {
    const point = sheetPoint(event);
    if (event.button !== 0 || !point) {
      return;
    }
    event.stopPropagation();
    gesture.current = { kind: "probe", channel, pointer: event.pointerId };
    holdFrame();
    setProbeDrag({ channel, at: point });
    svg.current?.setPointerCapture(event.pointerId);
  };
  const leadDown = (event: ReactPointerEvent<SVGElement>, id: string) => {
    const point = sheetPoint(event);
    if (!editing || event.button !== 0 || !point) {
      return;
    }
    event.stopPropagation();
    svg.current?.focus({ preventScroll: true });
    gesture.current = { kind: "lead", id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, dragged: false };
    holdFrame();
    svg.current?.setPointerCapture(event.pointerId);
  };
  const holdDown = (event: ReactPointerEvent<SVGElement>, id: string, index: number) => {
    const point = sheetPoint(event);
    if (!editing || event.button !== 0 || !point) {
      return;
    }
    event.stopPropagation();
    gesture.current = { kind: "hold", id, index, pointer: event.pointerId };
    holdFrame();
    setHeldBend({ id, index, at: point });
    svg.current?.setPointerCapture(event.pointerId);
  };
  // A wire's end is taken off its contact and carried to another — or to nothing, which unplugs it.
  const endDown = (event: ReactPointerEvent<SVGElement>, id: string, end: WireEnd) => {
    const point = sheetPoint(event);
    if (!editing || event.button !== 0 || !point) {
      return;
    }
    event.stopPropagation();
    gesture.current = { kind: "end", id, end, pointer: event.pointerId };
    holdFrame();
    setCarriedEnd({ id, end, at: point, target: editing.plugAt(id, end, point) });
    svg.current?.setPointerCapture(event.pointerId);
  };
  const sheetDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!editing) {
      return;
    }
    svg.current?.focus({ preventScroll: true });
    if (event.button === 1 || (event.button === 0 && editing.tool === "pan")) {
      event.preventDefault();
      gesture.current = { kind: "pan", pointer: event.pointerId, startX: event.clientX, startY: event.clientY, view: frame.current };
      svg.current?.setPointerCapture(event.pointerId);
      return;
    }
    const point = sheetPoint(event);
    if (event.button !== 0 || !point) {
      return;
    }
    // Select in hand and nothing being placed or drawn: a press on empty sheet may become a box. A press that does not
    // move is a click, as before — it clears the selection.
    if (editing.tool === "select" && !editing.placement && !editing.pending) {
      gesture.current = { kind: "box", pointer: event.pointerId, from: point, adding: event.shiftKey || event.ctrlKey || event.metaKey, dragged: false };
      svg.current?.setPointerCapture(event.pointerId);
      return;
    }
    editing.pressSheet({ x: snap(point.x), y: snap(point.y) });
  };
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    const matrix = svg.current?.getScreenCTM();
    if (current?.kind === "pan" && matrix) {
      setView(panned(current.view, (event.clientX - current.startX) / matrix.a, (event.clientY - current.startY) / matrix.d));
      return;
    }
    if (current?.kind === "lead" && current.pointer === event.pointerId) {
      const point = sheetPoint(event);
      if (!point) {
        return;
      }
      if (!current.dragged) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_THRESHOLD) {
          return;
        }
        current.dragged = true;
        tethers.current?.grab(current.id, point);
      }
      tethers.current?.pull(point);
      return;
    }
    if (current?.kind === "hold" && current.pointer === event.pointerId) {
      const point = sheetPoint(event);
      if (point) {
        setHeldBend({ id: current.id, index: current.index, at: point });
      }
      return;
    }
    if (current?.kind === "end" && current.pointer === event.pointerId) {
      const point = sheetPoint(event);
      if (point && editing) {
        setCarriedEnd({ id: current.id, end: current.end, at: point, target: editing.plugAt(current.id, current.end, point) });
      }
      return;
    }
    if (current?.kind === "text" && current.pointer === event.pointerId && matrix) {
      if (!current.dragged) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_THRESHOLD) {
          return;
        }
        current.dragged = true;
        setDragFrame(frame.current);
        svg.current?.setPointerCapture(event.pointerId);
      }
      setTextDrag({ id: current.id, text: current.text, offset: {
        x: Math.round(current.origin.x + (event.clientX - current.startX) / matrix.a),
        y: Math.round(current.origin.y + (event.clientY - current.startY) / matrix.d) } });
      return;
    }
    if (current?.kind === "probe" && current.pointer === event.pointerId) {
      const point = sheetPoint(event);
      if (point) {
        setProbeDrag({ channel: current.channel, at: point });
      }
      return;
    }
    if (current?.kind === "box" && current.pointer === event.pointerId) {
      const point = sheetPoint(event);
      if (point) {
        const box = boxBetween(current.from, point);
        if (!current.dragged && Math.max(box.width, box.height) * (matrix?.a ?? 1) < DRAG_THRESHOLD) {
          return;
        }
        current.dragged = true;
        setDragFrame(frame.current);
        setSelecting(box);
      }
      return;
    }
    if (current?.kind === "part" && current.pointer === event.pointerId && matrix) {
      if (!current.dragged) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_THRESHOLD) {
          return;
        }
        current.dragged = true;
        setDragFrame(frame.current);
        svg.current?.setPointerCapture(event.pointerId);
      }
      const x = snap(current.originX + (event.clientX - current.startX) / matrix.a);
      const y = snap(current.originY + (event.clientY - current.startY) / matrix.d);
      if (latest.current?.x !== x || latest.current?.y !== y) {
        latest.current = { id: current.id, x, y, together: current.together };
        setMoving(latest.current);
      }
      return;
    }
    editing?.pointerAt(sheetPoint(event));
  };
  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    gesture.current = null;
    if (current && (current.kind === "lead" || current.kind === "hold" || current.kind === "end" || current.kind === "probe")) {
      // The sheet stays where it was while it was worked on, as after a zoom: it does not jump to fit what was let go.
      setView(frame.current);
      setDragFrame(null);
    }
    if (current?.kind === "part") {
      clickSuppressed.current = current.dragged;
      const move = latest.current;
      if (current.dragged && move && (move.x !== current.originX || move.y !== current.originY)) {
        if (current.together.length) {
          editing?.moveItems([move.id, ...current.together], move.x - current.originX, move.y - current.originY);
        } else {
          editing?.moveItem(move.id, move.x, move.y);
        }
        // The sheet stays where it was, as after any carried thing is let go: refitted to the drawing the moved part
        // changed, every other part jumped and the move looked like the whole sheet being dragged.
        setView(frame.current);
      }
      latest.current = null;
      setMoving(null);
      setDragFrame(null);
      return;
    }
    if (current?.kind === "pan") {
      return;
    }
    if (current?.kind === "box") {
      const box = selecting;
      setSelecting(null);
      setDragFrame(null);
      if (current.dragged && box) {
        setView(frame.current);
        editing?.selectBox(keysInBox(library, editing.document, box), current.adding);
        clickSuppressed.current = true;
      } else if (!current.adding) {
        editing?.pressSheet({ x: snap(current.from.x), y: snap(current.from.y) });
      }
      return;
    }
    if (current?.kind === "lead") {
      const wire = editing?.document.wires.find((candidate) => candidate.id === current.id);
      const letGo = current.dragged ? tethers.current?.release() : null;
      if (!current.dragged) {
        editing?.select({ kind: "wire", id: current.id });
      } else if (wire && letGo && !tethers.current?.laid) {
        // Let go while hanging, it hangs through that point from now on — between the two holds it was taken from between.
        // On the table it simply lies where it was put: a point to hang it from would only fold it there.
        const bends = [...wire.bends];
        bends.splice(letGo.span, 0, { x: Math.round(letGo.at.x), y: Math.round(letGo.at.y) });
        editing?.setWireBends(wire.id, bends);
      }
      return;
    }
    if (current?.kind === "text") {
      if (current.dragged && textDrag) {
        editing?.setItemLabel(current.id, current.text, textDrag.offset);
      }
      setTextDrag(null);
      setDragFrame(null);
      return;
    }
    if (current?.kind === "probe") {
      const point = sheetPoint(event);
      setProbeDrag(null);
      if (point) {
        probeDrop.current?.(current.channel, point);
      }
      return;
    }
    if (current?.kind === "end") {
      const point = sheetPoint(event);
      setCarriedEnd(null);
      if (point) {
        editing?.reconnectWire(current.id, current.end, point);
      }
      return;
    }
    if (current?.kind === "hold") {
      const wire = editing?.document.wires.find((candidate) => candidate.id === current.id);
      const point = sheetPoint(event);
      if (wire && point) {
        editing?.setWireBends(wire.id, wire.bends.map((bend, index) => index === current.index ? { x: Math.round(point.x), y: Math.round(point.y) } : bend));
      }
      setHeldBend(null);
      return;
    }
    const point = sheetPoint(event);
    if (point) {
      editing?.releaseAt(point);
    }
  };
  // The click that ends a drag belongs to the drag; it does not choose the part.
  const suppressesClick = useCallback(() => {
    const suppressed = clickSuppressed.current;
    clickSuppressed.current = false;
    return suppressed;
  }, []);
  return {
    frame, view: view ?? dragFrame, moving, selecting, suppressesClick, partDown, portDown, wireDown, leadDown, holdDown, heldBend, endDown, carriedEnd, probeDown, probeDrag, textDown, textDrag, sheetDown, pointerMove, pointerUp,
    pointerLeave: () => editing?.pointerAt(null),
    zoomBy: (factor: number) => zoomAround(factor),
    fit: () => setView(null),
  };
}

/**
 * Where a wire answers the pointer, under the parts: a band wider than its stroke, and the selected wire marked. A lead
 * is taken hold of and pulled — let go, it hangs through that point —, and the points it hangs through are shown on the
 * chosen one: dragged to move, a double click to take away.
 */
function SheetWireHits({ document, editing, shapeOf, tetherOf, onWireDown, onLeadDown, onHoldDown, heldBend }: {
  document: SchematicDocument; editing: SheetEditing;
  shapeOf: (wire: DrawingWire) => string; tetherOf: (wire: DrawingWire) => string | undefined;
  onWireDown: (event: ReactPointerEvent<SVGElement>, id: string) => void;
  onLeadDown: (event: ReactPointerEvent<SVGElement>, id: string) => void;
  onHoldDown: (event: ReactPointerEvent<SVGElement>, id: string, index: number) => void;
  heldBend: { id: string; index: number; at: { x: number; y: number } } | null;
}) {
  return <g className="parallax-circuit-diagram-wire-hits">
    {document.wires.map((wire) => {
      const shape = shapeOf(wire);
      const tether = tetherOf(wire);
      const selected = editing.selected.includes(`wire:${wire.id}`);
      return <g key={wire.id}>
        {selected ? <path className="parallax-circuit-diagram-wire-selected" d={shape} data-tether={tether} /> : null}
        <path className={`parallax-circuit-diagram-wire-hit${tether ? " parallax-lead" : ""}`} d={shape} data-tether={tether}
          onPointerDown={(event) => tether && editing.tool === "select" ? onLeadDown(event, wire.id) : onWireDown(event, wire.id)} />
        {tether && selected ? wire.bends.map((bend, index) => {
          const at = heldBend && heldBend.id === wire.id && heldBend.index === index ? heldBend.at : bend;
          return <circle key={index} className="parallax-circuit-diagram-lead-hold" cx={at.x} cy={at.y} r="6"
            onPointerDown={(event) => onHoldDown(event, wire.id, index)}
            onDoubleClick={() => editing.setWireBends(wire.id, wire.bends.filter((_, position) => position !== index))}>
            <title>Where the lead hangs: drag to move, double-click to let it hang free</title>
          </circle>;
        }) : null}
      </g>;
    })}
  </g>;
}

/**
 * What a sheet being worked on shows over its parts: with Wire in hand, every contact as a target; the wire being drawn
 * as the router lays it; and the contact or wire point the pointer is drawn to.
 */
function SheetEditingLayer({ document, editing, onPortDown, onEndDown, carriedEnd }: {
  document: SchematicDocument; editing: SheetEditing; onPortDown: (event: ReactPointerEvent<SVGElement>, key: string) => void;
  onEndDown: (event: ReactPointerEvent<SVGElement>, id: string, end: WireEnd) => void;
  carriedEnd: CarriedEnd | null;
}) {
  const library = useParallaxPartLibrary();
  const chosen = editing.tool === "select" ? editing.selectedWire : null;
  const ends = chosen ? wirePoints(library, document, chosen) : [];
  const carried = carriedEnd ? document.wires.find((wire) => wire.id === carriedEnd.id) : undefined;
  // Every selected part framed by its body: a colour alone did not show on symbols drawn in their own strokes.
  const framed = selectedItemIds(editing.selected).map((id) => document.items.find((item) => item.id === id))
    .filter((item): item is DrawingItem => !!item && item.type !== "JUNCTION").map((item) => ({ id: item.id, box: itemBox(library, item) }));
  return <g className="parallax-circuit-diagram-edit-layer">
    {framed.map(({ id, box }) => <rect key={id} className="parallax-selection-frame" x={box.x - 6} y={box.y - 6} width={box.width + 12} height={box.height + 12} />)}
    {chosen && ends.length > 1 ? (["from", "to"] as const).map((end) => {
      const at = end === "from" ? ends[0] : ends[ends.length - 1];
      return <circle key={end} className="parallax-circuit-diagram-wire-end" cx={at.x} cy={at.y} r="7" onPointerDown={(event) => onEndDown(event, chosen.id, end)}>
        <title>Drag to plug this end into another contact or wire; let go on nothing to unplug it</title>
      </circle>;
    }) : null}
    {carried && carriedEnd ? <>
      <path className="parallax-circuit-diagram-wire-preview" d={wirePath(carriedEnd.end === "from"
        ? [carriedEnd.target?.at ?? carriedEnd.at, ...carried.bends, ...wirePoints(library, document, carried).slice(-1)]
        : [...wirePoints(library, document, carried).slice(0, 1), ...carried.bends, carriedEnd.target?.at ?? carriedEnd.at])} />
      {carriedEnd.target ? <circle className="parallax-circuit-diagram-magnet" cx={carriedEnd.target.at.x} cy={carriedEnd.target.at.y} r="8" /> : null}
    </> : null}
    {editing.tool === "wire" ? document.items.flatMap((item) => portsOf(library, item).map((port) => {
      const key = portKey(item.id, port.name);
      const at = positionOf(library, item, port.name);
      return <circle key={key} className={`parallax-circuit-diagram-port-target${editing.pending?.start.kind === "port" && editing.pending.start.key === key ? " parallax-pending" : ""}`} cx={at.x} cy={at.y} r="12"
        onPointerDown={(event) => onPortDown(event, key)}><title>{`${item.id} · ${port.name}`}</title></circle>;
    })) : null}
    {editing.preview.length > 1 ? <path className="parallax-circuit-diagram-wire-preview" d={wirePath(editing.preview)} /> : null}
    {editing.target ? <circle className="parallax-circuit-diagram-magnet" cx={editing.target.at.x} cy={editing.target.at.y} r="8" /> : null}
  </g>;
}

/** An invisible plate over a part's body, so the whole of it is pressed, not only the lines it is drawn with. */
function BodyTarget({ library, item }: { library: PartLibraryView; item: DrawingItem }) {
  const { halfWidth, halfHeight } = bodyOf(library, item);
  // Styled inline: a sheet's own rule for a part's rectangles (an authored box) would otherwise paint it.
  return <rect className="parallax-circuit-diagram-body-target" x={-halfWidth} y={-halfHeight} width={2 * halfWidth} height={2 * halfHeight}
    style={{ fill: "transparent", stroke: "none", pointerEvents: "all" }} />;
}

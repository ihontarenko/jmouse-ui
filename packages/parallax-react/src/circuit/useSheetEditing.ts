import { useParallaxTransport, useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { boxed, clicked, EditHistory } from "@jmouse/parallax/editor";
import { editorKey } from "../editor/editorKeys";
import { SHEET_TOOLS } from "./sheetTools";
import type { ComponentModelView } from "@jmouse/parallax";
import type { PartText } from "@jmouse/parallax/schematic";
import {
  type CircuitElement, copiedTogether, createDrawingItem, itemKey, parseSheetKey, rewiredTo, selectedItemIds, selectedWireIds, wireKey, newNetLabel, cutWire, type DrawingItem, type DrawingWire, endingAt, insertedInto, isLead, labelOf, magnetAt, type MeterShow, nearestOnWire, nextDrawingId, parsePort, portPoint, previewWire, rerouted, resolvedOn, sameTarget, type SchematicDocument, type SheetPlacement, type SheetPoint, type SheetSelection, type SheetTool, snap, type WireEnd, wireId, type WireTarget,
} from "@jmouse/parallax/circuit";

const HISTORY_LIMIT = 100;
/** What an arrow key moves the selection by: one grid step. */
const NUDGE_STEP = 20;

export interface SheetEditing {
  document: SchematicDocument;
  /** Whether the sheet has been changed since it was `base`. */
  touched: boolean;
  reset: () => void;
  tool: SheetTool;
  chooseTool: (tool: SheetTool) => void;
  placement: SheetPlacement | null;
  startPlacement: (placement: SheetPlacement) => void;
  placeComponent: (reference: string) => Promise<void>;
  loadingComponent: boolean;
  componentProblem: string;
  /** The one thing selected, when exactly one is — what the properties panel edits; null for none or several. */
  selection: SheetSelection;
  /** Everything selected: parts and wires by key (`item:R1`, `wire:wire-7`), in the order taken. */
  selected: readonly string[];
  select: (selection: SheetSelection) => void;
  /** Shift-click: a part or a wire added to the selection, or taken out of it. */
  toggle: (selection: NonNullable<SheetSelection>) => void;
  /** A box let go: what it holds selected — added to what was, with Shift. */
  selectBox: (keys: readonly string[], adding: boolean) => void;
  /** Moves the parts by the same distance, their wires laid afresh; one step. */
  moveItems: (ids: readonly string[], dx: number, dy: number) => void;
  selectedItem: DrawingItem | null;
  selectedWire: DrawingWire | null;
  /** The wire being drawn: where it starts — a contact, or a point on a wire — and the corners clicked so far. */
  pending: { start: WireTarget; bends: SheetPoint[] } | null;
  /** Where the pointer is, drawn to a contact or a wire when one is near. */
  pointer: SheetPoint | null;
  target: WireTarget | null;
  /** The wire being drawn as the router would lay it to the pointer: what is shown is what will be made. */
  preview: SheetPoint[];
  message: string;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  rotate: () => void;
  mirror: () => void;
  remove: () => void;
  /** Takes a part off the sheet, with every wire on it. */
  removeItem: (id: string) => void;
  /**
   * Carries one end of a wire to where it is let go: onto a contact or a wire it is plugged in there; onto nothing it is
   * unplugged and the wire is gone — as a test lead is taken off one point and put on another.
   */
  reconnectWire: (id: string, end: WireEnd, point: SheetPoint) => void;
  /** What a wire's end would be plugged into if let go at `point`: a contact or a wire, never its own other end. */
  plugAt: (id: string, end: WireEnd, point: SheetPoint) => WireTarget | null;
  /** The points a wire is laid or hung through, in order. */
  setWireBends: (id: string, bends: SheetPoint[]) => void;
  /** Where a text of a part stands, from its centre — or, null, back to where the sheet places it. */
  setItemLabel: (id: string, text: PartText, offset: SheetPoint | null) => void;
  /** How an instrument part's display reads — kept in its layout line, saved with the circuit. */
  setItemShows: (id: string, shows: MeterShow[]) => void;
  duplicate: () => void;
  /** Ctrl C: keeps the selected part on the sheet's own clipboard. */
  copySelected: () => void;
  /** Ctrl V: places the copied part under the pointer, or a step further from it when the pointer is off the sheet. */
  paste: () => void;
  changeItem: (changes: Partial<DrawingItem>, elementChanges?: Partial<CircuitElement>) => void;
  /**
   * Every part drawn from a component, whichever revision it was pinned to, moved to another reference — the revision
   * just saved; one step, undone at once. The ids of the parts it moved.
   */
  retarget: (slug: string, reference: string) => string[];
  moveItem: (id: string, x: number, y: number) => void;
  pressPort: (key: string) => void;
  pressWire: (id: string, point: SheetPoint) => void;
  pressSheet: (point: SheetPoint) => void;
  releaseAt: (point: SheetPoint) => void;
  pointerAt: (point: SheetPoint | null) => void;
  keys: (event: KeyboardEvent<Element>) => void;
}

/**
 * The sheet being edited. Until its first change it IS `base` — the circuit as the caller draws it, which may still be
 * laid out again as symbols arrive —; from then on it is its own. `onEdit` hears every change that is kept, never the
 * previews of a gesture; `reset` gives the sheet back to `base`.
 */
export function useSheetEditing(base: SchematicDocument, onEdit: (document: SchematicDocument) => void): SheetEditing {
  const transport = useParallaxTransport();
  const library = useParallaxPartLibrary();
  const [own, setOwn] = useState<SchematicDocument | null>(null);
  const document = own ?? base;
  const current = useRef(document);
  current.current = document;
  const history = useRef(new EditHistory<SchematicDocument>(HISTORY_LIMIT)).current;
  const [, setRevision] = useState(0);
  const [tool, setTool] = useState<SheetTool>("select");
  const [placement, setPlacement] = useState<SheetPlacement | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const keyOf = (one: NonNullable<SheetSelection>) => one.kind === "item" ? itemKey(one.id) : wireKey(one.id);
  const setSelection = (next: SheetSelection) => setSelected(next ? [keyOf(next)] : []);
  const selection: SheetSelection = selected.length === 1 ? parseSheetKey(selected[0]) : null;
  // A gesture's events can follow each other before the sheet is drawn again, so what they read — the wire being drawn,
  // the target the pointer is drawn to — is kept in refs as well as shown.
  const [pending, showPending] = useState<SheetEditing["pending"]>(null);
  const pendingRef = useRef(pending);
  const setPending = (next: SheetEditing["pending"]) => {
    pendingRef.current = next;
    showPending(next);
  };
  const [pointer, setPointer] = useState<SheetPoint | null>(null);
  const [target, showTarget] = useState<WireTarget | null>(null);
  const targetRef = useRef(target);
  const setTarget = (next: WireTarget | null) => {
    targetRef.current = next;
    showTarget(next);
  };
  const [message, setMessage] = useState("Choose a part, then click the sheet. Wire (W) connects contacts and wires.");
  const [loadingComponent, setLoadingComponent] = useState(false);
  const [componentProblem, setComponentProblem] = useState("");
  const edited = useRef(onEdit);
  edited.current = onEdit;

  const show = (next: SchematicDocument) => {
    current.current = next;
    setOwn(next);
  };
  const reset = useCallback(() => {
    history.clear();
    setOwn(null);
    setSelection(null);
    setPending(null);
  }, []);
  const commit = (next: SchematicDocument) => {
    if (!history.record(current.current, next)) {
      return;
    }
    show(next);
    edited.current(next);
    setRevision((revision) => revision + 1);
  };
  const restore = (next: SchematicDocument | null) => {
    if (!next) {
      return;
    }
    show(next);
    edited.current(next);
    setSelection(null);
    setPending(null);
    setRevision((revision) => revision + 1);
  };

  const undo = () => restore(history.undo(current.current));
  const redo = () => restore(history.redo(current.current));

  const chooseTool = (next: SheetTool) => {
    setTool(next);
    setPlacement(null);
    if (next !== "wire") {
      setPending(null);
    }
  };
  const startPlacement = (next: SheetPlacement) => {
    setPlacement(next);
    setTool("select");
    setPending(null);
    setMessage(`Click the sheet to place ${next.type === "MODEL" ? next.component : labelOf(next.type)} — on a wire, a part of two contacts goes into its break. Esc cancels.`);
  };
  const placeComponent = async (reference: string) => {
    setLoadingComponent(true);
    setComponentProblem("");
    try {
      const detail: ComponentModelView = await transport.components.model(reference);
      const unit = detail.units[0] ?? "";
      const pins = Object.fromEntries(detail.pins.map((pin) => [pin.shared || !unit ? pin.name : `${unit}.${pin.name}`, ""]));
      library.rememberComponentModel(reference, detail);
      startPlacement({ type: "MODEL", component: reference, pins });
    } catch {
      setComponentProblem(`Could not load ${reference}.`);
    } finally {
      setLoadingComponent(false);
    }
  };

  const updateItems = (change: (item: DrawingItem) => DrawingItem) => commit({ ...current.current, items: current.current.items.map(change) });
  const selectedItem = selection?.kind === "item" ? document.items.find((item) => item.id === selection.id) ?? null : null;
  const selectedWire = selection?.kind === "wire" ? document.wires.find((wire) => wire.id === selection.id) ?? null : null;

  // Each selected part turns about its own centre; one step for all of them.
  const rotate = () => {
    const ids = selectedItemIds(selectedRef.current);
    if (ids.length) {
      let sheet: SchematicDocument = { ...current.current, items: current.current.items.map((item) => ids.includes(item.id)
        ? { ...item, rotation: (item.rotation + 90) % 360 } : item) };
      for (const id of ids) {
        sheet = rerouted(sheet, id);
      }
      commit(sheet);
    }
  };
  const mirror = () => {
    const ids = selectedItemIds(selectedRef.current);
    if (ids.length) {
      updateItems((item) => ids.includes(item.id) ? { ...item, mirrored: !item.mirrored } : item);
    }
  };
  // A part goes with every wire on it.
  const removeItem = (id: string) => {
    const sheet = current.current;
    commit({ ...sheet, items: sheet.items.filter((item) => item.id !== id),
      wires: sheet.wires.filter((wire) => parsePort(wire.from).id !== id && parsePort(wire.to).id !== id) });
    setSelected((now) => now.filter((key) => key !== itemKey(id)));
  };
  const plugAt = (id: string, end: WireEnd, point: SheetPoint): WireTarget | null => {
    const sheet = current.current;
    const wire = sheet.wires.find((candidate) => candidate.id === id);
    if (!wire) {
      return null;
    }
    const kept = end === "from" ? wire.to : wire.from;
    const target = magnetAt(library, sheet, point, { kind: "port", key: kept, at: portPoint(library, sheet, kept) });
    return target?.kind === "wire" && target.id === id ? null : target;
  };
  const reconnectWire = (id: string, end: WireEnd, point: SheetPoint) => {
    const sheet = current.current;
    const wire = sheet.wires.find((candidate) => candidate.id === id);
    if (!wire) {
      return;
    }
    const target = plugAt(id, end, point);
    if (!target) {
      commit({ ...sheet, wires: sheet.wires.filter((candidate) => candidate.id !== id) });
      setSelection(null);
      setMessage(`Unplugged from ${parsePort(end === "from" ? wire.from : wire.to).id}.`);
      return;
    }
    const plugged = endingAt(library, sheet, target, target.at);
    // A lead keeps the points it hangs through; a routed wire is laid afresh to its new end.
    const bends = isLead(library, sheet, wire) ? wire.bends : [];
    const moved = end === "from" ? { ...wire, from: plugged.to, bends } : { ...wire, to: plugged.to, bends };
    if (moved.from === moved.to) {
      return;
    }
    commit({ ...plugged.document, wires: [...plugged.document.wires.filter((candidate) => candidate.id !== id), moved] });
    setMessage(`Plugged into ${parsePort(plugged.to).id}.`);
  };
  const setWireBends = (id: string, bends: SheetPoint[]) => {
    commit({ ...current.current, wires: current.current.wires.map((wire) => wire.id === id ? { ...wire, bends } : wire) });
  };
  const setItemLabel = (id: string, text: PartText, offset: SheetPoint | null) => {
    commit({ ...current.current, items: current.current.items.map((item) => {
      if (item.id !== id) {
        return item;
      }
      const labels = { ...item.labels };
      if (offset) {
        labels[text] = { x: Math.round(offset.x), y: Math.round(offset.y) };
      } else {
        delete labels[text];
      }
      return { ...item, labels };
    }) });
  };
  const setItemShows = (id: string, shows: MeterShow[]) => {
    commit({ ...current.current, items: current.current.items.map((item) => {
      if (item.id !== id) {
        return item;
      }
      const { shows: _, ...rest } = item;
      return shows.length ? { ...rest, shows } : rest;
    }) });
  };
  // Everything selected goes in one step: the parts with every wire on them, and the wires.
  const remove = () => {
    const itemIds = new Set(selectedItemIds(selectedRef.current));
    const wireIds = new Set(selectedWireIds(selectedRef.current));
    if (!itemIds.size && !wireIds.size) {
      return;
    }
    const sheet = current.current;
    commit({ ...sheet, items: sheet.items.filter((item) => !itemIds.has(item.id)),
      wires: sheet.wires.filter((wire) => !wireIds.has(wire.id) && !itemIds.has(parsePort(wire.from).id) && !itemIds.has(parsePort(wire.to).id)) });
    setSelected([]);
  };
  /**
   * Copies of parts — and of the wires between them — moved by (dx, dy), each under the next free id of its kind; a
   * net label's copy is another flag of the same net, so it joins that net wherever it is put. The copies are what is
   * selected afterwards, so they can be carried on at once.
   */
  const placeCopies = (originals: readonly DrawingItem[], wires: readonly DrawingWire[], dx: number, dy: number) => {
    let items = current.current.items;
    const renamed = new Map<string, string>();
    const copies: DrawingItem[] = [];
    for (const original of originals) {
      const x = snap(original.x + dx);
      const y = snap(original.y + dy);
      const id = original.type === "GROUND" && original.label ? newNetLabel(items, x, y).id
        : nextDrawingId(library, items, original.type, original.element?.component ?? undefined);
      const copy: DrawingItem = { ...structuredClone(original), id, x, y,
        element: original.element ? { ...structuredClone(original.element), id } : undefined };
      renamed.set(original.id, id);
      copies.push(copy);
      items = [...items, copy];
    }
    const wireCopies = wires.map((wire) => rewiredTo(wire, renamed, wireId(), snap(dx), snap(dy)));
    commit({ ...current.current, items, wires: [...current.current.wires, ...wireCopies] });
    setSelected([...copies.map((copy) => itemKey(copy.id)), ...wireCopies.map((wire) => wireKey(wire.id))]);
    setMessage(copies.length === 1 ? `${copies[0].id} placed — a copy of ${originals[0].id}.` : `${copies.length} parts placed — copies.`);
  };
  const duplicate = () => {
    const { items, wires } = copiedTogether(current.current, selectedRef.current);
    if (items.length) {
      placeCopies(items, wires, 80, 80);
    }
  };
  /** The sheet's own clipboard: the parts copied with the wires between them, and how often pasted where no pointer was. */
  const clipboard = useRef<{ items: DrawingItem[]; wires: DrawingWire[]; pasted: number } | null>(null);
  const copySelected = () => {
    const { items, wires } = copiedTogether(current.current, selectedRef.current);
    if (items.length) {
      clipboard.current = { items: structuredClone(items), wires: structuredClone(wires), pasted: 0 };
      setMessage(items.length === 1 ? `${items[0].id} copied — Ctrl V places it.` : `${items.length} parts copied — Ctrl V places them.`);
    }
  };
  /** Pastes with the first part under the pointer when it is on the sheet; otherwise a step further each time. */
  const paste = () => {
    const copied = clipboard.current;
    if (!copied || !copied.items.length) {
      return;
    }
    copied.pasted++;
    const anchor = copied.items[0];
    const dx = pointer ? pointer.x - anchor.x : 40 * copied.pasted;
    const dy = pointer ? pointer.y - anchor.y : 40 * copied.pasted;
    placeCopies(copied.items, copied.wires, dx, dy);
  };
  const toggle = (one: NonNullable<SheetSelection>) => setSelected((now) => clicked(now, keyOf(one), true));
  const selectBox = (keys: readonly string[], adding: boolean) => setSelected((now) => boxed(now, keys, adding));
  const selectAll = () => setSelected([...current.current.items.map((item) => itemKey(item.id)), ...current.current.wires.map((wire) => wireKey(wire.id))]);
  const moveItems = (ids: readonly string[], dx: number, dy: number) => {
    if (!ids.length || (dx === 0 && dy === 0)) {
      return;
    }
    let sheet: SchematicDocument = { ...current.current, items: current.current.items.map((item) => ids.includes(item.id)
      ? { ...item, x: item.x + dx, y: item.y + dy } : item),
      // A wire whose both ends move goes along whole; the rest are laid afresh to where their parts now stand.
      wires: current.current.wires.map((wire) => ids.includes(parsePort(wire.from).id) && ids.includes(parsePort(wire.to).id)
        ? { ...wire, bends: wire.bends?.map((bend) => ({ x: bend.x + dx, y: bend.y + dy })) } : wire) };
    for (const id of ids) {
      sheet = rerouted(sheet, id);
    }
    commit(sheet);
  };
  const changeItem = (changes: Partial<DrawingItem>, elementChanges?: Partial<CircuitElement>) => {
    if (selectedItem) {
      updateItems((item) => item.id === selectedItem.id
        ? { ...item, ...changes, element: item.element ? { ...item.element, ...elementChanges } : undefined } : item);
    }
  };
  const retarget = (slug: string, reference: string) => {
    const moved = current.current.items.filter((item) => item.element?.component && item.element.component.split("@")[0] === slug && item.element.component !== reference);
    if (moved.length) {
      updateItems((item) => moved.includes(item) && item.element ? { ...item, element: { ...item.element, component: reference } } : item);
    }
    return moved.map((item) => item.id);
  };
  // A moved part takes its wires with it, laid afresh by the router: corners drawn for where it stood would bend them
  // around nothing.
  const moveItem = (id: string, x: number, y: number) => {
    commit(rerouted({ ...current.current, items: current.current.items.map((item) => item.id === id ? { ...item, x, y } : item) }, id));
  };

  // A wire is made in one step, both ends at once: a wire it starts or ends on is cut by a junction only then, so a
  // wire given up leaves nothing behind, and one undo takes the whole of it back.
  const addWire = (start: WireTarget, end: WireTarget, bends: SheetPoint[]) => {
    if (sameTarget(start, end)) {
      return;
    }
    const from = endingAt(library, current.current, start, start.at);
    const to = endingAt(library, from.document, resolvedOn(library, from.document, end), end.at);
    // A second wire between the same two contacts joins nothing that is not joined already.
    if (to.document.wires.some((wire) => (wire.from === from.to && wire.to === to.to) || (wire.from === to.to && wire.to === from.to))) {
      return;
    }
    commit({ ...to.document, wires: [...to.document.wires, { id: wireId(), from: from.to, to: to.to, bends }] });
    setMessage(start.kind === "wire" || end.kind === "wire" ? "Joined to the wire at a new junction." : "Connected. Start another from any contact or wire.");
  };
  const finishAt = (end: WireTarget) => {
    const pending = pendingRef.current;
    if (pending) {
      addWire(pending.start, end, pending.bends);
      setPending(null);
    }
  };
  const begin = (start: WireTarget) => {
    setPending({ start, bends: [] });
    setMessage("Release on a contact or a wire — or click there; a click on the sheet adds a corner.");
  };

  const pressPort = (key: string) => {
    const pending = pendingRef.current;
    if (tool !== "wire") {
      setSelection({ kind: "item", id: parsePort(key).id });
      return;
    }
    const port: WireTarget = { kind: "port", key, at: portPoint(library, current.current, key) };
    if (!pending) {
      begin(port);
    } else if (sameTarget(pending.start, port)) {
      setPending(null);
    } else {
      finishAt(port);
    }
  };
  // A part in hand dropped on a wire goes into its break, turned along it — an ammeter is put in as on a bench.
  const insertPlacement = (id: string, point: SheetPoint): boolean => {
    const inserted = placement ? insertedInto(library, current.current, id, point, placement) : null;
    if (!inserted) {
      return false;
    }
    commit(inserted.document);
    setSelection({ kind: "item", id: inserted.item });
    setPlacement(null);
    setMessage(`${inserted.item} put into the break of the wire.`);
    return true;
  };
  const pressWire = (id: string, point: SheetPoint) => {
    const pending = pendingRef.current;
    if (placement) {
      if (!insertPlacement(id, point)) {
        pressSheet({ x: snap(point.x), y: snap(point.y) });
      }
      return;
    }
    if (tool === "cut") {
      const cut = cutWire(library, current.current, id, point);
      if (cut) {
        commit(cut);
        setMessage("Cut into two open ends: wire an instrument between them.");
      }
      return;
    }
    if (tool !== "wire") {
      setSelection({ kind: "wire", id });
      return;
    }
    const at = nearestOnWire(library, current.current, id, point)?.at;
    if (!at) {
      return;
    }
    if (pending) {
      finishAt({ kind: "wire", id, at });
    } else {
      begin({ kind: "wire", id, at });
    }
  };
  const pressSheet = (point: SheetPoint) => {
    const pending = pendingRef.current;
    const target = targetRef.current;
    if (placement) {
      if (target?.kind === "wire" && insertPlacement(target.id, target.at)) {
        return;
      }
      const items = current.current.items;
      const created = placement.label ? newNetLabel(items, point.x, point.y)
        : createDrawingItem(library, items, placement.type, point.x, point.y, placement.component, placement.pins);
      const item = placement.common ? { ...created, common: true } : created;
      commit({ ...current.current, items: [...current.current.items, item] });
      setSelection({ kind: "item", id: item.id });
      setPlacement(null);
      setMessage(`${item.id} placed. Wire (W) connects it.`);
      return;
    }
    if (tool === "wire" && pending) {
      if (target) {
        finishAt(target);
      } else {
        setPending({ ...pending, bends: [...pending.bends, point] });
      }
      return;
    }
    // A press near a contact or a wire is a press on it: the magnet works where a wire starts as where it ends.
    if (tool === "wire" && target) {
      begin(target);
      return;
    }
    setSelection(null);
  };
  // A wire dragged out of a contact or a wire ends where it is let go, when that is a contact or a wire.
  const releaseAt = (point: SheetPoint) => {
    const pending = pendingRef.current;
    if (tool !== "wire" || !pending) {
      return;
    }
    const end = magnetAt(library, current.current, point, pending.start);
    if (end && Math.hypot(end.at.x - pending.start.at.x, end.at.y - pending.start.at.y) > 0) {
      finishAt(end);
    }
  };
  const pointerAt = (point: SheetPoint | null) => {
    const pending = pendingRef.current;
    if (!point) {
      setPointer(null);
      setTarget(null);
      return;
    }
    // Drawing a wire, a contact or a wire draws the pointer; with a part in hand or the cut tool, only a wire does.
    const near = tool === "wire" || tool === "cut" || placement ? magnetAt(library, current.current, point, pending?.start) : null;
    const drawn = tool === "wire" || near?.kind === "wire" ? near : null;
    const at = drawn?.at ?? { x: snap(point.x), y: snap(point.y) };
    if (!sameTarget(targetRef.current, drawn)) {
      setTarget(drawn);
    }
    setPointer((previous) => previous && previous.x === at.x && previous.y === at.y ? previous : at);
  };
  // The keys are the editor's: one table for the sheet and the symbol editor alike (`editorKey`).
  const keys = (event: KeyboardEvent<Element>) => {
    editorKey(event, {
      cancel: () => {
        setPending(null);
        setPlacement(null);
        setTool("select");
        setSelected([]);
      },
      remove, undo, redo,
      copy: copySelected,
      cut: () => {
        copySelected();
        remove();
      },
      paste, duplicate, selectAll, rotate, mirror,
      nudge: (dx, dy) => moveItems(selectedItemIds(selectedRef.current), dx * NUDGE_STEP, dy * NUDGE_STEP),
      tools: Object.fromEntries(SHEET_TOOLS.map((choice) => [choice.key, () => chooseTool(choice.value)])),
    });
  };

  const preview = useMemo(() => pending && pointer ? previewWire(library, document, pending.start, pending.bends, target, pointer) : [],
    [document, pending, pointer, target]);

  return {
    document, touched: own !== null, reset, tool, chooseTool, placement, startPlacement, placeComponent, loadingComponent, componentProblem,
    selection, selected, select: useCallback((next: SheetSelection) => setSelected(next ? [next.kind === "item" ? itemKey(next.id) : wireKey(next.id)] : []), []),
    toggle, selectBox, moveItems, selectedItem, selectedWire,
    pending, pointer, target, preview, message,
    canUndo: history.canUndo, canRedo: history.canRedo, undo, redo,
    rotate, mirror, remove, removeItem, reconnectWire, plugAt, setWireBends, setItemLabel, setItemShows, duplicate, copySelected, paste, changeItem, retarget, moveItem, pressPort, pressWire, pressSheet, releaseAt, pointerAt, keys,
  };
}


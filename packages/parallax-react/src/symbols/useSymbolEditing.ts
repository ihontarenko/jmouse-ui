import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { SymbolDrawingDocument } from "@jmouse/parallax/schematic";
import {
  copiedSelection, freePinName, MAXIMUM_PINS, movedSelection, pastedInto, pinKey, selectedPins, selectedShapes, shapeKey, shapePath,
  shapesOf, symbolKeysInBox, turnedSelection, withoutSelection, withShapes, type SymbolClipboard, type SymbolShapeTool,
} from "@jmouse/parallax/component";
import { boxBetween, boxed, clicked, EditHistory, panned, snapped, zoomedAbout, zoomedAtCentre, type Box, type Frame } from "@jmouse/parallax/editor";
import { editorKey } from "../editor/editorKeys";
import type { EditorTool } from "../editor/EditorControls";

/** What is in hand while a symbol is drawn. */
export type SymbolTool = "select" | SymbolShapeTool | "pin" | "pan";

/** The symbol editor's tools — V and H as in every editor; B (box) for a rectangle, since R rotates the selection everywhere. */
export const SYMBOL_TOOLS: readonly EditorTool<SymbolTool>[] = [
  { value: "select", label: "Select", icon: "cursor", key: "v", title: "Select and move; drag on empty sheet to select with a box" },
  { value: "line", label: "Line", icon: "line", key: "l", title: "Draw a line: click its two ends" },
  { value: "rectangle", label: "Box", icon: "rectangle", key: "b", title: "Draw a rectangle: click two corners" },
  { value: "ellipse", label: "Ellipse", icon: "ellipse", key: "e", title: "Draw an ellipse: click two corners of its box" },
  { value: "pin", label: "Pin", icon: "pin-point", key: "p", title: "Place a pin where a wire arrives" },
  { value: "pan", label: "Pan", icon: "pan", key: "h", title: "Pan the drawing (or drag with the middle button)" },
];

/** The grid a point lands on: off, every unit, or every five. */
export type SnapStep = 0 | 1 | 5;

const INITIAL_FRAME: Frame = { x: -80, y: -60, width: 160, height: 120 };
const FRAME_LIMITS = { minimumWidth: 40, maximumWidth: 320 };
const WHEEL_STEP = 1.15;
/** Where a point may stand: the drawing's sheet. */
const REACH = { x: 80, y: 60 };

type Point = { x: number; y: number };

type Gesture =
  | { kind: "pan"; startX: number; startY: number; frame: Frame }
  | { kind: "move"; start: Point; before: SymbolDrawingDocument; keys: readonly string[]; moved: boolean }
  | { kind: "box"; from: Point; adding: boolean; dragged: boolean };

/**
 * A symbol drawing being edited — the symbol editor's model, as `useSheetEditing` is the sheet's: the tool in hand, the
 * selection (a set of shapes and pins), the history, the clipboard, the view and the gestures, built on the editor
 * shared with the sheet (`@jmouse/parallax/editor`, `editorKey`). Controlled: the drawing is the host's.
 */
export function useSymbolEditing(drawing: SymbolDrawingDocument, setDrawing: (next: SymbolDrawingDocument) => void, subject: unknown) {
  const sheet = useRef<SVGSVGElement>(null);
  const current = useRef(drawing);
  current.current = drawing;
  const history = useRef(new EditHistory<SymbolDrawingDocument>()).current;
  const [, setRevision] = useState(0);
  // A symbol that has a drawing opens to be worked on — Select —; a blank one to be drawn — Line.
  const [tool, setTool] = useState<SymbolTool>(() => shapesOf(drawing).length ? "select" : "line");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [start, setStart] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [frame, setFrame] = useState<Frame>(INITIAL_FRAME);
  const [snapStep, setSnapStep] = useState<SnapStep>(5);
  const [selecting, setSelecting] = useState<Box | null>(null);
  const [problem, setProblem] = useState("");
  const gesture = useRef<Gesture | null>(null);
  const clipboard = useRef<(SymbolClipboard & { pasted: number }) | null>(null);
  const snap = (value: number) => snapStep === 0 ? Math.round(value * 10) / 10 : snapped(value, snapStep);

  // Another symbol is a fresh sheet: nothing selected, the whole grid in view, no history.
  useEffect(() => {
    setStart(null);
    setSelected([]);
    setFrame(INITIAL_FRAME);
    setProblem("");
    history.clear();
  }, [subject, history]);

  const commit = (next: SymbolDrawingDocument, before = current.current) => {
    if (history.record(before, next)) {
      setRevision((revision) => revision + 1);
    }
    setDrawing(next);
  };
  const restore = (next: SymbolDrawingDocument | null) => {
    if (!next) {
      return;
    }
    setDrawing(next);
    setSelected([]);
    setStart(null);
    setRevision((revision) => revision + 1);
  };
  const undo = () => restore(history.undo(current.current));
  const redo = () => restore(history.redo(current.current));

  /** A point of the drawing under the pointer, unsnapped. */
  const rawPointOf = (event: { clientX: number; clientY: number }): Point | null => {
    const svg = sheet.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) {
      return null;
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  /** The point a tool takes: on the grid, within the sheet. */
  const pointOf = (event: { clientX: number; clientY: number }): Point => {
    const point = rawPointOf(event) ?? { x: 0, y: 0 };
    return { x: Math.max(-REACH.x, Math.min(REACH.x, snap(point.x))), y: Math.max(-REACH.y, Math.min(REACH.y, snap(point.y))) };
  };

  // The wheel zooms about the pointer, as on the sheet: what is under it stays under it.
  useEffect(() => {
    const element = sheet.current;
    if (!element) {
      return;
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = rawPointOf(event);
      if (at) {
        setFrame((now) => zoomedAbout(now, event.deltaY < 0 ? 1 / WHEEL_STEP : WHEEL_STEP, at, FRAME_LIMITS));
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  const chooseTool = (next: SymbolTool) => {
    setTool(next);
    setStart(null);
  };
  const remove = () => {
    if (selectedRef.current.length) {
      commit(withoutSelection(current.current, selectedRef.current));
      setSelected([]);
    }
  };
  const nudge = (dx: number, dy: number) => {
    if (selectedRef.current.length) {
      const step = snapStep || 1;
      commit(movedSelection(current.current, selectedRef.current, dx * step, dy * step));
    }
  };
  const turn = (how: "quarter" | "mirror") => {
    if (selectedRef.current.length) {
      commit(turnedSelection(current.current, selectedRef.current, how));
    }
  };
  const rotate = () => turn("quarter");
  const mirror = () => turn("mirror");
  const copy = () => {
    const copied = copiedSelection(current.current, selectedRef.current);
    if (copied.shapes.length || copied.pins.length) {
      clipboard.current = { ...structuredClone(copied), pasted: 0 };
    }
  };
  const place = (copied: SymbolClipboard, dx: number, dy: number) => {
    const { drawing: next, keys } = pastedInto(current.current, copied, dx, dy);
    commit(next);
    setSelected(keys);
  };
  const paste = () => {
    const copied = clipboard.current;
    if (copied) {
      copied.pasted++;
      place(copied, 5 * copied.pasted, 5 * copied.pasted);
    }
  };
  const duplicate = () => {
    const copied = copiedSelection(current.current, selectedRef.current);
    if (copied.shapes.length || copied.pins.length) {
      place(copied, 5, 5);
    }
  };
  const selectAll = () => setSelected([...shapesOf(current.current).map((_, index) => shapeKey(index)),
    ...(current.current.pins ?? []).map((_, index) => pinKey(index))]);

  const keys = (event: KeyboardEvent) => {
    editorKey(event, {
      cancel: () => {
        setStart(null);
        setSelected([]);
      },
      remove, undo, redo, copy, paste, duplicate, selectAll, nudge, rotate, mirror,
      cut: () => {
        copy();
        remove();
      },
      tools: Object.fromEntries(SYMBOL_TOOLS.map((choice) => [choice.key, () => chooseTool(choice.value)])),
    });
  };

  /** A shape or a pin pressed with Select in hand: it is taken — added with Shift — and carried with the selection. */
  const pressThing = (event: PointerEvent<SVGElement>, key: string) => {
    if (tool !== "select" || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    sheet.current?.focus({ preventScroll: true });
    const adding = event.shiftKey || event.ctrlKey || event.metaKey;
    const next = adding ? clicked(selectedRef.current, key, true) : selectedRef.current.includes(key) ? selectedRef.current : [key];
    setSelected(next);
    if (!adding) {
      gesture.current = { kind: "move", start: pointOf(event), before: current.current, keys: next, moved: false };
      sheet.current?.setPointerCapture(event.pointerId);
    }
  };
  const pressSheet = (event: PointerEvent<SVGSVGElement>) => {
    sheet.current?.focus({ preventScroll: true });
    if (event.button === 1 || (event.button === 0 && tool === "pan")) {
      event.preventDefault();
      gesture.current = { kind: "pan", startX: event.clientX, startY: event.clientY, frame };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) {
      return;
    }
    if (tool === "select") {
      gesture.current = { kind: "box", from: rawPointOf(event) ?? { x: 0, y: 0 }, adding: event.shiftKey || event.ctrlKey || event.metaKey, dragged: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const point = pointOf(event);
    if (tool === "pin") {
      const pins = current.current.pins ?? [];
      if (pins.length >= MAXIMUM_PINS) {
        setProblem(`A symbol can have at most ${MAXIMUM_PINS} pins.`);
        return;
      }
      commit({ ...current.current, pins: [...pins, { name: freePinName(pins), ...point }] });
      setSelected([pinKey(pins.length)]);
      setProblem("");
      return;
    }
    if (!start) {
      setStart(point);
      setCursor(point);
      return;
    }
    const shapeTool = tool as SymbolShapeTool;
    if ((start.x !== point.x || start.y !== point.y) && (shapeTool !== "ellipse" || (start.x !== point.x && start.y !== point.y))) {
      const shapes = shapesOf(current.current);
      const turning = shapes.filter((shape) => !shape.upright);
      commit(withShapes(current.current, [...turning, { path: shapePath(shapeTool, start, point), upright: false }, ...shapes.filter((shape) => shape.upright)]));
      setSelected([shapeKey(turning.length)]);
    }
    setStart(null);
    setCursor(null);
  };
  const movePointer = (event: PointerEvent<SVGSVGElement>) => {
    const now = gesture.current;
    if (now?.kind === "pan") {
      const matrix = sheet.current?.getScreenCTM();
      if (matrix) {
        setFrame(panned(now.frame, (event.clientX - now.startX) / matrix.a, (event.clientY - now.startY) / matrix.d));
      }
      return;
    }
    if (now?.kind === "move") {
      const point = pointOf(event);
      // The selection moves by whole snap steps, its shapes' commands shifted — never resampled into polylines.
      setDrawing(movedSelection(now.before, now.keys, snap(point.x - now.start.x), snap(point.y - now.start.y)));
      now.moved = true;
      return;
    }
    if (now?.kind === "box") {
      const point = rawPointOf(event);
      if (point) {
        now.dragged = true;
        setSelecting(boxBetween(now.from, point));
      }
      return;
    }
    if (start) {
      setCursor(pointOf(event));
    }
  };
  const releasePointer = () => {
    const now = gesture.current;
    gesture.current = null;
    if (now?.kind === "move" && now.moved) {
      commit(current.current, now.before);
    }
    if (now?.kind === "box") {
      const box = selecting;
      setSelecting(null);
      if (now.dragged && box && Math.max(box.width, box.height) > 1) {
        setSelected((before) => boxed(before, symbolKeysInBox(current.current, box), now.adding));
      } else if (!now.adding) {
        setSelected([]);
      }
    }
  };

  return {
    sheet: sheet as RefObject<SVGSVGElement | null>, tool, chooseTool, selected, setSelected, start, cursor, frame, selecting, snapStep, setSnapStep,
    problem, commit, undo, redo, remove, duplicate, rotate, mirror, canUndo: history.canUndo, canRedo: history.canRedo, keys,
    pressThing, pressSheet, movePointer, releasePointer,
    zoomBy: (factor: number) => setFrame((now) => zoomedAtCentre(now, factor, FRAME_LIMITS)),
    fit: () => setFrame(INITIAL_FRAME),
    zoomPercent: Math.round(INITIAL_FRAME.width / frame.width * 100),
    selectedShapes: selectedShapes(selected), selectedPins: selectedPins(selected),
  };
}

export type SymbolEditing = ReturnType<typeof useSymbolEditing>;

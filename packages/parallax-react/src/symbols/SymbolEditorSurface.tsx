import { useState, type ReactNode } from "react";
import type { Category, ObjectDetail } from "@jmouse/parallax";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { Tool } from "../controls/BenchControls";
import { BenchGrid } from "../controls/BenchGrid";
import { ParallaxLink } from "../providers/ParallaxNavigation";
import { drawingExtent, readSymbolDrawing, type SymbolDrawingDocument } from "@jmouse/parallax/schematic";
import { pinKey, shapeKey, shapePath, shapesOf, withShapes, writeSymbolSource, type SymbolShapeTool } from "@jmouse/parallax/component";
import { EditActions, ToolPicker, ViewControls } from "../editor/EditorControls";
import { SYMBOL_TOOLS, useSymbolEditing } from "./useSymbolEditing";

/** A symbol as it is being edited: its identity and its drawing — what a save writes as its jMX text. */
export interface SymbolDraft {
  title: string;
  slug: string;
  category: string;
  drawing: SymbolDrawingDocument;
}

// A new symbol starts with the size and label anchors every catalogue symbol has.
const blank: SymbolDrawingDocument = { version: 1, width: 60, height: 40, paths: [],
  labels: [{ subject: "name", x: 0, y: -26 }, { subject: "value", x: 0, y: 32 }] };
/** The grid drawn under a symbol: a line every 2.5 units over the sheet, the tenth ones heavier. */
const GRID_LINES = Array.from({ length: 65 }, (_, index) => -80 + index * 2.5);
/** The draft a symbol opens as: the saved one's identity and drawing, or a blank sheet. */
export function symbolDraftOf(object: ObjectDetail | null): SymbolDraft {
  return {
    title: object?.summary.title ?? "",
    slug: object?.summary.slug ?? "",
    category: object?.summary.category ?? "CIRCUITS",
    drawing: readSymbolDrawing(typeof object?.definition.drawing === "string" ? object.definition.drawing : null) ?? blank,
  };
}

/** The identifier a symbol is saved under: the one written, else its title as a slug. */
export function symbolSlugOf(draft: SymbolDraft): string {
  return draft.slug.trim() || draft.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** What a new symbol's text is written from: its identity, with the saved object's summary, description and tags kept. */
export function symbolHeadOf(draft: SymbolDraft, object: ObjectDetail | null) {
  return { title: draft.title.trim(), slug: symbolSlugOf(draft),
    summary: object?.summary.summary || `${draft.title.trim()}, as drawn on a schematic`, description: object?.description ?? undefined,
    category: draft.category, tags: object?.summary.tags.length ? object.summary.tags : ["electronics", "schematic"] };
}

/** Why a draft cannot be saved yet, in words — or null when it can. */
export function symbolDraftProblem(draft: SymbolDraft): string | null {
  if (!draft.title.trim() || !(draft.drawing.paths.length + (draft.drawing.upright?.length ?? 0))) {
    return "Name the symbol and draw at least one stroke.";
  }
  const pinNames = (draft.drawing.pins ?? []).map((pin) => pin.name.trim());
  if (pinNames.some((name) => !/^[A-Za-z_][A-Za-z_0-9]{0,31}$/.test(name)) || new Set(pinNames).size !== pinNames.length) {
    return "Give each pin a unique name using letters, digits, and underscores.";
  }
  return null;
}

/**
 * The workbench's Symbol editor (Html/Parallax-UI/workbench.html): tools, layers and snap on the left; the drawing on
 * its grid; the identity, pins, label anchors and source on the right. Edits a symbol document — the drawing every
 * schematic, palette and component preview draws a part from. Controlled: the host keeps the draft and saves it (as its
 * jMX text), and wraps the surface in its own bar or dialog.
 */
export function SymbolEditorSurface({ object = null, value, onChange, categories, problem, identityExtra }: {
  /** The saved symbol, or null for a new one. */
  object?: ObjectDetail | null;
  value: SymbolDraft;
  onChange: (next: SymbolDraft) => void;
  categories: readonly Category[] | null;
  /** Why the last save was refused, shown under the drawing. */
  problem?: string | null;
  /** Identity fields the host adds — Parallax: where a new symbol is kept. */
  identityExtra?: ReactNode;
}) {
  const { title, slug, category, drawing } = value;
  const shapes = shapesOf(drawing);
  const setDrawing = (next: SymbolDrawingDocument) => onChange({ ...value, drawing: next });
  const editing = useSymbolEditing(drawing, setDrawing, object);
  const { commit, tool, frame, selected, selectedShapes, selectedPins } = editing;
  const [layers, setLayers] = useState({ paths: true, pins: true, labels: true, grid: true });
  const onlyShape = selected.length === 1 && selectedShapes.length === 1 ? selectedShapes[0] : null;
  const error = problem || editing.problem;
  const extent = drawingExtent(drawing);
  const pins = drawing.pins ?? [];
  // A wire arrives at a pin from outside the body: a pin inside the box would be hidden under the drawing.
  const inside = pins.filter((pin) => Math.abs(pin.x) < extent.halfWidth && Math.abs(pin.y) < extent.halfHeight);
  const changePin = (index: number, changes: Partial<(typeof pins)[number]>) => {
    const next = [...pins];
    next[index] = { ...next[index], ...changes };
    commit({ ...drawing, pins: next });
  };
  const changeLabel = (index: number, changes: { x?: number; y?: number }) => {
    const labels = [...(drawing.labels ?? [])];
    labels[index] = { ...labels[index], ...changes };
    commit({ ...drawing, labels });
  };
  const sourcePreview = (() => {
    try {
      return writeSymbolSource({ ...symbolHeadOf(value, object), title: title.trim() || "Untitled", slug: slug.trim() || "symbol" }, drawing);
    } catch {
      return "";
    }
  })();
  const status = editing.start ? "Choose the second point · Esc cancels"
    : selected.length ? `${selected.length} selected · drag or arrow keys move · Shift click adds · Delete removes`
      : `${shapes.length} shapes · ${pins.length} pins · drag on empty to select with a box · wheel zooms`;

  const side = <>
    <div className="parallax-side-group parallax-flush">
      <h3>Layers</h3>
      <div data-parallax-part="layer-list" className="parallax-layer-list">
        {([["paths", "Paths", shapes.length], ["pins", "Pins", pins.length], ["labels", "Label anchors", drawing.labels?.length ?? 0], ["grid", "Grid", editing.snapStep || "off"]] as const).map(([key, label, count]) => (
          <label key={key} className="parallax-choice"><input className="parallax-check" type="checkbox" checked={layers[key]} onChange={(event) => setLayers((current) => ({ ...current, [key]: event.target.checked }))} /> {label}<span className="parallax-push">{count}</span></label>
        ))}
      </div>
    </div>
    <div className="parallax-side-group">
      <h3>Snap</h3>
      <div className="parallax-control-row"><span>Grid</span>
        <div data-parallax-part="segmented" className="parallax-segmented parallax-small parallax-stretch" role="group" aria-label="Snap to grid">
          {([0, 1, 5] as const).map((step) => <button key={step} type="button" aria-pressed={editing.snapStep === step} onClick={() => editing.setSnapStep(step)}>{step === 0 ? "Off" : step}</button>)}
        </div>
      </div>
    </div>
    <div className="parallax-side-note"><span>Pins must land on the box edge or outside it; a part's wire arrives at the pin. Labels are anchors the sheet fills with the part's name and value.</span></div>
  </>;

  const stage = <>
    {/* One row, as the circuit sheet's: the tools and edits on the left, the zoom at the end. The symbol's name is the
        bar's and the inspector's; what the pointer does next is the status line's, under the drawing. */}
    <div data-parallax-part="stage-toolbar" className="parallax-stage-toolbar">
      <ToolPicker tools={SYMBOL_TOOLS} value={tool} onChange={editing.chooseTool} />
      <EditActions hasSelection={selected.length > 0} canUndo={editing.canUndo} canRedo={editing.canRedo} onUndo={editing.undo} onRedo={editing.redo}
        onRemove={editing.remove} onDuplicate={editing.duplicate} onRotate={editing.rotate} onMirror={editing.mirror} />
      <span className="parallax-push" />
      <ViewControls onZoom={editing.zoomBy} onFit={editing.fit} zoomPercent={editing.zoomPercent} />
    </div>
    <div data-parallax-part="stage-body" className="parallax-stage-body">
      <div className="parallax-draw-canvas">
        <svg ref={editing.sheet} viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} data-tool={tool} data-parallax-part="symbol-sheet" className="parallax-symbol-sheet" role="img" aria-label="Symbol drawing grid"
          onPointerDown={editing.pressSheet} onPointerMove={editing.movePointer} onPointerUp={editing.releasePointer} onPointerCancel={editing.releasePointer} tabIndex={0} onKeyDown={editing.keys}>
          {layers.grid ? <>
            {GRID_LINES.map((position) => <line key={`v${position}`} className={position % 10 === 0 ? "parallax-grid-major" : "parallax-grid-minor"} x1={position} x2={position} y1={-60} y2={60} />)}
            {GRID_LINES.filter((position) => Math.abs(position) <= 60).map((position) => <line key={`h${position}`} className={position % 10 === 0 ? "parallax-grid-major" : "parallax-grid-minor"} x1={-80} x2={80} y1={position} y2={position} />)}
          </> : null}
          <path d="M-80 0H80M0-60V60" className="parallax-axis" />
          <rect x={-extent.halfWidth} y={-extent.halfHeight} width={2 * extent.halfWidth} height={2 * extent.halfHeight} className="parallax-frame" />
          {layers.labels ? (drawing.labels ?? []).map((label) => <g key={label.subject}>
            <rect className="parallax-anchor" x={label.x - 8} y={label.y - 2.5} width={16} height={5} />
            <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" className="parallax-anchor-name">{label.subject}</text>
          </g>) : null}
          {/* Each shape is taken by a wide, invisible stroke along it: a hairline is a pixel wide, and the pointer missed it. */}
          {layers.paths ? shapes.map(({ path, upright }, index) => <g key={`${index}-${path}`} data-symbol-shape={index}
            onPointerDown={(event) => editing.pressThing(event, shapeKey(index))}>
            <path d={path} className="parallax-drawing-hit" />
            <path d={path} className={`parallax-drawing${upright ? " parallax-drawing-upright" : ""}${selectedShapes.includes(index) ? " parallax-selected" : ""}`} />
          </g>) : null}
          {layers.pins ? pins.map((pin, index) => <g key={index} onPointerDown={(event) => editing.pressThing(event, pinKey(index))}>
            <circle className={selectedPins.includes(index) ? "parallax-pin parallax-selected" : "parallax-pin"} cx={pin.x} cy={pin.y} r="2.2" />
            <text className="parallax-pin-name" x={pin.x + 3.5} y={pin.y - 3.5}>{pin.name}</text>
          </g>) : null}
          {editing.start && editing.cursor && tool !== "select" && tool !== "pin" && tool !== "pan"
            ? <path d={shapePath(tool as SymbolShapeTool, editing.start, editing.cursor)} className="parallax-drawing parallax-preview" /> : null}
          {editing.start ? <circle cx={editing.start.x} cy={editing.start.y} r="1.6" className="parallax-pin parallax-selected" /> : null}
          {editing.selecting ? <rect className="parallax-selection-box" x={editing.selecting.x} y={editing.selecting.y}
            width={editing.selecting.width} height={editing.selecting.height} /> : null}
        </svg>
        <span className="parallax-coordinates">{editing.cursor ? `x ${editing.cursor.x} · y ${editing.cursor.y}` : `${shapes.length} shapes · ${pins.length} pins`}</span>
      </div>
    </div>
    <div data-parallax-part="stage-foot" className="parallax-stage-foot">
      {error ? <span className="parallax-diagnostic parallax-danger" role="alert"><ParallaxIcon name="error" />{error}</span>
        : inside.length ? <span className="parallax-diagnostic parallax-warn"><ParallaxIcon name="warning" />{inside.map((pin) => pin.name).join(", ")} {inside.length === 1 ? "is" : "are"} inside the box</span>
          : <span className="parallax-diagnostic parallax-good"><ParallaxIcon name="check" />Every pin is on the edge or outside it</span>}
      <span className="parallax-hint">{status}</span>
      <span className="parallax-push">box {2 * extent.halfWidth} × {2 * extent.halfHeight}</span>
    </div>
  </>;

  const inspector = <>
    <div data-parallax-part="panel-head" className="parallax-panel-head">
      <div data-parallax-part="inspector-title" className="parallax-inspector-title"><h2>{slug || title || "New symbol"}</h2><span className="parallax-technical">symbol{object ? ` · r${object.definitionRevision}` : " · not saved yet"}</span></div>
    </div>
    <div data-parallax-part="inspector-group" className="parallax-inspector-group">
      <h3>Identity</h3>
      <div className="parallax-field-inline"><label htmlFor="symbol-title">Title</label><input id="symbol-title" data-parallax-part="input" className="parallax-input parallax-small" required value={title} autoFocus
        onChange={(event) => onChange({ ...value, title: event.target.value })} /></div>
      <div className="parallax-field-inline"><label htmlFor="symbol-slug">Identifier</label><input id="symbol-slug" data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" value={slug} readOnly={!!object}
        placeholder={title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")} onChange={(event) => onChange({ ...value, slug: event.target.value })} /></div>
      <div className="parallax-field-inline"><label htmlFor="symbol-category">Section</label><select id="symbol-category" data-parallax-part="input" className="parallax-input parallax-small" value={category}
        onChange={(event) => onChange({ ...value, category: event.target.value })}>{(categories ?? []).map((entry) => <option key={entry.code} value={entry.code}>{entry.title}</option>)}</select></div>
      {identityExtra}
    </div>
    {onlyShape !== null && shapes[onlyShape] ? (
      <div data-parallax-part="inspector-group" className="parallax-inspector-group">
        <h3>Shape {onlyShape + 1}</h3>
        <label className="parallax-choice">
          <input className="parallax-check" type="checkbox" checked={shapes[onlyShape].upright}
            onChange={(event) => {
              // An upright shape is written after the others, so the selection follows it to where it now stands.
              const changed = shapes.map((shape, index) => index === onlyShape ? { ...shape, upright: event.target.checked } : shape);
              const next = withShapes(drawing, changed);
              commit(next);
              editing.setSelected([shapeKey(shapesOf(next).findIndex((shape) => shape.path === shapes[onlyShape].path && shape.upright === event.target.checked))]);
            }} />
          Stays upright as the part turns
        </label>
        <p className="parallax-hint">For a letter or a mark that has to be read: a meter&apos;s V, a gauge&apos;s scale. It turns round the
          symbol&apos;s centre with the part, but never lies on its side. Leads, bodies and polarity marks turn with it.</p>
      </div>
    ) : null}
    <div data-parallax-part="inspector-group" className="parallax-inspector-group">
      <h3>Pins <Tool tone="quiet" onClick={() => editing.chooseTool("pin")}><ParallaxIcon name="plus" />Add</Tool></h3>
      {pins.length ? (
        <table className="parallax-table parallax-dense parallax-pins-table">
          <thead><tr><th scope="col">Name</th><th scope="col" className="parallax-numeric">x</th><th scope="col" className="parallax-numeric">y</th><th scope="col"><span className="parallax-screen-reader-only">Remove</span></th></tr></thead>
          <tbody>
            {pins.map((pin, index) => (
              <tr key={index} aria-selected={selectedPins.includes(index)} onClick={() => editing.setSelected([pinKey(index)])}>
                <td><input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" aria-label={`Name of pin ${index + 1}`} value={pin.name} onChange={(event) => changePin(index, { name: event.target.value })} /></td>
                <td className="parallax-numeric"><input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" type="number" aria-label={`x of ${pin.name}`} value={pin.x} onChange={(event) => changePin(index, { x: Number(event.target.value) })} /></td>
                <td className="parallax-numeric"><input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" type="number" aria-label={`y of ${pin.name}`} value={pin.y} onChange={(event) => changePin(index, { y: Number(event.target.value) })} /></td>
                <td><Tool tone="quiet" icon aria-label={`Remove ${pin.name}`} onClick={() => { commit({ ...drawing, pins: pins.filter((_, position) => position !== index) }); editing.setSelected([]); }}><ParallaxIcon name="close" /></Tool></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="parallax-hint">Choose Pin, then click the sheet. Name each pin as the component names its port, so wires connect here.</p>}
    </div>
    <div data-parallax-part="inspector-group" className="parallax-inspector-group">
      <h3>Label anchors</h3>
      <table className="parallax-table parallax-dense parallax-pins-table">
        <thead><tr><th scope="col">Label</th><th scope="col" className="parallax-numeric">x</th><th scope="col" className="parallax-numeric">y</th></tr></thead>
        <tbody>
          {(drawing.labels ?? []).map((label, index) => (
            <tr key={label.subject}>
              <td>{label.subject}</td>
              <td className="parallax-numeric"><input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" type="number" aria-label={`x of the ${label.subject} label`} value={label.x} onChange={(event) => changeLabel(index, { x: Number(event.target.value) })} /></td>
              <td className="parallax-numeric"><input data-parallax-part="input" className="parallax-input parallax-small parallax-monospace" type="number" aria-label={`y of the ${label.subject} label`} value={label.y} onChange={(event) => changeLabel(index, { y: Number(event.target.value) })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <details data-parallax-part="disclosure" className="parallax-disclosure">
      <summary>Source <span className="parallax-metadata">jMX{object ? " · saved line by line" : ""}</span><ParallaxIcon name="chevron-down" className="parallax-chevron" /></summary>
      <div className="parallax-disclosure-body">
        <pre className="parallax-code">{sourcePreview}</pre>
        <Tool onClick={() => void navigator.clipboard?.writeText(sourcePreview)}><ParallaxIcon name="copy" />Copy</Tool>
      </div>
    </details>
    <div data-parallax-part="inspector-group" className="parallax-inspector-group">
      <h3>Used by</h3>
      <p className="parallax-hint">A component says <code className="parallax-inline">symbol uses {slug || "this-symbol"}</code>; schematics, palettes and previews read this same drawing.</p>
      {object ? <div className="parallax-tags"><ParallaxLink className="parallax-tag" to={{ kind: "object", slug: object.summary.slug }}>{object.summary.slug}</ParallaxLink></div> : null}
    </div>
  </>;

  return <BenchGrid storageKey="symbol-editor" sideLabel="Drawing tools" side={side} stage={stage} inspectorLabel="Symbol properties" inspectorClassName="parallax-inspector" inspector={inspector} />;
}

import { Tool } from "../controls/BenchControls";
import { ParallaxIcon } from "../icons/ParallaxIcon";

/** How far one press of a zoom button goes. */
export const ZOOM_STEP = 1.2;

/**
 * Zoom out, fit, zoom in — the view of any drawing editor. `zoom` takes a factor above 1 to show more; the fit button
 * may say how far in the view is.
 */
export function ViewControls({ onZoom, onFit, zoomPercent }: { onZoom: (factor: number) => void; onFit: () => void; zoomPercent?: number }) {
  return (
    <div data-parallax-part="editor-view" className="parallax-circuit-diagram-view" role="group" aria-label="View">
      <button type="button" aria-label="Zoom out" title="Zoom out (wheel)" onClick={() => onZoom(ZOOM_STEP)}><ParallaxIcon name="zoom-out" /></button>
      <button type="button" title="Fit the drawing" onClick={onFit}>{zoomPercent === undefined ? "Fit" : <span className="parallax-monospace">{zoomPercent}%</span>}</button>
      <button type="button" aria-label="Zoom in" title="Zoom in (wheel)" onClick={() => onZoom(1 / ZOOM_STEP)}><ParallaxIcon name="zoom-in" /></button>
    </div>
  );
}

/** What is done to the selection and the history, the same buttons in every drawing editor. */
export interface EditActionsProperties {
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRemove: () => void;
  onDuplicate?: () => void;
  onRotate?: () => void;
  onMirror?: () => void;
}

export function EditActions({ hasSelection, canUndo, canRedo, onUndo, onRedo, onRemove, onDuplicate, onRotate, onMirror }: EditActionsProperties) {
  return <>
    <div className="parallax-button-group">
      {onRotate ? <Tool icon aria-label="Rotate the selection (R)" title="Rotate (R)" disabled={!hasSelection} onClick={onRotate}><ParallaxIcon name="rotate" /></Tool> : null}
      {onMirror ? <Tool icon aria-label="Mirror the selection (M)" title="Mirror (M)" disabled={!hasSelection} onClick={onMirror}><ParallaxIcon name="mirror" /></Tool> : null}
      {onDuplicate ? <Tool icon aria-label="Duplicate the selection (Ctrl D)" title="Duplicate (Ctrl D)" disabled={!hasSelection} onClick={onDuplicate}><ParallaxIcon name="copy" /></Tool> : null}
      <Tool icon tone="danger" aria-label="Delete the selection (Delete)" title="Delete" disabled={!hasSelection} onClick={onRemove}><ParallaxIcon name="trash" /></Tool>
    </div>
    <div className="parallax-button-group">
      <Tool icon aria-label="Undo" title="Undo (Ctrl Z)" disabled={!canUndo} onClick={onUndo}><ParallaxIcon name="undo" /></Tool>
      <Tool icon aria-label="Redo" title="Redo (Ctrl Y)" disabled={!canRedo} onClick={onRedo}><ParallaxIcon name="redo" /></Tool>
    </div>
  </>;
}

/** One tool of an editor, as its picker shows it and its key chooses it. */
export interface EditorTool<T extends string> {
  value: T;
  label: string;
  icon: Parameters<typeof ParallaxIcon>[0]["name"];
  key: string;
  title: string;
}

/** The editor's tools as one segmented row, each with its key. */
export function ToolPicker<T extends string>({ tools, value, onChange }: { tools: readonly EditorTool<T>[]; value: T | null; onChange: (tool: T) => void }) {
  return (
    <div data-parallax-part="segmented" className="parallax-segmented parallax-small" role="group" aria-label="Tool">
      {tools.map((tool) => (
        <button key={tool.value} type="button" aria-pressed={value === tool.value} title={`${tool.title} (${tool.key.toUpperCase()})`}
          onClick={() => onChange(tool.value)}><ParallaxIcon name={tool.icon} />{tool.label}</button>
      ))}
    </div>
  );
}

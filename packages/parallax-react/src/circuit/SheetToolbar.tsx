import { EditActions, ToolPicker } from "../editor/EditorControls";
import { SHEET_TOOLS } from "./sheetTools";
import type { SheetEditing } from "./useSheetEditing";

/**
 * The tools of a sheet being worked on — what is in hand, what is done to the selection, and the history —, the same
 * on every view the sheet is edited in, and built from the same pieces as the symbol editor's.
 */
export function SheetToolbar({ editing }: { editing: SheetEditing }) {
  const hasSelection = editing.selected.length > 0;
  return <>
    <ToolPicker tools={SHEET_TOOLS} value={editing.placement ? null : editing.tool} onChange={editing.chooseTool} />
    <EditActions hasSelection={hasSelection} canUndo={editing.canUndo} canRedo={editing.canRedo} onUndo={editing.undo} onRedo={editing.redo}
      onRemove={editing.remove} onDuplicate={editing.duplicate} onRotate={editing.rotate} onMirror={editing.mirror} />
  </>;
}

import type { SheetTool } from "@jmouse/parallax/circuit";
import type { EditorTool } from "../editor/EditorControls";

/** The sheet's tools — the keys are the editor's (`editorKey`): V and H as in every editor, W and X the sheet's own. */
export const SHEET_TOOLS: readonly EditorTool<SheetTool>[] = [
  { value: "select", label: "Select", icon: "cursor", key: "v", title: "Select and move; drag on empty sheet to select with a box" },
  { value: "wire", label: "Wire", icon: "wire", key: "w", title: "Draw wires between contacts and onto wires" },
  { value: "cut", label: "Cut", icon: "cut", key: "x", title: "Cut a wire into two open ends, to put an instrument into the break" },
  { value: "pan", label: "Pan", icon: "move", key: "h", title: "Pan the sheet (or drag with the middle button)" },
];

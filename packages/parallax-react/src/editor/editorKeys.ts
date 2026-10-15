import type { KeyboardEvent } from "react";
import type { Hotkey } from "../controls/Hotkeys";

/**
 * What every drawing editor answers to — a sheet and a symbol alike —, each an action of the editor it is given to;
 * an editor without one (a symbol has no mirror) leaves it out, and its key does nothing there.
 */
export interface EditorCommands {
  cancel: () => void;
  remove: () => void;
  undo: () => void;
  redo: () => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  duplicate: () => void;
  selectAll: () => void;
  /** Moves the selection by (dx, dy) grid steps. */
  nudge: (dx: number, dy: number) => void;
  rotate?: () => void;
  mirror?: () => void;
  /** The editor's tools by their key — `v` select, `h` pan, then its own (`w` wire, `l` line …). */
  tools: Record<string, () => void>;
}

const ARROWS: Record<string, readonly [number, number] | undefined> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

/** Whether a key is being typed into a field — the editor leaves those alone. */
function typing(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

/**
 * The editor's keys, one table for every editor: what a key does is decided here once, so a sheet and a symbol answer
 * to the same keys. Whether it acted — a key it took is not passed on.
 */
export function editorKey(event: KeyboardEvent, commands: EditorCommands): boolean {
  if (typing(event)) {
    return false;
  }
  const key = event.key.toLowerCase();
  const command = event.ctrlKey || event.metaKey;
  const act = (action: (() => void) | undefined) => {
    if (!action) {
      return false;
    }
    event.preventDefault();
    action();
    return true;
  };
  if (event.key === "Escape") {
    return act(commands.cancel);
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    return act(commands.remove);
  }
  if (command) {
    switch (key) {
      case "z": return act(event.shiftKey ? commands.redo : commands.undo);
      case "y": return act(commands.redo);
      case "c": return act(commands.copy);
      case "x": return act(commands.cut);
      case "v": return act(commands.paste);
      case "d": return act(commands.duplicate);
      case "a": return act(commands.selectAll);
      default: return false;
    }
  }
  if (event.altKey) {
    return false;
  }
  const arrow = ARROWS[event.key];
  if (arrow) {
    // A grid step; five with Shift.
    const steps = event.shiftKey ? 5 : 1;
    return act(() => commands.nudge(arrow[0] * steps, arrow[1] * steps));
  }
  if (key === "r") {
    return act(commands.rotate);
  }
  if (key === "m") {
    return act(commands.mirror);
  }
  return act(commands.tools[key]);
}

/**
 * The keys every editor has, as the help lists them — the same table the keys are acted on from, so the list cannot
 * drift from what the keys do. An editor adds its own tools after them.
 */
export const EDITOR_HOTKEYS: readonly Hotkey[] = [
  { keys: "V", label: "Select and move", group: "Editor" },
  { keys: "H", label: "Pan", group: "Editor" },
  { keys: "Shift click", label: "Add to the selection, or take out of it", group: "Editor" },
  { keys: "Drag on empty", label: "Select what a box holds (Shift adds)", group: "Editor" },
  { keys: "Ctrl A", label: "Select everything", group: "Editor" },
  { keys: "Arrows", label: "Move the selection a grid step (Shift: five)", group: "Editor" },
  { keys: "R", label: "Rotate the selection", group: "Editor" },
  { keys: "M", label: "Mirror the selection", group: "Editor" },
  { keys: "Ctrl C", label: "Copy", group: "Editor" },
  { keys: "Ctrl X", label: "Cut", group: "Editor" },
  { keys: "Ctrl V", label: "Paste under the pointer", group: "Editor" },
  { keys: "Ctrl D", label: "Duplicate", group: "Editor" },
  { keys: "Delete", label: "Remove the selection", group: "Editor" },
  { keys: "Ctrl Z", label: "Undo", group: "Editor" },
  { keys: "Ctrl Y", label: "Redo", group: "Editor" },
  { keys: "Esc", label: "Cancel what is in hand", group: "Editor" },
  { keys: "Wheel · middle drag", label: "Zoom about the pointer · pan", group: "Editor" },
];

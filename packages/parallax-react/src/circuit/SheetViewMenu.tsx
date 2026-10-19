import { useState, type ReactNode } from "react";
import { DEFAULT_SHEET_LABELS, type ReadingsDetail, type SheetLabels } from "@jmouse/parallax/circuit";
import { Segments } from "../controls/BenchControls";
import { ToolMenu, ToolMenuCheck, ToolMenuChoice, ToolMenuFoot, ToolMenuSection } from "../controls/ToolMenu";

/** Where a browser keeps the texts its reader chose for every sheet: a habit, not part of any circuit. */
const LABELS_KEY = "parallax.sheet.labels";

/** The texts the reader chose, kept in this browser; every sheet opens with them. */
export function useSheetLabels(): [SheetLabels, (labels: SheetLabels) => void] {
  const [labels, setLabels] = useState<SheetLabels>(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(LABELS_KEY) ?? "null") as Partial<SheetLabels> | null;
      return { ...DEFAULT_SHEET_LABELS, ...(kept ?? {}) };
    } catch {
      return DEFAULT_SHEET_LABELS;
    }
  });
  const choose = (next: SheetLabels) => {
    setLabels(next);
    try {
      localStorage.setItem(LABELS_KEY, JSON.stringify(next));
    } catch {
      // A private window keeps no habit.
    }
  };
  return [labels, choose];
}

const DEPTHS: { value: ReadingsDetail; label: string; title: string }[] = [
  { value: "off", label: "Off", title: "No readings beside the parts — a part past its limits still carries its mark" },
  { value: "brief", label: "Brief", title: "The one line that tells most — a figure near its limit, else what the part takes — and the meters on it; point at a block to open it, click to keep it open" },
  { value: "full", label: "Full", title: "Every line: what each part takes and how warm it is, each figure its component displays, each meter on it" },
];

export type SheetShows = "drawing" | "readings";

/** One overlay the sheet can draw over its wires and parts, switched on and off from the menu. */
export interface SheetOverlay {
  label: string;
  /** What it draws, in a line under its name. */
  description: string;
  on: boolean;
  onChange: (on: boolean) => void;
}

/**
 * Everything about how the sheet looks, behind one View button at the end of its toolbar: what the pane shows (the
 * drawing, or the readings as a table), the overlays on the drawing, the texts beside each part, and — when the host
 * keeps one — the way to its own appearance settings. The toolbar keeps what is done to the sheet; this, what is seen.
 */
export function SheetViewMenu({ shows, onShows, labels, onLabels, overlays = [], appearance }: {
  shows: SheetShows;
  /** Given when the pane can show the readings instead of the drawing (a live run). */
  onShows?: (shows: SheetShows) => void;
  labels: SheetLabels;
  onLabels: (labels: SheetLabels) => void;
  overlays?: readonly SheetOverlay[];
  /** The host's own settings for how the sheet draws current, glow and leads, opened from the panel's foot. */
  appearance?: { label: ReactNode; open: () => void };
}) {
  const drawing = shows === "drawing";
  const activeOverlays = overlays.filter((overlay) => overlay.on).length;
  const summary = !drawing ? "the readings" : `the drawing, labels ${labels.readings}${activeOverlays ? `, ${activeOverlays} overlay${activeOverlays === 1 ? "" : "s"} on` : ""}`;
  return (
    <ToolMenu label="View" icon="eye" part="sheet-view" title={`How the sheet looks: ${summary}`}>
      {(close) => <>
        {onShows ? (
          <ToolMenuSection title="Pane shows">
            <Segments wide label="What the circuit pane shows" value={shows} onChange={onShows}
              options={[{ value: "drawing", label: "Drawing", title: "The schematic: voltage as colour, current as motion, power as glow" },
                { value: "readings", label: "Readings", title: "Every node's voltage and every part's power, current and temperature" }]} />
          </ToolMenuSection>
        ) : null}
        {drawing && overlays.length ? (
          <ToolMenuSection title="On the drawing">
            {overlays.map((overlay) => <ToolMenuCheck key={overlay.label} label={overlay.label} description={overlay.description} checked={overlay.on} onChange={overlay.onChange} />)}
          </ToolMenuSection>
        ) : null}
        {drawing ? (
          <ToolMenuSection title="Beside each part">
            <ToolMenuCheck label="Names" description="R1, D1" checked={labels.names} onChange={(names) => onLabels({ ...labels, names })} />
            <ToolMenuCheck label="Values" description="10 kΩ, 1N4148" checked={labels.values} onChange={(values) => onLabels({ ...labels, values })} />
            <ToolMenuChoice label="Readings" description="a brief block opens under the pointer; click it to keep it">
              <Segments label="How much of each part's readings" value={labels.readings} onChange={(readings) => onLabels({ ...labels, readings })} options={DEPTHS} />
            </ToolMenuChoice>
          </ToolMenuSection>
        ) : null}
        {appearance ? <ToolMenuFoot icon="appearance" onClick={() => {
          close();
          appearance.open();
        }}>{appearance.label}</ToolMenuFoot> : null}
      </>}
    </ToolMenu>
  );
}

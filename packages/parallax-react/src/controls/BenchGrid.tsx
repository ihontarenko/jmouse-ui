import { createContext, useContext, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { classNames } from "../support/classNames";
import { ParallaxIcon, type ParallaxIconName } from "../icons/ParallaxIcon";
import { useHotkeys } from "./Hotkeys";

/*
 * The Parallax-UI workbench (Html/Parallax-UI/workbench.html): one layout for the emulator, the circuit editor, the
 * symbol shelf and the symbol editor — a bench bar with the bench's tabs, then three resizable columns.
 */

/** Narrower than this a column's controls stop fitting: the side's sliders, the inspector's three-way switch. */
const MINIMUM_COLUMN = 232;
const MAXIMUM_COLUMN = 520;

function readWidth(key: string): number | null {
  try {
    const stored = Number(window.localStorage.getItem(`parallax.bench.${key}`));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function storeWidth(key: string, width: number) {
  try {
    window.localStorage.setItem(`parallax.bench.${key}`, String(Math.round(width)));
  } catch {
    // The width lasts for this visit only.
  }
}

function storeShare(key: string, share: number) {
  try {
    window.localStorage.setItem(`parallax.bench.${key}`, String(share));
  } catch {
    // The share lasts for this visit only.
  }
}

function readFolded(key: string): boolean {
  try {
    return window.localStorage.getItem(`parallax.bench.${key}.folded`) === "true";
  } catch {
    return false;
  }
}

function storeFolded(key: string, folded: boolean) {
  try {
    window.localStorage.setItem(`parallax.bench.${key}.folded`, String(folded));
  } catch {
    // The fold lasts for this visit only.
  }
}

/** Whether a column or the instrument is folded away, remembered per bench as the rail's fold is. */
function useFolded(key: string): [boolean, () => void] {
  const [folded, setFolded] = useState(() => readFolded(key));
  const toggle = () => setFolded((current) => {
    storeFolded(key, !current);
    return !current;
  });
  return [folded, toggle];
}

/** The knob on an edge that folds the column or the instrument beside it away, and brings it back. */
function FoldKnob({ folded, what, icons, onFold }: { folded: boolean; what: string; icons: [ParallaxIconName, ParallaxIconName]; onFold: () => void }) {
  return <button type="button" className="parallax-bench-fold" aria-expanded={!folded} aria-label={folded ? `Show the ${what}` : `Fold the ${what} away`}
    title={folded ? `Show the ${what}` : `Fold the ${what} away`} onClick={onFold}>
    <ParallaxIcon name={folded ? icons[1] : icons[0]} />
  </button>;
}

/** What stands for a folded column or instrument: its name; a click brings it back. */
function FoldedStrip({ label, horizontal = false, onUnfold }: { label: string; horizontal?: boolean; onUnfold: () => void }) {
  return <button type="button" className={classNames("parallax-bench-folded", horizontal && "parallax-horizontal")} aria-expanded={false}
    aria-label={`Show the ${label.toLowerCase()}`} onClick={onUnfold}>
    <ParallaxIcon name={horizontal ? "chevron-up" : "unfold"} /><span className="parallax-label">{label}</span>
  </button>;
}

/**
 * A column edge (`.bench-edge`): the template's `.split-handle`, dragged or stepped with the arrow keys, and the knob
 * that folds the column beside it. A folded column is not resized.
 */
function ColumnHandle({ label, width, sign, onWidth, folded, what, onFold, className }: {
  label: string; width: () => number; sign: 1 | -1; onWidth: (width: number) => void;
  folded: boolean; what: string; onFold: () => void; className?: string;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const bounded = (next: number) => Math.max(MINIMUM_COLUMN, Math.min(MAXIMUM_COLUMN, next));
  // The knob points the way the column goes: the side folds to the left, the inspector to the right.
  const icons: [ParallaxIconName, ParallaxIconName] = sign === 1 ? ["chevron-left", "chevron-right"] : ["chevron-right", "chevron-left"];
  return (
    <div data-parallax-part="bench-edge" className={classNames("parallax-bench-edge", className)}>
    <div data-parallax-part="split-handle" className="parallax-split-handle" role="separator" aria-orientation="vertical" aria-label={label} tabIndex={folded ? -1 : 0}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || folded) {
          return;
        }
        drag.current = { x: event.clientX, width: width() };
        event.currentTarget.setPointerCapture(event.pointerId);
        document.body.style.cursor = "col-resize";
      }}
      onPointerMove={(event) => {
        if (drag.current) {
          onWidth(bounded(drag.current.width + (event.clientX - drag.current.x) * sign));
        }
      }}
      onPointerUp={() => {
        drag.current = null;
        document.body.style.cursor = "";
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        const delta = event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0;
        if (delta && !folded) {
          event.preventDefault();
          onWidth(bounded(width() + delta * sign));
        }
      }} />
    <FoldKnob folded={folded} what={what} icons={icons} onFold={onFold} />
    </div>
  );
}

/**
 * `.bench-grid`: the side column, the stage and the inspector, with a handle between each — the side's and the
 * inspector's widths are the reader's, remembered per bench under `storageKey`. Without `side` it is `.no-side`;
 * without `inspector` the stage runs to the right edge.
 */
export function BenchGrid({ side, sideLabel, stage, inspector, inspectorLabel, inspectorClassName, storageKey, panelId, labelledBy, section = true, sideWidth, inspectorWidth: initialInspectorWidth }: {
  side?: ReactNode;
  sideLabel?: string;
  stage: ReactNode;
  inspector?: ReactNode;
  inspectorLabel?: string;
  /** `inspector` for a property sheet (the template's `.bench-inspector.inspector`). */
  inspectorClassName?: string;
  storageKey: string;
  panelId?: string;
  labelledBy?: string;
  /** False when the page already wraps the grid in its own `section.bench`. */
  section?: boolean;
  /** The columns' starting widths in pixels, until the reader drags them; the template's otherwise. */
  sideWidth?: number;
  inspectorWidth?: number;
}) {
  const [panelWidth, setPanelWidth] = useState(() => readWidth(`${storageKey}.side`) ?? sideWidth ?? null);
  const [inspectorWidth, setInspectorWidth] = useState(() => readWidth(`${storageKey}.inspector`) ?? initialInspectorWidth ?? null);
  const [sideFolded, toggleSide] = useFolded(`${storageKey}.side`);
  const [inspectorFolded, toggleInspector] = useFolded(`${storageKey}.inspector`);
  const sideElement = useRef<HTMLElement>(null);
  const inspectorElement = useRef<HTMLElement>(null);
  // A width the reader dragged on a wide screen gives way on a narrow one, as the template's own widths do; a folded
  // column is the strip that stands for it.
  const style = {
    ...(sideFolded ? { "--parallax-panel-width": "var(--parallax-bench-folded)" }
      : panelWidth ? { "--parallax-panel-width": `max(${MINIMUM_COLUMN}px, min(${panelWidth}px, 22vw))` } : {}),
    ...(inspectorFolded ? { "--parallax-inspector-width": "var(--parallax-bench-folded)" }
      : inspectorWidth ? { "--parallax-inspector-width": `max(${MINIMUM_COLUMN}px, min(${inspectorWidth}px, 24vw))` } : {}),
  } as CSSProperties;
  const sideName = sideLabel ?? "Side column";
  const inspectorName = inspectorLabel ?? "Inspector";
  const className = classNames("parallax-bench-grid", !side && "parallax-no-side", !inspector && "parallax-no-inspector");
  const grid = (
      <div data-parallax-part="bench-grid" className={className} style={style}>
        {side ? (
          <>
            {/* Folded, the column keeps what it holds — its state, its scroll — and only hides it. */}
            <aside ref={sideElement} data-parallax-part="bench-side" className={classNames("parallax-bench-side", sideFolded && "parallax-folded")} aria-label={sideLabel}>
              {sideFolded ? <FoldedStrip label={sideName} onUnfold={toggleSide} /> : null}
              <div data-parallax-part="bench-column" className="parallax-bench-column" hidden={sideFolded}>{side}</div>
            </aside>
            <ColumnHandle label={`Resize the ${sideLabel?.toLowerCase() ?? "side"} column`} sign={1}
              folded={sideFolded} what={sideName.toLowerCase()} onFold={toggleSide}
              width={() => sideElement.current?.getBoundingClientRect().width ?? 272}
              onWidth={(width) => {
                setPanelWidth(width);
                storeWidth(`${storageKey}.side`, width);
              }} />
          </>
        ) : null}
        <div data-parallax-part="bench-stage" className="parallax-bench-stage">{stage}</div>
        {inspector ? (
          <>
            <ColumnHandle label={`Resize the ${inspectorLabel?.toLowerCase() ?? "inspector"} column`} sign={-1} className="parallax-inspector-edge"
              folded={inspectorFolded} what={inspectorName.toLowerCase()} onFold={toggleInspector}
              width={() => inspectorElement.current?.getBoundingClientRect().width ?? 304}
              onWidth={(width) => {
                setInspectorWidth(width);
                storeWidth(`${storageKey}.inspector`, width);
              }} />
            <aside ref={inspectorElement} data-parallax-part="bench-inspector" className={classNames("parallax-bench-inspector", inspectorClassName, inspectorFolded && "parallax-folded")} aria-label={inspectorLabel}>
              {inspectorFolded ? <FoldedStrip label={inspectorName} onUnfold={toggleInspector} /> : null}
              <div data-parallax-part="bench-column" className="parallax-bench-column" hidden={inspectorFolded}>{inspector}</div>
            </aside>
          </>
        ) : null}
      </div>
  );
  if (!section) {
    return grid;
  }
  return (
    <section data-parallax-part="bench" className="parallax-bench" id={panelId} role={panelId ? "tabpanel" : undefined} aria-labelledby={labelledBy}>
      {grid}
    </section>
  );
}

/** What of a split stage is folded away: nothing, the instrument under the sheet, or the sheet itself. */
type StageFold = "none" | "instrument" | "sheet";

/** The stage's fold, for what is drawn under it: an instrument can take the whole stage and give it back. */
const StageFoldContext = createContext<{ fold: StageFold; foldTo: (fold: StageFold) => void } | null>(null);

/**
 * «Expand»: the instrument takes the whole stage — the sheet above it folds away, still running — and «Restore» gives
 * it back. A graph a hundred pixels tall under a sheet could not be read, and the only way to enlarge it was a pair of
 * chevrons on the splitter nobody found. Nothing when the instrument is not under a stage.
 */
export function ExpandTool() {
  const stage = useContext(StageFoldContext);
  if (!stage) {
    return null;
  }
  const expanded = stage.fold === "sheet";
  return (
    <button type="button" data-parallax-part="button" className="parallax-button parallax-small" aria-pressed={expanded}
      title={expanded ? "Give the sheet its place back (E)" : "Take the whole stage: the sheet folds away and keeps running (E)"}
      onClick={() => stage.foldTo(expanded ? "none" : "sheet")}>
      <ParallaxIcon name="fit" />{expanded ? "Restore" : "Expand"}
    </button>
  );
}

function readStageFold(key: string): StageFold {
  try {
    const stored = window.localStorage.getItem(`parallax.bench.${key}.fold`);
    return stored === "instrument" || stored === "sheet" ? stored : "none";
  } catch {
    return "none";
  }
}

/**
 * The stage body split between a sheet above and an instrument below (`.scope`, or any pane sized by
 * `--parallax-scope-height`), with the template's horizontal handle between them. Either side folds away from the handle's
 * knobs — the instrument to read the sheet alone, the sheet to read the instrument alone —, never both.
 */
export function StageSplit({ top, bottom, storageKey, label = "Resize the oscilloscope", name = "Instruments", topName = "Sheet" }: {
  top: ReactNode; bottom: ReactNode; storageKey: string; label?: string;
  /** What the instrument under the stage is called on its strip when folded away. */
  name?: string;
  /** What the part above is called on its strip when folded away. */
  topName?: string;
}) {
  const body = useRef<HTMLDivElement>(null);
  const [fold, setFold] = useState<StageFold>(() => readStageFold(storageKey));
  const foldTo = (next: StageFold) => {
    setFold(next);
    try {
      window.localStorage.setItem(`parallax.bench.${storageKey}.fold`, next);
    } catch {
      // The fold lasts for this visit only.
    }
  };
  // E: the instrument takes the whole stage, and gives it back.
  useHotkeys([{ keys: "E", label: "Expand the instrument, or restore the sheet", group: "Bench", run: () => foldTo(fold === "sheet" ? "none" : "sheet") }]);
  // Kept as a share of the stage, not in pixels: a height chosen on a tall screen must not swallow a laptop's sheet.
  const [share, setShare] = useState(() => {
    const stored = readWidth(`${storageKey}.instrumentShare`);
    return stored !== null && stored < 1 ? stored : null;
  });
  const drag = useRef<{ y: number; height: number } | null>(null);
  const instrumentHeight = () => body.current?.querySelector<HTMLElement>(":scope > .parallax-scope, :scope > .parallax-stage-instrument, :scope > .parallax-bench-instruments")?.getBoundingClientRect().height ?? 300;
  const apply = (next: number) => {
    const total = body.current?.getBoundingClientRect().height ?? 800;
    const bounded = Math.max(140, Math.min(total - 160, next));
    const nextShare = Math.round(bounded / total * 1000) / 1000;
    setShare(nextShare);
    storeShare(`${storageKey}.instrumentShare`, nextShare);
  };
  const resizable = fold === "none";
  return (
    <StageFoldContext.Provider value={{ fold, foldTo }}>
    <div data-parallax-part="stage-body" className={classNames("parallax-stage-body", fold === "instrument" && "parallax-instrument-folded", fold === "sheet" && "parallax-sheet-folded")} ref={body}
      style={share && resizable ? { "--parallax-scope-height": `${share * 100}%` } as CSSProperties : undefined}>
      {fold === "sheet" ? <FoldedStrip label={topName} horizontal onUnfold={() => foldTo("none")} /> : null}
      {/* Folded, either side keeps running — the sheet its lights, the instrument its screen — and is only hidden. */}
      <div data-parallax-part="stage-top" className="parallax-stage-top" hidden={fold === "sheet"}>{top}</div>
      <div data-parallax-part="bench-edge" className="parallax-bench-edge parallax-horizontal">
        <div data-parallax-part="split-handle" className="parallax-split-handle parallax-horizontal" role="separator" aria-orientation="horizontal" aria-label={label} tabIndex={resizable ? 0 : -1}
          onPointerDown={(event) => {
            if (event.button !== 0 || !resizable) {
              return;
            }
            drag.current = { y: event.clientY, height: instrumentHeight() };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (drag.current) {
              apply(drag.current.height - (event.clientY - drag.current.y));
            }
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const delta = event.key === "ArrowUp" ? 16 : event.key === "ArrowDown" ? -16 : 0;
            if (delta && resizable) {
              event.preventDefault();
              apply(instrumentHeight() + delta);
            }
          }} />
        <div className="parallax-bench-folds">
          <FoldKnob folded={fold === "sheet"} what={topName.toLowerCase()} icons={["chevron-up", "chevron-down"]}
            onFold={() => foldTo(fold === "sheet" ? "none" : "sheet")} />
          <FoldKnob folded={fold === "instrument"} what={name.toLowerCase()} icons={["chevron-down", "chevron-up"]}
            onFold={() => foldTo(fold === "instrument" ? "none" : "instrument")} />
        </div>
      </div>
      {fold === "instrument" ? <FoldedStrip label={name} horizontal onUnfold={() => foldTo("none")} /> : null}
      {bottom}
    </div>
    </StageFoldContext.Provider>
  );
}

/**
 * Two panes side by side inside an instrument — a screen and its meters — with a handle between them; the right one's
 * width is the reader's, kept as a share of the whole so it means the same on any screen.
 */
export function PaneSplit({ left, right, storageKey, label }: { left: ReactNode; right: ReactNode; storageKey: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [share, setShare] = useState(() => {
    const stored = readWidth(`${storageKey}.paneShare`);
    return stored !== null && stored < 1 ? stored : null;
  });
  const drag = useRef<{ x: number; width: number } | null>(null);
  const rightWidth = () => host.current?.lastElementChild?.getBoundingClientRect().width ?? 280;
  const apply = (next: number) => {
    const total = host.current?.getBoundingClientRect().width ?? 1000;
    const bounded = Math.max(220, Math.min(total * 0.6, next));
    const nextShare = Math.round(bounded / total * 1000) / 1000;
    setShare(nextShare);
    storeShare(`${storageKey}.paneShare`, nextShare);
  };
  return (
    <div data-parallax-part="pane-split" className="parallax-pane-split" ref={host} style={share ? { "--parallax-pane-right": `${share * 100}%` } as CSSProperties : undefined}>
      {left}
      <div data-parallax-part="split-handle" className="parallax-split-handle" role="separator" aria-orientation="vertical" aria-label={label} tabIndex={0}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          drag.current = { x: event.clientX, width: rightWidth() };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current) {
            apply(drag.current.width - (event.clientX - drag.current.x));
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          const delta = event.key === "ArrowLeft" ? 16 : event.key === "ArrowRight" ? -16 : 0;
          if (delta) {
            event.preventDefault();
            apply(rightWidth() + delta);
          }
        }} />
      {right}
    </div>
  );
}

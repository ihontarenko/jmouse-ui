import { useParallaxTransport, useParallaxPartLibrary } from "../providers/ParallaxTransportProvider";
import type { PartLibraryView } from "@jmouse/parallax/schematic";
import { useMemo, useState, type ReactNode } from "react";
import { sameOwner, type ComponentReferenceView, type ParallaxOwner } from "@jmouse/parallax";
import { useAsync } from "../support/useAsync";
import {
  COMMON_SYMBOL, GROUND_SYMBOL, LABEL_SYMBOL, type SymbolDrawingDocument,
} from "@jmouse/parallax/schematic";
import { usePartLibrary } from "../providers/usePartLibrary";
import { SymbolPicture } from "../symbols/SymbolDrawing";
import { ComponentPicture } from "../symbols/ComponentPicture";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { elementTypes } from "@jmouse/parallax/circuit";
import type { SheetEditing } from "./useSheetEditing";

// The primitives come first in the palette; each is drawn from its own component's symbol document.
export const STANDARD_PARTS = (["RESISTOR", "CAPACITOR", "INDUCTOR", "DIODE", "VOLTAGE_SOURCE", "CURRENT_SOURCE"] as const)
  .map((type) => ({ slug: elementTypes[type].component, label: elementTypes[type].label, fallback: type }));

/**
 * The palette's groups, by what a component is (its `type` in jMX): a reader looks for a source among sources. A kind
 * no group names is an integrated circuit — the catalogue's ICs each have a kind of their own.
 */
const PALETTE_GROUPS: { title: string; kinds: readonly string[] }[] = [
  { title: "Sources", kinds: ["generator", "power-supply", "dual-power-supply", "voltage-source", "current-source"] },
  { title: "Passives", kinds: ["resistor", "capacitor", "inductor", "potentiometer"] },
  { title: "Semiconductors", kinds: ["diode", "rectifier-bridge", "mosfet", "transistor"] },
  { title: "Switches", kinds: ["switch", "button"] },
  { title: "Instruments", kinds: ["meter"] },
];
const INTEGRATED = "Integrated circuits";

/**
 * The components a sheet owned by `owner` may be built from: the built-in ones, the catalogue's published ones and
 * that owner's own.
 */
export function useAvailableComponentModels(owner: ParallaxOwner | null | undefined, enabled = true): ComponentReferenceView[] {
  const transport = useParallaxTransport();
  const models = useAsync((signal) => transport.components.models(signal), [], enabled);
  return useMemo(() => models.data?.filter((model) => model.origin === "BUILTIN"
    || (model.origin === "CATALOGUE" && model.status === "PUBLISHED")
    || (model.origin === "OWNED" && sameOwner(model.owner, owner))) ?? [], [models.data, owner?.type, owner?.id]);
}

function paletteGroupOf(library: PartLibraryView, reference: string): string {
  const kind = library.componentModelOf(reference)?.kind ?? "";
  return PALETTE_GROUPS.find((group) => group.kinds.includes(kind))?.title ?? INTEGRATED;
}

/** The components a sheet is built from, grouped by kind: choosing one puts it in hand, a click on the sheet places it. */
export function PartPalette({ models, editing, actions }: {
  models: readonly ComponentReferenceView[];
  editing: SheetEditing;
  /** What the host offers beside the palette — a new component, an import. */
  actions?: ReactNode;
}) {
  const library = useParallaxPartLibrary();
  const [search, setSearch] = useState("");
  // What a component is and how it is drawn — its group and its picture — comes with its model.
  usePartLibrary(models.map((model) => model.reference));
  const placement = editing.placement;
  const wanted = search.toLowerCase();
  const filteredModels = models.filter((model) => `${model.name} ${model.reference}`.toLowerCase().includes(wanted));
  const standardReference = (slug: string) => models.find((candidate) => candidate.reference.startsWith(`${slug}@`))?.reference;
  return <>
    {actions ? <div className="parallax-side-group parallax-palette-actions">{actions}</div> : null}
    <div className="parallax-side-group">
      <div className="parallax-search">
        <ParallaxIcon name="search" />
        <input data-parallax-part="input" className="parallax-input parallax-small" type="search" placeholder="Find a component" aria-label="Find a component" value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </div>
    </div>
    <div className="parallax-side-group parallax-flush">
      <h3>Parts</h3>
      <div data-parallax-part="palette-grid" className="parallax-palette-grid">
        {STANDARD_PARTS.filter((entry) => entry.label.toLowerCase().includes(wanted)).map((entry) => {
          const found = standardReference(entry.slug);
          return <button key={entry.slug} type="button" data-parallax-part="palette-item" className="parallax-palette-item" aria-pressed={!!found && placement?.component === found}
            onClick={() => found ? void editing.placeComponent(found) : editing.startPlacement({ type: entry.fallback })}>
            <PalettePicture drawing={componentDrawingOf(library, found)} /><span>{entry.label}</span></button>;
        })}
        {!search || "ground".includes(wanted) ? <button type="button" data-parallax-part="palette-item" className="parallax-palette-item" aria-pressed={placement?.type === "GROUND" && !placement.common && !placement.label}
          onClick={() => editing.startPlacement({ type: "GROUND" })}>
          <PalettePicture drawing={library.symbolDrawingOf(GROUND_SYMBOL)} /><span>Ground</span></button> : null}
        {!search || "0 v common".includes(wanted) ? <button type="button" data-parallax-part="palette-item" className="parallax-palette-item" aria-pressed={placement?.type === "GROUND" && !!placement.common}
          title="The circuit's 0 V — the common of a bipolar supply —, drawn as such rather than as an earth"
          onClick={() => editing.startPlacement({ type: "GROUND", common: true })}>
          <PalettePicture drawing={library.symbolDrawingOf(COMMON_SYMBOL)} /><span>0 V common</span></button> : null}
        {!search || "net label".includes(wanted) ? <button type="button" data-parallax-part="palette-item" className="parallax-palette-item" aria-pressed={placement?.type === "GROUND" && !!placement.label}
          title="A net's label: every label of one name is one net — a rail or any signal — with no wire drawn between them"
          onClick={() => editing.startPlacement({ type: "GROUND", label: true })}>
          <PalettePicture drawing={library.symbolDrawingOf(LABEL_SYMBOL)} /><span>Net label</span></button> : null}
      </div>
    </div>
    {editing.loadingComponent ? <p className="parallax-side-note">Loading a component…</p> : null}
    {editing.componentProblem ? <p className="parallax-diagnostic parallax-danger parallax-palette-problem"><ParallaxIcon name="error" />{editing.componentProblem}</p> : null}
    {[...PALETTE_GROUPS.map((group) => group.title), INTEGRATED].map((title) => {
      const members = filteredModels.filter((candidate) => !STANDARD_PARTS.some((entry) => candidate.reference.startsWith(`${entry.slug}@`))
        && paletteGroupOf(library, candidate.reference) === title);
      return members.length ? (
        <div key={title} className="parallax-side-group parallax-flush">
          <h3>{title}</h3>
          <div data-parallax-part="palette-grid" className="parallax-palette-grid">
            {members.map((candidate) => (
              <button key={candidate.reference} type="button" data-parallax-part="palette-item" className="parallax-palette-item" aria-pressed={placement?.component === candidate.reference}
                title={`${candidate.name} · ${candidate.reference}`} onClick={() => void editing.placeComponent(candidate.reference)}>
                <ComponentPicture reference={candidate.reference} margin={4} showPins={false} /><span>{candidate.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null;
    })}
    <div className="parallax-side-note"><span>Choose a component, then click where it goes on the sheet. <kbd>R</kbd> rotates, <kbd>M</kbd> mirrors,
      <kbd>W</kbd> draws wires, <kbd>V</kbd> selects.</span></div>
  </>;
}

/** The drawing a component is shown with: its default symbol document, once its model and the symbols have arrived. */
function componentDrawingOf(library: PartLibraryView, reference: string | undefined): SymbolDrawingDocument | undefined {
  const symbol = reference ? library.componentModelOf(reference)?.symbolReference : null;
  return symbol ? library.symbolDrawingOf(symbol) : undefined;
}

/**
 * A palette entry's picture for a primitive or a mark, every one in the same frame: its symbol, or an empty frame while
 * the drawing is on its way. A component of the library is drawn by `ComponentPicture`, its box included.
 */
function PalettePicture({ drawing }: { drawing: SymbolDrawingDocument | undefined }) {
  if (drawing) {
    return <SymbolPicture drawing={drawing} margin={4} />;
  }
  return <svg viewBox="-40 -30 80 60" aria-hidden="true" />;
}

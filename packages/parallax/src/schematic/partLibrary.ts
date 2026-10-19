import type { ParallaxTransport } from "../transport/transport";
import type { ComponentModelView } from "../transport/wire";
import { readSymbolDrawing, type SymbolDrawingDocument } from "./symbolDrawingDocument";

/** The symbol document the sheet's ground mark is drawn with; ground is a mark on the sheet, not a component. */
export const GROUND_SYMBOL = "ground-symbol";
/** The symbol document a 0 V mark is drawn with: the common of the circuit, not an earth. */
export const COMMON_SYMBOL = "common-symbol";
/** The symbol document a net's label is drawn with: a power port's bar and lead, the net's name over it. */
export const LABEL_SYMBOL = "net-label-symbol";

/**
 * What a sheet reads while it lays out parts and wires — synchronously, from every function that places a pin. A part
 * whose data has not arrived yet is drawn as a box; the revision changes whenever something arrives, so a layout cached
 * against it is laid out again.
 */
export interface PartLibraryView {
  /** A component's model if it has arrived; `null` when it could not be read, `undefined` while it is on its way. */
  componentModelOf(reference: string): ComponentModelView | null | undefined;
  /** A symbol document's drawing, if the library has it. */
  symbolDrawingOf(slug: string): SymbolDrawingDocument | undefined;
  /** The library's revision now, for a layout cache that must not outlive the data it was laid out from. */
  revision(): number;
}

/**
 * What every sheet draws its parts from: the component models (`GET /component-models/{reference}` — pins, the default
 * symbol's drawing and its port map) and the symbol documents (`GET /symbols`), fetched through ONE transport and kept
 * for it. Two transports are two libraries: a model is named `slug@revision` by the server it came from, so the same
 * name from another server is another part.
 */
/** How long a refused request is left before it is made again. */
const ASK_AGAIN_MILLISECONDS = 3000;

export class ParallaxPartLibrary implements PartLibraryView {
  private readonly models = new Map<string, ComponentModelView | null>();
  private readonly symbols = new Map<string, SymbolDrawingDocument>();
  private readonly requestedModels = new Set<string>();
  private readonly listeners = new Set<() => void>();
  /** When each refused model was refused, so it is asked for again later. */
  private readonly refusedModels = new Map<string, number>();
  /** The full set of symbol documents arrived. */
  private symbolsFetched = false;
  private symbolsPending = false;
  private symbolsRefusedAt = Number.NEGATIVE_INFINITY;
  /** The symbol documents came, or their request failed: a sheet stops waiting for them either way. */
  private symbolsAnswered = false;
  private currentRevision = 0;
  /** Listeners are to be told of the revision once the current task is over. */
  private notificationPending = false;

  private readonly transport: ParallaxTransport;

  constructor(transport: ParallaxTransport) {
    this.transport = transport;
  }

  componentModelOf(reference: string): ComponentModelView | null | undefined {
    return this.models.get(reference);
  }

  symbolDrawingOf(slug: string): SymbolDrawingDocument | undefined {
    return this.symbols.get(slug);
  }

  revision(): number {
    return this.currentRevision;
  }

  /**
   * Whether everything a sheet of these components is drawn from has been answered — the symbol documents and each
   * model, arrived or refused. Drawn before, the sheet showed every part as a grey box named by its lowercase reference
   * for a moment, then jumped to its symbols.
   */
  holds(references: readonly string[]): boolean {
    return this.symbolsAnswered && references.every((reference) => !reference || this.models.has(reference));
  }

  /** Calls the listener whenever a model or a symbol document arrives; returns the call that stops it. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The revision, as a store's snapshot: a bound function, so it can be handed over as it is. */
  snapshot = (): number => this.currentRevision;

  /** Keeps a model read elsewhere, so a part placed from it is drawn at once. */
  rememberComponentModel(reference: string, model: ComponentModelView) {
    this.requestedModels.add(reference);
    this.models.set(reference, model);
    this.publish();
  }

  /**
   * Fetches the models not yet asked for, and asks again for one refused a while ago: a refusal is often only "not signed
   * in yet", and kept for good it drew every part of the sheet as a box after the reader signed in.
   */
  requestComponentModels(references: readonly string[]) {
    const now = Date.now();
    for (const reference of references) {
      const refused = this.refusedModels.get(reference);
      if (!reference || (this.requestedModels.has(reference) && (refused === undefined || now - refused < ASK_AGAIN_MILLISECONDS))) {
        continue;
      }
      this.requestedModels.add(reference);
      this.refusedModels.delete(reference);
      this.transport.components.model(reference)
        .then((model) => {
          this.models.set(reference, model);
        })
        .catch(() => {
          this.refusedModels.set(reference, Date.now());
          // a model kept from elsewhere (a specimen read before sign-in) outlives a refused request
          if (!this.models.get(reference)) {
            this.models.set(reference, null);
          }
        })
        .finally(() => this.publish());
    }
  }

  /**
   * Keeps symbol documents read elsewhere — the specimens a page shows before anyone signs in, when the API refuses — so
   * a sheet that uses them is drawn at once. It is a few documents, not the library: the full set is still to be asked
   * for. Taken for it, the sign-in page's four specimens were every symbol a reader had after signing in.
   */
  rememberSymbols(views: readonly { slug: string; drawing: string }[]) {
    this.keepSymbols(views);
    this.publish();
  }

  /** Fetches every symbol document the reader may see, once — and again a while after a refusal. */
  requestSymbols() {
    if (this.symbolsFetched || this.symbolsPending || Date.now() - this.symbolsRefusedAt < ASK_AGAIN_MILLISECONDS) {
      return;
    }
    this.symbolsPending = true;
    this.transport.components.symbols()
      .then((views) => {
        this.keepSymbols(views);
        this.symbolsFetched = true;
      })
      .catch(() => {
        this.symbolsRefusedAt = Date.now();
      })
      .finally(() => {
        this.symbolsPending = false;
        this.symbolsAnswered = true;
        this.publish();
      });
  }

  private keepSymbols(views: readonly { slug: string; drawing: string }[]) {
    for (const view of views) {
      const drawing = readSymbolDrawing(view.drawing);
      if (drawing) {
        this.symbols.set(view.slug, drawing);
      }
    }
  }

  /**
   * A new revision now, and one call to every listener once the arrivals of this moment are in. A sheet asks for dozens
   * of models whose answers land one microtask after another; told of each at once, React drew the sheet once per model
   * inside one chain of microtasks and refused the fiftieth draw as an endless loop ("Maximum update depth exceeded").
   */
  private publish() {
    this.currentRevision += 1;
    if (this.notificationPending) {
      return;
    }
    this.notificationPending = true;
    setTimeout(() => {
      this.notificationPending = false;
      this.listeners.forEach((listener) => listener());
    }, 0);
  }
}

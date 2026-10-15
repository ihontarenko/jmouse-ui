import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ParallaxTransport } from "@jmouse/parallax";
import { ParallaxPartLibrary } from "@jmouse/parallax/schematic";

const Transport = createContext<ParallaxTransport | null>(null);
const PartLibrary = createContext<ParallaxPartLibrary | null>(null);

/**
 * Hands the components and hooks the host's transport — and the part library kept for it: the component models and
 * symbol documents every sheet draws from, fetched through this transport and shared by every sheet under it. Mounted
 * once, at the application's root; a second transport mounted elsewhere gets a library of its own.
 */
export function ParallaxTransportProvider({ value, children }: { value: ParallaxTransport; children?: ReactNode }) {
  const library = useMemo(() => new ParallaxPartLibrary(value), [value]);
  return (
    <Transport.Provider value={value}>
      <PartLibrary.Provider value={library}>{children}</PartLibrary.Provider>
    </Transport.Provider>
  );
}

const missing = (what: string) => new Error(`No ${what}. Wrap the screen in <ParallaxTransportProvider value={…}> — the engine's interface `
  + "brings no HTTP client of its own, on purpose.");

/**
 * ⚠️ Throws rather than falling back. A bench with no transport would render, sit empty, and read as *this circuit has
 * no parts* — which is the wrong bug to go looking for.
 */
export function useParallaxTransport(): ParallaxTransport {
  const transport = useContext(Transport);
  if (transport === null) {
    throw missing("ParallaxTransport");
  }
  return transport;
}

/** The part library of the transport above: what a sheet reads synchronously while it lays out parts and wires. */
export function useParallaxPartLibrary(): ParallaxPartLibrary {
  const library = useContext(PartLibrary);
  if (library === null) {
    throw missing("part library");
  }
  return library;
}

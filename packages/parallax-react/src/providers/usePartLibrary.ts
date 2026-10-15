import { useEffect, useSyncExternalStore } from "react";
import { useParallaxPartLibrary } from "./ParallaxTransportProvider";

/**
 * Asks the transport's part library for the given component models and the symbol documents, and draws the caller
 * again whenever any arrive. Returns the library's revision, which a memoised layout keys on.
 */
export function usePartLibrary(componentReferences: readonly string[]): number {
  const library = useParallaxPartLibrary();
  const key = [...new Set(componentReferences)].sort().join("|");
  // On every sheet that mounts, and whenever its parts change: a request refused before the reader signed in is made
  // again by the library once a while has passed, so the sheet opened after signing in gets what the sign-in page did not.
  useEffect(() => {
    library.requestSymbols();
    library.requestComponentModels(key ? key.split("|") : []);
  }, [library, key]);
  return useSyncExternalStore(library.subscribe, library.snapshot);
}

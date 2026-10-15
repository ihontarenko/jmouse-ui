import { useEffect, useState } from "react";
import { listedReferenceKinds, referenceOptionsOf, type ReferenceOption } from "@jmouse/parallax/document";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";

/** The documents a reference field may name, or null when its kinds have no listing and the slug is typed. */
export function useReferenceOptions(kinds: readonly string[]): ReferenceOption[] | null {
  const transport = useParallaxTransport();
  const key = listedReferenceKinds(kinds).join("|");
  const [options, setOptions] = useState<ReferenceOption[] | null>(null);
  useEffect(() => {
    if (!key) {
      setOptions(null);
      return;
    }
    let current = true;
    Promise.all(key.split("|").map((kind) => referenceOptionsOf(transport, kind)))
      .then((lists) => {
        if (current) {
          setOptions(lists.flat().sort((first, second) => first.label.localeCompare(second.label)));
        }
      })
      .catch(() => {
        if (current) {
          setOptions(null);
        }
      });
    return () => {
      current = false;
    };
  }, [transport, key]);
  return key ? options ?? [] : null;
}

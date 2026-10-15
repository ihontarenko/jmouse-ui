import { useEffect, useState } from "react";
import { ApiProblem, isAbort, type ObjectDetail } from "@jmouse/parallax";
import { useParallaxTransport } from "@jmouse/parallax-react";

export type DetailState = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; detail: ObjectDetail };

/** A catalogue object read through the library's transport — the only way this host reaches the engine. */
export function useObjectDetail(slug: string): DetailState {
  const transport = useParallaxTransport();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    transport.catalogue.object(slug, controller.signal)
      .then((detail) => setState({ status: "ready", detail }))
      .catch((error: unknown) => {
        if (isAbort(error)) {
          return;
        }
        const message = error instanceof ApiProblem ? error.detail : "The object could not be read.";
        setState({ status: "failed", message });
      });
    return () => controller.abort();
  }, [transport, slug]);
  return state;
}

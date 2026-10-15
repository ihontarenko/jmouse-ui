import { useState } from "react";
import { CATALOGUE_SUBJECT, type ObjectDetail } from "@jmouse/parallax";
import { Bench } from "@jmouse/parallax-react/bench";
import { useObjectDetail } from "./useObjectDetail";

/** Page 2: a catalogue circuit on the library's live bench, with the thinnest bar a host can draw around it. */
export function BenchPage({ slug }: { slug: string }) {
  const state = useObjectDetail(slug);
  if (state.status === "loading") {
    return <p className="sample-status">Reading {slug}…</p>;
  }
  if (state.status === "failed") {
    return <p className="sample-status" role="alert">{state.message}</p>;
  }
  return <CircuitBench key={state.detail.summary.slug} detail={state.detail} />;
}

function CircuitBench({ detail }: { detail: ObjectDetail }) {
  const [representation, setRepresentation] = useState<string | null>(null);
  return (
    <section className="sample-bench" aria-label={detail.summary.title}>
      <Bench reference={`${CATALOGUE_SUBJECT}${detail.summary.slug}`} detail={detail} editable={false}
        representation={representation} onRepresentation={setRepresentation}
        bar={(parts) => (
          <div className="sample-bench-bar">
            <h2 className="sample-page-title">{detail.summary.title}</h2>
            <div className="sample-bench-context">{parts.context}</div>
          </div>
        )} />
    </section>
  );
}

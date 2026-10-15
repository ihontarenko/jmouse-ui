import { useState } from "react";
import type { ObjectDetail } from "@jmouse/parallax";
import { Stand } from "@jmouse/parallax-react/stand";
import { useObjectDetail } from "./useObjectDetail";

/** Page 1: a catalogue object on the library's stand — its parameter sliders, the computed view, its outputs. */
export function ObjectPage({ slug }: { slug: string }) {
  const state = useObjectDetail(slug);
  if (state.status === "loading") {
    return <p className="sample-status">Reading {slug}…</p>;
  }
  if (state.status === "failed") {
    return <p className="sample-status" role="alert">{state.message}</p>;
  }
  return <ObjectStand key={state.detail.summary.slug} detail={state.detail} />;
}

function ObjectStand({ detail }: { detail: ObjectDetail }) {
  const [values, setValues] = useState<Record<string, number>>(
    () => Object.fromEntries(detail.parameters.map((parameter) => [parameter.name, parameter.defaultValue])));
  return (
    <section className="sample-page" aria-labelledby="sample-object-title">
      <h2 id="sample-object-title" className="sample-page-title">{detail.summary.title}</h2>
      <Stand detail={detail} target={{ subject: `catalogue:${detail.summary.slug}` }} saved values={values} onValues={setValues} />
    </section>
  );
}

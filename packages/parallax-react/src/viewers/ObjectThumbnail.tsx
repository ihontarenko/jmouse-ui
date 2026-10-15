import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import { useAsync } from "../support/useAsync";
import { ComputedThumbnail } from "./ComputedViewport";

/** An object's card picture by its identifier alone: its primary representation, computed. */
export function ObjectThumbnail({ slug, title }: { slug: string | null; title: string }) {
  const transport = useParallaxTransport();
  const detail = useAsync((signal) => transport.catalogue.object(slug!, signal), [slug], Boolean(slug));
  if (!slug) {
    return <div data-parallax-part="computed-frame" className="parallax-computed-frame" />;
  }
  if (!detail.data) {
    return <div data-parallax-part="computed-frame" className="parallax-computed-frame" aria-busy={detail.loading} />;
  }
  return detail.data.summary.primaryRepresentation
    ? <ComputedThumbnail target={detail.data.summary.id} representation={detail.data.summary.primaryRepresentation} title={title} latex={detail.data.summary.formulaLatex} />
    : <div data-parallax-part="computed-frame" className="parallax-computed-frame" aria-label={`${title} has no numerical preview`} />;
}

import { useEffect, useState, type ReactNode } from "react";
import type { ParallaxLinkAttributes, ParallaxNavigation, ParallaxTarget } from "@jmouse/parallax-react";

/*
 * The sample's whole router: two addresses in the hash. The library's navigation port is answered with plain anchors —
 * an object or a circuit it names opens here; everything else it may name (symbols, the formula page, the reference)
 * this host does not have, so those render as text and navigate nowhere.
 */

export type SampleRoute = { page: "object"; slug: string } | { page: "bench"; slug: string };

export const DEFAULT_OBJECT = "lorenz";
export const DEFAULT_CIRCUIT = "bridge-supply";

export function addressOf(route: SampleRoute): string {
  return `#/${route.page}/${encodeURIComponent(route.slug)}`;
}

function routeOf(hash: string): SampleRoute {
  const [, page, slug] = hash.replace(/^#/, "").split("/");
  if (page === "bench") {
    return { page: "bench", slug: slug ? decodeURIComponent(slug) : DEFAULT_CIRCUIT };
  }
  return { page: "object", slug: page === "object" && slug ? decodeURIComponent(slug) : DEFAULT_OBJECT };
}

export function useSampleRoute(): SampleRoute {
  const [route, setRoute] = useState(() => routeOf(window.location.hash));
  useEffect(() => {
    const follow = () => setRoute(routeOf(window.location.hash));
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
  return route;
}

function routeOfTarget(target: ParallaxTarget): SampleRoute | null {
  switch (target.kind) {
    case "object":
      return { page: "object", slug: target.slug };
    case "circuit":
      return { page: "bench", slug: target.slug };
    default:
      return null;
  }
}

export const sampleNavigation: ParallaxNavigation = {
  renderLink(target: ParallaxTarget, children: ReactNode, attributes: ParallaxLinkAttributes = {}): ReactNode {
    const route = routeOfTarget(target);
    if (route === null) {
      return <span className={attributes.className} title={attributes.title}>{children}</span>;
    }
    return <a href={addressOf(route)} {...attributes}>{children}</a>;
  },
  navigate(target: ParallaxTarget): void {
    const route = routeOfTarget(target);
    if (route !== null) {
      window.location.hash = addressOf(route);
    }
  },
};

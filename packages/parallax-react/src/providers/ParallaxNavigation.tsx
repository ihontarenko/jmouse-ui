import { createContext, useContext, type ReactNode } from "react";

/**
 * Where a component may send the reader — a closed list, so a host maps every one of them onto its own routes and the
 * package never names a URL.
 */
export type ParallaxTarget =
  /** An object's own page. */
  | { kind: "object"; slug: string }
  /** A circuit on its bench. */
  | { kind: "circuit"; slug: string }
  /** The circuits there are, to choose one for the bench. */
  | { kind: "circuits" }
  /** A symbol in the symbol editor. */
  | { kind: "symbol"; slug: string }
  /** The symbols there are. */
  | { kind: "symbols" }
  /** The symbol editor with a blank drawing. */
  | { kind: "new-symbol" }
  /** A formula opened on its own, to be analysed. */
  | { kind: "formula"; source: string }
  /** The language reference. */
  | { kind: "reference" };

/** What a link carries besides where it goes: the look and the name the host's anchor is drawn with. */
export interface ParallaxLinkAttributes {
  className?: string;
  role?: string;
  title?: string;
  "aria-label"?: string;
}

/** The host's router, as the components use it: an anchor to a target, and a move to one. */
export interface ParallaxNavigation {
  /** An anchor (`<a href>`) to the target, holding `children` — the host's own link component. */
  renderLink(target: ParallaxTarget, children: ReactNode, attributes?: ParallaxLinkAttributes): ReactNode;
  /** Takes the reader to the target, as a click on its link would. */
  navigate(target: ParallaxTarget): void;
}

const Navigation = createContext<ParallaxNavigation | null>(null);

/** Hands the components the host's router; mounted once, at the application's root. */
export const ParallaxNavigationProvider = Navigation.Provider;

/** ⚠️ Throws rather than falling back: a link that silently goes nowhere is a dead control. */
export function useParallaxNavigation(): ParallaxNavigation {
  const navigation = useContext(Navigation);
  if (navigation === null) {
    throw new Error("No ParallaxNavigation. Wrap the screen in <ParallaxNavigationProvider value={{ renderLink, navigate }}>.");
  }
  return navigation;
}

/** An anchor to a target, drawn by the host's router. */
export function ParallaxLink({ to, children, ...attributes }: ParallaxLinkAttributes & { to: ParallaxTarget; children: ReactNode }) {
  return <>{useParallaxNavigation().renderLink(to, children, attributes)}</>;
}

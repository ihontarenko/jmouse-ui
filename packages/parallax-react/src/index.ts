/**
 * Parallax's interface as React components over `@jmouse/parallax`. The root holds the ports a host mounts once: the
 * transport (and the part library kept for it), the navigation over the host's router, and the host's settings. Every
 * component is in a subpath by domain — `/bench`, `/viewers`, `/circuit`, `/scope`, `/meters`, `/graph`, `/stand`,
 * `/document`, `/symbols`, `/scene`, `/program`, `/controls`, `/icons`.
 */
export * from "./providers/ParallaxNavigation";
export * from "./providers/ParallaxSettings";
export * from "./providers/ParallaxTransportProvider";
export * from "./providers/usePartLibrary";

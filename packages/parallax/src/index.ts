/**
 * Parallax's headless machinery. The root is the transport: the engine's routes as a port, the wire types, the live
 * session and problems. Every other domain is its own subpath — `@jmouse/parallax/visual`, `/circuit`, `/scope`, ….
 * Nothing here imports React or a product.
 */
export * from "./transport";

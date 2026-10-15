/**
 * Orthogonal wire routing for a schematic sheet on a grid: wires kept out of part bodies and off other nodes' wires,
 * crossings drawn as hops and branches as dots. It knows nothing of what a part is — the caller describes each part's
 * body and pins through `PartGeometry`. It imports nothing from the product; the product imports it from here.
 */
export { GRID, parsePort, portKey, snap } from "./grid";
export {
  routeSheet, wirePath,
  type PartGeometry, type RoutedSheet, type SheetPart, type SheetPoint, type SheetWire,
} from "./router";

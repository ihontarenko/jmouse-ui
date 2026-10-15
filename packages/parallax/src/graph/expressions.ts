import type { Interpretation } from "../transport/wire";
import { SERIES_COUNT, snappedWindow, visibleWindow, type PlaneView, type PlaneWindow, type Size } from "../visual";

/**
 * The window an expression is computed over: what is visible, widened by half on every side and snapped to a
 * coarse grid, so a short pan or a small zoom keeps the dataset already drawn instead of asking for a new one.
 */
export function computationWindow(view: PlaneView, size: Size): PlaneWindow {
  const visible = visibleWindow(view, size);
  const span = Math.max(visible.xMaximum - visible.xMinimum, visible.yMaximum - visible.yMinimum);
  const snap = Math.pow(2, Math.ceil(Math.log2(span / 2)));
  const widen = (minimum: number, maximum: number): [number, number] => {
    const margin = (maximum - minimum) / 2;
    return [Math.floor((minimum - margin) / snap) * snap, Math.ceil((maximum + margin) / snap) * snap];
  };
  const [xMinimum, xMaximum] = widen(visible.xMinimum, visible.xMaximum);
  const [yMinimum, yMaximum] = widen(visible.yMinimum, visible.yMaximum);
  return { xMinimum, xMaximum, yMinimum, yMaximum };
}

/*
 * The graph's list of expressions and what each line plays in it. A line's role is read from its shape alone — a
 * slider, a definition the other lines may call, or an expression to draw — the way a syntax colours a line; what
 * the mathematics IS stays the backend's word (`/formula/interpret`).
 */

/** A saved line's name, and what the page does not draw yet: its pane, `until`, `at`, whether it is a label. */
export interface WrittenLine {
  name: string;
  label?: boolean;
  until?: string | null;
  at?: string | null;
  pane?: string | null;
  /** The circuit pane whose signal the line draws: `p from sheet`, `a - b from sheet`. */
  from?: string | null;
}

export interface GraphExpression {
  id: string;
  source: string;
  /** Index into the graph's series colours, kept by the line for its whole life. */
  colorIndex: number;
  visible: boolean;
  /** What a line of a saved graph says besides its expression, kept so a save writes it back. */
  written?: WrittenLine;
  /** A slider's range as a saved graph wrote it (`N = 7 in 1 .. 49`); without one the range follows the value. */
  range?: SliderRange;
  /** The value a graph's clock moves over its own range (`clock s from 0 to 5`), not a parameter of the graph. */
  fromClock?: boolean;
}

export type ExpressionRole =
  | { kind: "empty" }
  /** `a = 2`: a number the other lines read by name, worked by a slider. */
  | { kind: "slider"; name: string; value: number }
  /** `f(x) = …` or `c = sqrt(2)`: a definition every other line may call. */
  | { kind: "definition"; name: string }
  | { kind: "expression" };

export const GRAPH_COLOR_COUNT = SERIES_COUNT;

/** The names a line cannot define: the plane's own variables and the language's constants. */
const RESERVED = new Set(["x", "y", "z", "w", "n", "t", "e", "pi", "tau", "phi", "i"]);
const NAME = "[A-Za-z\\u0370-\\u03FF][A-Za-z0-9_\\u0370-\\u03FF]*";
const SLIDER = new RegExp(`^\\s*(${NAME})\\s*=\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)\\s*$`);
const FUNCTION = new RegExp(`^\\s*(${NAME})\\s*\\(\\s*${NAME}(?:\\s*,\\s*${NAME})*\\s*\\)\\s*=(?!=)`);
const CONSTANT = new RegExp(`^\\s*(${NAME})\\s*=(?!=)`);

/** A construction's own words (jmouse `GeometricElementType`): a line that calls one of them is geometry. */
const GEOMETRY_WORDS = ["point", "midpoint", "line", "segment", "ray", "circle", "circle_through_three", "plane", "sphere",
  "intersection", "perpendicular", "parallel", "tangent", "reflection", "vector", "polygon", "rotation"];
const GEOMETRY_CALL = new RegExp(`^(?:${GEOMETRY_WORDS.join("|")})\\s*\\(`);
const NAMED = new RegExp(`^\\s*(${NAME})\\s*=(?!=)\\s*([\\s\\S]*)$`);

/**
 * Whether a line is geometry rather than a function: a point `(a, b)` — the notation jMX gives a curve's components —
 * or a construction step `vector(A, B)`, named (`P = (cos(t), sin(t))`) or not. The backend reads it as a construction.
 */
export function isGeometrySource(source: string): boolean {
  const named = NAMED.exec(source);
  const body = (named && !FUNCTION.test(source) ? named[2] : source).trim();
  if (GEOMETRY_CALL.test(body)) {
    return true;
  }
  if (!body.startsWith("(") || !body.endsWith(")")) {
    return false;
  }
  let depth = 0;
  let commas = 0;
  for (let index = 0; index < body.length; index++) {
    const character = body[index];
    if (character === "(") {
      depth++;
    } else if (character === ")") {
      depth--;
      if (depth === 0 && index !== body.length - 1) {
        return false;
      }
    } else if (character === "," && depth === 1) {
      commas++;
    }
  }
  return commas >= 1;
}

/**
 * A line's role, the line itself known: the value a graph's clock moves (`clock t from 0 to 4 pi`) is a slider even
 * under a name the plane otherwise keeps for itself — `t` is the graph's time when the graph says so.
 */
export function roleOfLine(expression: Pick<GraphExpression, "source" | "fromClock">): ExpressionRole {
  return roleOf(expression.source, expression.fromClock === true);
}

export function roleOf(source: string, ownsReservedName = false): ExpressionRole {
  if (!source.trim()) {
    return { kind: "empty" };
  }
  if (source.includes(";")) {
    return { kind: "expression" };
  }
  // A named point or shape is drawn, and its name is what other geometry lines refer to.
  if (isGeometrySource(source)) {
    return { kind: "expression" };
  }
  const slider = SLIDER.exec(source);
  if (slider && (ownsReservedName || !RESERVED.has(slider[1]))) {
    return { kind: "slider", name: slider[1], value: Number(slider[2]) };
  }
  const definition = FUNCTION.exec(source) ?? CONSTANT.exec(source);
  if (definition && !RESERVED.has(definition[1])) {
    return { kind: "definition", name: definition[1] };
  }
  return { kind: "expression" };
}

/**
 * The definitions every expression line is read against, in the order they are written. A geometry line also gets the
 * graph's named points and shapes, which a formula cannot read: jMF has no tuples.
 */
export function libraryOf(expressions: readonly GraphExpression[], forGeometry = false): string {
  return expressions
    .filter((expression) => roleOfLine(expression).kind === "definition"
      || (forGeometry && NAMED.test(expression.source) && isGeometrySource(expression.source)))
    .map((expression) => expression.source.trim())
    .join("; ");
}

/** A line as the backend reads it: the graph's definitions first, then the line. */
export function withLibrary(library: string, source: string): string {
  return library ? `${library}; ${source.trim()}` : source.trim();
}

/** The range a slider runs over: −10 to 10, widened to hold its value. */
/** A slider's range; `values` when it stops only at listed values (`N = 7 in [1, 3, 7, 19, 49]`, a jME list). */
export interface SliderRange {
  minimum: number;
  maximum: number;
  values?: number[];
}

/** The listed value nearest to a value: where a slider over listed values lands. */
export function nearestListed(values: readonly number[], value: number): number {
  return values.reduce((nearest, candidate) => (Math.abs(candidate - value) < Math.abs(nearest - value) ? candidate : nearest), values[0]);
}

export function sliderRange(value: number, written?: SliderRange): SliderRange {
  if (written && value >= written.minimum && value <= written.maximum) {
    return written;
  }
  return { minimum: Math.min(-10, Math.floor(value)), maximum: Math.max(10, Math.ceil(value)) };
}

/** The value every slider line sets, by name. */
export function sliderValues(expressions: readonly GraphExpression[]): Record<string, number> {
  const values: Record<string, number> = {};
  for (const expression of expressions) {
    const role = roleOfLine(expression);
    if (role.kind === "slider") {
      values[role.name] = role.value;
    }
  }
  return values;
}

/** How a kind is drawn on the plane: the representation asked for and the window written into its definition. */
export interface PlaneDrawing {
  representation: string;
  settings: Record<string, unknown>;
  definition: (definition: Record<string, unknown>, window: PlaneWindow, visible: PlaneWindow) => Record<string, unknown>;
  /** The window the dataset covers, which the plane needs to place a raster. */
  coverage: (window: PlaneWindow, visible: PlaneWindow) => PlaneWindow;
}

const interval = (minimum: number, maximum: number) => ({ minimum, maximum });

const planeDrawings: Record<string, PlaneDrawing> = {
  EXPLICIT_CURVE: {
    representation: "CURVE",
    settings: { samples: 2400 },
    definition: (definition, window) => ({ ...definition, x: interval(window.xMinimum, window.xMaximum) }),
    coverage: (window) => window,
  },
  IMPLICIT_CURVE: {
    representation: "LEVEL_SET",
    settings: { resolution: 480 },
    definition: (definition, window) => ({ ...definition, x: interval(window.xMinimum, window.xMaximum), y: interval(window.yMinimum, window.yMaximum) }),
    coverage: (window) => window,
  },
  // `(cos(s), sin(s))  s in 0 .. 2 pi`: drawn over its own range, wherever the plane looks.
  PARAMETRIC_CURVE: {
    representation: "CURVE",
    settings: { samples: 2400 },
    definition: (definition) => definition,
    coverage: (window) => window,
  },
  GEOMETRIC_CONSTRUCTION: {
    representation: "CONSTRUCTION",
    settings: { extent: 1000 },
    definition: (definition) => definition,
    coverage: (window) => window,
  },
  REGION: {
    representation: "REGION",
    settings: { resolution: 640 },
    definition: (definition, _window, visible) => {
      const raster = snappedWindow(visible);
      return { ...definition, from: [String(raster.xMinimum), String(raster.yMinimum)], to: [String(raster.xMaximum), String(raster.yMaximum)] };
    },
    coverage: (_window, visible) => snappedWindow(visible),
  },
};

/** Whether an object of this kind belongs on the graph: drawn on its plane, or a value read beside its line. */
export function belongsOnGraph(kind: string): boolean {
  return kind in planeDrawings || kind === "VALUE";
}

/** How a line's kind goes on the plane, or null when it is not a plane object (a surface, a value, a fractal). */
/** The surfaces a space pane draws, by kind: computed over the pane's x and y when it fixes them, else their own. */
const spaceRepresentations: Record<string, string> = {
  EXPLICIT_SURFACE: "SURFACE",
  IMPLICIT_SURFACE: "IMPLICIT_SURFACE",
  PARAMETRIC_SURFACE: "SURFACE",
  PARAMETRIC_CURVE: "CURVE",
};

/** How a kind is drawn in a space pane, in the shape a plane drawing has; null when it is not a thing in space. */
export function spaceDrawingOf(interpretation: Interpretation | null, axes: { x?: [number, number]; y?: [number, number] }): PlaneDrawing | null {
  const family = interpretation ? familyDrawingOf(interpretation, (member) => spaceDrawingOf(member, axes)) : undefined;
  if (family !== undefined) {
    return family;
  }
  const representation = interpretation?.kind && interpretation.definition ? spaceRepresentations[interpretation.kind] : undefined;
  if (!representation) {
    return null;
  }
  return {
    representation,
    settings: {},
    definition: (definition) => ({
      ...definition,
      ...(axes.x && interpretation!.kind === "EXPLICIT_SURFACE" ? { x: interval(axes.x[0], axes.x[1]) } : {}),
      ...(axes.y && interpretation!.kind === "EXPLICIT_SURFACE" ? { y: interval(axes.y[0], axes.y[1]) } : {}),
    }),
    coverage: (window) => window,
  };
}

export function planeDrawingOf(interpretation: Interpretation | null): PlaneDrawing | null {
  if (!interpretation?.kind || !interpretation.definition) {
    return null;
  }
  const family = familyDrawingOf(interpretation, (member) => planeDrawingOf(member));
  return family !== undefined ? family : planeDrawings[interpretation.kind] ?? null;
}

/**
 * A family (`… k in 1 .. N integer`) is drawn as its member is: the member's representation, its window written into
 * the member. Undefined when the line is not a family.
 */
function familyDrawingOf(interpretation: Interpretation, drawingOf: (member: Interpretation) => PlaneDrawing | null): PlaneDrawing | null | undefined {
  if (interpretation.kind !== "FAMILY") {
    return undefined;
  }
  const member = interpretation.definition?.member as Interpretation["definition"] & { kind: string };
  const drawing = member ? drawingOf({ ...interpretation, kind: member.kind, definition: member }) : null;
  if (!drawing) {
    return null;
  }
  return {
    ...drawing,
    definition: (definition, window, visible) => ({ ...definition, member: drawing.definition(definition.member as Record<string, unknown>, window, visible) }),
  };
}

let sequence = 0;

export function newExpression(source: string, colorIndex: number): GraphExpression {
  sequence += 1;
  return { id: `${Date.now().toString(36)}-${sequence}`, source, colorIndex: colorIndex % GRAPH_COLOR_COUNT, visible: true };
}

/** The colour index the next line takes: the one used least, so deleting a line frees its colour. */
export function nextColorIndex(expressions: readonly GraphExpression[]): number {
  const counts = Array.from({ length: GRAPH_COLOR_COUNT }, (_, index) => expressions.filter((expression) => expression.colorIndex === index).length);
  return counts.indexOf(Math.min(...counts));
}

import type { ObjectDetail } from "../transport/wire";
import type { GraphCheck } from "./checks";
import { GRAPH_COLOR_COUNT, newExpression, nextColorIndex, roleOfLine, sliderRange, type GraphExpression } from "./expressions";

/**
 * A graph kept as a jMX `graph` document, and read back. The text is the truth, as for every object: the page writes
 * it and sends it, and opens a saved graph from the definition the backend read off it.
 *
 * Sliders become `parameters`, definitions `formulas`, every other line a line of `lines` — with what the page does
 * not draw yet (a pane, `until`, `at`, a label) kept on the line as written, so a save never loses it.
 */


export interface GraphPaneDocument {
  name: string;
  kind: string;
  axes: Record<string, [string, string]>;
  uses: string | null;
  /** A circuit pane's span of circuit time the clock's range is laid onto, as written (`0`, `5 ms`). */
  over?: [string, string] | null;
  camera: string | null;
}

export interface GraphDefinition {
  kind: "GRAPH";
  formulas: string;
  clock: { parameter: string; from: string | null; to: string | null; speed: number; loop: boolean } | null;
  layout: string;
  panes: GraphPaneDocument[];
  checks?: GraphCheck[];
  lines: { name: string; expression: string; label: boolean; until: string | null; at: string | null; from?: string | null; pane: string | null; color: number | null; hidden: boolean }[];
}

/** The panes a graph has when none are written: one plane. */
export const DEFAULT_PANES: GraphPaneDocument[] = [{ name: "main", kind: "PLANE", axes: {}, uses: null, camera: null }];

export interface GraphDocument {
  title: string;
  slug: string;
  expressions: GraphExpression[];
  /** The slider that plays; `from`/`to` when the clock names its own range rather than the slider's. */
  clock: { parameter: string; speed: number; from?: string | null; to?: string | null } | null;
  layout: string;
  panes: GraphPaneDocument[];
  /** What the graph claims, written back as its `expect` blocks. */
  checks?: GraphCheck[];
  /** The ranges the saved text gave its parameters; a slider keeps its own while its value stays inside. */
  ranges?: Record<string, { minimum: number; maximum: number; label?: string; values?: number[] }>;
}

/** The graph's jMX text. */
export function writeGraphDocument(graph: GraphDocument): string {
  const parameters: string[] = [];
  const formulas: string[] = [];
  const lines: string[] = [];
  const names = new Set(graph.expressions.map((expression) => expression.written?.name).filter(Boolean));
  let next = 1;
  const freshName = () => {
    while (names.has(`line${next}`)) {
      next += 1;
    }
    names.add(`line${next}`);
    return `line${next}`;
  };
  for (const expression of graph.expressions) {
    const source = expression.source.trim();
    if (!source) {
      continue;
    }
    const role = roleOfLine(expression);
    if (role.kind === "slider") {
      // The clock's own value is written by the clock's `from … to`, not as a parameter.
      if (!expression.fromClock) {
        const written = graph.ranges?.[role.name];
        const range = sliderRange(role.value, expression.range ?? written);
        const label = written?.label && written.label !== role.name ? `   ${quoted(written.label)}` : "";
        const listed = expression.range?.values ?? written?.values;
        const span = listed?.length ? `[${listed.join(", ")}]` : `${range.minimum} .. ${range.maximum}`;
        parameters.push(`${role.name} = ${role.value} in ${span}${label}`);
      }
    } else if (role.kind === "definition") {
      formulas.push(source);
    } else {
      lines.push(lineOf(expression, source, expression.written?.name ?? freshName()));
    }
  }
  const body: string[] = [];
  if (parameters.length) {
    body.push(block("parameters", parameters));
  }
  if (formulas.length) {
    body.push(block("formulas", formulas));
  }
  if (graph.clock) {
    const speed = graph.clock.speed === 1 ? "" : ` speed ${graph.clock.speed}`;
    const range = graph.clock.from && graph.clock.to ? ` from ${graph.clock.from} to ${graph.clock.to}` : "";
    body.push(`    clock ${graph.clock.parameter}${range}${speed} loop`);
  }
  const onePlane = graph.panes.length === 1 && graph.panes[0].name === "main" && graph.panes[0].kind === "PLANE" && Object.keys(graph.panes[0].axes).length === 0;
  if (!onePlane) {
    body.push(block(`panes ${graph.layout.toLowerCase()}`, graph.panes.map(paneLine)));
  }
  body.push(block("lines", lines));
  for (const check of graph.checks ?? []) {
    body.push(block(`expect ${quoted(check.title)}`, [`measure ${check.measure}`, check.criterion]));
  }
  return `graph ${quoted(graph.title)} as ${graph.slug} {\n${body.join("\n")}\n}\n`;
}

function lineOf(expression: GraphExpression, source: string, name: string): string {
  const written = expression.written;
  const parts = [name, written?.label ? quoted(source.replace(/^"|"$/g, "")) : source];
  if (written?.until) {
    parts.push(`until ${written.until}`);
  }
  if (written?.at) {
    parts.push(`at ${written.at}`);
  }
  if (written?.from) {
    parts.push(`from ${written.from}`);
  }
  if (written?.pane) {
    parts.push(`in ${written.pane}`);
  }
  parts.push(`color ${expression.colorIndex + 1}`);
  if (!expression.visible) {
    parts.push("hidden");
  }
  return parts.join("  ");
}

function paneLine(pane: GraphPaneDocument): string {
  const parts = [pane.name, pane.kind.toLowerCase()];
  for (const [axis, [minimum, maximum]] of Object.entries(pane.axes)) {
    parts.push(`${axis} ${minimum} .. ${maximum}`);
  }
  if (pane.uses) {
    parts.push(`uses ${pane.uses}`);
  }
  if (pane.over) {
    parts.push(`over ${pane.over[0]} .. ${pane.over[1]}`);
  }
  if (pane.camera) {
    parts.push(`camera ${pane.camera}`);
  }
  return parts.join("  ");
}

function block(opening: string, lines: readonly string[]): string {
  return `    ${opening} {\n${lines.map((line) => `        ${line}`).join("\n")}\n    }`;
}

function quoted(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** A saved graph as the page holds it: sliders from its parameters, then its definitions, then its lines. */
export function readGraphDocument(detail: ObjectDetail): GraphDocument {
  const definition = detail.definition as unknown as GraphDefinition;
  const expressions: GraphExpression[] = [];
  const add = (source: string, colorIndex?: number) => {
    const expression = newExpression(source, colorIndex ?? nextColorIndex(expressions));
    expressions.push(expression);
    return expression;
  };
  for (const parameter of detail.parameters) {
    add(`${parameter.name} = ${parameter.defaultValue}`).range = { minimum: parameter.minimum, maximum: parameter.maximum,
      ...(parameter.values?.length ? { values: parameter.values } : {}) };
  }
  // A clock with its own range (`clock s from 0 to 4 pi`) moves a value no parameter declares: it is a slider of the
  // page over that range, written back as the clock.
  const clock = definition.clock;
  const from = clock?.from ? evaluateConstant(clock.from) : null;
  const to = clock?.to ? evaluateConstant(clock.to) : null;
  if (clock && from !== null && to !== null && to > from && !detail.parameters.some((parameter) => parameter.name === clock.parameter)) {
    const own = add(`${clock.parameter} = ${from}`);
    own.range = { minimum: from, maximum: to };
    own.fromClock = true;
  }
  for (const formula of definition.formulas.split("\n").map((line) => line.trim()).filter(Boolean)) {
    add(formula);
  }
  for (const line of definition.lines) {
    const expression = add(line.label ? `"${line.expression}"` : line.expression, line.color ? (line.color - 1) % GRAPH_COLOR_COUNT : undefined);
    expression.visible = !line.hidden;
    expression.written = { name: line.name, label: line.label, until: line.until, at: line.at, from: line.from ?? null, pane: line.pane };
  }
  return {
    title: detail.summary.title,
    slug: detail.summary.slug,
    expressions,
    clock: clock ? { parameter: clock.parameter, speed: clock.speed, from: clock.from, to: clock.to } : null,
    layout: definition.layout,
    panes: definition.panes.length ? definition.panes : DEFAULT_PANES,
    checks: definition.checks ?? [],
    ranges: Object.fromEntries(detail.parameters.map((parameter) => [parameter.name, { minimum: parameter.minimum, maximum: parameter.maximum, label: parameter.label, values: parameter.values }])),
  };
}

/**
 * A constant as a pane's axes or a clock's range write it — `4 pi`, `-2 pi`, `1/2`, `2.5e3`, `(1 + 2) pi` — or null
 * for anything that names a value (`Vm`): those wait for the backend, which reads every jMF expression.
 */
export function evaluateConstant(text: string): number | null {
  const tokens = text.match(/\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+|pi|π|tau|e(?![a-z])|[-+*/()]|\S/g) ?? [];
  let position = 0;
  const peek = () => tokens[position];
  const sum = (): number | null => {
    let value = product();
    while (value !== null && (peek() === "+" || peek() === "-")) {
      const operator = tokens[position++];
      const right = product();
      value = right === null ? null : operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const product = (): number | null => {
    let value = unary();
    while (value !== null && position < tokens.length && peek() !== "+" && peek() !== "-" && peek() !== ")") {
      const operator = peek() === "*" || peek() === "/" ? tokens[position++] : "*";
      const right = unary();
      value = right === null ? null : operator === "/" ? value / right : value * right;
    }
    return value;
  };
  const unary = (): number | null => {
    if (peek() === "-") {
      position++;
      const value = unary();
      return value === null ? null : -value;
    }
    if (peek() === "+") {
      position++;
      return unary();
    }
    return atom();
  };
  const atom = (): number | null => {
    const token = tokens[position++];
    if (token === undefined) {
      return null;
    }
    if (token === "(") {
      const value = sum();
      return tokens[position++] === ")" ? value : null;
    }
    if (token === "pi" || token === "π") {
      return Math.PI;
    }
    if (token === "tau") {
      return 2 * Math.PI;
    }
    if (token === "e") {
      return Math.E;
    }
    const number = Number(token);
    return Number.isFinite(number) ? number : null;
  };
  const value = sum();
  return value !== null && position === tokens.length && Number.isFinite(value) ? value : null;
}

const TIME_UNITS: Record<string, number> = { s: 1, ms: 1e-3, us: 1e-6, "µs": 1e-6, ns: 1e-9 };

/** A time as a circuit pane's `over` writes it — `5 ms`, `20 µs`, `0.01` (seconds) — in seconds, or null. */
export function evaluateDuration(text: string): number | null {
  const written = /^(.*?)\s*(s|ms|us|µs|ns)$/.exec(text.trim());
  const value = evaluateConstant(written ? written[1] : text);
  return value === null ? null : value * (written ? TIME_UNITS[written[2]] : 1);
}

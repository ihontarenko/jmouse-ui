/**
 * A channel's reading written over by hand: `X * pi / 2`, `abs(X) - 0.5`, `20 * log(X)` — X being what the probe reads.
 * Compiled once into a plain function, so applying it to every sample costs a call, not a parse. The grammar is the
 * arithmetic a bench scope's math menu offers and nothing more: numbers (with engineering suffixes), X, pi and e,
 * + − × ÷ ^, parentheses, and a handful of functions. Anything else is refused with a message, never guessed.
 */

export type ReadingTransform = (value: number) => number;

export type CompiledExpression =
  | { ok: true; transform: ReadingTransform }
  | { ok: false; message: string };

const FUNCTIONS: Record<string, (value: number) => number> = {
  abs: Math.abs, sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, atan: Math.atan, sign: Math.sign, round: Math.round, floor: Math.floor, ceil: Math.ceil,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const SUFFIXES: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };

type Node =
  | { kind: "number"; value: number }
  | { kind: "reading" }
  | { kind: "negate"; operand: Node }
  | { kind: "binary"; operator: string; left: Node; right: Node }
  | { kind: "call"; name: string; argument: Node };

class ExpressionParser {
  private position = 0;
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  parse(): Node {
    const node = this.sum();
    this.skipSpace();
    if (this.position < this.text.length) {
      throw new Error(`unexpected «${this.text[this.position]}» at ${this.position + 1}`);
    }
    return node;
  }

  private sum(): Node {
    let left = this.product();
    for (;;) {
      const operator = this.take("+", "-", "−");
      if (!operator) {
        return left;
      }
      left = { kind: "binary", operator: operator === "−" ? "-" : operator, left, right: this.product() };
    }
  }

  private product(): Node {
    let left = this.unary();
    for (;;) {
      const operator = this.take("*", "/", "×", "÷");
      if (!operator) {
        return left;
      }
      left = { kind: "binary", operator: operator === "×" ? "*" : operator === "÷" ? "/" : operator, left, right: this.unary() };
    }
  }

  private unary(): Node {
    if (this.take("-", "−")) {
      return { kind: "negate", operand: this.unary() };
    }
    if (this.take("+")) {
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.atom();
    if (this.take("^")) {
      return { kind: "binary", operator: "^", left: base, right: this.unary() };
    }
    return base;
  }

  private atom(): Node {
    this.skipSpace();
    if (this.take("(")) {
      const inner = this.sum();
      this.expect(")");
      return inner;
    }
    const number = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?([pnuµmkMG](?![a-zA-Z]))?/.exec(this.text.slice(this.position));
    if (number) {
      this.position += number[0].length;
      const value = Number(number[1] + (number[2] ?? ""));
      return { kind: "number", value: value * (number[3] ? SUFFIXES[number[3]] : 1) };
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.text.slice(this.position));
    if (!word) {
      throw new Error(this.position >= this.text.length ? "the expression ends too early" : `unexpected «${this.text[this.position]}» at ${this.position + 1}`);
    }
    this.position += word[0].length;
    const name = word[0];
    if (name === "X" || name === "x") {
      return { kind: "reading" };
    }
    const lower = name.toLowerCase();
    if (lower in CONSTANTS) {
      return { kind: "number", value: CONSTANTS[lower] };
    }
    if (lower in FUNCTIONS) {
      this.expect("(");
      const argument = this.sum();
      this.expect(")");
      return { kind: "call", name: lower, argument };
    }
    throw new Error(`«${name}» is not known — X is the reading; pi, e and ${Object.keys(FUNCTIONS).join(", ")} are`);
  }

  private take(...tokens: string[]): string | null {
    this.skipSpace();
    const found = tokens.find((token) => this.text.startsWith(token, this.position));
    if (found) {
      this.position += found.length;
      return found;
    }
    return null;
  }

  private expect(token: string) {
    if (!this.take(token)) {
      throw new Error(`«${token}» expected at ${this.position + 1}`);
    }
  }

  private skipSpace() {
    while (this.position < this.text.length && /\s/.test(this.text[this.position])) {
      this.position++;
    }
  }
}

function compileNode(node: Node): ReadingTransform {
  switch (node.kind) {
    case "number": {
      const value = node.value;
      return () => value;
    }
    case "reading":
      return (value) => value;
    case "negate": {
      const operand = compileNode(node.operand);
      return (value) => -operand(value);
    }
    case "call": {
      const apply = FUNCTIONS[node.name];
      const argument = compileNode(node.argument);
      return (value) => apply(argument(value));
    }
    case "binary": {
      const left = compileNode(node.left);
      const right = compileNode(node.right);
      switch (node.operator) {
        case "+": return (value) => left(value) + right(value);
        case "-": return (value) => left(value) - right(value);
        case "*": return (value) => left(value) * right(value);
        case "/": return (value) => left(value) / right(value);
        default: return (value) => left(value) ** right(value);
      }
    }
  }
}

/** Whether an expression leaves the reading as it is: empty, or X alone. */
export function isIdentityExpression(expression: string | undefined): boolean {
  const text = (expression ?? "").trim();
  return text === "" || text === "X" || text === "x";
}

/** Compiles an expression over X; an empty one is the reading itself. */
export function compileReadingExpression(expression: string): CompiledExpression {
  if (isIdentityExpression(expression)) {
    return { ok: true, transform: (value) => value };
  }
  try {
    return { ok: true, transform: compileNode(new ExpressionParser(expression).parse()) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

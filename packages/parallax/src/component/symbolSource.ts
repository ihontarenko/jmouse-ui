import type { SymbolDrawingDocument } from "../schematic/symbolDrawingDocument";

/** What a symbol document says about itself besides its drawing. */
export interface SymbolHead {
  title: string;
  slug: string;
  summary: string;
  description?: string | null;
  /** A section code (`CIRCUITS`); written in lowercase, as the catalogue files write it. */
  category: string;
  tags: readonly string[];
}

/**
 * A jMX text: in double quotes, or in single quotes when it holds a double one, or in triple quotes when it holds
 * both or a line break — jMX strings have no escapes.
 */
function text(value: string): string {
  if (/\n/.test(value) || (value.includes("\"") && value.includes("'"))) {
    return `"""${value}"""`;
  }
  return value.includes("\"") ? `'${value}'` : `"${value}"`;
}

/** A coordinate as the drawing lines write it: at most two decimals, no trailing zeros. */
function number(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * The symbol document the editor saves — `symbol "Title" as slug { meta { … }  size  path  pin  label }` — the text the
 * server stores and every schematic reads the drawing back from.
 */
export function writeSymbolSource(head: SymbolHead, drawing: SymbolDrawingDocument): string {
  const lines = [`symbol ${text(head.title)} as ${head.slug} {`, "    meta {", `        summary ${text(head.summary)}`];
  if (head.description) {
    lines.push(`        description ${text(head.description)}`);
  }
  lines.push(`        category ${head.category.toLowerCase()}`);
  if (head.tags.length) {
    lines.push(`        tags ${head.tags.join(", ")}`);
  }
  lines.push("    }");
  if (drawing.width || drawing.height) {
    lines.push(`    size ${number(drawing.width ?? 0)} x ${number(drawing.height ?? 0)}`);
  }
  drawing.paths.forEach((path) => lines.push(`    path ${text(path)}`));
  (drawing.upright ?? []).forEach((path) => lines.push(`    path ${text(path)} upright`));
  (drawing.pins ?? []).forEach((pin) => lines.push(`    pin ${pin.name} at ${number(pin.x)}, ${number(pin.y)}`
    + (pin.label ? ` ${text(pin.label)}` : "")));
  (drawing.labels ?? []).forEach((label) => lines.push(`    label ${label.subject} at ${number(label.x)}, ${number(label.y)}`));
  lines.push("}", "");
  return lines.join("\n");
}

/*
 * SVG path data worked on as commands, never as points sampled along it. A path is a list of subpaths and curves; sampled
 * into one polyline, its separate strokes were joined into a zigzag and its arcs became polygons — a symbol's minus
 * sign, dragged, pulled the whole drawing into a scribble.
 */

/** How many numbers each command takes, and which of them are x and which y (an arc's last two). */
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** One command of path data: its letter, as written (lower case is relative), and its numbers. */
export interface PathCommand {
  letter: string;
  values: number[];
}

/** Path data as commands; a run of numbers after one letter is that command repeated (`L1 2 3 4` is two lines). */
export function parsePathData(data: string): PathCommand[] {
  const tokens = data.match(/[MLHVCSQTAZmlhvcsqtaz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const commands: PathCommand[] = [];
  let index = 0;
  let letter = "";
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      letter = tokens[index];
      index++;
      if (letter === "Z" || letter === "z") {
        commands.push({ letter, values: [] });
        continue;
      }
    } else if (!letter) {
      break;
    }
    const arity = ARITY[letter.toUpperCase()];
    const values = tokens.slice(index, index + arity).map(Number);
    if (values.length < arity) {
      break;
    }
    commands.push({ letter, values });
    index += arity;
    // A moveto's further pairs are linetos, as the SVG grammar reads them.
    if (letter === "M") {
      letter = "L";
    } else if (letter === "m") {
      letter = "l";
    }
  }
  return commands;
}

/** Commands back as path data, numbers rounded to what a symbol's grid can tell apart. */
export function writePathData(commands: readonly PathCommand[]): string {
  const number = (value: number) => String(Math.round(value * 100) / 100);
  return commands.map(({ letter, values }) => letter + values.map((value, position) =>
    (position > 0 && value >= 0 ? " " : "") + number(value)).join("")).join("");
}

/**
 * The path moved by (dx, dy): every absolute coordinate shifted — an arc's radii, rotation and flags left alone —, every
 * relative one kept, except a path's opening `m`, which is absolute by the grammar.
 */
export function translatePath(data: string, dx: number, dy: number): string {
  const commands = parsePathData(data).map(({ letter, values }, position) => {
    const relative = letter === letter.toLowerCase() && !(position === 0 && letter === "m");
    if (relative || letter === "Z" || letter === "z") {
      return { letter, values };
    }
    const upper = letter.toUpperCase();
    const shifted = values.map((value, place) => {
      if (upper === "H") {
        return value + dx;
      }
      if (upper === "V") {
        return value + dy;
      }
      if (upper === "A") {
        return place === 5 ? value + dx : place === 6 ? value + dy : value;
      }
      return place % 2 === 0 ? value + dx : value + dy;
    });
    return { letter: position === 0 && letter === "m" ? "M" : letter, values: shifted };
  });
  return writePathData(commands);
}

/** A turn or a flip of the plane about a point, as a symbol's editor applies it to a selection. */
export type PathTurn = "quarter" | "mirror";

/**
 * The path turned a quarter clockwise, or mirrored left to right, about (cx, cy) — still commands, never sampled into
 * points. Relative commands become absolute and H/V become L (a turned horizontal line is vertical); an arc keeps its
 * shape: a quarter turn swaps its radii and turns its axis, a mirror reverses its sweep.
 */
export function turnedPath(data: string, turn: PathTurn, cx: number, cy: number): string {
  const map = (x: number, y: number): [number, number] => turn === "quarter"
    ? [cx - (y - cy), cy + (x - cx)]
    : [2 * cx - x, y];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const out: PathCommand[] = [];
  for (const { letter, values } of parsePathData(data)) {
    const relative = letter === letter.toLowerCase();
    const upper = letter.toUpperCase();
    if (upper === "Z") {
      out.push({ letter: "Z", values: [] });
      x = startX;
      y = startY;
      continue;
    }
    if (upper === "H" || upper === "V") {
      const nextX = upper === "H" ? (relative ? x + values[0] : values[0]) : x;
      const nextY = upper === "V" ? (relative ? y + values[0] : values[0]) : y;
      out.push({ letter: "L", values: map(nextX, nextY) });
      x = nextX;
      y = nextY;
      continue;
    }
    if (upper === "A") {
      const [radiusX, radiusY, axis, large, sweep] = values;
      const endX = relative ? x + values[5] : values[5];
      const endY = relative ? y + values[6] : values[6];
      const [mappedX, mappedY] = map(endX, endY);
      out.push({ letter: "A", values: turn === "quarter"
        ? [radiusX, radiusY, axis + 90, large, sweep, mappedX, mappedY]
        : [radiusX, radiusY, -axis, large, sweep ? 0 : 1, mappedX, mappedY] });
      x = endX;
      y = endY;
      continue;
    }
    // M L C S Q T: pairs of coordinates, the last pair where the pen ends.
    const mapped: number[] = [];
    for (let index = 0; index + 1 < values.length; index += 2) {
      const pointX = relative ? x + values[index] : values[index];
      const pointY = relative ? y + values[index + 1] : values[index + 1];
      mapped.push(...map(pointX, pointY));
    }
    x = relative ? x + values[values.length - 2] : values[values.length - 2];
    y = relative ? y + values[values.length - 1] : values[values.length - 1];
    if (upper === "M") {
      startX = x;
      startY = y;
    }
    out.push({ letter: upper, values: mapped });
  }
  return writePathData(out);
}

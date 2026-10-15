export type SymbolSide = "left" | "right" | "top" | "bottom";

interface SymbolModel {
  symbol?: string[];
  pins?: { name: string; nature: string; output: boolean }[];
}

const SIDE_ROW = /^\s*(left|right|top|bottom|power)\s+(.+)$/i;

/** The jMC symbol declaration owns pin placement; the pin's nature is the fallback. */
export function pinSide(model: SymbolModel, name: string): SymbolSide {
  for (const row of model.symbol ?? []) {
    const match = row.match(SIDE_ROW);
    if (match && match[2].split(/[\s,]+/).includes(name)) {
      const side = match[1].toLowerCase();
      return side === "power" ? "top" : (side as SymbolSide);
    }
  }
  const pin = model.pins?.find((candidate) => candidate.name === name);
  if (pin?.nature === "POWER") {
    return "top";
  }
  if (pin?.nature === "GROUND") {
    return "bottom";
  }
  return pin?.output ? "right" : "left";
}

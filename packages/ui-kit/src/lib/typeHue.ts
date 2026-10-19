/**
 * A stable hue for a category — a part type, an event kind — computed from its identifier, so the same kind wears the
 * same colour on every screen without anybody choosing it (Innoventa's `typeHue`, same names). The colour itself is
 * `hsl(var(--kit-type-hue) var(--kit-type-saturation) var(--kit-type-lightness))`; the saturation and lightness are the
 * mode's, so a hue that reads on paper still reads on a dark ground.
 */
const HUES = [212, 12, 148, 40, 278, 186, 96, 322, 252, 64, 168, 300]

export function typeHue(identifier: string | null | undefined): number {
  if (!identifier) {
    return 24
  }
  let hash = 0
  for (let index = 0; index < identifier.length; index += 1) {
    hash = (hash * 31 + identifier.charCodeAt(index)) % 100_000
  }
  return HUES[hash % HUES.length]
}

/** The style that dresses an element in a kind's hue. */
export function typeHueStyle(identifier: string | null | undefined): Record<string, string> {
  return { "--kit-type-hue": String(typeHue(identifier)) }
}

/** A row whose top edge is the kind's hue — or the record's own tint, when it has one the browser can paint. */
export function rowEdgeStyle(identifier: string | null | undefined, tint?: string | null): Record<string, string> {
  return paintable(tint) ? { ...typeHueStyle(identifier), borderTopColor: tint! } : typeHueStyle(identifier)
}

function paintable(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.trim() === "") {
    return false
  }
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("color", value)
}

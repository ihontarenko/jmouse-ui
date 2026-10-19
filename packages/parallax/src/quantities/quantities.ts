/**
 * Engineering quantities, as LLx's `engineering-components.js` defines them: a value is SI, a prefix only changes how
 * it is written, and a value steps along the 1–2–5 ladder an instrument's knob clicks through.
 */

const prefixes: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, "μ": 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };

/**
 * The symbols units are written with: a jMX document's units come back in their canonical ASCII names (`Ohm`,
 * `degC`), which a reader should see as Ω and °C. Every formatting below writes a unit through this.
 */
const UNIT_SYMBOLS: Record<string, string> = { Ohm: "Ω", ohm: "Ω", Ω: "Ω", degC: "°C", deg: "°" };

/** A unit as it is written for a reader: its symbol when it has one. */
export function unitSymbol(unit: string): string {
  return UNIT_SYMBOLS[unit] ?? unit;
}

/** Units a prefix never goes on: a share, an angle, a level against a reference — «µ%» means nothing. */
const UNPREFIXED = new Set(["%", "‰", "°", "°C", "dB"]);

const written: [number, string][] = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]];

/** `4.7k`, `100n`, `0.25`, `2 ms` → SI. Throws with a sentence a field can show. */
export function parseQuantity(text: string, unit = ""): number {
  let normalized = text.trim().replace(",", ".");
  if (unit && normalized.endsWith(unit)) {
    normalized = normalized.slice(0, -unit.length).trim();
  }
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([pnuµμmkKMG]?)$/.exec(normalized);
  if (!match) {
    throw new TypeError("Write a number: 4.7k, 100n or 0.25.");
  }
  const value = Number(match[1]) * (match[2] ? prefixes[match[2]] : 1);
  if (!Number.isFinite(value)) {
    throw new RangeError("The value must be finite.");
  }
  return value;
}

/** SI → `4.7 k`, `100 n`, `2 m` with the unit after it: the shortest honest spelling, three significant digits. */
export function formatQuantity(value: number, unitName = "", digits = 3): string {
  const unit = unitSymbol(unitName);
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (value === 0) {
    return `0 ${unit}`.trim();
  }
  if (UNPREFIXED.has(unit)) {
    return `${Number(value.toPrecision(digits))} ${unit}`;
  }
  const magnitude = Math.abs(value);
  const [factor, prefix] = written.find(([candidate]) => magnitude >= candidate * 0.9995) ?? written[written.length - 1];
  const scaled = Number((value / factor).toPrecision(digits));
  return `${scaled} ${prefix}${unit}`.trim();
}

/**
 * SI → a meter's readout: `11.00 V`, `1.000 A`, `235.2 mA` — always `digits` significant figures, trailing zeros
 * kept, so the figures stand still while the value moves, as a bench meter's display does.
 */
export function formatReadout(value: number, unitName = "", digits = 4): string {
  const unit = unitSymbol(unitName);
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (UNPREFIXED.has(unit)) {
    const decimals = Math.max(0, digits - 1 - Math.max(0, Math.floor(Math.log10(Math.abs(value) || 1))));
    // A value that rounds to zero is zero: «−0.00 %» read as a sign the circuit does not have.
    const shown = Math.abs(value) < 0.5 * 10 ** -decimals ? 0 : value;
    return `${shown.toFixed(decimals)} ${unit}`;
  }
  const magnitude = Math.abs(value);
  const [factor, prefix] = magnitude === 0 ? [1, ""] as const
    : written.find(([candidate]) => magnitude >= candidate * 0.99995) ?? written[written.length - 1];
  return `${(value / factor).toPrecision(digits)} ${prefix}${unit}`.trim();
}

/** The next value up or down the 1–2–5 ladder. */
export function ladderStep(value: number, direction: 1 | -1): number {
  if (value <= 0) {
    return direction > 0 ? 1 : 0;
  }
  const exponent = Math.floor(Math.log10(value));
  const candidates: number[] = [];
  for (let power = exponent - 1; power <= exponent + 1; power++) {
    for (const mantissa of [1, 2, 5]) {
      candidates.push(mantissa * 10 ** power);
    }
  }
  if (direction > 0) {
    return candidates.find((candidate) => candidate > value * (1 + 1e-10)) ?? value * 2;
  }
  return candidates.filter((candidate) => candidate < value * (1 - 1e-10)).at(-1) ?? value / 2;
}

/** The smallest value on the 1–2–5 ladder that is at least `value`. */
export function ladderAtLeast(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) {
    return 1;
  }
  const decade = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 5, 10].find((mantissa) => mantissa * decade >= value * (1 - 1e-10)) ?? 10) * decade;
}


/** A representation's name, read from the code the backend uses for it: `TANGENT_PLANE` → "Tangent plane". */
export function representationLabel(kind: string): string {
  return humanize(kind).replace(/\b(dc|ac|fft|rms)\b/gi, (acronym) => acronym.toUpperCase());
}

/** A code as words: `TANGENT_PLANE` → "Tangent plane". The product's own `humanize`, copied so the library imports nothing of it. */
function humanize(code: string): string {
  const words = code.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replaceAll("-", " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

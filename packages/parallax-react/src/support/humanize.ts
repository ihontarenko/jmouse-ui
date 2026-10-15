/** `STREAMLINES` → "Streamlines", `CROSS_SECTION` → "Cross section": a server code read as words. */
export function humanize(code: string): string {
  const words = code.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replaceAll("-", " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

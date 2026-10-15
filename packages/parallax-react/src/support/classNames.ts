/** Joins the truthy class names; the design's own classes and Tailwind utilities share one attribute. */
export function classNames(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

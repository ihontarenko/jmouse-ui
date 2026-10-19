/** Joins the class names that are present; a falsy entry is a class this render does not want. */
export function joinClassNames(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ")
}

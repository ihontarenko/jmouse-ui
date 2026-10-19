import type { ComponentType, SVGProps } from "react"
import { iconPaths, type IconName } from "./iconPaths"

/**
 * An icon: a name from the kit's own set, or an icon component a product already uses (lucide-react's, its own) —
 * so a screen moved onto the kit keeps the icons it had. A component gets the kit's class and size, and stays hidden
 * from assistive technology unless a label is given.
 */
export type IconSource = IconName | ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false"; "aria-label"?: string; role?: string }>

export interface IconProperties extends Omit<SVGProps<SVGSVGElement>, "children" | "name"> {
  name: IconSource
  size?: "small" | "regular" | "large"
  /**
   * What the icon says when nothing beside it does. Without it the icon is decorative and hidden from assistive
   * technology — which is right whenever a word sits next to it.
   */
  label?: string
}

/**
 * One line icon: 24-unit grid, a 1.75 stroke in `currentColor`, so it takes the colour of the text it sits in. The set
 * is drawn here rather than taken from a package because Parallax and Raccoon carry no icon dependency, and a kit they
 * would take must not bring one.
 */
export function Icon({ name, size = "regular", label, className, ...rest }: IconProperties) {
  const classes = className ? `kit-icon ${className}` : "kit-icon"
  if (typeof name !== "string") {
    const Component = name
    return <Component className={classes} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} />
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={classes}
      data-size={size === "regular" ? undefined : size}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {iconPaths[name]}
    </svg>
  )
}

import type { ReactNode } from "react"
import { IconButton } from "../controls/Button"
import { Popover } from "../data/Collections"
import { Icon, type IconSource } from "../icons/Icon"
import { SegmentedControl } from "../navigation/Toolbar"
import { useAppearance } from "./AppearanceProvider"
import { AccentTonePicker, TypefacePicker } from "./Pickers"

export interface AppearanceMenuProperties {
  className?: string
  /** Rows the product adds below the kit's own — a chart palette, a notice sound. Use {@link AppearanceRow}. */
  children?: ReactNode
  label?: string
  /** The sentence at the foot. */
  footnote?: string
}

/**
 * The topbar's quick appearance — Innoventa's `AppearanceMenu`, on the kit's axes: the mode, the tone, the typeface, the
 * size, the row height, and whatever rows the product adds. Each says in one line what it moves.
 */
export function AppearanceMenu({ className, children, label = "Appearance", footnote = "Kept on this device, not on your account — a phone in a store room and a desktop under a window want different answers from the same person." }: AppearanceMenuProperties) {
  const { choice, mode, change } = useAppearance()
  return (
    <Popover
      label={label}
      alignment="end"
      trigger={(triggerProperties) => <IconButton icon="appearance" label={`${label} — mode, tone, typeface, size`} className={className} {...triggerProperties} />}
    >
      {() => (
        <div className="kit-appearance-menu">
          <AppearanceRow label="Mode" hint="Light or dark. A theme's fixed regions stay as they are in both." icon={mode === "dark" ? "moon" : "sun"}>
            <SegmentedControl label="Mode" value={choice.mode} options={[{ value: "system", label: "System" }, { value: "light", label: "Light", icon: "sun" }, { value: "dark", label: "Dark", icon: "moon" }]} onChange={(value) => change("mode", value)} />
          </AppearanceRow>
          <AppearanceRow label="Tone" hint="The colour this interface acts in. Nothing else moves.">
            <AccentTonePicker />
          </AppearanceRow>
          <AppearanceRow label="Typeface" hint="The text face. Part numbers and quantities stay in the data face.">
            <TypefacePicker />
          </AppearanceRow>
          <AppearanceRow label="Size" hint="How large everything is — text and controls together.">
            <SegmentedControl label="Size" value={choice.scale} options={[{ value: "0.9", label: "S" }, { value: "1", label: "M" }, { value: "1.15", label: "L" }, { value: "1.3", label: "XL" }]} onChange={(value) => change("scale", value)} />
          </AppearanceRow>
          <AppearanceRow label="Rows" hint="How tall a row is — the same text, more of it. Not the same thing as Size." icon={choice.density === "compact" ? "list" : "menu"}>
            <SegmentedControl label="Rows" value={choice.density} options={[{ value: "airy", label: "Airy" }, { value: "regular", label: "Comfortable" }, { value: "compact", label: "Compact" }]} onChange={(value) => change("density", value)} />
          </AppearanceRow>
          {children}
          <p className="kit-appearance-menu-footnote">{footnote}</p>
        </div>
      )}
    </Popover>
  )
}

/** One row of the appearance menu: a micro-label, its control, one line saying what it moves. */
export function AppearanceRow({ label, hint, icon, children }: { label: string; hint: string; icon?: IconSource; children: ReactNode }) {
  return (
    <div className="kit-appearance-row">
      <div className="kit-appearance-row-head">
        {icon && <Icon name={icon} size="small" />}
        <span className="kit-micro-label">{label}</span>
      </div>
      {children}
      <p>{hint}</p>
    </div>
  )
}

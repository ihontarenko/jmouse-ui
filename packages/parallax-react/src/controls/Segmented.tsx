import type { ReactNode } from "react";
import { classNames } from "../support/classNames";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedProperties<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** `.segmented.small` — inside a dense row or a strip. */
  small?: boolean;
  /** `.segmented.accent` — the chosen segment filled with the accent. */
  accent?: boolean;
  /** `.segmented.stretch` — the segments share the whole width. */
  stretch?: boolean;
  disabled?: boolean;
  className?: string;
}

/** One choice among a few, shown as a strip of pressed toggle buttons (Parallax-UI `.segmented`). */
export function Segmented<T extends string>({ options, value, onChange, label, small = false, accent = false, stretch = false, disabled, className }: SegmentedProperties<T>) {
  return (
    <div data-parallax-part="segmented" className={classNames("parallax-segmented", small && "parallax-small", accent && "parallax-accent", stretch && "parallax-stretch", className)} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} disabled={disabled} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

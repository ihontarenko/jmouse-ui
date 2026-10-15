import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "../support/classNames";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { formatQuantity, ladderStep } from "@jmouse/parallax/quantities";

type ToolProperties = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * `go` starts something (the palette's good), `stop` halts it (danger), `accent` and `warn` mark a step and a reset,
   * `danger` removes something.
   */
  tone?: "default" | "primary" | "quiet" | "accent" | "warn" | "go" | "stop" | "danger";
  /** An icon-only tool still needs a name: it is the label read aloud and the tooltip. */
  label?: string;
  icon?: boolean;
  /** Shows the spinner and holds the tool while what it started is in flight. */
  busy?: boolean;
};

const TONES: Record<NonNullable<ToolProperties["tone"]>, string | false> = {
  default: false, primary: "parallax-primary", quiet: "parallax-quiet", accent: "parallax-accent", warn: "parallax-warn", go: "parallax-good parallax-primary", stop: "parallax-danger parallax-primary",
  danger: "parallax-danger",
};

/** A small bench button (Parallax-UI `.button.small`): an icon, or an icon and a short word. */
export function Tool({ tone = "default", label, icon = false, busy = false, className, children, type = "button", disabled, ...button }: ToolProperties) {
  return (
    <button
      type={type}
      data-parallax-part="button" className={classNames("parallax-button parallax-small", TONES[tone], icon && "parallax-icon-only", busy && "parallax-is-loading", className)}
      aria-label={label}
      title={label}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...button}
    >
      {children}
    </button>
  );
}

export interface Segment<T extends string> {
  value: T;
  label: ReactNode;
  /** The name read aloud when the label is a glyph. */
  title?: string;
  /** This one choice not open now — its title says why. */
  disabled?: boolean;
}

/** A few choices in one tight strip (Parallax-UI `.segmented.small`): an instrument's switch, not a tab bar. */
export function Segments<T extends string>({ label, options, value, onChange, wide = false, disabled = false }: {
  label: string;
  options: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  wide?: boolean;
  disabled?: boolean;
}) {
  return (
    <div data-parallax-part="segmented" className={classNames("parallax-segmented parallax-small", wide && "parallax-stretch")} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} disabled={disabled || option.disabled}
          aria-label={option.title} title={option.title} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A value an instrument's knob clicks through on the 1–2–5 ladder: − value + . */
export function Stepper({ label, value, unit, onChange, minimum = 0, maximum = Number.POSITIVE_INFINITY, step, format }: {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  minimum?: number;
  maximum?: number;
  /** A fixed step instead of the ladder — for a position, which is linear. */
  step?: number;
  format?: (value: number) => string;
}) {
  const next = (direction: 1 | -1) => {
    const candidate = step ? value + direction * step : ladderStep(value, direction);
    return Math.min(maximum, Math.max(minimum, Number(candidate.toPrecision(12))));
  };
  const shown = format ? format(value) : formatQuantity(value, unit);
  return (
    <div data-parallax-part="stepper" className="parallax-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`${label}: less`} disabled={next(-1) === value} onClick={() => onChange(next(-1))}><ParallaxIcon name="minus" /></button>
      <output aria-live="polite" aria-label={label}>{shown}</output>
      <button type="button" aria-label={`${label}: more`} disabled={next(1) === value} onClick={() => onChange(next(1))}><ParallaxIcon name="plus" /></button>
    </div>
  );
}

/**
 * A stepper over a fixed list — the run's speed: − and + walk the list one choice at a time, and the value itself
 * opens the whole list. As narrow as one segment however long the list grows.
 */
export function ChoiceStepper({ label, value, choices, onChange }: {
  label: string;
  value: string;
  /** In order: − moves towards the first, + towards the last. */
  choices: readonly { value: string; label: string; title?: string }[];
  onChange: (value: string) => void;
}) {
  const index = choices.findIndex((choice) => choice.value === value);
  const previous = index > 0 ? choices[index - 1] : null;
  const next = index >= 0 && index < choices.length - 1 ? choices[index + 1] : null;
  return (
    <div data-parallax-part="stepper" className="parallax-stepper parallax-choice-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={previous ? `${label}: ${previous.label}` : label} title={previous?.title} disabled={!previous}
        onClick={() => previous && onChange(previous.value)}><ParallaxIcon name="minus" /></button>
      <select aria-label={label} value={value} title={choices[index]?.title} onChange={(event) => onChange(event.target.value)}>
        {choices.map((choice) => <option key={choice.value} value={choice.value} title={choice.title}>{choice.label}</option>)}
      </select>
      <button type="button" aria-label={next ? `${label}: ${next.label}` : label} title={next?.title} disabled={!next}
        onClick={() => next && onChange(next.value)}><ParallaxIcon name="plus" /></button>
    </div>
  );
}

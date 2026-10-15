import { useEffect, useId, useState } from "react";
import { ParallaxIcon } from "../icons/ParallaxIcon";
import { formatQuantity, ladderStep, parseQuantity } from "@jmouse/parallax/quantities";

/**
 * A value is a quantity: typed with an engineering suffix (`4.7k`, `100n`), stepped along 1–2–5, kept in SI.
 * Parallax-UI `.quantity` (the number and its unit) with 1–2–5 steps beside it. A text that does not read is shown as an error and not applied.
 */
export function QuantityField({ label, value, unit, onChange, minimum = Number.NEGATIVE_INFINITY, maximum = Number.POSITIVE_INFINITY, compact = false }: {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  minimum?: number;
  maximum?: number;
  /** In a bench panel: the label sits beside the field, and the hint is left out. */
  compact?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(() => formatQuantity(value, ""));
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setText(formatQuantity(value, ""));
    setProblem(null);
  }, [value]);

  const commit = (written: string) => {
    try {
      const parsed = parseQuantity(written, unit);
      if (parsed < minimum || parsed > maximum) {
        throw new RangeError(`Between ${formatQuantity(minimum, unit)} and ${formatQuantity(maximum, unit)}.`);
      }
      setProblem(null);
      if (parsed !== value) {
        onChange(parsed);
      } else {
        setText(formatQuantity(value, ""));
      }
    } catch (failure) {
      setProblem((failure as Error).message);
    }
  };
  const step = (direction: 1 | -1) => {
    const next = Math.min(maximum, Math.max(minimum, ladderStep(Math.abs(value), direction) * (value < 0 ? -1 : 1)));
    onChange(next);
  };

  return (
    <div className={compact ? "parallax-control-row" : "parallax-field"}>
      <label htmlFor={id}>{label}</label>
      <div className="parallax-row">
        <div data-parallax-part="quantity" className="parallax-quantity parallax-grow">
          <input id={id} data-parallax-part="input" className={compact ? "parallax-input parallax-small" : "parallax-input"} type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={text}
            aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-problem` : undefined}
            onChange={(event) => setText(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit(event.currentTarget.value);
              } else if (event.key === "Escape") {
                setText(formatQuantity(value, ""));
                setProblem(null);
              } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                step(event.key === "ArrowUp" ? 1 : -1);
              }
            }} />
          <span className="parallax-addon" aria-hidden="true">{unit || "—"}</span>
        </div>
        <div className="parallax-button-group">
          <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-icon-only" aria-label={`${label}: previous 1–2–5 value`} onClick={() => step(-1)}><ParallaxIcon name="minus" /></button>
          <button type="button" data-parallax-part="button" className="parallax-button parallax-small parallax-icon-only" aria-label={`${label}: next 1–2–5 value`} onClick={() => step(1)}><ParallaxIcon name="plus" /></button>
        </div>
      </div>
      {problem ? <span className="parallax-error-text" id={`${id}-problem`} role="alert">{problem}</span> : compact ? null : <span className="parallax-hint">{formatQuantity(value, unit)} · 1–2–5 steps</span>}
    </div>
  );
}

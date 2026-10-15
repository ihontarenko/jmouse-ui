import type { ReactNode } from "react";
import { ParallaxIcon } from "../icons/ParallaxIcon";

/** A failure that keeps the reader where they are and offers to try again. */
export function ErrorState({ title, description, onRetry }: { title: ReactNode; description?: ReactNode; onRetry?: () => void }) {
  return (
    <div className="parallax-notice parallax-danger" role="alert">
      <ParallaxIcon name="error" />
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {onRetry ? (
        <div className="parallax-actions">
          <button type="button" data-parallax-part="button" className="parallax-button parallax-small" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** A label: value list — a property sheet. */
export function Facts({ rows }: { rows: readonly (readonly [ReactNode, ReactNode])[] }) {
  return (
    <dl className="parallax-facts">
      {rows.map(([label, value], index) => (
        <FactRow key={index} label={label} value={value} />
      ))}
    </dl>
  );
}

function FactRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

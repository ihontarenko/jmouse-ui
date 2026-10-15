import { useState, type ReactNode } from "react";
import { ParallaxIcon } from "../icons/ParallaxIcon";

/** Where a panel section's state is kept, by its key. */
const PREFIX = "parallax.panel.";

function readOpen(storageKey: string, fallback: boolean): boolean {
  try {
    const kept = window.localStorage.getItem(PREFIX + storageKey);
    return kept === null ? fallback : kept === "open";
  } catch {
    return fallback;
  }
}

function keepOpen(storageKey: string, open: boolean) {
  try {
    window.localStorage.setItem(PREFIX + storageKey, open ? "open" : "closed");
  } catch {
    // Storage refused (a private window): the section still opens, it is only not remembered.
  }
}

/**
 * One block of a side panel that folds: its title — and what it holds in brief, for when it is folded — as a button,
 * its body under it. Folded or open is the reader's and is remembered per block; a block nobody opened yet starts as
 * `opened` says — most start folded, so a panel shows what it has before what is in it.
 */
export function PanelSection({ storageKey, title, summary, actions, opened = false, children }: {
  /** Names the block across visits: `bench.values`, `bench.part.R1`. */
  storageKey: string;
  title: ReactNode;
  /** A line of what is inside, shown beside the title: «25 °C · nominal», «2 changed». */
  summary?: ReactNode;
  /** Controls that belong on the title line (a Reset); they do not fold the block. */
  actions?: ReactNode;
  /** Open on a first visit. */
  opened?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(storageKey, opened));
  return (
    <details data-parallax-part="disclosure" className="parallax-disclosure parallax-panel-section" open={open}
      onToggle={(event) => {
        const now = event.currentTarget.open;
        if (now !== open) {
          setOpen(now);
          keepOpen(storageKey, now);
        }
      }}>
      <summary>
        <span className="parallax-panel-section-title">{title}</span>
        {summary ? <span className="parallax-metadata">{summary}</span> : null}
        {actions ? <span className="parallax-panel-section-actions" onClick={(event) => event.preventDefault()}>{actions}</span> : null}
        <ParallaxIcon name="chevron-down" className="parallax-chevron" />
      </summary>
      <div className="parallax-disclosure-body">{children}</div>
    </details>
  );
}

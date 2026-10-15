import { useState } from "react";
import { PROBE_COLORS } from "@jmouse/parallax/oscilloscope";

const PROBE_COLOR_NAMES = ["amber", "blue", "pink", "green", "orange", "violet", "cyan", "lime", "red", "white"];

/**
 * A trace's colour as the bar before its name — every trace the screen draws, a channel or the math channel, the same
 * way: pressing the bar opens the ten to choose from, choosing one (or Escape) folds them away.
 */
export function TraceColor({ color, name, onChange }: { color: number; name: string; onChange: (color: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="parallax-trace-color" onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.stopPropagation();
        setOpen(false);
      }
    }}>
      <button type="button" className={`parallax-channel-color-bar parallax-probe-${color}`} aria-expanded={open}
        aria-label={`${name} colour: ${PROBE_COLOR_NAMES[color - 1]} — choose another`}
        title={`${PROBE_COLOR_NAMES[color - 1]} — choose another`} onClick={() => setOpen((shown) => !shown)} />
      {open ? <div className="parallax-probe-colors-choice" role="group" aria-label={`${name} colour`}>
        {Array.from({ length: PROBE_COLORS }, (_, index) => index + 1).map((choice) => (
          <button key={choice} type="button" className={`parallax-probe-${choice}`} aria-pressed={color === choice}
            aria-label={PROBE_COLOR_NAMES[choice - 1]} title={PROBE_COLOR_NAMES[choice - 1]} onClick={() => {
              onChange(choice);
              setOpen(false);
            }} />
        ))}
      </div> : null}
    </span>
  );
}

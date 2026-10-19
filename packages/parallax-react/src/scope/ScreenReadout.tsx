import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { ChannelId } from "@jmouse/parallax/oscilloscope";
import type { CursorPlate, ReadoutCell, ReadoutPlate } from "@jmouse/parallax/scope";
import { ParallaxIcon } from "../icons/ParallaxIcon";

/** Folded or open is this browser's habit, for every screen. */
const FOLDED_KEY = "parallax.scope.readout.folded";

function readFolded(): boolean {
  try {
    return localStorage.getItem(FOLDED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * The screen's readout (`ReadoutPlate`): ONE table, the same everywhere on the screen — in its top left corner each
 * trace's scale and readings against time, a spectrum's peaks or a phasor diagram's arrows; beside a cursor's line, what
 * that cursor marks — on a translucent plate of the screen's own colour, so the traces under it still show. Its columns
 * are fixed and its figures right-aligned in tabular digits, so a number that moves keeps its place; a setting the
 * reader changes (a scale, the time base) lights up for a moment, so the eye finds what changed. A trace's name makes it
 * the active trace; the rest of the plate lets the pointer through to the screen. The corner table folds to one button.
 */
export const ScreenReadout = forwardRef<HTMLDivElement, {
  plate: ReadoutPlate | null;
  active?: ChannelId;
  onActivate?: (channel: ChannelId) => void;
  /** The corner table: it folds to a button and opens again, remembered in this browser. */
  foldable?: boolean;
  /** A cursor's tag rather than the corner table: placed by its host, edged in the accent. */
  tag?: boolean;
  style?: CSSProperties;
}>(function ScreenReadout({ plate, active, onActivate, foldable = false, tag = false, style }, reference) {
  const [folded, setFolded] = useState(() => foldable && readFolded());
  const fold = (next: boolean) => {
    setFolded(next);
    try {
      localStorage.setItem(FOLDED_KEY, String(next));
    } catch {
      // A private window keeps no habit.
    }
  };
  if (!plate || (plate.rows.length === 0 && plate.notes.length === 0)) {
    return null;
  }
  if (foldable && folded) {
    return (
      <div ref={reference} data-parallax-part="screen-readout" className="parallax-screen-readout parallax-folded" style={style}>
        <button type="button" className="parallax-screen-readout-fold" aria-expanded="false" title="Open the readout: scales and readings"
          onPointerDown={(event) => event.stopPropagation()} onClick={() => fold(false)}>
          <ParallaxIcon name="list" />
        </button>
      </div>
    );
  }
  const columns = Math.max(0, ...plate.rows.map((row) => row.cells.length));
  // The fold sits in the heading, or — a table without one — at the end of its notes, never on a row of its own.
  const foldButton = foldable ? (
    <button type="button" className="parallax-screen-readout-fold" aria-expanded="true" title="Fold the readout to a button"
      onPointerDown={(event) => event.stopPropagation()} onClick={() => fold(true)}>
      <ParallaxIcon name="minus" />
    </button>
  ) : null;
  const foldInNotes = foldable && !plate.heading && plate.notes.length > 0;
  return (
    <div ref={reference} data-parallax-part="screen-readout" className={`parallax-screen-readout${tag ? " parallax-tag" : ""}`} style={style} aria-live="off">
      {plate.heading || (foldable && !foldInNotes) ? (
        <div className="parallax-screen-readout-heading">
          <span>{plate.heading}</span>
          {foldButton}
        </div>
      ) : null}
      {plate.rows.length ? (
        <table>
          <tbody>
            {plate.rows.map((row) => (
              <tr key={row.key} className={row.channel && row.channel === active ? "parallax-active" : undefined}
                style={row.color ? { color: `var(--parallax-probe-${row.color})` } : undefined}>
                {Array.from({ length: columns }, (_, index) => {
                  const cell = row.cells[index];
                  if (!cell) {
                    return <td key={index} />;
                  }
                  if (index === 0 && cell.tone === "name" && row.channel && onActivate) {
                    const channel = row.channel;
                    return (
                      <td key={index}>
                        <button type="button" className="parallax-screen-readout-name" aria-pressed={channel === active}
                          title={`Make ${cell.text} the active trace`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onActivate(channel)}>{cell.text}</button>
                      </td>
                    );
                  }
                  return <td key={index} className={cell.numeric ? "parallax-numeric" : undefined}><ReadoutValue cell={cell} /></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {plate.notes.length ? (
        <div className="parallax-screen-readout-notes">
          {plate.notes.map((cell, index) => <ReadoutValue key={index} cell={cell} />)}
          {foldInNotes ? foldButton : null}
        </div>
      ) : null}
    </div>
  );
});

/**
 * The cursors' tags: each its own readout table beside its line — A before it, B after it —, kept inside the screen and
 * clear of the corner table: a time cursor's tag goes down below it, a volts cursor's to its right.
 */
export function CursorReadouts({ tags, screen, corner }: {
  tags: readonly CursorPlate[];
  screen: RefObject<HTMLElement | null>;
  /** The corner table, which no tag may cover. */
  corner: RefObject<HTMLElement | null>;
}) {
  return <>{tags.map((tag) => <CursorReadout key={tag.name} tag={tag} screen={screen} corner={corner} />)}</>;
}

function CursorReadout({ tag, screen, corner }: { tag: CursorPlate; screen: RefObject<HTMLElement | null>; corner: RefObject<HTMLElement | null> }) {
  const own = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    const box = own.current;
    const host = screen.current;
    if (!box || !host) {
      return;
    }
    const width = host.clientWidth;
    const height = host.clientHeight;
    const tagWidth = box.offsetWidth;
    const tagHeight = box.offsetHeight;
    const gap = 4;
    let left: number;
    let top: number;
    if (tag.axis === "time") {
      const anchor = tag.fraction * width;
      left = Math.min(width - tagWidth - 2, Math.max(2, tag.name === "A" ? anchor - tagWidth - gap : anchor + gap));
      top = 8;
    } else {
      const anchor = tag.fraction * height;
      left = 8;
      top = Math.min(height - tagHeight - 2, Math.max(2, tag.name === "A" ? anchor - tagHeight - gap : anchor + gap));
    }
    const kept = corner.current;
    if (kept) {
      const keptRight = kept.offsetLeft + kept.offsetWidth;
      const keptBottom = kept.offsetTop + kept.offsetHeight;
      const overlaps = left < keptRight && left + tagWidth > kept.offsetLeft && top < keptBottom && top + tagHeight > kept.offsetTop;
      if (overlaps && tag.axis === "time") {
        top = keptBottom + gap;
      } else if (overlaps) {
        left = keptRight + gap;
      }
    }
    setPlacement((current) => current.left === left && current.top === top ? current : { left, top });
  });
  return <ScreenReadout ref={own} plate={tag.plate} tag style={placement} />;
}

/** How long a changed setting stays lit: long enough to be seen, short enough not to be read as a state. */
const LIT_MILLISECONDS = 900;

/** One figure of the readout. A setting that changes is lit for a moment — the reader's own change, made visible. */
function ReadoutValue({ cell }: { cell: ReadoutCell }) {
  const previous = useRef(cell.text);
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (cell.tone !== "setting" || previous.current === cell.text) {
      previous.current = cell.text;
      return;
    }
    previous.current = cell.text;
    setLit((count) => count + 1);
    const timer = window.setTimeout(() => setLit(0), LIT_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [cell.text, cell.tone]);
  // A new key restarts the light when a second change comes while the first is still lit.
  return <span key={lit} className={`parallax-readout-${cell.tone}${lit ? " parallax-readout-lit" : ""}`} title={cell.title}>{cell.text}</span>;
}

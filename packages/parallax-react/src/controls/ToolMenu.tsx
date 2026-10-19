import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ParallaxIcon, type ParallaxIconName } from "../icons/ParallaxIcon";
import { Tool } from "./BenchControls";

/**
 * A toolbar button that opens a panel of settings hung under it — the place for what is chosen now and then (how a sheet
 * or a screen looks), so a toolbar keeps one row of what is done all the time. The panel is a settings sheet of
 * {@link ToolMenuSection}s; it closes on Escape (giving the focus back to its button) and on a click outside it.
 * The panel is placed against the viewport, not its toolbar — a toolbar inside an instrument clips what overflows it —,
 * under the button, or over it when the room below is shorter than the panel.
 */
export function ToolMenu({ label, icon, title, align = "end", wide = false, part, children }: {
  label: ReactNode;
  icon?: ParallaxIconName;
  /** What the button's choices are now, said in its tooltip. */
  title: string;
  /** Which edge of the button the panel lines up with. */
  align?: "start" | "end";
  /** A panel with a table or a scale in it: half as wide again. */
  wide?: boolean;
  /** The stable part name a host may style the menu by. */
  part?: string;
  /** The panel's sections; a function receives `close`, for an item that opens something else. */
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const host = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    if (!open) {
      setPlacement({ visibility: "hidden" });
      return;
    }
    const place = () => {
      const button = host.current?.getBoundingClientRect();
      const height = panel.current?.offsetHeight ?? 0;
      if (!button) {
        return;
      }
      const gap = 4;
      const below = window.innerHeight - button.bottom - gap;
      const above = button.top - gap;
      const upward = below < height && above > below;
      const horizontal = align === "end" ? { right: Math.max(8, window.innerWidth - button.right) } : { left: Math.max(8, button.left) };
      setPlacement({
        ...horizontal,
        ...(upward ? { bottom: window.innerHeight - button.top + gap } : { top: button.bottom + gap }),
        maxHeight: Math.max(160, (upward ? above : below) - 8),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);
  useEffect(() => {
    if (!open) {
      return;
    }
    const outside = (event: PointerEvent) => {
      if (host.current && !host.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        host.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <span ref={host} className="parallax-tool-menu" data-parallax-part={part ?? "tool-menu"}>
      <Tool aria-haspopup="true" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)} title={title}>
        {icon ? <ParallaxIcon name={icon} /> : null}<span>{label}</span><ParallaxIcon name="chevron-down" />
      </Tool>
      {open ? (
        <div ref={panel} id={panelId} role="group" aria-label={title} className={`parallax-tool-menu-panel${wide ? " parallax-wide" : ""}`} style={placement}>
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </span>
  );
}

/** One section of a tool menu: a small-caps heading over its rows. */
export function ToolMenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="parallax-tool-menu-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** A switch in a tool menu: a box, a name, and a line saying what it does. */
export function ToolMenuCheck({ label, description, checked, onChange }: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="parallax-tool-menu-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}{description ? <small>{description}</small> : null}</span>
    </label>
  );
}

/** A setting in a tool menu chosen with a control of its own (a strip of choices, a list): its name on the left, the control on the right. */
export function ToolMenuChoice({ label, description, children }: { label: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="parallax-tool-menu-row parallax-tool-menu-choice">
      <span>{label}{description ? <small>{description}</small> : null}</span>
      {children}
    </div>
  );
}

/** The menu's last row: an action that leads elsewhere — another dialog's settings. */
export function ToolMenuFoot({ icon, onClick, children }: { icon?: ParallaxIconName; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="parallax-tool-menu-foot" onClick={onClick}>
      {icon ? <ParallaxIcon name={icon} /> : null}<span>{children}</span>
    </button>
  );
}

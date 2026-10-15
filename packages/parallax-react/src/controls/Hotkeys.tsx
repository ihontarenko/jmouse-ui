import { useEffect, useRef } from "react";

/**
 * A keyboard shortcut: the keys as a person reads them — «Space», «Ctrl+S», «[», «?» —, what it does, the group it is
 * listed under, and the action. One without `run` is only listed: a key some element handles on its own (the sheet's R,
 * the screen's arrows), shown so the list is the whole truth.
 */
export interface Hotkey {
  keys: string;
  label: string;
  group: string;
  run?: () => void;
  /** Listed but not acted on while false — a Step while running. */
  enabled?: boolean;
}

/**
 * Binds the shortcuts to the window, once: a key typed into a field, a text editor or a select is the field's, and a
 * key an element already handled (`preventDefault`) is not acted on twice. The list may change on every render.
 */
export function useHotkeys(hotkeys: readonly Hotkey[]) {
  const current = useRef(hotkeys);
  current.current = hotkeys;
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || editing(event.target)) {
        return;
      }
      const hotkey = current.current.find((candidate) => candidate.run && candidate.enabled !== false && matches(candidate.keys, event));
      if (hotkey) {
        event.preventDefault();
        hotkey.run!();
      }
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, []);
}

/** Whether a key belongs to what has focus: a field, a text editor, a select, anything editable. */
function editing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], .cm-editor") !== null;
}

/** Whether an event is these keys: modifiers exactly as written, the key by its name or its character. */
function matches(keys: string, event: KeyboardEvent): boolean {
  const parts = keys.split("+");
  const key = parts.pop()!;
  const modifiers = new Set(parts.map((part) => part.toLowerCase()));
  if ((event.ctrlKey || event.metaKey) !== modifiers.has("ctrl") || event.altKey !== modifiers.has("alt")) {
    return false;
  }
  // Shift is part of a character — «?» is Shift+/ — so only a letter or a named key checks it.
  const named = key.length > 1 || /[a-z]/i.test(key);
  if (named && event.shiftKey !== modifiers.has("shift")) {
    return false;
  }
  return key === "Space" ? event.key === " " : key.length === 1 ? event.key.toLowerCase() === key.toLowerCase() : event.key === key;
}

/**
 * Every shortcut, by group, in a dialog — the browser's own: it holds focus while open, Escape closes it, and focus goes
 * back to what opened it.
 */
export function HotkeyHelp({ hotkeys, open, onClose }: { hotkeys: readonly Hotkey[]; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closed = useRef(onClose);
  closed.current = onClose;
  // The element's own close event — Escape, the button —: a React prop on a dialog did not deliver it.
  useEffect(() => {
    const element = dialog.current;
    const close = () => closed.current();
    element?.addEventListener("close", close);
    return () => element?.removeEventListener("close", close);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);
  const groups = [...new Set(hotkeys.map((hotkey) => hotkey.group))];
  return (
    <dialog ref={dialog} data-parallax-part="hotkeys" className="parallax-hotkeys" aria-labelledby="parallax-hotkeys-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}>
      <header>
        <h2 id="parallax-hotkeys-title">Keyboard shortcuts</h2>
        <button type="button" className="parallax-hotkeys-close" aria-label="Close" onClick={onClose}>Esc</button>
      </header>
      <div className="parallax-hotkeys-groups">
        {groups.map((group) => (
          <section key={group} aria-label={group}>
            <h3>{group}</h3>
            <dl>
              {hotkeys.filter((hotkey) => hotkey.group === group).map((hotkey) => (
                <div key={`${hotkey.keys}-${hotkey.label}`}>
                  <dt>{hotkey.keys.split(" / ").map((alternative, index) => (
                    <span key={alternative}>{index ? " / " : null}{alternative.split("+").map((key, keyIndex) => <span key={key}>{keyIndex ? "+" : null}<kbd>{key}</kbd></span>)}</span>
                  ))}</dt>
                  <dd>{hotkey.label}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  );
}

import { useMemo, useSyncExternalStore } from "react";
import katex from "katex";
import type { Notation } from "@jmouse/parallax";
import { classNames } from "../support/classNames";

export type NotationKind = "latex" | "jmf" | "text";

const notationLabels: Record<NotationKind, string> = { latex: "LaTeX", jmf: "jMF", text: "Text" };
const NOTATION_KINDS: readonly NotationKind[] = ["latex", "jmf", "text"];

// Which notation the reader prefers is one choice for the whole interface: switching it on one formula switches
// every formula, the cards included. It is remembered in this browser only — a convenience, not a setting.
const PREFERENCE_KEY = "parallax.notation";
const preferenceListeners = new Set<() => void>();

function readPreference(): NotationKind {
  try {
    const stored = window.localStorage.getItem(PREFERENCE_KEY);
    return stored === "jmf" || stored === "text" ? stored : "latex";
  } catch {
    return "latex";
  }
}

let preference: NotationKind = typeof window === "undefined" ? "latex" : readPreference();

function choosePreference(kind: NotationKind) {
  preference = kind;
  try {
    window.localStorage.setItem(PREFERENCE_KEY, kind);
  } catch {
    // A browser that keeps nothing still switches for this visit.
  }
  preferenceListeners.forEach((listener) => listener());
}

function subscribePreference(listener: () => void) {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}

export function useNotationPreference(): [NotationKind, (kind: NotationKind) => void] {
  const current = useSyncExternalStore(subscribePreference, () => preference);
  return [current, choosePreference];
}

/**
 * Every formula in the interface. Given a notation it shows the reader's preferred form — typeset LaTeX, the jMF
 * it is typed as, or plain text — and, where `switchable`, the switch between them; a form the formula lacks
 * falls back to LaTeX. Given only LaTeX (hand-written text with no source) it typesets that. Text the typesetter
 * cannot read is shown as it is rather than as an error: a catalogue card must never break on one bad entry.
 */
export function Formula({
  notation,
  latex,
  display = false,
  switchable = display,
  className,
}: {
  notation?: Notation | null;
  latex?: string | null;
  display?: boolean;
  switchable?: boolean;
  className?: string;
}) {
  const [preferred, choose] = useNotationPreference();
  const forms: Record<NotationKind, string | null> = {
    latex: notation?.latex ?? latex ?? null,
    jmf: notation?.jmf ?? null,
    text: notation?.text ?? null,
  };
  const available = NOTATION_KINDS.filter((kind) => forms[kind]);
  const shown: NotationKind = forms[preferred] ? preferred : forms.latex ? "latex" : (available[0] ?? "latex");
  const content = forms[shown];
  if (!content) {
    return null;
  }
  const body = shown === "latex" ? <TypesetLatex latex={content} display={display} className={className} /> : <pre className={classNames("parallax-formula", "parallax-formula-plain", className)}>{content}</pre>;
  if (!switchable || available.length < 2) {
    return body;
  }
  return (
    <div className={classNames("parallax-formula-notation", display && "parallax-formula-notation-display")}>
      {body}
      <div data-parallax-part="segmented" className="parallax-segmented parallax-small" role="group" aria-label="Notation">
        {available.map((kind) => (
          <button key={kind} type="button" aria-pressed={kind === shown} onClick={() => choose(kind)}>
            {notationLabels[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The object's definition across the page (Parallax-UI `.formula-band`): the formula in the reader's notation at
 * display size on the left, the notation switch on the right.
 */
export function FormulaBand({ notation, latex, label = "Definition" }: { notation?: Notation | null; latex?: string | null; label?: string }) {
  const [preferred, choose] = useNotationPreference();
  const forms: Record<NotationKind, string | null> = {
    latex: notation?.latex ?? latex ?? null,
    jmf: notation?.jmf ?? null,
    text: notation?.text ?? null,
  };
  const available = NOTATION_KINDS.filter((kind) => forms[kind]);
  const shown: NotationKind = forms[preferred] ? preferred : forms.latex ? "latex" : (available[0] ?? "latex");
  const content = forms[shown];
  if (!content) {
    return null;
  }
  return (
    <div className="parallax-formula-band">
      <div>
        <span className="parallax-label">{label}</span>
        <div className="parallax-display-formula">
          {shown === "latex" ? <TypesetLatex latex={content} display /> : content}
        </div>
      </div>
      {available.length > 1 ? (
        <div className="parallax-notation">
          <span className="parallax-label">Notation</span>
          <div data-parallax-part="segmented" className="parallax-segmented parallax-small" role="group" aria-label="Notation">
            {(["text", "jmf", "latex"] as const).filter((kind) => forms[kind]).map((kind) => (
              <button key={kind} type="button" aria-pressed={kind === shown} onClick={() => choose(kind)}>
                {notationLabels[kind]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TypesetLatex({ latex, display, className }: { latex: string; display: boolean; className?: string }) {
  const markup = useMemo(() => {
    try {
      return katex.renderToString(latex, { displayMode: display, throwOnError: true, output: "htmlAndMathml" });
    } catch {
      return null;
    }
  }, [latex, display]);
  if (markup === null) {
    return <div className={classNames("parallax-formula", className)}>{latex}</div>;
  }
  return <div className={classNames("parallax-formula", "parallax-formula-typeset", className)} dangerouslySetInnerHTML={{ __html: markup }} />;
}

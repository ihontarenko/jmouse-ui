import { useEffect, useRef } from "react";
import { jmfSyntax, jmsSyntax } from "@jmouse/codemirror";
import { editorChrome } from "@jmouse/codemirror/editor";
import { SYNTAX_HIGHLIGHT_STYLE } from "@jmouse/codemirror/highlight";
import { StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { ParallaxIcon } from "../icons/ParallaxIcon";

// jMX is a document language around jMF and jMS. Its lexical colours live here until the shared language package
// provides a dedicated grammar; the words are the reader's own: kinds, blocks, meta fields, parameter flags.
const JMX_KEYWORDS = new RegExp(`\\b(?:${[
  "curve", "surface", "hypersurface", "field", "dynamics", "iteration", "mapping", "value", "iterated_function_system",
  "lindenmayer_system", "matrix", "points", "construction", "polytope", "region",
  "program", "component", "circuit", "symbol", "family", "functions", "category", "collection", "course", "instrument",
  "graph", "clock", "panes", "lines", "rows", "columns", "grid", "plane", "space", "values", "over", "until", "at", "color",
  "hidden", "speed", "loop", "to", "layout", "wire", "via", "junction", "ground", "common", "current", "voltage", "power", "against", "level",
  "as", "type", "uses", "units", "meta", "parameters", "inputs", "outputs", "formulas", "state", "equations", "behaviour",
  "run", "view", "expect", "bench", "measure", "near", "within", "is", "from", "pins", "nodes", "parts", "nets", "ports",
  "probes", "analysis", "sheet", "maps", "axiom", "rules", "turtle", "steps", "vertices", "edges", "items", "step",
  "summary", "description", "tags", "source", "authors", "license", "links", "in", "where", "log", "integer", "animate",
  "live", "exact", "per", "unit", "primary", "preset", "camera", "explain", "without", "place", "rotate", "mirror", "route",
  "analog", "digital", "power", "discrete", "continuous", "local", "function", "on", "when", "do", "end", "if", "then",
  "else", "elseif", "for", "return",
].join("|")})\\b`);

const jmxSyntax = StreamLanguage.define<{ longText: boolean }>({
  startState: () => ({ longText: false }),
  token(stream, state) {
    if (state.longText) {
      if (stream.skipTo('"""')) {
        stream.match('"""');
        state.longText = false;
      } else {
        stream.skipToEnd();
      }
      return "string";
    }
    if (stream.match('"""')) {
      state.longText = true;
      return "string";
    }
    if (stream.match(/#[^\n]*/)) return "comment";
    if (stream.match(/"(?:[^"\\]|\\.)*"?/) || stream.match(/'(?:[^'\\]|\\.)*'?/)) return "string";
    if (stream.match(JMX_KEYWORDS)) return "keyword";
    if (stream.match(/\b(?:true|false|X|Z)\b/)) return "atom";
    if (stream.match(/\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i)) return "number";
    if (stream.match(/[{}()[\],;:]/)) return "punctuation";
    if (stream.match(/[=+*/<>!|&^-]+/)) return "operator";
    stream.next();
    return null;
  },
});

/**
 * SPICE as it is read: a card is a line; its first letter says what it is (R, C, L, V, I, D, Q, M, X, B, E, F, G, H, K),
 * a dot opens a directive (`.model`, `.subckt`, `.tran`), `*` at the start of a line and `;` or `$` after it open a
 * comment, `+` continues the card above. Numbers carry engineering suffixes (`4.7k`, `10meg`), and `{…}` or `'…'` are
 * expressions. It colours; the reader on the server decides what a deck means.
 */
const SPICE_FUNCTIONS = /^(?:sin|pulse|pwl|exp|sffm|am|dc|ac)\b/i;
const spiceSyntax = StreamLanguage.define<{ cardStart: boolean; titled: boolean }>({
  startState: () => ({ cardStart: true, titled: false }),
  token(stream, state) {
    // A deck's first line is its title, whatever it says — SPICE never reads it as a card.
    if (!state.titled) {
      state.titled = true;
      stream.skipToEnd();
      return "heading";
    }
    if (stream.sol()) {
      state.cardStart = true;
      if (stream.match(/^\*.*/)) {
        return "comment";
      }
      if (stream.match(/^\+/)) {
        state.cardStart = false;
        return "operator";
      }
    }
    if (stream.eatSpace()) {
      return null;
    }
    if (stream.match(/^[;$].*/)) {
      return "comment";
    }
    if (state.cardStart) {
      state.cardStart = false;
      if (stream.match(/^\.[a-z]+/i)) {
        return "keyword";
      }
      if (stream.match(/^[a-z][\w.]*/i)) {
        return "typeName";
      }
    }
    if (stream.match(/^\{[^}]*\}?/) || stream.match(/^'[^']*'?/)) {
      return "string";
    }
    if (stream.match(SPICE_FUNCTIONS)) {
      return "macroName";
    }
    if (stream.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:meg|mil|[fpnumkgt])?[a-z]*/i)) {
      return "number";
    }
    if (stream.match(/^[()=,]/)) {
      return "punctuation";
    }
    stream.next();
    return null;
  },
});

/**
 * The frame's colours in the library's tokens, given as CodeMirror's own theme: its base theme is mounted after every
 * stylesheet, so a rule in `styles.css` could never reach the gutters.
 */
const SOURCE_EDITOR_THEME = EditorView.theme({
  "&": { backgroundColor: "transparent", height: "100%" },
  ".cm-gutters": { backgroundColor: "var(--parallax-surface-2)", borderRight: "1px solid var(--parallax-line)", color: "var(--parallax-muted)" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--parallax-accent-soft)" },
});

/**
 * @param readOnly  shown, not edited — the object page's Source tab
 * @param focusLine a line to select and scroll to: the line a derived fact follows from
 * @param bare      the editor alone, for a panel or a stage that names it in its own head
 */
export function CodeSourceEditor({ id, label, language, value, onChange, error, minHeight = 190, readOnly = false, focusLine, bare = false }: {
  id: string; label: string; language: "jMF" | "jMS" | "jMX" | "SPICE";
  value: string; onChange?: (value: string) => void; error?: string; minHeight?: number; readOnly?: boolean; focusLine?: number | null; bare?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: value, extensions: [
        lineNumbers(),
        highlightActiveLine(),
        language === "jMS" ? jmsSyntax() : language === "jMF" ? jmfSyntax() : language === "SPICE" ? spiceSyntax : jmxSyntax,
        syntaxHighlighting(SYNTAX_HIGHLIGHT_STYLE),
        editorChrome({ fontSize: "12px", padding: "12px 14px" }),
        SOURCE_EDITOR_THEME,
        EditorView.lineWrapping,
        EditorState.readOnly.of(readOnly),
        EditorView.contentAttributes.of({ id, role: "textbox", "aria-label": `${label} (${language})`, "aria-multiline": "true" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) change.current?.(update.state.doc.toString());
        }),
      ] }),
    });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
  }, [id, language, readOnly]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || !focusLine || focusLine > editor.state.doc.lines) return;
    const line = editor.state.doc.line(focusLine);
    editor.dispatch({ selection: { anchor: line.from, head: line.to }, effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
  }, [focusLine, value]);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  const problem = error ? <p className="parallax-error-text" role="alert"><ParallaxIcon name="error" />{error}</p> : null;
  if (bare) {
    return <>
      <div ref={host} data-parallax-part="code-editor" className="parallax-code-editor parallax-bare" style={{ minHeight }} />
      {problem}
    </>;
  }
  return <div data-parallax-part="field" className="parallax-field">
    <div className="parallax-field-label">
      <label htmlFor={id}>{label}</label>
      <span className="parallax-row">
        <span className="parallax-kind">{language}</span>
        <button type="button" data-parallax-part="button" className="parallax-button parallax-quiet parallax-icon-only parallax-small" title={`Copy ${label}`} aria-label={`Copy ${label}`} onClick={() => void navigator.clipboard.writeText(value)}><ParallaxIcon name="copy" /></button>
      </span>
    </div>
    <div ref={host} data-parallax-part="code-editor" className="parallax-code-editor" style={{ minHeight }} />
    {problem}
  </div>;
}

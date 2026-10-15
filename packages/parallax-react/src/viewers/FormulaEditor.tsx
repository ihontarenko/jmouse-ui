import { useEffect, useRef } from "react";
import { autocompletion, closeBrackets, closeCompletion, type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, keymap, placeholder as placeholderExtension, type DecorationSet } from "@codemirror/view";
import { JMF_CONSTANTS, JMF_FORMS, JMF_FUNCTIONS, jmfSyntax } from "@jmouse/codemirror";
import { editorChrome } from "@jmouse/codemirror/editor";
import { SYNTAX_HIGHLIGHT_STYLE } from "@jmouse/codemirror/highlight";
import { classNames } from "../support/classNames";

const setErrorPosition = StateEffect.define<number | null>();

/** Underlines the character the backend's `invalid-formula` refusal points at. */
const errorMark = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    let next = marks.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setErrorPosition)) {
        const length = transaction.state.doc.length;
        if (effect.value === null || length === 0) {
          next = Decoration.none;
        } else {
          const from = Math.max(0, Math.min(effect.value, length - 1));
          next = Decoration.set([Decoration.mark({ class: "parallax-formula-error-mark" }).range(from, from + 1)]);
        }
      }
    }
    if (transaction.docChanged) {
      next = Decoration.none;
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Completion of the language's words and the field's own names, read at the moment of asking so they can change while typing. */
function completionSource(names: () => readonly string[]) {
  const builtIns: Completion[] = [
    ...JMF_FUNCTIONS.map((entry) => ({ label: entry.name, type: "function", detail: entry.arity === 1 ? "(x)" : "(a, b)", apply: `${entry.name}(` })),
    ...JMF_FORMS.map((form) => ({ label: form, type: "keyword", apply: `${form}(` })),
    ...JMF_CONSTANTS.map((constant) => ({ label: constant, type: "constant" })),
  ];
  return (context: CompletionContext) => {
    const options = [...builtIns, ...names().map((name) => ({ label: name, type: "variable", boost: 2 }))];
    const word = context.matchBefore(/[A-Za-z\p{L}][\w\p{L}]*/u);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }
    return { from: word.from, options, validFor: /^[\w\p{L}]*$/u };
  };
}

interface FormulaEditorProperties {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Parameters and variables offered by completion before the built-ins. */
  names?: readonly string[];
  /** The zero-based character the server refused, or null. */
  errorPosition?: number | null;
  invalid?: boolean;
  describedBy?: string;
  /** The id of the visible label; a contenteditable is not labelable by `for`. */
  labelledBy?: string;
  placeholder?: string;
  /** Called on Enter, which never inserts a line in a one-line formula. */
  onSubmit?: () => void;
  multiline?: boolean;
  /** Takes the caret when the field appears — a line just added to a list. */
  autoFocus?: boolean;
}

/** The completion list in the library's tokens, given as CodeMirror's own theme so it wins over the base theme. */
const FORMULA_EDITOR_THEME = EditorView.theme({
  "&": { backgroundColor: "transparent" },
  ".cm-tooltip-autocomplete": {
    backgroundColor: "var(--parallax-surface)", border: "1px solid var(--parallax-line)", borderRadius: "var(--parallax-radius-control)",
    boxShadow: "var(--parallax-shadow-pop)", font: "var(--parallax-text-xs) var(--parallax-font-technical)",
  },
  ".cm-tooltip-autocomplete li[aria-selected]": { backgroundColor: "var(--parallax-accent-soft)", color: "var(--parallax-ink)" },
});

/**
 * A jMF formula field: the shared grammar's colours, completion of functions, forms, constants and the
 * object's own names, and the refused character underlined. It colours; the backend decides.
 */
export function FormulaEditor({ id, value, onChange, names = [], errorPosition = null, invalid, describedBy, labelledBy, placeholder, onSubmit, multiline = false, autoFocus = false }: FormulaEditorProperties) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const listeners = useRef({ onChange, onSubmit });
  listeners.current = { onChange, onSubmit };
  const currentNames = useRef(names);
  currentNames.current = names;

  useEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const extensions: Extension[] = [
      jmfSyntax(),
      syntaxHighlighting(SYNTAX_HIGHLIGHT_STYLE),
      editorChrome({ fontSize: "12px", padding: "6px 9px" }),
      FORMULA_EDITOR_THEME,
      closeBrackets(),
      autocompletion({ override: [completionSource(() => currentNames.current)], icons: false }),
      errorMark,
      EditorView.contentAttributes.of({
        id,
        role: "textbox",
        "aria-multiline": String(multiline),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          listeners.current.onChange(update.state.doc.toString());
        }
      }),
    ];
    if (placeholder) {
      extensions.push(placeholderExtension(placeholder));
    }
    if (!multiline) {
      extensions.push(
        keymap.of([
          {
            key: "Enter",
            // Enter finishes the formula even while a suggestion is offered; Tab or a click takes the suggestion.
            run: (editorView) => {
              closeCompletion(editorView);
              listeners.current.onSubmit?.();
              return true;
            },
          },
        ]),
        EditorState.transactionFilter.of((transaction) => (transaction.newDoc.lines > 1 ? [] : transaction)),
      );
    }
    const editor = new EditorView({ parent: element, state: EditorState.create({ doc: value, extensions }) });
    view.current = editor;
    if (autoFocus) {
      editor.focus();
    }
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is built once per field; value and error flow in through the effects below.
  }, [id, multiline]);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: setErrorPosition.of(errorPosition) });
  }, [errorPosition]);

  return <div ref={host} data-parallax-part="formula-editor" className={classNames("parallax-formula-editor", invalid && "parallax-formula-editor-invalid")} />;
}

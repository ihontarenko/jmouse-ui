import { useEffect, useRef } from "react"
import { Compartment, EditorState, type Extension } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { editorChrome } from "@jmouse/codemirror/editor"
import { joinClassNames } from "../lib/classNames"

export interface CodeEditorProperties {
  value: string
  /** Called with the whole document after every edit. Leave it out for a read-only view. */
  onChange?(value: string): void
  /** The language and anything else the editor needs — `jmsSyntax()`, a linter, completion. */
  extensions?: Extension[]
  /** The editor's accessible name. */
  label: string
  readOnly?: boolean
  lineNumbers?: boolean
  className?: string
}

/**
 * Code being edited, on the kit's canvas: CodeMirror with the house frame (`editorChrome`) and the house syntax colours
 * (`@jmouse/codemirror/styles.css`), history, Tab indents (Escape then Tab leaves the editor, as CodeMirror documents).
 * The value is controlled; an outside change replaces the document without losing the editor.
 */
export function CodeEditor({ value, onChange, extensions = [], label, readOnly = false, lineNumbers: showLineNumbers = true, className }: CodeEditorProperties) {
  const hostReference = useRef<HTMLDivElement>(null)
  const viewReference = useRef<EditorView | null>(null)
  const changeReference = useRef(onChange)
  const dynamic = useRef(new Compartment())
  changeReference.current = onChange

  useEffect(() => {
    const view = new EditorView({
      parent: hostReference.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          editorChrome(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              changeReference.current?.(update.state.doc.toString())
            }
          }),
          dynamic.current.of([]),
        ],
      }),
    })
    viewReference.current = view
    return () => {
      view.destroy()
      viewReference.current = null
    }
    // The view is made once; what may change later is reconfigured below rather than rebuilt.
  }, [])

  useEffect(() => {
    viewReference.current?.dispatch({
      effects: dynamic.current.reconfigure([
        ...(showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
        EditorState.readOnly.of(readOnly || !onChange),
        ...extensions,
      ]),
    })
  }, [extensions, readOnly, showLineNumbers, onChange])

  useEffect(() => {
    const view = viewReference.current
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={hostReference} className={joinClassNames("kit-code-editor", className)} />
}

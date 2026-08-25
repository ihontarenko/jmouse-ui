import { useMemo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { cn } from "@jmouse/ui"
import { jmqSyntax } from "@jmouse/codemirror"
import { useCodeThemeExtensions } from "@jmouse/codemirror/react"

/**
 * jMQ, read but not typed — a declaration, or the body of a view somebody kept.
 *
 * ## ⚠️ The same grammar as the editor, deliberately
 *
 * A read-only pane painting its own colours would be a second opinion about what a keyword is, and the
 * two drift the first time the language grows a word. This is `@jmouse/codemirror`'s grammar — the one
 * that colours the editor, and the one that colours a ` ```jmq ` fence in a manual — so a query looks
 * the same everywhere it is shown.
 *
 * ## ⚠️ Read-only, not disabled
 *
 * `editable: false` keeps selection, scrolling and copying; a disabled input takes all three away. What
 * is on this pane is text somebody will want to paste into an editor, so being able to select it is the
 * whole point.
 */
export function JmqCode({
  value,
  className,
  lineNumbers = false,
}: {
  value: string
  className?: string
  /** On for a declaration, which is read as a document; off for one line of a filter. */
  lineNumbers?: boolean
}) {
  const theme = useCodeThemeExtensions()

  const extensions = useMemo(
    () => [jmqSyntax(), EditorView.lineWrapping, EditorView.editable.of(false), ...theme],
    [theme],
  )

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/60", className)}>
      <CodeMirror
        value={value}
        extensions={extensions}
        editable={false}
        basicSetup={{
          lineNumbers,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
      />
    </div>
  )
}

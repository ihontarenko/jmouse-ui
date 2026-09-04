import { useMemo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint"
import { EditorView } from "@codemirror/view"
import { AlertTriangle, Check, RotateCcw, Unplug } from "lucide-react"
import { Alert, AlertDescription, AlertTitle, Button, cn } from "@jmouse/ui"
import { jmvSyntax } from "@jmouse/codemirror"
import { useCodeThemeExtensions } from "@jmouse/codemirror/react"
import { useValidationTransport } from "./transport"
import type { ValidationLabels } from "./labels"
import type { UnshowableValidation } from "./types"

/**
 * The `.jmv` tab — the document itself, not a preview of one. 📄
 *
 * ## ⚠️ What is shown here is what gets saved
 *
 * It was rendered by the server's own writer, which is the same call an editor's save goes through. So
 * there is no moment where the text a person read and the text a file receives are produced by
 * different code, and no reconciliation step where the two can be found to disagree.
 *
 * ## ⚠️ Editable, and reading it back is a deliberate act
 *
 * Text typed here does not flow into the form on its own. Somebody presses *read this into the form*,
 * and either the rows appear or the panel says which construct has no row — never a silent partial
 * import, which is a form that saves and a save that deletes what it never showed.
 *
 * ## ⚠️ Highlighted by `.jmv`'s own grammar, never by a neighbour's
 *
 * `jmvSyntax` colours the field column, the checks, `stop` and `optional` as the different things they
 * are. Reaching for `jmmSyntax` instead — which was the state of this file for one commit — marks
 * `target` and `from` as significant and leaves `gate` and `when` plain: highlighting that reads as
 * authoritative and is wrong about every keyword the language actually has.
 *
 * ## ⚠️ `theme="none"` is load-bearing, and its absence is invisible in the code
 *
 * Left unset, `@uiw/react-codemirror` bolts its OWN light theme on — so the editor came up on white
 * paper inside a dark application, with the shared dark palette painting its colours onto it. Nothing
 * errors; the result simply looks like the palette is broken, and the palette is the last place anybody
 * looks. Every jMouse editor says `theme="none"` for this reason, and every one of them that ever
 * looked wrong was missing it.
 *
 * ## ⚠️ The linter calls the real reader; the grammar above only colours
 *
 * A syntax error is answered by the server's own parser — the same one the runtime loads a file with —
 * so what the editor calls wrong is exactly what will refuse to load. A TypeScript re-implementation of
 * the grammar would be a second reader that agrees for about a month.
 *
 * ⚠️ **A refusal is not a syntax error and is never underlined.** `422` with a `construct` means *this
 * document is fine and the form has no row for it* — it is reported as prose below, because painting it
 * red would send somebody hunting for a mistake that is not in their file.
 */
export function ValidationDocument({
  text,
  edited,
  refusal,
  unreachable,
  readable,
  labels,
  height = "60vh",
  className,
  onEdit,
  onRevert,
  onApply,
}: {
  /** The document as it stands — rendered from the form, or as somebody typed it. */
  text: string
  /** Whether this text came from the box rather than from the form. */
  edited: boolean
  /** ⚠️ Why it has no rows, when it has none. */
  refusal: UnshowableValidation | null
  /**
   * ⚠️ Whether the document could not be read AT ALL, which is a different thing from having no rows.
   *
   * A refusal is the server saying *this is fine and the form cannot show it*. This is a fault — an
   * expired session, a server down — and telling somebody their document is wrong when the network is
   * what failed sends them through a file that was never the problem.
   */
  unreachable: boolean
  /** Whether the typed text has rows waiting to be read in. */
  readable: boolean
  labels: ValidationLabels
  /** The editor's height, as CSS. `100%` where the surrounding box already has one. */
  height?: string
  className?: string
  onEdit: (text: string) => void
  onRevert: () => void
  onApply: () => void
}) {
  const transport = useValidationTransport()
  const themed = useCodeThemeExtensions()

  // ⚠️ Built once. A linter recreated on every render restarts CodeMirror's own debounce, so a document
  // being typed into is checked on the first keystroke and never again until typing stops entirely.
  const documentLinter = useMemo(
    () =>
      linter(async (view): Promise<Diagnostic[]> => {
        const written = view.state.doc.toString()

        if (written.trim() === "") {
          return []
        }

        try {
          await transport.parse(written)

          return []
        } catch (thrown) {
          const problem = problemWithin(thrown)

          // ⚠️ Null covers both *a refusal* and *the request failed*, and neither is a mark on the text.
          // Underlining somebody's correct document because the network hiccuped is the one failure a
          // linter must not have.
          if (problem === null) {
            return []
          }

          // ⚠️ Anchored to the start where the complaint is about the document as a whole. A problem
          // with nowhere to point is still a problem.
          const line =
            problem.line > 0 ? view.state.doc.line(Math.min(problem.line, view.state.doc.lines)) : null

          return [
            {
              from: line ? line.from + Math.max(0, problem.column - 1) : 0,
              to: line ? line.to : 0,
              severity: "error",
              source: "syntax",
              message: problem.detail,
            },
          ]
        }
      }),
    [transport],
  )

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      {/* Square and min-h-96, the same frame the policy editor has. A code surface with rounded
          corners reads as a widget rather than as the file it is. */}
      <div className="border-border min-h-96 flex-1 overflow-hidden border">
        <CodeMirror
          value={text}
          height={height}
          // ⚠️ See the note above — without this the editor brings its own light theme.
          theme="none"
          // ⚠️ The same setup the policy editor has, down to the fold gutter. The box is editable
          // whether or not anybody has typed in it yet, so the active line is marked from the start —
          // it used to turn on only once `edited`, which made the caret appear to arrive late.
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
          extensions={[
            jmvSyntax(),
            ...themed,
            lintGutter(),
            documentLinter,
            EditorView.lineWrapping,
          ]}
          onChange={onEdit}
        />
      </div>

      {refusal !== null && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>{labels.cannotShow}</AlertTitle>
          {/* ⚠️ The construct by name. A screen that only printed the sentence would leave somebody
              hunting for which line the form could not take. */}
          <AlertDescription>
            <code className="font-mono">{refusal.construct}</code> — {refusal.detail}
          </AlertDescription>
        </Alert>
      )}

      {unreachable && (
        <Alert>
          <Unplug className="size-4" />
          <AlertDescription>{labels.unreachable}</AlertDescription>
        </Alert>
      )}

      {edited && (
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" disabled={!readable} onClick={onApply}>
            <Check className="size-4" />
            {labels.readIntoForm}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRevert}>
            <RotateCcw className="size-4" />
            {labels.discard}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Where a refusal says the trouble is, out of whatever the product's HTTP client threw.
 *
 * ## ⚠️ Tolerant about WHERE it lives, strict about WHETHER there is one
 *
 * This package brings no HTTP client, so a `400` may arrive as the body itself, as `error.body`, or as
 * `error.response.data`. It looks in all three — and answers `null` when none of them carries a line,
 * which is what tells the linter to leave the text unmarked.
 *
 * ⚠️ **A `construct` disqualifies it.** That is the `422` refusal — a valid document the form cannot
 * draw — and it is prose beside the editor, never a red underline in it.
 */
function problemWithin(thrown: unknown): { line: number; column: number; detail: string } | null {
  const candidates = [thrown, within(thrown, "body"), within(thrown, "data"), payloadOf(thrown)]

  for (const candidate of candidates) {
    if (typeof within(candidate, "construct") === "string") {
      return null
    }

    const line = within(candidate, "line")

    if (typeof line !== "number") {
      continue
    }

    const column = within(candidate, "column")
    const detail = within(candidate, "detail")

    return {
      line,
      column: typeof column === "number" ? column : 1,
      detail: typeof detail === "string" ? detail : "This is not a validation document yet.",
    }
  }

  return null
}

function within(subject: unknown, name: string): unknown {
  if (subject === null || typeof subject !== "object") {
    return undefined
  }

  return (subject as Record<string, unknown>)[name]
}

function payloadOf(thrown: unknown): unknown {
  return within(within(thrown, "response"), "data")
}

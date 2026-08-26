import CodeMirror from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { AlertTriangle, Check, RotateCcw, Unplug } from "lucide-react"
import { Alert, AlertDescription, AlertTitle, Button, cn } from "@jmouse/ui"
import { jmmSyntax } from "@jmouse/codemirror"
import { useCodeThemeExtensions } from "@jmouse/codemirror/react"
import type { MapperLabels } from "./labels"
import type { UnshowableMapping } from "./types"

/**
 * The jMM tab — the document itself, not a preview of one.
 *
 * ## ⚠️ What is shown here is what gets saved
 *
 * It was rendered by the server's own translator, which is the same call an editor's save goes through.
 * So there is no moment where the text a person read and the text a file receives are produced by
 * different code, and no reconciliation step where the two can be found to disagree.
 *
 * ## ⚠️ Editable, and reading it back is a deliberate act
 *
 * Text typed here does not flow into the form on its own. Somebody presses *read this into the form*,
 * and either the rows appear or the panel says which construct has no row — never a silent partial
 * import, which is a form that saves and a save that deletes what it never showed.
 */
export function MappingDocument({
  text,
  edited,
  refusal,
  unreachable,
  readable,
  labels,
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
  refusal: UnshowableMapping | null
  /**
   * ⚠️ Whether the document could not be READ AT ALL, which is a different thing from having no rows.
   *
   * A refusal is an answer about the document. This is the absence of an answer — an expired session, a
   * fault, the network. They are shown apart because the reader's next move is different: one means edit
   * the file, the other means sign in again.
   */
  unreachable: boolean
  /** Whether the text parses into rows the form can show. */
  readable: boolean
  labels: MapperLabels
  className?: string
  onEdit: (text: string) => void
  onRevert: () => void
  onApply: () => void
}) {
  const themed = useCodeThemeExtensions()

  return (
    <div className={cn("space-y-3", className)}>
      {refusal === null ? null : (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{labels.readOnly}</AlertTitle>
          <AlertDescription>
            <p>
              {labels.cannotShow} <code className="font-mono">{refusal.construct}</code>.
            </p>
            <p className="text-xs">{labels.readOnlyHint}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* ⚠️ Its own banner, never folded into the one above. "The form cannot show `unknown`" is what
          this used to say, and it points at a construct that is not in the file. */}
      {unreachable ? (
        <Alert variant="destructive">
          <Unplug className="size-4" />
          <AlertTitle>{labels.unreachable}</AlertTitle>
          <AlertDescription>
            <p className="text-xs">{labels.unreachableHint}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-md border">
        <CodeMirror
          value={text}
          extensions={[jmmSyntax(), EditorView.lineWrapping, ...themed]}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: edited }}
          onChange={onEdit}
        />
      </div>

      {edited ? (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={!readable} onClick={onApply}>
            <Check className="mr-1.5 size-4" />
            {labels.applyDocument}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onRevert}>
            <RotateCcw className="mr-1.5 size-4" />
            {labels.revertDocument}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

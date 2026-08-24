import { useMemo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { EditorView } from "@codemirror/view"
import { AlertTriangle, Check } from "lucide-react"
import { cn } from "@jmouse/ui"
import { jmqSyntax } from "@jmouse/codemirror"
import { useCodeThemeExtensions } from "@jmouse/codemirror/react"
import type { QueryLabels } from "./labels"
import type { Translated } from "./types"

/**
 * The escape hatch — the query as text, in the language's own colours.
 *
 * ## ⚠️ Why an editor rather than an input
 *
 * A filter is the one part of a saved view that is a *program*. Typed into a bare box it can be written
 * and never read back: no colour, no structure, and a converter pipe indistinguishable from a vertical
 * bar somebody pasted. The grammar here is `@jmouse/codemirror`'s — the same one that colours a
 * ` ```jmq ` fence in a manual, so a query reads identically wherever it is written.
 *
 * ## ⚠️ This colours; it does not decide
 *
 * Whether a query is *valid* — whether the attribute exists, whether the comparison is typed, whether an
 * aggregate is in the wrong clause — is answered by the compiler on the server, in sentences a person
 * can act on. A TypeScript opinion about the same question would be a second grammar that agrees for
 * about a month, after which the editor calls a query good and the save refuses it.
 *
 * So the band below shows **the server's** verdict, verbatim.
 */
export function QueryEditor({
  value,
  translated,
  labels,
  placeholder,
  pending,
  onChange,
}: {
  value: string
  /** What the server said about this text, or `undefined` while nothing has been asked yet. */
  translated: Translated | undefined
  labels: QueryLabels
  placeholder?: string
  pending?: string
  onChange: (value: string) => void
}) {
  const theme = useCodeThemeExtensions()

  const extensions = useMemo(() => [jmqSyntax(), EditorView.lineWrapping, ...theme], [theme])

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border/60">
        <CodeMirror
          value={value}
          extensions={extensions}
          placeholder={placeholder}
          basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
          onChange={onChange}
        />
      </div>

      {/*
        ⚠️ Silent while the box is empty. A person who has typed nothing has made no mistake, and a
        refusal sitting under an empty field reads as an accusation.
      */}
      {value.trim() === "" ? null : (
        <p
          className={cn(
            "flex items-start gap-2 text-xs",
            translated?.readable === false ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {translated === undefined ? null : translated.readable ? (
            <Check className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>
            {translated === undefined
              ? (pending ?? "…")
              : translated.readable
                ? labels.readable
                : translated.message}
          </span>
        </p>
      )}
    </div>
  )
}

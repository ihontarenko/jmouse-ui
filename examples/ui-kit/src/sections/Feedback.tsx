import { useState } from "react"
import { Button, EmptyState, ErrorPage, Segmented, type ErrorKind, IconButton, Notice, PageHeader, ProblemState, Skeleton, Spinner, Tooltip, useToast, Waiting } from "@jmouse/ui-kit"
import { Specimen } from "../Specimen"

export function FeedbackSection() {
  const toast = useToast()
  const [errorKind, setErrorKind] = useState<ErrorKind>("not-found")
  return (
    <div className="showcase-stack">
      <PageHeader title="Feedback" description="What the reader should know: notices about a place, toasts about an action, the empty and the failed states, work in progress. Every tone carries an icon and a word." />

      <Specimen id="notice" title="Notice" summary="Something true about this place — information, a caution, a failure — with a band, an icon and the words. A danger notice is announced as an alert." layout="column" usage={`<Notice tone="warn" title="Stock is low" actions={<Button size="small">Reorder</Button>}>12 left; the threshold is 50.</Notice>`}>
        <Notice title="Read-only">This revision is published; edit the draft instead.</Notice>
        <Notice tone="good" title="Indexed">2 000 documents are searchable.</Notice>
        <Notice tone="warn" title="Stock is low" actions={<Button size="small">Reorder</Button>}>12 left; the threshold is 50.</Notice>
        <Notice tone="danger" title="The source is unreachable">The last harvest failed at 14:02 with a timeout.</Notice>
      </Specimen>

      <Specimen id="toast" title="Toast" summary="The outcome of an action, in the corner, for a few seconds — one action at most (Undo). A danger toast stays until it is dismissed. Polite to screen readers; a failure is an alert." usage={`const toast = useToast()\ntoast.show({ title: "Part deleted", tone: "danger", action: { label: "Undo", run: restore } })`}>
        <Button onClick={() => toast.show({ title: "Saved", description: "NE555 · revision 15" })}>Information</Button>
        <Button tone="good" onClick={() => toast.show({ title: "Harvest finished", tone: "good", description: "128 new posts" })}>Success</Button>
        <Button tone="warn" onClick={() => toast.show({ title: "Rate limited", tone: "warn", description: "Retrying in 30 s" })}>Caution</Button>
        <Button tone="danger" onClick={() => toast.show({ title: "Part deleted", tone: "danger", action: { label: "Undo", run: () => toast.show({ title: "Restored", tone: "good" }) } })}>Failure with undo</Button>
      </Specimen>

      <Specimen id="states" title="Empty and problem states" summary="An empty place says why and what fills it. A failure is never dressed as an empty list: it says what failed, the detail, and how to try again." layout="grid">
        <EmptyState title="No documents yet" description="Add a source and Raccoon starts indexing it." actions={<Button variant="primary" icon="plus">Add a source</Button>} />
        <ProblemState title="Could not load the catalogue" description="The server did not answer." detail="GET /api/parts · 503 Service Unavailable" actions={<Button icon="refresh">Try again</Button>} />
      </Specimen>

      <Specimen
        id="error-page"
        title="Error page and error boundary"
        summary="A whole place that cannot be shown: what happened, why, the way out, and the technical detail folded away. Five kinds with their own words; a product may replace the words when it knows more. ErrorBoundary catches a render failure and draws the page instead of a blank screen."
        layout="column"
        usage={`
<ErrorBoundary fallback={(error, reset) => (
  <ErrorPage kind="failed" detail={error.stack} actions={<Button variant="primary" onClick={reset}>Try again</Button>} />
)}>
  <Routes />
</ErrorBoundary>

<ErrorPage kind="not-found" actions={<ButtonLink href="/">Go to the overview</ButtonLink>} />`}
      >
        <Segmented<ErrorKind> label="Kind" size="small" value={errorKind} onValueChange={setErrorKind} options={(["not-found", "forbidden", "failed", "offline", "unavailable"] as const).map((kind) => ({ value: kind, label: kind }))} />
        <ErrorPage
          kind={errorKind}
          actions={<><Button variant="primary" icon="arrow-right">Go to the overview</Button><Button icon="refresh">Reload</Button></>}
          detail={errorKind === "failed" ? "TypeError: Cannot read properties of undefined (reading 'parts')\n    at CatalogueTable (catalogue.tsx:42:18)" : undefined}
        />
      </Specimen>

      <Specimen id="waiting" title="Skeleton, spinner, waiting, tooltip" summary="A skeleton holds the shape of what is loading; a spinner says work is happening, and Waiting says which work. A tooltip names a control on hover and focus — never the only place a fact lives.">
        <div className="showcase-stack" data-gap="tight">
          <Skeleton width={220} height={14} />
          <Skeleton width={160} height={14} />
          <Skeleton width={260} height={36} />
        </div>
        <Spinner label="Loading" />
        <Spinner size="large" label="Loading" />
        <Waiting>Indexing 1 240 documents…</Waiting>
        <Tooltip content="Reload the catalogue" shortcut="F5">
          <IconButton icon="refresh" label="Reload" variant="default" title="" />
        </Tooltip>
      </Specimen>
    </div>
  )
}

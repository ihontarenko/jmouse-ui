import { useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardGrid,
  ConfirmDialog,
  Dialog,
  Disclosure,
  Facts,
  Field,
  IconButton,
  Input,
  Inspector,
  InspectorGroup,
  Kind,
  PageHeader,
  Panel,
  Section,
  Split,
  useToast,
} from "@jmouse/ui-kit"
import { Specimen } from "../Specimen"

export function ContainersSection() {
  const toast = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="showcase-stack">
      <PageHeader title="Containers" description="Panel, section, inspector, disclosure, dialog, drawer, splitter and card. The page is the composition: a card is one independent object, and nothing nests a card in a card." />

      <Specimen id="panel" title="Panel and section" summary="A panel is a bordered region with its own head and foot; a flush body runs a table or list to its edges. A section is a ruled heading with no box — the default way to divide a page." layout="grid">
        <Panel title="Pins" meta="8" actions={<IconButton icon="plus" label="Add a pin" size="small" />} footer="Read from the symbol, revision 14">
          <Facts facts={[{ label: "1", value: "GND", technical: true }, { label: "2", value: "TRIG", technical: true }, { label: "3", value: "OUT", technical: true }]} />
        </Panel>
        <Section title="Supply" description="What the part needs to run." actions={<Button size="small" variant="quiet">Edit</Button>}>
          <Facts facts={[{ label: "VCC", value: "4.5 – 16 V", technical: true }, { label: "Quiescent", value: "3 mA", technical: true }]} />
        </Section>
      </Specimen>

      <Specimen id="inspector" title="Inspector" summary="The right-hand column that explains the selection: its title and identifier, then ruled groups headed by micro-labels." >
        <div className="kit-panel showcase-fixed-column">
          <Inspector title="NE555" subtitle="catalogue/ic/timers/ne555.jmc" actions={<IconButton icon="close" label="Close the inspector" size="small" />}>
            <InspectorGroup title="Model">
              <Facts facts={[{ label: "Kind", value: <Kind>IC</Kind> }, { label: "Package", value: "DIP-8", technical: true }, { label: "Stock", value: "42", technical: true }]} />
            </InspectorGroup>
            <InspectorGroup title="State" actions={<Badge tone="good">In stock</Badge>}>
              <p className="kit-secondary">Reordered on 2026-10-02.</p>
            </InspectorGroup>
          </Inspector>
        </div>
      </Specimen>

      <Specimen id="disclosure" title="Disclosure" summary="Content that folds under its title — the native details element: no script, and the keys work as they should." layout="column">
        <div>
          <Disclosure title="Electrical characteristics" meta="12 rows" defaultOpen>
            <Facts facts={[{ label: "Output current", value: "200 mA", technical: true }, { label: "Rise time", value: "100 ns", technical: true }]} />
          </Disclosure>
          <Disclosure title="Absolute maximum ratings" meta="6 rows">
            <Facts facts={[{ label: "VCC", value: "18 V", technical: true }]} />
          </Disclosure>
        </div>
      </Specimen>

      <Specimen
        id="dialog"
        title="Dialog, drawer, confirmation"
        summary="On the native <dialog>: focus is trapped inside, Escape closes, the page under it is inert, and focus returns to the opener. A drawer is the same dialog along an edge. A confirmation spells out the consequence and focuses the safe answer."
        usage={`
<Dialog open={open} onClose={close} title="New part" description="…"
  actions={<><Button onClick={close}>Cancel</Button><Button variant="primary">Create</Button></>}>
  <Field label="Part number" required><Input technical /></Field>
</Dialog>
<Dialog placement="end" … />   // a drawer
<ConfirmDialog tone="danger" confirmLabel="Delete" description="The part and its 14 revisions are deleted." … />`}
      >
        <Button onClick={() => setDialogOpen(true)}>Open a dialog</Button>
        <Button onClick={() => setDrawerOpen(true)} icon="sidebar">Open a drawer</Button>
        <Button tone="danger" icon="trash" onClick={() => setConfirmOpen(true)}>Delete…</Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="New part"
          description="It is added to the catalogue; stock is counted separately."
          footNote="Esc closes"
          actions={
            <>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => { setDialogOpen(false); toast.show({ title: "Part created", tone: "good", description: "NE556 · DIP-14" }) }}>Create</Button>
            </>
          }
        >
          <Field label="Part number" required hint="As printed on the package.">
            <Input technical defaultValue="NE556" data-autofocus="" />
          </Field>
          <Field label="Package">
            <Input technical defaultValue="DIP-14" />
          </Field>
        </Dialog>
        <Dialog open={drawerOpen} onClose={() => setDrawerOpen(false)} placement="end" title="Filters" description="Narrow the catalogue." actions={<Button variant="primary" onClick={() => setDrawerOpen(false)}>Apply</Button>}>
          <Field label="Value contains"><Input /></Field>
          <Field label="Package"><Input technical /></Field>
        </Dialog>
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Delete NE555?"
          description="The part and its 14 revisions are deleted. Circuits that use it keep a copy."
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => new Promise<void>((resolve) => window.setTimeout(() => { toast.show({ title: "NE555 deleted", tone: "danger", duration: 4000 }); resolve() }, 700))}
        />
      </Specimen>

      <Specimen id="split" title="Split" summary="Two panes and the handle between them. The handle is a focusable separator: arrow keys move it (Shift for larger steps), Home and End take it to its limits, a double click restores it. Its size can be kept under a storage key." flush height="tall">
        <Split label="List width" defaultSize={260} minimum={180} maximum={480}>
          <div className="kit-panel-body"><p className="kit-secondary">The sized pane. Drag the handle, or focus it and press the arrow keys.</p></div>
          <div className="kit-panel-body"><p className="kit-secondary">The pane that takes the rest.</p></div>
        </Split>
      </Specimen>

      <Specimen id="cards" title="Card" summary="One independent object — a part, a project, a film — as a link to it. Never a wrapper for a section, never nested." layout="column">
        <CardGrid>
          {["NE555", "LM358", "ATmega328P", "AMS1117"].map((name, index) => (
            <Card key={name} href="#/containers" title={name} selected={index === 0} media={<svg viewBox="0 0 120 60" className="showcase-brand-mark" aria-hidden="true"><rect x="30" y="12" width="60" height="36" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />{[0, 1, 2, 3].map((pin) => <line key={pin} x1={40 + pin * 13} y1="4" x2={40 + pin * 13} y2="12" stroke="currentColor" strokeWidth="2" />)}</svg>} meta={<><Kind>IC</Kind><span>DIP-8</span></>}>
              <span className="kit-secondary kit-technical">{index + 1} revision{index ? "s" : ""}</span>
            </Card>
          ))}
        </CardGrid>
      </Specimen>
    </div>
  )
}

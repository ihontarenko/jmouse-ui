import { useMemo, useState } from "react"
import { ActivityList, Button, DateRangeField, Field, FacetChecklist, Popover, Steps, Switch, Badge, Code, Facts, Figures, Identity, InlineCode, Kind, List, ListItem, PageHeader, PathText, Progress, Table, Tree, type TableColumn, type TableSort } from "@jmouse/ui-kit"
import { parts, projectTree, type Part } from "../fixtures"
import { Specimen } from "../Specimen"

export const partColumns: TableColumn<Part>[] = [
  { key: "designator", header: "Part", sortable: true, cell: (part) => <Identity name={part.value} sub={part.designator} /> },
  { key: "kind", header: "Kind", cell: (part) => <Kind>{part.kind.toUpperCase()}</Kind>, shrink: true },
  { key: "package", header: "Package", sortable: true, technical: true, cell: (part) => part.package, shrink: true },
  { key: "path", header: "Model", truncate: true, cell: (part) => <PathText path={part.path} truncate /> },
  { key: "stock", header: "Stock", sortable: true, align: "end", technical: true, cell: (part) => part.stock.toLocaleString("en") },
  { key: "state", header: "State", shrink: true, cell: (part) => <Badge tone={part.state}>{part.stateLabel}</Badge> },
]

export function sortParts(rows: Part[], sort: TableSort): Part[] {
  const factor = sort.direction === "ascending" ? 1 : -1
  return [...rows].sort((first, second) => {
    const firstValue = first[sort.key as keyof Part]
    const secondValue = second[sort.key as keyof Part]
    return (typeof firstValue === "number" && typeof secondValue === "number" ? firstValue - secondValue : String(firstValue).localeCompare(String(secondValue))) * factor
  })
}

export function DataSection() {
  const [sort, setSort] = useState<TableSort>({ key: "designator", direction: "ascending" })
  const [selectedId, setSelectedId] = useState<string | undefined>("p1")
  const [treeSelected, setTreeSelected] = useState("core/Binder.java")
  const [checked, setChecked] = useState<string[]>(["core/Binder.java", "core/Slugifier.java"])
  const [current, setCurrent] = useState("r14")
  const rows = useMemo(() => sortParts(parts, sort), [sort])
  const [facets, setFacets] = useState<Record<string, string[]>>({ kind: ["Resistor"] })
  const [range, setRange] = useState({ from: "2026-10-01", to: "2026-10-16" })
  const [columns, setColumns] = useState({ package: true, model: true, stock: true })

  return (
    <div className="showcase-stack">
      <PageHeader title="Data" description="Tables, trees, lists, facts and figures. Technical values sit in the data face with tabular figures; a selected row is marked by the band inside it." />

      <Specimen
        id="table"
        title="Table"
        summary="A sticky head in the data face, fixed row heights, sortable columns that announce their order, rows selected by click or keyboard (arrows move, Enter selects). The identity cell keeps its two lines in two faces. The table scrolls inside its own box."
        flush
        height="tall"
        usage={`
const columns: TableColumn<Part>[] = [
  { key: "designator", header: "Part", sortable: true, cell: (part) => <Identity name={part.value} sub={part.designator} /> },
  { key: "stock", header: "Stock", sortable: true, align: "end", technical: true, cell: (part) => part.stock },
  { key: "state", header: "State", shrink: true, cell: (part) => <Badge tone={part.state}>{part.stateLabel}</Badge> },
]
<Table label="Parts" columns={columns} rows={rows} rowKey={(part) => part.id}
  sort={sort} onSortChange={setSort} selectedKey={selected} onRowSelect={(part) => setSelected(part.id)} />`}
      >
        <Table label="Parts" columns={partColumns} rows={rows} rowKey={(part) => part.id} sort={sort} onSortChange={setSort} selectedKey={selectedId} onRowSelect={(part) => setSelectedId(part.id)} />
      </Specimen>

      <Specimen id="table-compact" title="Compact table and the empty case" summary="Compact for dense instruments; when there are no rows, the table says why and what to do." flush>
        <Table label="Nets" density="compact" columns={partColumns.slice(0, 3)} rows={[]} rowKey={(part) => part.id} empty="No parts match these filters. Clear a filter to see more." />
      </Specimen>

      <Specimen
        id="tree"
        title="Tree"
        summary="Files, folders or any nested things. One tab stop; Up and Down through the visible rows, Right opens or steps in, Left closes or steps out, Enter activates. Names are coloured by what changed, the letter at the end repeats it in words. With checkboxes, a folder is checked when all of its files are."
        layout="grid"
        usage={`<Tree label="Project" nodes={nodes} selectedId={selected} onSelect={setSelected} onActivate={openFile} defaultExpandedIds={["core"]} />`}
      >
        <div className="kit-panel">
          <Tree label="Project" nodes={projectTree} selectedId={treeSelected} onSelect={setTreeSelected} defaultExpandedIds={["core", "core/src"]} />
        </div>
        <div className="kit-panel">
          <Tree label="Changes to commit" nodes={projectTree} defaultExpandedIds={["core", "core/src", "el"]} checkedIds={checked} onCheckedChange={setChecked} />
        </div>
      </Specimen>

      <Specimen id="list" title="List" summary="Rows the user picks from — revisions, nets, symbols. The current one carries the band; a value sits at the end in the data face." layout="grid">
        <div className="kit-panel">
          <List ruled>
            {["r14", "r13", "r12", "r11"].map((revision, index) => (
              <ListItem key={revision} current={revision === current} value={`${index + 1}d ago`} onClick={() => setCurrent(revision)}>
                <Identity name={revision} sub={index === 0 ? "Pins renamed" : "Package drawing"} />
              </ListItem>
            ))}
          </List>
        </div>
      </Specimen>

      <Specimen id="facts" title="Facts and figures" summary="Facts are label / value pairs on one column of labels. Figures are a page's key numbers as one ruled band — never floating metric cards." layout="column">
        <Figures
          figures={[
            { label: "Parts", value: "1 204" },
            { label: "Low stock", value: "37", tone: "warn" },
            { label: "Out of stock", value: "6", tone: "danger" },
            { label: "Value on hand", value: "18 420", unit: "UAH" },
          ]}
        />
        <Facts
          facts={[
            { label: "Manufacturer", value: "Texas Instruments" },
            { label: "Package", value: "DIP-8", technical: true },
            { label: "Supply", value: "4.5 – 16 V", technical: true },
            { label: "Datasheet", value: <PathText path="datasheets/ti/ne555.pdf" /> },
          ]}
        />
      </Specimen>

      <Specimen id="collections" title="Filter rail, date range, popover, activity, steps" summary="Facets with counts narrow a list (Innoventa's catalogue, Kitsu's library). A date range says when its end is before its start. A popover holds a few controls under a button without blocking the page. Activity is what happened, newest first. Steps are a run's stages, each state an icon and a word." layout="grid">
        <FacetChecklist
          label="Filter parts"
          selected={facets}
          onSelectedChange={setFacets}
          facets={[
            { id: "kind", label: "Kind", options: [{ value: "Resistor", label: "Resistor", count: 412 }, { value: "Capacitor", label: "Capacitor", count: 388 }, { value: "IC", label: "IC", count: 96 }, { value: "Diode", label: "Diode", count: 54 }, { value: "Transistor", label: "Transistor", count: 41 }, { value: "Inductor", label: "Inductor", count: 22 }, { value: "Crystal", label: "Crystal", count: 9 }, { value: "Connector", label: "Connector", count: 118 }] },
            { id: "package", label: "Package", visible: 3, options: [{ value: "0603", label: "0603", count: 210 }, { value: "0805", label: "0805", count: 380 }, { value: "1206", label: "1206", count: 96 }, { value: "SOT-23", label: "SOT-23", count: 77 }] },
          ]}
        />
        <div className="showcase-stack" data-gap="tight">
          <Field label="Received" hint="Both ends are inclusive.">
            <DateRangeField value={range} onValueChange={setRange} presets={[{ label: "This month", range: () => ({ from: "2026-10-01", to: "2026-10-31" }) }, { label: "Last 7 days", range: () => ({ from: "2026-10-09", to: "2026-10-16" }) }, { label: "Any time", range: () => ({ from: "", to: "" }) }]} />
          </Field>
          <Popover label="Columns" trigger={(triggerProperties) => <Button icon="list" trailingIcon="chevron-down" {...triggerProperties}>Columns</Button>}>
            {() => (
              <div className="showcase-stack" data-gap="tight">
                <span className="kit-micro-label">Visible columns</span>
                {(Object.keys(columns) as Array<keyof typeof columns>).map((key) => (
                  <Switch key={key} label={key} checked={columns[key]} onChange={(event) => setColumns({ ...columns, [key]: event.target.checked })} />
                ))}
              </div>
            )}
          </Popover>
        </div>
        <ActivityList
          label="Recent activity"
          entries={[
            { id: "a1", actor: "Ivan", action: "renamed the pins of", subject: <a href="#/data">NE555</a>, when: "2 min ago", icon: "edit" },
            { id: "a2", actor: "Harvest", action: "imported 128 posts into", subject: <a href="#/data">Trove</a>, when: "14:02", icon: "download", tone: "good" },
            { id: "a3", actor: "Indexer", action: "failed on", subject: <a href="#/data">manual.pdf</a>, when: "13:40", icon: "danger", tone: "danger" },
          ]}
        />
        <Steps
          label="Indexing run"
          steps={[
            { id: "fetch", label: "Fetched", state: "done", detail: "2 000 files" },
            { id: "parse", label: "Parsed", state: "done", detail: "41 s" },
            { id: "index", label: "Indexed", state: "current", detail: "1 240 of 2 000" },
            { id: "embed", label: "Embedded", state: "waiting" },
          ]}
        />
      </Specimen>

      <Specimen id="values" title="Path, code, progress" summary="A path breaks only at its separators and keeps its file name in ink. Code sits on the canvas with a copy button. Progress says its amount in words as well as in length." layout="column">
        <PathText path="Kitsu/FE/src/components/media/media-browser.tsx" />
        <p className="kit-secondary">Run <InlineCode>./jm.sh up kitsu</InlineCode> to start it.</p>
        <Code code={"./jm.sh up parallax\n./jm.sh logs parallax:be"} label="Commands" />
        <Progress label="Indexing documents" value={0.62} valueText="62% · 1 240 of 2 000" showLabel />
        <Progress label="Harvesting" showLabel valueText="waiting for the source" />
        <Progress label="Disk" value={0.91} tone="danger" showLabel />
      </Specimen>
    </div>
  )
}

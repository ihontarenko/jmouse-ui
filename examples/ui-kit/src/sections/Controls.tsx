import { useState } from "react"
import {
  Addon,
  Avatar,
  Badge,
  Button,
  ButtonGroup,
  ButtonLink,
  Checkbox,
  Chip,
  ChipInput,
  Field,
  FieldRow,
  FormFields,
  type FieldDefinition,
  type FormValues,
  IconButton,
  Input,
  InputGroup,
  Kind,
  PageHeader,
  Parameter,
  QuantityField,
  RadioGroup,
  SearchField,
  Segmented,
  Select,
  KeyChord,
  StatusLight,
  Stepper,
  Switch,
  Tag,
  Tags,
  TextArea,
} from "@jmouse/ui-kit"
import { Specimen } from "../Specimen"

const standardResistances = [1, 2.2, 4.7, 10, 22, 47, 100, 220, 470, 1000]

const partForm: Array<{ title: string; description?: string; fields: FieldDefinition[] }> = [
  {
    title: "Part",
    fields: [
      { name: "number", kind: "text", label: "Part number", technical: true, required: true, hint: "As printed on the package." },
      { name: "kind", kind: "choice", label: "Kind", presentation: "segmented", options: [{ value: "resistor", label: "Resistor" }, { value: "capacitor", label: "Capacitor" }, { value: "ic", label: "IC" }] },
      { name: "package", kind: "choice", label: "Package", options: [{ value: "0603", label: "0603" }, { value: "0805", label: "0805" }, { value: "dip8", label: "DIP-8" }] },
      { name: "value", kind: "number", label: "Resistance", unit: "kΩ", minimum: 0 },
    ],
  },
  {
    title: "Stock",
    description: "Counted separately from the catalogue.",
    fields: [
      { name: "quantity", kind: "stepper", label: "On hand", minimum: 0, step: 10, unit: "pcs" },
      { name: "received", kind: "date", label: "Received" },
      { name: "labels", kind: "list", label: "Labels", placeholder: "Add a label", wide: true },
      { name: "notes", kind: "multiline", label: "Notes", wide: true },
      { name: "tracked", kind: "flag", label: "Tracked", text: "Warn me when it runs low", presentation: "switch", wide: true },
    ],
  },
]

export function ControlsSection() {
  const [view, setView] = useState("table")
  const [unit, setUnit] = useState("kΩ")
  const [mode, setMode] = useState("hybrid")
  const [query, setQuery] = useState("")
  const [resistance, setResistance] = useState(10)
  const [frequency, setFrequency] = useState(1.2)
  const [labels, setLabels] = useState(["timer", "astable"])
  const [filters, setFilters] = useState({ inStock: true, smd: false, favourites: false })
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState("NE555")
  const [formValues, setFormValues] = useState<FormValues>({ number: "", kind: "resistor", package: "0805", value: 10, quantity: 120, labels: ["smd"], tracked: true })

  return (
    <div className="showcase-stack">
      <PageHeader title="Controls" description="Buttons, fields, choices and labels. State is an attribute, never a second class: data-variant, data-tone, data-size, aria-pressed, aria-invalid." />

      <Specimen
        id="buttons"
        title="Button"
        summary="Default is outlined; primary is the one filled action of a screen; quiet has no chrome until hovered. A tone colours an action that starts, cautions or destroys. A button that navigates is a ButtonLink — an anchor."
        usage={`
<Button variant="primary" icon="play" shortcut="F5">Run</Button>
<Button tone="danger" icon="trash">Delete</Button>
<Button variant="quiet" trailingIcon="chevron-down">More</Button>
<IconButton icon="settings" label="Settings" />
<Button busy={saving}>Save</Button>`}
      >
        <Button variant="primary" icon="play" shortcut="F5">Run</Button>
        <Button>Default</Button>
        <Button variant="quiet" trailingIcon="chevron-down">Quiet</Button>
        <Button tone="good" icon="check">Approve</Button>
        <Button tone="warn">Limit</Button>
        <Button tone="danger" icon="trash">Delete</Button>
        <Button variant="primary" tone="danger">Delete forever</Button>
        <Button tone="accent" icon="plus">Add part</Button>
        <ButtonLink href="#/controls" icon="external">A link</ButtonLink>
        <Button disabled>Disabled</Button>
        <Button busy={busy} onClick={() => { setBusy(true); window.setTimeout(() => setBusy(false), 1500) }}>Save</Button>
      </Specimen>

      <Specimen id="buttons-small" title="Small, icon-only, pressed, grouped" summary="Small sits in a dense row or a strip. An icon-only button must have a label — it is its name and its tooltip. A group shares one border; pressed is a toggle and is announced as one.">
        <Button size="small" icon="filter">Filter</Button>
        <IconButton icon="refresh" label="Reload" />
        <IconButton icon="settings" label="Settings" variant="default" />
        <IconButton icon="star" label="Favourite" pressed />
        <ButtonGroup label="View">
          <Button size="small" icon="list" pressed={view === "table"} onClick={() => setView("table")}>Table</Button>
          <Button size="small" icon="grid" pressed={view === "cards"} onClick={() => setView("cards")}>Cards</Button>
        </ButtonGroup>
        <ButtonGroup label="Alignment">
          <Button size="small">Left</Button>
          <Button size="small">Centre</Button>
          <Button size="small">Right</Button>
        </ButtonGroup>
      </Specimen>

      <Specimen
        id="fields"
        title="Field"
        summary="A label, a control, a hint and an error, wired: the label names the control, the hint and the error describe it, an error marks it invalid. Required is a word, never a lone red star. A placeholder is never the label."
        layout="grid"
        usage={`
<Field label="Part number" hint="As printed on the reel." required>
  <Input technical value={value} onChange={…} />
</Field>
<Field label="Value" error="Needs a unit: Ω, kΩ or MΩ.">
  <QuantityField unit="kΩ" value={…} />
</Field>`}
      >
        <Field label="Part number" hint="As printed on the reel." required>
          <Input technical value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Resistance" error="Needs a value between 1 Ω and 10 MΩ.">
          <QuantityField unit="kΩ" defaultValue="0" />
        </Field>
        <Field label="Package" optional>
          <Select defaultValue="0805" options={[{ value: "0603", label: "0603" }, { value: "0805", label: "0805" }, { value: "1206", label: "1206" }]} />
        </Field>
        <Field label="Address" hint="Where the server listens.">
          <InputGroup>
            <Addon>https://</Addon>
            <Input technical defaultValue="id.innoventa.net" />
            <Button>Test</Button>
          </InputGroup>
        </Field>
        <Field label="Readonly">
          <Input readOnly value="sha256:4f1c…a92b" technical />
        </Field>
        <Field label="Disabled">
          <Input disabled value="Not editable here" />
        </Field>
        <Field label="Notes" hint="Markdown is kept as written.">
          <TextArea defaultValue="Astable at 1.2 kHz; duty 66%." />
        </Field>
        <Field label="Labels" hint="Enter or a comma adds one; Backspace takes the last back.">
          <ChipInput values={labels} onValuesChange={setLabels} placeholder="Add a label" />
        </Field>
      </Specimen>

      <Specimen
        id="form"
        title="Form from a definition"
        summary="One renderer for every place a field appears: the builder's preview, the live form, a settings page. A field is data — its kind, label, hint, options — and the form engine hands in what it decided: hidden, the options, the errors in words. Here the kind decides the value field: it only shows for a resistor."
        layout="column"
        usage={`
const sections: FormFieldsSection[] = [{ title: "Part", fields: [
  { name: "number", kind: "text", label: "Part number", technical: true, required: true },
  { name: "kind", kind: "choice", label: "Kind", presentation: "segmented", options: [...] },
  { name: "value", kind: "number", label: "Resistance", unit: "kΩ", hidden: values.kind !== "resistor" },
] }]
<FormFields sections={sections} values={values} onValuesChange={setValues} errors={engine.errorsOf(values)} />`}
      >
        <FormFields
          sections={partForm.map((section) => ({ ...section, fields: section.fields.map((field) => (field.name === "value" ? { ...field, hidden: formValues.kind !== "resistor" } : field)) }))}
          values={formValues}
          onValuesChange={setFormValues}
          errors={{ number: String(formValues.number ?? "").trim() ? undefined : "A part needs its number." }}
        />
      </Specimen>

      <Specimen id="inline-fields" title="Inline field and field row" summary="The label beside the control for settings and inspectors; fields side by side that fold to one column when the room runs out." layout="column">
        <Field label="Timeout" layout="inline" hint="Milliseconds before a request is abandoned.">
          <QuantityField unit="ms" defaultValue="3000" />
        </Field>
        <FieldRow>
          <Field label="Minimum"><QuantityField unit="V" defaultValue="3.0" /></Field>
          <Field label="Typical"><QuantityField unit="V" defaultValue="3.3" /></Field>
          <Field label="Maximum"><QuantityField unit="V" defaultValue="3.6" /></Field>
        </FieldRow>
      </Specimen>

      <Specimen id="search" title="Search field" summary="An icon inside, the shortcut printed while it is empty, a clear button once there is something to clear; Escape clears.">
        <SearchField label="Search parts" placeholder="Search parts, values, packages" value={query} onValueChange={setQuery} shortcut="/" />
      </Specimen>

      <Specimen id="choices" title="Checkbox, switch, radio group" summary="A checkbox is confirmed by a button; a switch takes effect the moment it is flipped. A radio group shows every option with its explanation; a strip of short options is a Segmented." layout="grid">
        <div className="showcase-stack" data-gap="tight">
          <Checkbox label="Include out-of-stock parts" defaultChecked />
          <Checkbox label="Only parts with a datasheet" description="Parts whose datasheet is attached." />
          <Checkbox label="Some files selected" indeterminate />
          <Checkbox label="Disabled" disabled />
        </div>
        <div className="showcase-stack" data-gap="tight">
          <Switch label="Notify me when a job finishes" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          <Switch label="Follow the system theme" description="Light by day, dark by night." defaultChecked />
          <Switch label="Disabled" disabled />
        </div>
        <RadioGroup
          legend="Search mode"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "hybrid", label: "Hybrid", description: "Words and meaning together." },
            { value: "lexical", label: "Lexical", description: "The words as typed." },
            { value: "semantic", label: "Semantic", description: "Close in meaning." },
          ]}
        />
      </Specimen>

      <Specimen id="segmented" title="Segmented, stepper, parameter" summary="Segmented: one of a few, arrow keys move. Stepper: a value along the only values it may take — here the E3 series. Parameter: the workbench slider with its symbol, unit, value and limits." layout="grid">
        <div className="showcase-stack" data-gap="tight">
          <Segmented label="Unit" value={unit} onValueChange={setUnit} options={[{ value: "Ω", label: "Ω" }, { value: "kΩ", label: "kΩ" }, { value: "MΩ", label: "MΩ" }]} />
          <Segmented label="Unit" tone="accent" size="small" value={unit} onValueChange={setUnit} options={[{ value: "Ω", label: "Ω" }, { value: "kΩ", label: "kΩ" }, { value: "MΩ", label: "MΩ" }]} />
        </div>
        <Stepper label="Resistance" value={resistance} onValueChange={setResistance} steps={standardResistances} format={(value) => `${value} kΩ`} />
        <Parameter label={<span className="kit-technical">f</span>} unit="kHz" value={frequency} onValueChange={setFrequency} minimum={0.1} maximum={5} step={0.1} format={(value) => value.toFixed(1)} showLimits />
      </Specimen>

      <Specimen id="labels" title="Kind, badge, tag, chip, status light" summary="Kind says what a thing is, neutral. Badge says a status, with a dot and a word. Tag is a topic. Chip is a filter that is on or off. A status light is a state as a word with a lamp.">
        <Kind>FORMULA</Kind>
        <Kind>CIRCUIT</Kind>
        <Badge>Draft</Badge>
        <Badge tone="accent">Selected</Badge>
        <Badge tone="good">In stock</Badge>
        <Badge tone="warn">Low</Badge>
        <Badge tone="danger">Out</Badge>
        <Badge tone="good" live>Running</Badge>
        <Tags>
          <Tag>timer</Tag>
          <Tag onRemove={() => undefined}>astable</Tag>
        </Tags>
        <div className="kit-chips">
          <Chip pressed={filters.inStock} count={128} onClick={() => setFilters({ ...filters, inStock: !filters.inStock })}>In stock</Chip>
          <Chip pressed={filters.smd} count={96} onClick={() => setFilters({ ...filters, smd: !filters.smd })}>SMD</Chip>
          <Chip pressed={filters.favourites} onClick={() => setFilters({ ...filters, favourites: !filters.favourites })}>Favourites</Chip>
        </div>
        <StatusLight tone="good" live>Running</StatusLight>
        <StatusLight tone="danger">Offline</StatusLight>
        <StatusLight>Stopped</StatusLight>
      </Specimen>

      <Specimen id="keys" title="Keys and avatars" summary="A shortcut is printed as keys, so it is learned by using the mouse. An avatar falls back to initials; its name is its alternative text.">
        <KeyChord keys="Ctrl+Shift+A" />
        <KeyChord keys="Shift+F10" />
        <kbd>/</kbd>
        <Avatar name="Ivan Hontarenko" size="small" />
        <Avatar name="Ivan Hontarenko" />
        <Avatar name="Raccoon Agent" size="large" />
      </Specimen>
    </div>
  )
}

import { useEffect, useMemo, useState } from "react"
import {
  Badge,
  Button,
  Checkbox,
  Code,
  Field,
  FieldRow,
  Input,
  PageHeader,
  Panel,
  Parameter,
  Segmented,
  Select,
  Table,
  Tabs,
  useAppearance,
  useToast,
  type Mode,
} from "@jmouse/ui-kit"
import { parts } from "../fixtures"
import { partColumns } from "./Data"

/* ---------- the model: what a theme file holds ---------- */

const shapeKeys = [
  ["density", "Density", 0.75, 1.25, 0.025, ""],
  ["text", "Body text", 11, 16, 0.5, "px"],
  ["radius-small", "Radius · option", 0, 8, 1, "px"],
  ["radius-control", "Radius · control", 0, 12, 1, "px"],
  ["radius-surface", "Radius · surface", 0, 16, 1, "px"],
  ["radius-dialog", "Radius · dialog", 0, 20, 1, "px"],
  ["control", "Control height", 24, 44, 1, "px"],
  ["control-small", "Small control", 20, 36, 1, "px"],
  ["row", "Row", 26, 48, 1, "px"],
  ["row-dense", "Dense row", 20, 40, 1, "px"],
  ["rail", "Rail width", 180, 300, 4, "px"],
  ["inspector", "Inspector width", 260, 420, 4, "px"],
] as const

type ShapeKey = (typeof shapeKeys)[number][0]

const colourKeys = [
  ["bg", "Page ground"],
  ["surface", "Surface"],
  ["surface-2", "Surface, a step below"],
  ["well", "Well"],
  ["ink", "Ink"],
  ["secondary", "Secondary text"],
  ["muted", "Muted text"],
  ["line", "Hairline"],
  ["line-strong", "Control border"],
  ["accent-base", "Accent"],
  ["on-accent", "On the accent"],
  ["good-base", "Good"],
  ["warn-base", "Warn"],
  ["danger-base", "Danger"],
] as const

type ColourKey = (typeof colourKeys)[number][0]

const fonts = [
  ["Inter, system-ui, sans-serif", "Inter"],
  ["Onest, Inter, system-ui, sans-serif", "Onest"],
  ["Manrope, Inter, system-ui, sans-serif", "Manrope"],
  ['"IBM Plex Sans", Inter, system-ui, sans-serif', "IBM Plex Sans"],
  ['"JetBrains Mono", ui-monospace, monospace', "JetBrains Mono"],
] as const

interface GeneratedTheme {
  name: string
  shape: Record<ShapeKey, number>
  borderWidth: number
  band: number
  font: string
  intensity: number
  /** 0 = ruled; up to 1 = a soft shadow under every surface */
  elevation: number
  primaryIsInk: boolean
  followsPalette: boolean
  colours: Record<Mode, Record<ColourKey, string>>
}

/* ---------- reading a shipped theme as the starting point ---------- */

function toHexadecimal(value: string): string {
  const probe = document.createElement("span")
  probe.style.color = value
  document.body.append(probe)
  const channels = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0]
  probe.remove()
  return "#" + channels.slice(0, 3).map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")
}

/** Reads a theme's own values by dressing a hidden region in it — the values as the files wrote them. */
function readTheme(name: string): GeneratedTheme {
  const read = (mode: Mode) => {
    const region = document.createElement("div")
    region.dataset.theme = name
    region.dataset.mode = mode
    region.style.cssText = "position:absolute;visibility:hidden"
    document.body.append(region)
    const style = getComputedStyle(region)
    const values = {
      colours: Object.fromEntries(colourKeys.map(([key]) => [key, toHexadecimal(style.getPropertyValue(`--kit-${key}`).trim() || "#000")])) as Record<ColourKey, string>,
      shape: Object.fromEntries(shapeKeys.map(([key]) => [key, Number(style.getPropertyValue(`--kit-shape-${key}`)) || 0])) as Record<ShapeKey, number>,
      border: parseFloat(style.getPropertyValue("--kit-border-width")) || 1,
      band: parseFloat(style.getPropertyValue("--kit-band")) || 3,
      font: style.getPropertyValue("--kit-font-ui").trim(),
      intensity: Number(style.getPropertyValue("--kit-intensity")) || 1,
      primaryIsInk: style.getPropertyValue("--kit-primary-fill").trim() === style.getPropertyValue("--kit-ink").trim(),
    }
    region.remove()
    return values
  }
  const light = read("light")
  const dark = read("dark")
  return {
    name: `${name}-custom`,
    shape: light.shape,
    borderWidth: light.border,
    band: light.band,
    font: fonts.find(([stack]) => light.font.startsWith(stack.split(",")[0]))?.[0] ?? fonts[0][0],
    intensity: light.intensity,
    elevation: 0,
    primaryIsInk: light.primaryIsInk,
    followsPalette: true,
    colours: { light: light.colours, dark: dark.colours },
  }
}

/* ---------- writing the file ---------- */

function slugOf(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom"
}

function colourBlock(theme: GeneratedTheme, mode: Mode): string[] {
  const colours = theme.colours[mode]
  const dark = mode === "dark"
  const accent = theme.followsPalette ? `var(--kit-palette-on-${mode}, ${colours["accent-base"]})` : colours["accent-base"]
  const shadowColour = dark ? "#000000" : colours.ink
  const lines = [
    `  color-scheme: ${mode};`,
    ...colourKeys.filter(([key]) => key !== "accent-base").map(([key]) => `  --kit-${key}: ${colours[key]};`),
    `  --kit-accent-base: ${accent};`,
    `  --kit-accent-strong-towards: ${dark ? "#ffffff" : "#000000"};`,
    `  --kit-scrim: color-mix(in srgb, ${dark ? "#000000" : colours.ink} ${dark ? 70 : 50}%, transparent);`,
    `  --kit-shadow-color: ${shadowColour};`,
    `  --kit-shadow-pop: 0 12px 32px -12px color-mix(in srgb, ${shadowColour} ${dark ? 60 : 25}%, transparent), 0 1px 2px color-mix(in srgb, ${shadowColour} ${dark ? 40 : 10}%, transparent);`,
  ]
  if (theme.elevation > 0) {
    const strength = Math.round(theme.elevation * (dark ? 60 : 22))
    lines.push(`  --kit-shadow-surface: 0 1px 2px color-mix(in srgb, ${shadowColour} ${Math.round(strength / 3)}%, transparent), 0 ${Math.round(2 + theme.elevation * 6)}px ${Math.round(8 + theme.elevation * 16)}px -8px color-mix(in srgb, ${shadowColour} ${strength}%, transparent);`)
  }
  if (theme.primaryIsInk) {
    lines.push(`  --kit-primary-fill: var(--kit-ink);`, `  --kit-primary-fill-hover: var(--kit-accent);`, `  --kit-on-primary: ${colours.bg};`)
  }
  return lines
}

function serializeTheme(theme: GeneratedTheme): string {
  const name = slugOf(theme.name)
  return [
    `/* ${theme.name} — made with the jMouse UI-kit theme generator. Import it after @jmouse/ui-kit/styles.css and add`,
    `   { name: "${name}", label: "${theme.name}" } to the catalogue handed to <AppearanceProvider themes={…}>. */`,
    `[data-theme="${name}"] {`,
    ...shapeKeys.map(([key]) => `  --kit-shape-${key}: ${theme.shape[key]};`),
    `  --kit-border-width: ${theme.borderWidth}px;`,
    `  --kit-band: ${theme.band}px;`,
    `  --kit-font-ui: ${theme.font};`,
    `  --kit-intensity: ${theme.intensity};`,
    ...colourBlock(theme, "light"),
    `}`,
    ``,
    `[data-theme="${name}"][data-mode="dark"] {`,
    ...colourBlock(theme, "dark"),
    `}`,
    ``,
  ].join("\n")
}

/* ---------- the page ---------- */

export function ThemeGeneratorSection() {
  const { themes } = useAppearance()
  const toast = useToast()
  const [start, setStart] = useState("parallax")
  const [theme, setTheme] = useState<GeneratedTheme>(() => readTheme("parallax"))
  const [editMode, setEditMode] = useState<Mode>("light")
  const [previewMode, setPreviewMode] = useState<Mode>("light")
  const [view, setView] = useState("preview")
  const css = useMemo(() => serializeTheme(theme), [theme])
  const slug = slugOf(theme.name)

  // The generated file is live: an unlayered <style> beats the kit's own layers, exactly as a product's theme does.
  useEffect(() => {
    const style = document.createElement("style")
    style.dataset.generatedTheme = ""
    style.textContent = css
    document.head.append(style)
    return () => style.remove()
  }, [css])

  function update(change: Partial<GeneratedTheme>) {
    setTheme((current) => ({ ...current, ...change }))
  }

  function updateShape(key: ShapeKey, value: number) {
    setTheme((current) => ({ ...current, shape: { ...current.shape, [key]: value } }))
  }

  function updateColour(key: ColourKey, value: string) {
    setTheme((current) => ({ ...current, colours: { ...current.colours, [editMode]: { ...current.colours[editMode], [key]: value } } }))
  }

  function download() {
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([css], { type: "text/css" }))
    link.download = `${slug}.css`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="showcase-stack">
      <PageHeader
        title="Theme generator"
        description="Start from a shipped theme, move its spacing, borders, radii, heights, type, colours of both modes and shadows, and take the result as a theme file — the same file a product writes by hand."
        actions={
          <>
            <Button icon="copy" onClick={async () => { await navigator.clipboard.writeText(css); toast.show({ title: "Theme copied", tone: "good", description: `${slug}.css` }) }}>Copy CSS</Button>
            <Button variant="primary" icon="download" onClick={download}>Download {slug}.css</Button>
          </>
        }
      />
      <div className="showcase-generator">
        <div className="showcase-generator-controls">
          <Panel title="Start" headingLevel={2}>
            <div className="showcase-stack" data-gap="tight">
              <Field label="Start from">
                <Select value={start} onChange={(event) => { setStart(event.target.value); setTheme(readTheme(event.target.value)) }} options={themes.map((candidate) => ({ value: candidate.name, label: candidate.label }))} />
              </Field>
              <Field label="Name" hint={`The file is ${slug}.css; the attribute is data-theme="${slug}".`}>
                <Input value={theme.name} onChange={(event) => update({ name: event.target.value })} />
              </Field>
            </div>
          </Panel>

          <Panel title="Shape">
            <div className="showcase-stack" data-gap="tight">
              {shapeKeys.map(([key, label, minimum, maximum, step, unit]) => (
                <Parameter key={key} label={label} unit={unit} value={theme.shape[key]} minimum={minimum} maximum={maximum} step={step} onValueChange={(value) => updateShape(key, value)} format={(value) => (step < 1 ? value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") : String(value))} />
              ))}
              <Parameter label="Border width" unit="px" value={theme.borderWidth} minimum={0.5} maximum={3} step={0.5} onValueChange={(value) => update({ borderWidth: value })} />
              <Parameter label="Selection band" unit="px" value={theme.band} minimum={1} maximum={6} step={1} onValueChange={(value) => update({ band: value })} />
            </div>
          </Panel>

          <Panel title="Type and character">
            <div className="showcase-stack" data-gap="tight">
              <Field label="Interface typeface">
                <Select value={theme.font} onChange={(event) => update({ font: event.target.value })} options={fonts.map(([stack, label]) => ({ value: stack, label }))} />
              </Field>
              <Parameter label="Colour intensity" value={theme.intensity} minimum={0.2} maximum={1} step={0.02} onValueChange={(value) => update({ intensity: value })} format={(value) => `${Math.round(value * 100)}%`} />
              <Parameter label="Surface shadow" value={theme.elevation} minimum={0} maximum={1} step={0.05} onValueChange={(value) => update({ elevation: value })} format={(value) => (value === 0 ? "ruled" : `${Math.round(value * 100)}%`)} />
              <Checkbox label="The primary action is filled with ink" description="Raccoon's «ink acts, tone marks»." checked={theme.primaryIsInk} onChange={(event) => update({ primaryIsInk: event.target.checked })} />
              <Checkbox label="The palette axis may repaint the accent" checked={theme.followsPalette} onChange={(event) => update({ followsPalette: event.target.checked })} />
            </div>
          </Panel>

          <Panel title="Colours" actions={<Segmented<Mode> label="Mode being edited" size="small" value={editMode} onValueChange={(value) => { setEditMode(value); setPreviewMode(value) }} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />}>
            <div className="showcase-colours">
              {colourKeys.map(([key, label]) => (
                <label key={key} className="showcase-colour">
                  <input type="color" value={theme.colours[editMode][key]} onChange={(event) => updateColour(key, event.target.value)} />
                  <span>{label}</span>
                  <code className="kit-technical">{theme.colours[editMode][key]}</code>
                </label>
              ))}
            </div>
          </Panel>
        </div>

        <div className="showcase-generator-output">
          <div className="showcase-row">
            <Tabs id="generator-view" label="Output" variant="strip" value={view} onValueChange={setView} items={[{ value: "preview", label: "Preview" }, { value: "css", label: `${slug}.css` }]} />
            <span className="kit-toolbar-push" />
            <Segmented<Mode> label="Preview mode" size="small" value={previewMode} onValueChange={setPreviewMode} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </div>
          {view === "preview" ? (
            <div className="showcase-generator-preview" data-theme={slug} data-mode={previewMode}>
              <div className="showcase-row">
                <Button variant="primary" icon="play">Run</Button>
                <Button>Default</Button>
                <Button variant="quiet">Quiet</Button>
                <Button tone="danger" icon="trash">Delete</Button>
                <Badge tone="good">Running</Badge>
                <Badge tone="warn">Low</Badge>
                <Badge tone="danger">Out</Badge>
              </div>
              <FieldRow>
                <Field label="Part number" hint="As printed on the reel."><Input technical defaultValue="NE555" /></Field>
                <Field label="Package" error="Pick a package."><Select defaultValue="" options={[{ value: "", label: "—" }, { value: "dip8", label: "DIP-8" }]} /></Field>
              </FieldRow>
              <Panel title="Parts" meta={parts.length} flush>
                <Table label="Parts" columns={partColumns.slice(0, 5)} rows={parts.slice(0, 5)} rowKey={(part) => part.id} selectedKey="p2" onRowSelect={() => undefined} />
              </Panel>
            </div>
          ) : (
            <Code code={css} label={`${slug}.css`} />
          )}
        </div>
      </div>
    </div>
  )
}

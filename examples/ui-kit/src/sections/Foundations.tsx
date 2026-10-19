import { Badge, Button, Facts, Icon, iconPaths, Notice, PageHeader, Segmented, useAppearance, type IconName } from "@jmouse/ui-kit"
import { Specimen } from "../Specimen"

const colourTokens = [
  ["--kit-bg", "page ground"],
  ["--kit-surface", "panels, fields"],
  ["--kit-surface-2", "a step below a surface"],
  ["--kit-well", "inset: strips, readonly"],
  ["--kit-ink", "text"],
  ["--kit-secondary", "secondary text"],
  ["--kit-muted", "labels, metadata"],
  ["--kit-line", "hairlines"],
  ["--kit-line-strong", "control borders"],
  ["--kit-accent", "derived: selection, focus, one action"],
  ["--kit-accent-soft", "derived: selected ground"],
  ["--kit-good", "derived: status"],
  ["--kit-warn", "derived: status"],
  ["--kit-danger", "derived: status"],
  ["--kit-canvas", "derived: code, instruments"],
  ["--kit-change-modified", "derived: a changed file"],
] as const

const typeScale = [
  ["--kit-text-3xl", "28"],
  ["--kit-text-2xl", "23 · page title"],
  ["--kit-text-xl", "19 · dialog title"],
  ["--kit-text-lg", "16 · section"],
  ["--kit-text-md", "14"],
  ["--kit-text-base", "13 · body"],
  ["--kit-text-sm", "12 · controls, tables"],
  ["--kit-text-xs", "11 · hints"],
  ["--kit-text-2xs", "10 · micro-labels"],
] as const

export function OverviewSection() {
  return (
    <div className="showcase-stack">
      <PageHeader
        eyebrow={<span className="kit-micro-label">@jmouse/ui-kit · 0.1.0</span>}
        title="jMouse UI-kit"
        description="One token vocabulary, themes as plain CSS files, the appearance axes, and every component the jMouse products draw with — taken once from Burin, Parallax, Raccoon and Kitsu, so a new product composes what is already here."
      />
      <Specimen
        id="install"
        title="Wiring a product"
        summary="Import the stylesheet once, before the product's own; wrap the application in the appearance and toast providers; put the boot script in the page's head so the stored theme is on <html> before the first paint."
        layout="column"
        usage={`
// main.tsx
import "@jmouse/ui-kit/styles.css"
import "./themes/my-theme.css"            // optional: a theme of the product's own
import { AppearanceProvider, ToastProvider, standardThemes } from "@jmouse/ui-kit"

const themes = [...standardThemes, { name: "my-theme", label: "My theme", scheme: "dark" }]

createRoot(root).render(
  <AppearanceProvider storagePrefix="my-product" themes={themes}>
    <ToastProvider>
      <App />
    </ToastProvider>
  </AppearanceProvider>,
)

// index.html <head> — generated once with appearanceBootScript("my-product", themes)
<script>/* … */</script>`}
      >
        <Facts
          facts={[
            { label: "Package", value: "@jmouse/ui-kit", technical: true },
            { label: "Peer dependencies", value: "react, react-dom — nothing else", technical: true },
            { label: "Styles", value: "plain CSS in @layer jmouse-ui-kit; every product rule wins without !important" },
            { label: "Class names", value: "kit-*; state as attributes — data-variant, data-tone, aria-pressed", technical: true },
            { label: "Tokens", value: "--kit-*; a host's own --accent or --border never collides", technical: true },
            { label: "Domain components", value: "stay in their own packages — the oscilloscope in @jmouse/parallax-react" },
          ]}
        />
      </Specimen>
      <Specimen id="rules" title="Rules that keep the products one family" summary="The kit encodes these; a screen built from it keeps them without trying." layout="column">
        <Facts
          layout="stacked"
          facts={[
            { label: "One filled action per screen", value: "Primary is the accent as a fill. Everything else is outlined or quiet." },
            { label: "Selection is a band, never a border", value: "A 3px accent band inside the row or the item, on the accent-soft ground." },
            { label: "Status is never colour alone", value: "Every tone carries an icon and a word; a badge has a dot and a label." },
            { label: "Lines before shadows", value: "Surfaces are ruled. A shadow belongs to what floats: a menu, a dialog, a toast — or to the Surfaces axis." },
            { label: "Figures are a band", value: "Key numbers sit in one ruled strip, never as floating metric cards." },
            { label: "Technical values are tabular", value: "Identifiers, quantities and paths are in the data face with tabular figures." },
          ]}
        />
      </Specimen>
    </div>
  )
}

export function ThemesSection() {
  const { choice, mode, themes, change } = useAppearance()
  return (
    <div className="showcase-stack">
      <PageHeader title="Themes and tokens" description="A theme is a product's whole look in one CSS file — its spacing, borders, radii, heights, typefaces and colours — and every theme has a light and a dark mode. The mode is chosen on its own; the other axes adjust a theme without replacing it." />
      <Specimen
        id="themes"
        title="Themes, each in both modes"
        summary="Each preview is a region wearing a theme and a mode — the same attributes work on <html> and on any element, which is how a rail stays dark on a light page. Look at the corners, the control heights and the primary action: those are the theme too. Graphite is not in the kit: the showcase defines it in its own file, as a product would."
        layout="column"
        usage={`
/* themes/graphite.css — imported after @jmouse/ui-kit/styles.css */
[data-theme="graphite"] {                       /* the shape and the LIGHT colours */
  color-scheme: light;
  --kit-shape-density: 0.95;  --kit-shape-text: 13;
  --kit-shape-radius-small: 1; --kit-shape-radius-control: 2; --kit-shape-radius-surface: 3; --kit-shape-radius-dialog: 4;
  --kit-shape-control: 30;    --kit-shape-control-small: 24; --kit-shape-row: 34;
  --kit-border-width: 1px;    --kit-band: 3px;
  --kit-font-ui: Manrope, Inter, system-ui, sans-serif;

  --kit-bg: #ecebe8; --kit-surface: #f9f8f6; --kit-surface-2: #f2f1ee; --kit-well: #e4e2de;
  --kit-ink: #1d1c20; --kit-secondary: #45434a; --kit-muted: #6d6a72;
  --kit-line: #d6d3ce; --kit-line-strong: #9a968f;
  --kit-accent-base: var(--kit-palette-on-light, #a8610c);   /* follows the palette axis */
  --kit-good-base: #2e7a52; --kit-warn-base: #96590c; --kit-danger-base: #b23a32;
  /* … scrim, shadows, on-accent */
}
[data-theme="graphite"][data-mode="dark"] {     /* the DARK colours */
  color-scheme: dark;
  --kit-bg: #17161a; --kit-surface: #1f1e22; /* … every colour role again */
}

/* and one line in the catalogue */
const themes = [...standardThemes, { name: "graphite", label: "Graphite" }]`}
      >
        <div className="showcase-themes">
          {themes.flatMap((theme) =>
            (["light", "dark"] as const).map((previewMode) => (
              <div key={theme.name + previewMode} className="showcase-theme" data-theme={theme.name} data-mode={previewMode} aria-current={choice.theme === theme.name && mode === previewMode ? "true" : undefined}>
                <div className="showcase-theme-head">
                  <strong>{theme.label}</strong>
                  <span className="kit-micro-label">{previewMode}</span>
                </div>
                <div className="showcase-row">
                  <Button variant="primary" size="small" onClick={() => { change("theme", theme.name); change("mode", previewMode) }}>Use</Button>
                  <Button size="small">Default</Button>
                </div>
                <div className="showcase-row">
                  <Badge tone="good">Running</Badge>
                  <Badge tone="warn">Low</Badge>
                  <Badge tone="danger">Failed</Badge>
                </div>
                <span className="kit-technical kit-secondary">R1 · 10 kΩ · 0805</span>
              </div>
            )),
          )}
        </div>
      </Specimen>
      <Specimen id="theme-axis" title="Switching" summary="The theme and the mode are two choices: the quick switch every product puts in its settings; the full set of axes is the appearance dialog." >
        <Segmented label="Theme" value={choice.theme} onValueChange={(value) => change("theme", value)} options={themes.map((theme) => ({ value: theme.name, label: theme.label }))} />
        <Segmented label="Mode" value={choice.mode} onValueChange={(value) => change("mode", value as "light" | "dark" | "system")} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </Specimen>
      <Specimen id="colour" title="Colour roles" summary="Read live from the theme in force. A page names a role, never a literal; a role that does not exist yet is added here first." layout="column">
        <div className="showcase-swatches">
          {colourTokens.map(([token, role]) => (
            <div key={token} className="showcase-swatch" style={{ ["--showcase-color" as string]: `var(${token})` }}>
              <span aria-hidden="true" />
              <span>
                <code>{token}</code>
                <span className="showcase-caption" data-block="">{role}</span>
              </span>
            </div>
          ))}
        </div>
        <Notice tone="accent" title="Status is never colour alone">Every tone also carries an icon and a word — the swatches are for the people writing themes, not a vocabulary of meaning by colour.</Notice>
      </Specimen>
      <Specimen id="type" title="Type" summary="Interface face for words, data face for values. The scale moves with the Interface size axis; Density never touches type." layout="column">
        <div className="showcase-type-scale">
          {typeScale.map(([token, note]) => (
            <div key={token}>
              <span className="showcase-caption kit-technical">{note}</span>
              <span style={{ fontSize: `var(${token})` }}>Resistor network R1–R8 · 4.7 kΩ</span>
            </div>
          ))}
        </div>
      </Specimen>
      <Specimen id="icons" title="Icons" summary="One line set on a 24-unit grid, a 1.75 stroke in the colour of the text it sits in. Named for what they mean, not what they show." layout="column">
        <div className="showcase-swatches">
          {(Object.keys(iconPaths) as IconName[]).map((name) => (
            <div key={name} className="showcase-row">
              <Icon name={name} />
              <code className="showcase-caption kit-technical">{name}</code>
            </div>
          ))}
        </div>
      </Specimen>
    </div>
  )
}

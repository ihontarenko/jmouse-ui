# `@jmouse/markdown` — a plugin-driven Markdown renderer and editor

A self-contained Markdown stack. It knows CommonMark, two block shapes, and nothing else.

Everything beyond that — diagrams, maths, live data, applets, syntax highlighting, every toolbar
button, every dialog, every endpoint it talks to — arrives as a **plugin you construct and hand in**.
There is no `enableJme` flag, no hard-coded API path, no imported design system. Configure it, don't
fork it.

```json
"@jmouse/markdown": "github:ihontarenko/jmouse-markdown#v0.1.0"
```

A **git dependency**, deliberately: no registry account, no publish step in CI, no `.npmrc` token in
every consuming repository — and the version is a tag, which is the property that actually matters,
because the failure this package exists to end is *"which copy is current"*. `npm i` runs `prepare`,
which builds `dist/`; the repository never commits one.

## Entry points

| Specifier | Holds |
|---|---|
| `@jmouse/markdown` | the engine, the host bindings, and every plugin below |
| `@jmouse/markdown/plugins` | the shipped plugins alone — callouts, code, data blocks, inserts, pickers, prose, Mermaid |
| `@jmouse/markdown/jme` | the applet block — separate because it needs an evaluator endpoint to be useful |
| `@jmouse/markdown/wavedrom` | timing diagrams — ⚠️ separate because the renderer pulls `wavedrom` and `json5` |
| `@jmouse/markdown/styles.css` | the one stylesheet, imported explicitly |

⚠️ **The last two subpaths are the whole reason there are subpaths.** A bundler resolves even a
*dynamic* import at build time, so one entry point would make every consumer install two electronics
libraries to render a document that never mentions one.

**Peers, not dependencies:** React, `react-markdown`, CodeMirror 6, `remark-gfm`, `remark-math`,
`rehype-katex`, `mermaid`. Two Reacts in one bundle is a hook-rules crash whose message names none of
this. `wavedrom` and `json5` are **optional** peers, needed only by that entry point.

## A host adapter

The library depends on nothing but its peers. What a product supplies — its UI kit, its resources, its
evaluator, its live blocks — is a *host adapter*, and it stays in the product: see Innoventa's
`src/components/ui/markdown/`, about 400 lines, most of it lists.

---

## The idea

```
                 ┌──────────── plugins you pass in ────────────┐
document ──►  parse  ──►  resolve  ──►  render                 │
              (claimed  (each plugin  (each plugin draws       │
               names)    batches its   its own blocks)         │
                         own data)                             │
                 └─────────────────────────────────────────────┘
```

A plugin may fill any subset of six slots, and they are orthogonal:

| Slot | What it contributes |
|---|---|
| `claims` | the `:::name` / `;;;name` constructs it owns |
| `renderBlock` | how one of its blocks draws |
| `useBlockData` | one batched fetch for every block it claims in the document |
| `prose` | remark/rehype plugins, element overrides, a source pre-pass |
| `actions` + `triggers` | toolbar buttons and the prefixes that open them |
| `editorExtensions` / `useEditorExtensions` | CodeMirror grammars, keymaps, themes |

Syntax nobody claims stays prose. Drop a plugin and its construct quietly turns back into text
instead of breaking the document — which is what makes one document portable across products.

---

## Rendering

```tsx
import { MarkdownRenderer, gfmPlugin, mathPlugin, mermaidPlugin, calloutPlugin } from '@jmouse/markdown';

// Build the list once. It must be stable across renders — module scope, or useMemo.
const PLUGINS = [gfmPlugin(), mathPlugin(), mermaidPlugin(), calloutPlugin()];

export function Article({ markdown }: { markdown: string }) {
    return <MarkdownRenderer markdown={markdown} plugins={PLUGINS} context={undefined} className="prose"/>;
}
```

That is a complete, working renderer: tables, `$$maths$$`, `;;;mermaid` diagrams and `:::note`
callouts. No provider, no configuration, no network.

### `context`

Ambient information every plugin receives on each render — the host decides what it means. Innoventa
passes the *surface* a document is being read on (in-app, public share, inert preview), which is how
one plugin list serves an authenticated page and a signed-out one:

```tsx
const context = useMemo(() => ({ signedIn }), [signedIn]);   // keep it stable!
<MarkdownRenderer markdown={markdown} plugins={PLUGINS} context={context}/>
```

Keeping it stable matters: plugins memoise their per-context configuration, and a context rebuilt
every render would rebuild an evaluator every render.

---

## Editing

The editor needs one more thing: **your widgets**. It ships no buttons, inputs or modals — its dialogs
ask the host for them, so they inherit your themes and never drift into a second design system.

```tsx
import {
    MarkdownEditor, MarkdownUiProvider, FORMAT_ACTION_IDS, PREVIEW_TOGGLE_ACTION,
    TOOLBAR_SPACER, rowToggle, linkPlugin, tablePlugin,
} from '@jmouse/markdown';

const PLUGINS = [...READER_PLUGINS, linkPlugin(), tablePlugin()];

const TOOLBAR = [
    ['link', 'table', rowToggle('format', '✎ Format'), TOOLBAR_SPACER, PREVIEW_TOGGLE_ACTION],
    { id: 'format', hidden: true, actions: FORMAT_ACTION_IDS },
];

<MarkdownUiProvider kit={MY_UI_KIT}>
    <MarkdownEditor
        value={content}
        onChange={setContent}
        plugins={PLUGINS}
        context={context}
        toolbar={TOOLBAR}
        preview={{ className: 'prose' }}
    />
</MarkdownUiProvider>
```

### The toolbar is names, not components

Rows list **action ids**. Plugins contribute actions without knowing where they will sit; you arrange
rows without knowing how any action works. A name with no registered action is skipped silently, so
one layout survives across products with different plugin sets.

`FORMAT_ACTIONS` (bold, italic, headings, lists, quote, code) are built in — they need no plugin,
because they need no knowledge beyond "this is Markdown".

### The UI kit

Seven components, each a thin translation from the library's small prop shape to yours:

```tsx
const MY_UI_KIT: MarkdownUiKit = {
    Modal:    ({ title, width, onClose, footer, tabBar, children }) => …,
    Button:   ({ variant, disabled, onClick, children }) => …,
    Input:    ({ value, onChange, placeholder, type, autoFocus, ariaLabel }) => …,
    Select:   ({ value, onChange, options }) => …,
    Textarea: ({ value, onChange, rows, placeholder }) => …,
    Tabs:     ({ value, onChange, tabs }) => …,
    Field:    ({ label, hint, children }) => …,
};
```

Only dialogs need it. A read-only `MarkdownRenderer` never asks.

---

## The colour contract

The stylesheets are layout only. **Every colour, radius and typeface is a custom property the host
defines**, under the library's own `--markdown-` namespace:

```css
:root {
    --markdown-paper: …;   --markdown-ink: …;     --markdown-accent: …;      --markdown-r: …;
    --markdown-paper-2: …; --markdown-ink-2: …;   --markdown-accent-soft: …; --markdown-r-md: …;
    --markdown-line: …;    --markdown-ink-3: …;   --markdown-teal: …;
                           --markdown-ink-4: …;   --markdown-danger: …;      --markdown-font-mono: …;
                                                  --markdown-warn: …;        --markdown-font-sans: …;
                                                  --markdown-ok: …;
}
```

Plus one optional: `--markdown-editor-height`, which the editor falls back to `60vh` for. Right for a
full-page editor, absurd for a description field — set it per surface.

⚠️ **The namespace is the whole point, and it was bought with a bug.** The library used to read the
host's own names — `--accent`, `--paper`, `--ink-3` — which worked in the product it was written in and
nowhere else: `--accent` is the brand colour in one design system and a *subtle fill* in shadcn's, so a
consumer bridging it by redefining `--accent` in a scope repainted its own ghost buttons. Under
Tailwind v4 it cannot even be re-pointed, because `@theme inline` compiles `bg-accent` to a literal
`var(--accent)`. A name nobody else owns has nothing to collide with.

Map them with `var()` rather than by value, so a themed host re-resolves them for free:

```css
:root { --markdown-accent: var(--primary); --markdown-line: var(--border); … }
```

---

## Configuring the shipped plugins

### The applet plugin — point it at your evaluator

```ts
import { jmePlugin, fetchEvaluator } from '@jmouse/markdown/jme';

// Declaratively, from a URL that takes { code, variables } and answers { mode, result }:
jmePlugin({ evaluator: () => fetchEvaluator('/api/jme/execute') })

// Or through your own client, so it inherits auth and token refresh:
jmePlugin({
    evaluator: (context) => context.signedIn ? privateEvaluator : publicEvaluator,
})
```

The endpoint is the whole configuration. `resolveInput` exists as a full override for a host that
insists on drawing the controls itself, and is rarely what you want — the document already says what
each input is.

#### The block

Bindings above a `---`, the expression below it:

```
;;;jme
$voltage:numeric:"Supply voltage, V"
$tap:select(Low,1;High,2):"Winding tap"
$note:text:"Anything"
$urgent:boolean:"Rush order"
$when:date:"Needed by"
---
(voltage * tap) ~ ' V'
;;;
```

A binding line is **`$alias:type[(options)][:"title"]`** — the name the expression uses, the kind of
input to draw, and an optional quoted title for the label. Drop the `---` and the whole body is code
with no inputs.

| Type | Draws | Sends |
|---|---|---|
| `numeric` | a number box | a number |
| `select(Low,1;High,2)` | a dropdown | the chosen key, as a number when it reads as one |
| `text` | a text box | the string as typed |
| `boolean` | a checkbox | `true` / `false` |
| `date` | a date picker | the ISO string |

⚠️ **A binding whose type is not one of the five is a visible error in the block, and the block
evaluates nothing.** Not a silent text box: an applet that keeps working after its declaration stopped
meaning what it says is how somebody ships a page whose numbers are wrong. A calculator is better off
loudly broken.

Options are `label,key` pairs separated by `;`, split at the **last** comma — so a label may contain
one (`Low, tap 1,1`), and may not contain `;` or `)`.

⚠️ **`boolean` and `select` start answered** — unchecked is `false`, and a dropdown starts on its first
option. Every other type waits for the reader before the block evaluates at all.

### Pickers — a URL and a mapper

Anything a dialog can reach outside the document goes through one small port: a name and a search
function. `httpResource` is the declarative half.

```ts
import { httpResource, imageInsertPlugin, linkPlugin, matchesQuery } from '@jmouse/markdown';

const IMAGES = httpResource({
    id:    'files',
    label: 'From files',
    url:   (query) => `/api/files?search=${encodeURIComponent(query)}`,
    map:   (payload) => payload.items.map((file) => ({
        id: file.id, label: file.name, value: file.url, kind: file.mimeType,
    })),
});

// Or hand over a function, when you already have a client worth using:
const PAGES = {
    id: 'pages', label: 'Pages',
    search: async (query) => (await pagesApi.list(undefined, query)).data.map(toItem),
};

imageInsertPlugin({ sources: [IMAGES] });
linkPlugin({ sources: [PAGES] });
```

Items are the only thing the library ever sees — never a payload, an endpoint, or a client.

### Live data blocks — a loader and a renderer

```tsx
import { dataBlockPlugin, promiseLoader } from '@jmouse/markdown';

dataBlockPlugin({
    directives: ['stock', 'part', 'bom'],
    load:       promiseLoader((requests) => fetch('/api/blocks/resolve', {
                    method: 'POST', body: JSON.stringify(requests),
                }).then((response) => response.json())),
    render:     ({ block, data, status }) => …,
});
```

`promiseLoader` refetches only when the *set of blocks* changes, so typing prose around a `:::stock`
doesn't hit the network. Already have React Query? Pass your own hook as `load` instead — that's the
contract, and it's what Innoventa does so the editor's live preview reuses resolved blocks.

### Highlighting — bring your own

```ts
codeHighlightPlugin({
    highlight: async (language, code) => myHighlighter(language, code) ?? null,
});
```

Without it, fenced code renders plain. That's a legitimate choice, not a degraded one.

---

## Writing a plugin

A plugin is a plain object. A factory function gives it its configuration.

**A block that renders itself:**

```tsx
export function tweetPlugin(options: { theme: 'light' | 'dark' }) {
    return {
        name:        'tweet',
        claims:      [{ shape: 'line', name: 'tweet' }],   // :::tweet <id>
        renderBlock: ({ block }) => <Tweet id={block.body} theme={options.theme}/>,
    };
}
```

**A block that fetches, batched across the whole document:**

```tsx
export function weatherPlugin(options: { endpoint: string }) {
    return {
        name:   'weather',
        claims: [{ shape: 'line', name: 'weather' }],       // :::weather Kyiv
        useBlockData(blocks) {
            const cities = blocks.map((block) => block.body);
            const { data, loading } = useMyFetch(options.endpoint, cities);
            return useMemo(() => ({
                byKey:  index(data),                         // keyed by blockKey(block)
                status: loading ? 'loading' : 'ready',
            }), [data, loading]);
        },
        renderBlock: ({ data, status }) => …,
    };
}
```

**A toolbar dialog:**

```tsx
dialogActionPlugin({
    id: 'emoji', label: '🙂 Emoji', title: 'Insert an emoji',
    dialog: ({ insert, close }) => <EmojiPicker onPick={(emoji) => insert(emoji)} onClose={close}/>,
});
```

**A typing trigger** — `:::` opening a palette is just an action plus a pattern:

```ts
blockPickerPlugin({ blocks: MY_PALETTE, trigger: /^:::$/ });
```

`blocks` is a value, so it can come from the server. Innoventa fetches the set its workspace can
actually resolve and rebuilds the plugin list when it arrives, which keeps the palette from offering
blocks that would only ever render a miss. Note that this narrows **writing**, not reading — the
parser must keep recognising every construct a document might already contain, so the renderer's
directive list stays static on purpose.

The matched text becomes a range, so what the dialog inserts *replaces* the prefix rather than
stacking a second one after it.

---

## Two rules

1. **The plugin list must be stable across renders.** Build it at module scope or memoise it. The
   library mounts one provider per data-bearing plugin, so a list that changes shape between renders
   changes hook order.
2. **The `context` object must be stable too**, for the same reason — see above.

Both are the ordinary React contract for anything hook-shaped; they are called out because breaking
them fails at runtime rather than at compile time.

---

## What's in the box

| | |
|---|---|
| **Engine** | `MarkdownRenderer`, `MarkdownEditor`, `CodeSurface`, `parseMarkdown`, `buildRegistry` |
| **Prose** | `gfmPlugin`, `mathPlugin`, `externalLinkPlugin`, `imagePlugin`, `codeHighlightPlugin` |
| **Blocks** | `calloutPlugin`, `youtubePlugin`, `mermaidPlugin`, `wavedromPlugin`, `dataBlockPlugin`, `jmePlugin` |
| **Authoring** | `blockPickerPlugin`, `snippetPickerPlugin`, `linkPlugin`, `imageInsertPlugin`, `tablePlugin`, `dialogActionPlugin` |
| **Host bindings** | `MarkdownUiProvider`, `httpResource`, `ResourcePicker` |

## Block syntax

| Shape | Example | Claimed by |
|---|---|---|
| `:::name argument` | `:::note Check the footprint.` | any plugin claiming `{ shape: 'line' }` |
| `;;;name` … `;;;` | a `;;;mermaid` diagram | any plugin claiming `{ shape: 'fence' }` |

Both are ignored inside fenced code, so documentation can *show* the syntax without it being
evaluated. Anything unclaimed is prose.

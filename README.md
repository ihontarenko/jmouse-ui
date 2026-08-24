# jmouse-ui

The shared frontend packages for **Innoventa**, **Tessera** and **Kiwi** — one npm workspaces
monorepo, a sibling checkout beside `Git/jmouse` (the JVM half) and `Git/jMouseProjects` (the
products).

Moneta and Central are **not** consumers: they are on a different stack and are deliberately left
alone. ⚠️ **Identity is one of exactly one package** — it takes `@jmouse/codemirror`, which needs no
React, and nothing else; the render layer stays out of it on purpose.

```
packages/
├─ ui/          @jmouse/ui         primitives, the theme mechanism, cn   ← built
├─ files/       @jmouse/files      the file composites                   ← built
├─ codemirror/  @jmouse/codemirror the .jmp and jME grammars and the
│                                  editor/static machinery around them   ← built
├─ access-ui/   @jmouse/access-ui  headless access client                (INVT-0049)
├─ ai-ui/       @jmouse/ai-ui      headless AI-administration client     (INVT-0049)
└─ markdown/    @jmouse/markdown   moved here from its own repo          (INVT-0048 batch D)
```

## ⚠️ Not every consumer is on the render layer

`@jmouse/ui` is React, and `@jmouse/codemirror`'s **root** deliberately is not — there is not a
component, a hook or a `react` import in it. That is what lets **Identity** and Innoventa's legacy
interface, neither of which takes the render layer, drop their copies of the grammars too. Five copies
of the `.jmp` scanner is what that package was extracted to end; three would have been a worse answer
than one.

It splits into entry points **by what each makes you install**, not by topic:

| Entry | What it costs you |
|---|---|
| `.` | the tags and the two grammars |
| `./highlight` | the palette and the static renderer |
| `./editor` | `@codemirror/view` |
| `./markdown` | `@codemirror/lang-markdown` |
| `./palettes` · `./themes` | the six syntax palettes · the seventeen imported code themes |
| `./react` | ⚠️ **React** — the picker and the hooks, and the only thing in the package that asks |

So a host showing one policy on one screen is never made to install an editor for it, and Identity
never installs React to get a tokenizer.

⚠️ **`./styles.css` is not optional.** It carries the nineteen `--syntax-*` tokens, six palettes deep
and light/dark each, and a host that forgets to import it gets no syntax colour at all — a failure that
reads as a broken highlighter rather than as a missing stylesheet. It names **both** dark selectors,
`.dark` and the legacy interface's `.theme-dark`.

## What "shared" has come to mean here

Two rules, learned the expensive way and worth stating before the next extraction:

1. ⚠️ **A product-local variant of something the library already answers is a defect, not
   configuration.** Innoventa kept its own syntax palette because it looked like a defensible product
   choice; what it actually was, was the same file rendering two ways in two products, and it took
   somebody looking at a screen to catch it (`UIK-12`).
2. ⚠️ **Extract the mechanism, leave the drawing.** The tab-mark painter is `@jmouse/ui`'s
   (`themedFaviconPainter`); the chevrons, the diamond and the leaves stay in their products beside the
   `public/favicon.svg` each has to match (`UIK-15`). Copying the whole file would have been a third
   copy of the mechanism and the wrong glyph.

## Why a registry and not `github:#tag`

⚠️ **npm cannot install a subdirectory of a git repository** — there is no subdir selector. The
existing `github:ihontarenko/jmouse-markdown#v0.2.0` pattern works only because that repository's root
*is* the package, so a workspaces monorepo cannot be consumed that way at all. Publishing goes to
**npmjs, publicly, under the `@jmouse` scope** — GitHub Packages demands a token even for public
packages, which is friction on every new machine.

Each package carries **its own version**; there is no shared tag.

## Working on it

```bash
npm install          # once, at the root — workspaces link the packages to each other
npm run build        # every package
npm run typecheck
```

While a package and its consumer are being changed together, link rather than publish:

```bash
cd packages/ui && npm link
cd ../../../jMouseProjects/Tessera/UI && npm link @jmouse/ui
```

⚠️ **A consumer pins a version and never tracks `main`.** The friction of "one change, one version, one
bump in three products" is real and was accepted knowingly — `npm link` is what makes it bearable
during active work.

Tracked by `INVT-0047` in Tessera.

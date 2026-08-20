# jmouse-ui

The shared frontend packages for **Innoventa**, **Tessera** and **Kiwi** — one npm workspaces
monorepo, a sibling checkout beside `Git/jmouse` (the JVM half) and `Git/jMouseProjects` (the
products).

Moneta, Central and Identity are **not** consumers: they are on a different stack and are deliberately
left alone.

```
packages/
├─ ui/          @jmouse/ui        primitives, the theme mechanism, cn   ← built
├─ access-ui/   @jmouse/access-ui headless access client                (INVT-0049)
├─ ai-ui/       @jmouse/ai-ui     headless AI-administration client     (INVT-0049)
└─ markdown/    @jmouse/markdown  moved here from its own repo          (INVT-0048 batch D)
```

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

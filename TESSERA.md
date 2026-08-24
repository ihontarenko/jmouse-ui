# Tessera — jMouse UI

> Project-specific notes for the `tessera` skill. The tracker is the record; this file is notes.
> Fix it in the same response as any call that contradicts it.
> Verified: 2026-08-20

## Project

- **Key** `UIK` — every issue in it reads `UIK-<n>` forever; the key cannot be changed.
- **Name** `jMouse UI` — this is the `scope` argument, verbatim. ⚠️ Not `UIK`.
- **Lead** `SU`
- **Board** every open issue (`planning: board`)
- **Sprints** not used
- **Story points** used — `storyPoints` was accepted on `UIK-11`, so set the field on every issue as well as writing the Effort table.

## What this project is for

⚠️ **The shared render layer, and nothing that belongs to one product.** `@jmouse/ui` and
`@jmouse/markdown` are consumed by Innoventa, Tessera and Kiwi; a change here lands in all three at
once, which is exactly why it needs a tracker of its own rather than living in whichever product
noticed first.

| The work is… | Project |
|---|---|
| a primitive behaves wrongly in all three | `UIK` |
| a new shared part — a row, an empty state, a confirmation | `UIK` |
| a theme token, a palette, the font scale, contrast | `UIK` |
| one Innoventa screen looks wrong | `INVT` |
| a Tessera board lost a column | `TSSR` |
| a Kiwi page editor misbehaves | `KW` |

⚠️ **A product ticket may carry a workaround for a `UIK` defect** — that is normal and is how the
product ships without waiting. What it must do is link the `UIK` issue, so the workaround has
somewhere to be removed from.

## Naming the parts

⚠️ **Use the names from Innoventa's `/ui-kit` screen** (`Innoventa/FE/src/pages/ui-kit/`). Every
specimen there carries a short slug — `row/carded`, `callout/warning`, `confirm-in-place`,
`page-header` — and a ticket names that. "The grey pill thing on the right" is a ticket nobody can
verify.

That screen is Innoventa's for now and the names are the product's. Moving it into this repository is
its own decision and its own ticket.

## Issue types

Read from `projects_get` / an `issues_create` refusal before the first raise — the catalogue is
installation-wide, so it is the same one `INVT` uses:

| Type | Used for |
|---|---|
| `Epic` | a cluster — extracting a family, a theme overhaul |
| `Story` | ordinary work on the packages |
| `Task` | work with no visible surface |
| `Bug` | a defect |
| `UI changes` | a defect that is purely visual or layout — verified 2026-08-20 on `UIK-17` |
| `Papercut` | a small defect that annoys rather than breaks |
| `Nit` | a tidy-up, a rename, a stale comment |

⚠️ **Always pass `type` explicitly** — never take the project's default. The question it turns on is
*was something wrong?*: yes and visual → `UI changes`, yes and small → `Papercut`, yes otherwise →
`Bug`, no → `Nit` or `Story`.

## Statuses and the path through them

`To Do` → `WIP` → `In Review` → `Done`, with `Parked` and `Draft` beside the path.

- ⚠️ The in-flight status is **`WIP`**, not "In Progress".
- Finishing is **two transitions**. Read `canMoveTo` before each.

## Resolutions

`Done`, `Won't Do`, `Duplicate`, `Cannot Reproduce`.

## Mirror

`/.tessera/` — **at this repository's root**, one file per issue, named for the key.

- Git: ⚠️ this root **is** the repository root, so the mirror lands in `git status` unless ignored.
  `/.tessera/` is in `.gitignore`.

## Prose that belongs to this project

- `README.md` at this root.
- ⚠️ Nothing under `.scratch/` yet. A grilling about the render layer would go to
  `jMouseProjects/.scratch/jmouse-ui-<feature>/`, since that directory is shared across products.

## Local notes

- **Four packages, one repository**: `packages/ui` (`@jmouse/ui`), `packages/files` (`@jmouse/files`),
  `packages/markdown` (`@jmouse/markdown`) and `packages/codemirror` (`@jmouse/codemirror`). npm
  workspaces, published publicly to npmjs.
- ⚠️ **`@jmouse/codemirror`'s root has no React in it**, which is the whole reason it is not a folder
  inside `@jmouse/ui`: Identity and Innoventa's legacy interface consume it without taking the render
  layer. React lives behind one entry point, `./react` (the palette/code-theme picker and its hooks),
  and is an **optional** peer. It is also the only package here carrying its own tests — the `.jmp`
  grammar's 25, which moved with the grammar rather than staying behind in the product that happened
  to have written them.
- ⚠️ **`@jmouse/ui` owns the tab-mark mechanism, not the mark.** `themedFaviconPainter` reads the
  computed `--primary` / `--primary-foreground` and hangs a data URI on the one `rel="icon"`; each
  product supplies its own glyph beside the `public/favicon.svg` it has to match (`UIK-15`).
- ⚠️ **A git-tag install cannot reach a subdirectory** — this is why the packages are published rather
  than consumed from the repository.
- ⚠️ Four things fail **silently** when wiring a consumer: Tailwind's `@source`, `tsc` not being a
  bundler, peer dependencies, and `ThemeProvider`'s required properties.

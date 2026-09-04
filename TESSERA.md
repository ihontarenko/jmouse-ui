# Tessera — jMouse UI

> Project-specific notes for the `tessera` skill. The tracker is the record; this file is notes.
> Fix it in the same response as any call that contradicts it.
> Verified: 2026-08-31

## Project

- **Key** `UIK` — every issue in it reads `UIK-<n>` forever; the key cannot be changed.
- **Name** `jMouse UI` — this is the `scope` argument, verbatim. ⚠️ Not `UIK`.
- **Lead** `SU`
- **Board** every open issue (`planning: board`)
- **Sprints** not used
- **Story points** used — `storyPoints` was accepted on `UIK-11`, so set the field on every issue as well as writing the Effort table.

## What this project is for

⚠️ **The shared render layer, and nothing that belongs to one product.** `@jmouse/ui` is consumed by
Innoventa, Tessera and Kiwi; a change here lands in all three at once, which is exactly why it needs a
tracker of its own rather than living in whichever product noticed first.

⚠️ **`@jmouse/markdown` is NOT `UIK` — it is the `Markdown` project (`MD`)**, mirrored at
`jMouseProjects/.tessera/MD/`. This file claimed it until 2026-08-26; the tracker disagrees and the
tracker is the record — `MD-7` is a `frontmatterPlugin` fix and `MD-1` is the hub that made the package
shared. A ticket about the markdown package raised in `UIK` is a ticket filed away from its six
siblings.

| The work is… | Project |
|---|---|
| a primitive behaves wrongly in all three | `UIK` |
| a new shared part — a row, an empty state, a confirmation | `UIK` |
| a theme token, a palette, the font scale, contrast | `UIK` |
| anything inside `packages/markdown` — a plugin, the renderer, the editor | `MD` |
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

- **Eight packages, one repository**: `packages/ui` (`@jmouse/ui`), `packages/files` (`@jmouse/files`),
  `packages/markdown` (`@jmouse/markdown`), `packages/codemirror` (`@jmouse/codemirror`),
  `packages/avatars` (`@jmouse/avatars`), `packages/query` (`@jmouse/query`), `packages/pwa`
  (`@jmouse/pwa`) and `packages/validation` (`@jmouse/validation`). npm workspaces, published
  publicly to npmjs.
- ⚠️ **`@jmouse/validation` implements none of the `.jmv` language, and that is the rule to check in
  a review here.** Rows go to the server and come back as text; text goes out and comes back as rows.
  A browser that wrote the language would be a second implementation of it, and the two would disagree
  the first time somebody wrote a message containing an apostrophe. Its Rules tab is a read-only
  outline with a per-statement dialog for editing (`UIK-56`) — a page of inline inputs was what it
  replaced.
- ⚠️ **Tailwind does not re-scan `node_modules` while a consuming Vite server is running.** Rebuild a
  package and the product picks up the new JS at once but not a class the stylesheet has never seen —
  the page renders with a utility silently missing, which reads as a markup bug. Restart the consumer's
  dev server after any rebuild that introduces a new class.
- ⚠️ **`@jmouse/pwa` is the first package here that is not a render layer**, and the first with an
  entry a **bundler never touches**: `@jmouse/pwa/vite` is imported by a product's `vite.config.ts`,
  which Vite hands to Node. So its relative imports carry a `.js` extension while every other
  package's do not — remove them and the plugin throws `ERR_MODULE_NOT_FOUND` for its own sibling
  module, at the moment a product first configures its build and nowhere earlier. This is the same
  family of trap as "tsc is not a bundler" below, arriving from the other direction.
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

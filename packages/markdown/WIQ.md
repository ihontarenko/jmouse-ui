# WiQ — jmouse-markdown

> Project-specific notes for the `wiq` skill. WiQ is the record; this file is notes.
> Fix it in the same response as any call that contradicts it.
> Verified: 2026-08-18

## Where this codebase writes

- **Section** `projects/markdown/documents-2` — the `scope` argument, verbatim.
  ⚠️ **Send the slug, not the display path.** `categories_tree` reports older sections with a
  title-cased path (`Projects/WiQ/Documents/ADR`) and newer ones with their slug; `Projects/Markdown/Documents`
  is refused with `UNKNOWN_SCOPE` and the slug list. Read the refusal, it names the right one.
- ⚠️ **`-2` is a slug collision, not a mistake.** The section is called *Documents*; `projects/wiq/documents`
  already existed and slugs are unique. There is no rename over the protocol and the page address does
  not contain it, so it costs nothing — do not create a third section to make it prettier.
- **Addressing** slug + short hash — `writing-a-page-the-markdown-manual-e041e0`.

## Mirror

`.wiq/` at this repository's root — one file per page, named for the address.

- Git: **ignored** via `/.wiq/` in `.gitignore`. ⚠️ This repository *is* the root, unlike the products
  under `jMouseProjects/`, so the mirror is not untracked for free.

## Pages that matter

- `writing-a-page-the-markdown-manual-e041e0` — **the manual**. Every construct the library ships,
  written *live* rather than in code fences: callouts, Mermaid, maths, live blocks and three `;;;jme`
  applets — one of which is deliberately broken to show what an unknown input type does.
  ⚠️ It doubles as a rendering test. If the library breaks a construct, this page shows it.

## Local notes

- ⚠️ The manual's applets only compute when **Innoventa** is up: they post to its public evaluator at
  `POST /api/public/jme/execute`, named by the `jme` row in WiQ's *Administration → Live blocks*.
  With Innoventa down the blocks still render their inputs and say the product did not respond.

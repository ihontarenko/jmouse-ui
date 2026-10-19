# designs/

A product's screens rebuilt from `@jmouse/ui-kit` alone, one directory per product (`burin/`, later `raccoon/`,
`kitsu/`, `parallax/`, `innoventa/`). Each is the proof that the kit carries that product's look — its theme file and
its components — and the reference a product's migration is compared against.

They are not workspaces and not examples of the kit's API (that is `examples/ui-kit`, the component showcase): each
reads the kit's SOURCE through Vite aliases, so a change in the kit shows at once, and resolves its dependencies through
the monorepo root's `node_modules`.

| Directory | Port | Rebuilds |
|---|---|---|
| `burin/` | 5122 | `Html/Burin/editor.html` — the editor screen |

Run one with `npm run dev` inside its directory.

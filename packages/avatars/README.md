# `@jmouse/avatars`

Generated avatars: eight drawing strategies, one descriptor token, zero dependencies.

```ts
import { buildSVG, decodeToken, encodeToken, STRATEGIES } from "@jmouse/avatars"

const markup = buildSVG("avatar.1.blob-buddy.ivan.eyJodWUiOjI2NX0=", 64)
```

The React picker is a second entry point, `@jmouse/avatars/picker`. Only it costs you React.

## The token

```
avatar.1.<strategy>.<url-encoded seed>.<base64 parameters>
```

The prefix is a full word and the version is its own segment. The seed is url-encoded, which is what
makes the dot a safe separator — a seed is an arbitrary string and may well contain one.

⚠️ **A bare value with no dots is a legacy seed and stays valid forever.** Three products stored bare
seeds before this package existed; those decode into the `pixel-classic` strategy and draw exactly the
face they always drew. That is not a transitional kindness — it is why adopting this package changes
nobody's avatar.

## The strategies

| id | What it draws |
|---|---|
| `pixel-face` | a 16×16 face assembled from features |
| `meme-face` | a doodle, drawn with a wobbling line |
| `pixel-creature` | a cellular automaton that grows something with eyes |
| `blob-buddy` | a jelly creature with a gradient and however many eyes |
| `initials` | one or two letters on a gradient tile |
| `identicon` | the classic mirrored hash grid |
| `kaleido` | a mandala, built by rotating one element |
| `pixel-classic` | ⚠️ the pre-package generator, preserved verbatim |

## Two things worth knowing before changing anything

**A strategy declares its controls; the picker reads that declaration.** Nothing in the React layer
knows what a hairstyle is. Walk `strategy.controls`, render four widget shapes, write the values into
the descriptor's `parameters`. A ninth strategy is one file, not three.

**⚠️ The palettes are fixed, and deliberately not the theme's.** An avatar has to look the same to
everybody looking at it. Drawing it from theme tokens would render your face in my colours on my board,
which is the one thing an identity mark may not do — and it is why this package carries colour values
when `@jmouse/ui` carries none.

## Adding a strategy

One file in `src/strategies/`, exporting a `Strategy`: an `id` that is never renamed because it is
stored data, a `name` and `tag` for the chip, a `controls` declaration, and a `draw` that returns marks
plus a viewBox. Then one line in `src/strategies/index.ts`, whose order is what the picker shows.

⚠️ **Never change what an existing `id` draws.** That is not a refactor, it is changing what a stored
token means. A better pixel face is a new id.

## The picker

```tsx
import { AvatarPickerDialog, Avatar, type AvatarChoice } from "@jmouse/avatars/picker"

<Avatar source={member.avatarPreset} className="size-8 rounded-full [&>svg]:size-full" size={null} />

<AvatarPickerDialog
  open={open}
  onOpenChange={setOpen}
  value={member.avatarPreset}
  seedHint={member.displayName}
  pictureSource={<MyCropper … />}
  pictureReady={picture !== null}
  saving={isSaving}
  onSubmit={(choice: AvatarChoice) => { /* your API call */ }}
/>
```

⚠️ **The dialog never calls an API.** It reports a choice — `generated` with a token, `picture`, or
`initials` — and the product saves it. Three products have three routes, three error shapes and three
cache invalidations; a dialog that knew any of them could not be shared, which is how there came to be
three of it. The picture source is a slot for the same reason: the cropper belongs to whoever owns the
upload.

⚠️ **Both dialog panels stay mounted**, the inactive one hidden. Swapping them would unmount the
product's picture panel on every tab glance and throw away a half-cropped image.

⚠️ **Tailwind has to be told to scan this package**, or every class below ships unstyled and nothing
warns you:

```css
@source "../node_modules/@jmouse/avatars";
```

### Copy

All strings are English, matching all three interfaces. `labels` on the dialog overrides any of them,
which is the escape hatch for a product with its own translation layer — the alternative being that it
forks the dialog to translate it, which is what this package exists to prevent.

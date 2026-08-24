/**
 * ⚠️ **The generator that existed before this package, preserved so that nobody's face changes.**
 *
 * Every product used to carry its own copy of this file, and what was stored was a bare seed. Those
 * values are live in three databases. `pixel-face` next door draws a different face from the same seed
 * — it assembles features procedurally on a 16x16 grid, where this one composes hand-drawn ASCII parts
 * on a 12x12 one — so adopting the new engine without this module would silently redraw everybody.
 *
 * ⚠️ **The drawing code below is byte-identical to the copy it came from, and must stay that way.**
 * Improving it is not a refactor: it is changing what a stored seed means. A better pixel face belongs
 * in a new strategy with a new id, which costs one file and breaks nothing.
 *
 * Its original documentation follows.
 */

/**
 * Hand-drawn pixel faces, assembled by seed.
 *
 * A seed is a string; a face is what this module makes of it. The mapping is a pure function, so the
 * same seed is the same face on every screen, forever, with nothing stored but the string itself —
 * which is why a chosen face costs one short column and no bytes at all.
 *
 * ⚠️ **The parts are drawn, not generated.** Everything below is pixel art written as ASCII: a head
 * shape, a pair of eyes, a mouth, a thing on top. What the seed picks is the combination, never the
 * pixels. Noise-generated identicons are the alternative and they look like noise — a face reads as a
 * face because somebody placed the eyes. Editing one is editing the string art in place, and adding a
 * variant is appending one entry; nothing else in this module knows how many there are.
 *
 * ⚠️ **The palette is fixed, and deliberately not the theme's.** An avatar is somebody's identity, so
 * it has to look the same to everybody looking at it. Drawing it from theme tokens would mean your face
 * renders in my colours on my board, which is the one thing an identity mark may not do.
 */

/** Every glyph a layer may use. `.` means "leave whatever is underneath showing". */
type Ink = "." | "#" | "%" | "o" | "@" | "m" | "t" | "h" | "A" | "B"

/** The grid is square and small on purpose: 12 pixels is enough for a face and too few for a portrait. */
const GRID = 12

// ── The parts ────────────────────────────────────────────────────────────────────────────────────
//
//  # skin      % skin, shaded      h hair/brow      o eye white      @ pupil/ink
//  m mouth     t tooth             A accent         B accent, shaded

/**
 * Skulls. Everything else is drawn over one of these, so they define where the face has room.
 *
 * ⚠️ **Every one of them stops short of the edge, and that is the point.** They used to run the full
 * twelve columns, so the circular mask cropped all six to the same disc and the shape choice was
 * invisible — six heads that drew one head. Kept inside columns 1–10, the silhouette survives the mask
 * and a domed skull reads as a different creature from a pointed one.
 */
const HEADS: string[][] = [
  // round
  [
    "............",
    "...######...",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "...######...",
    "............",
    "............",
  ],
  // tall
  [
    "...######...",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "...######...",
    "............",
  ],
  // blocky, with ears
  [
    "............",
    "..########..",
    "..########..",
    "..########..",
    ".%########%.",
    ".%########%.",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "............",
    "............",
  ],
  // wide
  [
    "............",
    "............",
    ".##########.",
    ".##########.",
    ".##########.",
    ".##########.",
    ".##########.",
    ".##########.",
    ".##########.",
    "..########..",
    "............",
    "............",
  ],
  // pointed chin
  [
    "............",
    "...######...",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "...######...",
    "...######...",
    "....####....",
    "............",
    "............",
  ],
  // domed cranium
  [
    "............",
    "..########..",
    ".##########.",
    ".##########.",
    "..########..",
    "..########..",
    "..########..",
    "..########..",
    "...######...",
    "...######...",
    "............",
    "............",
  ],
]

/**
 * Eyes. Rows 4–5, and a pupil is always one pixel inside three of white.
 *
 * ⚠️ **Never a solid block of white over a solid block of dark.** That was the first attempt and at
 * this size it reads as a bar rather than an eye — half the faces looked blindfolded. Three white
 * pixels and one dark one is the smallest arrangement that still says "there is something looking at
 * you", and it is why every variant below keeps white beside its pupil rather than under it.
 */
const EYES: string[][] = [
  // wide
  [
    "............",
    "............",
    "............",
    "............",
    "...oo..oo...",
    "...o@..@o...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // beady
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "....@..@....",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // winking
  [
    "............",
    "............",
    "............",
    "............",
    "...oo.......",
    "...o@..hh...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // cyclops
  [
    "............",
    "............",
    "............",
    "....oooo....",
    "....o@@o....",
    "....oooo....",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // a third one, on the forehead
  [
    "............",
    "............",
    ".....oo.....",
    ".....o@.....",
    "...oo..oo...",
    "...o@..@o...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // patched
  [
    "............",
    "............",
    "............",
    "....BBBBBB..",
    "...oo..BB...",
    "...o@..BB...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // furious
  [
    "............",
    "............",
    "............",
    "...hh..hh...",
    "...oo..oo...",
    "...o@..@o...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // sleepy
  [
    "............",
    "............",
    "............",
    "............",
    "...hh..hh...",
    "...oo..oo...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // spectacled
  [
    "............",
    "............",
    "............",
    "..AAAAAAAA..",
    "...oo..oo...",
    "...o@..@o...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // cross-eyed
  [
    "............",
    "............",
    "............",
    "............",
    "...oo..oo...",
    "...@o..o@...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
]

/**
 * Mouths. Rows 6–8, and four pixels wide unless there is a reason.
 *
 * ⚠️ **Six was too wide.** A mouth spanning half the face is the only thing anybody saw, and it made
 * every expression read as the same grimace. Four leaves the eyes room to carry the character.
 */
const MOUTHS: string[][] = [
  // smiling
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "...m....m...",
    "....mmmm....",
    "............",
    "............",
    "............",
  ],
  // frowning
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "....mmmm....",
    "...m....m...",
    "............",
    "............",
    "............",
  ],
  // grinning
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "....mmmm....",
    "....tttt....",
    "............",
    "............",
    "............",
  ],
  // one tooth
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "....mmmm....",
    ".....t......",
    "............",
    "............",
    "............",
  ],
  // unimpressed
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "....mmmm....",
    "............",
    "............",
    "............",
  ],
  // astonished
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    ".....mm.....",
    ".....mm.....",
    "............",
    "............",
    "............",
  ],
  // tongue out
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "....mmmm....",
    ".....AA.....",
    "............",
    "............",
    "............",
  ],
  // moustachioed
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "...hhhhhh...",
    "............",
    "....mmmm....",
    "............",
    "............",
    "............",
  ],
  // smirking
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "......m.....",
    "....mm......",
    "............",
    "............",
    "............",
  ],
  // worried
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "...m.m.m....",
    "............",
    "............",
    "............",
  ],
]

/** Whatever is going on above the eyebrows. The first is nothing, and nothing is a valid look. */
const HEADGEAR: string[][] = [
  // bare
  [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // antenna
  [
    ".....AA.....",
    ".....BB.....",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // tinfoil
  [
    ".....AA.....",
    "....AAAA....",
    "...AAAAAA...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // headphones
  [
    "...AAAAAA...",
    "..A......A..",
    ".A........A.",
    ".AA......AA.",
    ".AA......AA.",
    ".AA......AA.",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // beanie
  [
    "............",
    "...AAAAAA...",
    "..AAAAAAAA..",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // mohawk
  [
    "....hhhh....",
    "....hhhh....",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // propeller
  [
    "..AA....AA..",
    ".....BB.....",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // halo
  [
    "...AAAAAA...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
  // horns
  [
    "..A......A..",
    "..AA....AA..",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ],
]

// ── The palette ──────────────────────────────────────────────────────────────────────────────────

/**
 * Skin. Pastels rather than realistic tones, because a face this size has no room for shading and
 * because a colour is doing the work of telling two people apart at 28 pixels wide.
 */
const SKINS = [
  "#7BD4A3", "#F5A97F", "#A0C4FF", "#FFD6A5", "#CDB4DB", "#FFADAD",
  "#9BF6FF", "#BDB2FF", "#FDFFB6", "#CAFFBF", "#FFC6FF", "#E4C1F9",
]

/** Everything that is not skin: hats, glasses, antennae, tongues. Saturated, to sit against the skin. */
const ACCENTS = [
  "#FF6B6B", "#4ECDC4", "#FFE66D", "#F72585", "#4CC9F0", "#B5179E", "#F77F00", "#06D6A0",
]

/** The one dark value in the whole palette. Every outline, pupil and mouth is this. */
const INK = "#1D1F2B"

const WHITE = "#FFFFFF"

/** How far each derived colour sits from its source, towards the ink. */
const SHADE_TOWARDS_INK = 0.25
const HAIR_TOWARDS_INK = 0.62
const ACCENT_SHADE_TOWARDS_INK = 0.35
const BACKGROUND_TOWARDS_INK = 0.74

// ── Making a face ────────────────────────────────────────────────────────────────────────────────

/** One horizontal run of identical pixels — the unit a face is actually drawn in. */
export interface FaceRun {
  x: number
  y: number
  width: number
  fill: string
}

export interface PixelFace {
  /** Every drawn run, top-left to bottom-right. */
  runs: FaceRun[]
  /** The disc behind the face. */
  background: string
  /** Grid width and height, and the SVG viewBox this face is drawn in. */
  size: number
}

/**
 * A 32-bit hash of a seed string (FNV-1a).
 *
 * Not a cryptographic choice and does not need to be — what matters is that visually similar seeds
 * ("owl-1", "owl-2") land far apart, which any avalanche gives, and that the result never changes,
 * which is why the constants are written down rather than imported.
 */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return hash
}

/**
 * Pulls independent choices out of one hash.
 *
 * Mulberry32 — small, fast, and with a period long past anything a face needs. The point is that six
 * successive calls give six unrelated numbers, so a seed whose hash happens to be even does not end up
 * with a correlated head and mouth.
 */
function sequenceFrom(hash: number): () => number {
  let state = hash

  return () => {
    state = (state + 0x6d2b79f5) >>> 0

    let drawn = Math.imul(state ^ (state >>> 15), 1 | state)
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn

    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296
  }
}

/** Blends `color` towards `towards` by `amount`, both as `#rrggbb`. */
function mix(color: string, towards: string, amount: number): string {
  const from = parseInt(color.slice(1), 16)
  const to = parseInt(towards.slice(1), 16)

  const blend = (shift: number) => {
    const left = (from >> shift) & 0xff
    const right = (to >> shift) & 0xff

    return Math.round(left + (right - left) * amount)
  }

  const blended = (blend(16) << 16) | (blend(8) << 8) | blend(0)

  return `#${blended.toString(16).padStart(6, "0")}`
}

/** Draws `layer` over `canvas`, where a `.` in the layer leaves what is underneath. */
function overlay(canvas: Ink[][], layer: string[]): void {
  layer.forEach((row, y) => {
    for (let x = 0; x < GRID; x += 1) {
      const glyph = row[x] as Ink

      if (glyph && glyph !== ".") {
        canvas[y][x] = glyph
      }
    }
  })
}

/**
 * The face a seed draws.
 *
 * Runs rather than pixels: a 12x12 face is 144 cells but only around thirty horizontal runs, and a
 * board rendering forty of these cares about the difference.
 */
export function pixelFace(seed: string): PixelFace {
  const next = sequenceFrom(hashSeed(seed))

  const pick = <Item,>(items: Item[]): Item => items[Math.floor(next() * items.length) % items.length]

  const head = pick(HEADS)
  const eyes = pick(EYES)
  const mouth = pick(MOUTHS)
  const headgear = pick(HEADGEAR)
  const skin = pick(SKINS)
  const accent = pick(ACCENTS)

  const colorOf: Record<Exclude<Ink, ".">, string> = {
    "#": skin,
    "%": mix(skin, INK, SHADE_TOWARDS_INK),
    h: mix(skin, INK, HAIR_TOWARDS_INK),
    o: WHITE,
    t: WHITE,
    "@": INK,
    m: INK,
    A: accent,
    B: mix(accent, INK, ACCENT_SHADE_TOWARDS_INK),
  }

  const canvas: Ink[][] = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => "." as Ink))

  // Order is the drawing order: a skull, then a face on it, then a hat over both. Headgear last is what
  // lets a beanie sit on the forehead rather than behind it.
  overlay(canvas, head)
  overlay(canvas, eyes)
  overlay(canvas, mouth)
  overlay(canvas, headgear)

  const runs: FaceRun[] = []

  canvas.forEach((row, y) => {
    let x = 0

    while (x < GRID) {
      const glyph = row[x]

      if (glyph === ".") {
        x += 1
        continue
      }

      let width = 1

      while (x + width < GRID && row[x + width] === glyph) {
        width += 1
      }

      runs.push({ x, y, width, fill: colorOf[glyph as Exclude<Ink, ".">] })
      x += width
    }
  })

  return { runs, background: mix(skin, INK, BACKGROUND_TOWARDS_INK), size: GRID }
}

// ── Seeds ────────────────────────────────────────────────────────────────────────────────────────

const ADJECTIVES = [
  "grumpy", "sleepy", "cosmic", "rusty", "electric", "feral", "polite", "haunted",
  "smug", "boiled", "velvet", "radioactive", "tiny", "unhinged", "noble", "damp",
]

const CREATURES = [
  "toaster", "goblin", "hamster", "cactus", "wizard", "moth", "pelican", "gremlin",
  "octopus", "yeti", "raccoon", "narwhal", "beetle", "sasquatch", "penguin", "mushroom",
]

/**
 * The faces the picker offers.
 *
 * ⚠️ Curation, not a catalogue. Nothing validates a stored seed against this list — the generator is
 * total, so every string is a face and the backend checks only the shape of the value. What this array
 * decides is what somebody is shown, which means it can be reordered, trimmed or extended without a
 * migration and without invalidating anybody's existing choice.
 */
export const PRESET_SEEDS: string[] = [
  "grumpy-toaster", "cosmic-hamster", "rusty-goblin", "sleepy-cactus",
  "electric-wizard", "feral-moth", "polite-pelican", "haunted-gremlin",
  "smug-octopus", "boiled-yeti", "velvet-raccoon", "radioactive-narwhal",
  "tiny-beetle", "unhinged-sasquatch", "noble-penguin", "damp-mushroom",
  "grumpy-narwhal", "cosmic-beetle", "rusty-penguin", "sleepy-octopus",
  "electric-raccoon", "feral-toaster", "polite-goblin", "haunted-cactus",
  "smug-wizard", "boiled-moth", "velvet-pelican", "radioactive-gremlin",
  "tiny-yeti", "unhinged-hamster", "noble-mushroom", "damp-sasquatch",
]

/**
 * A seed nobody has been offered yet — what "roll another" hands out.
 *
 * Built from the same two word lists, plus a number, so it reads like the curated ones and satisfies
 * the shape the backend accepts. Collisions with an existing seed are fine and mean the same face,
 * which is the whole contract.
 */
export function rollSeed(): string {
  const from = (words: string[]) => words[Math.floor(Math.random() * words.length)]

  return `${from(ADJECTIVES)}-${from(CREATURES)}-${Math.floor(Math.random() * 900) + 100}`
}

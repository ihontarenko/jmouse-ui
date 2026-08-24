/**
 * The two ways these strategies put marks on a canvas: a pixel grid, and a smoothed vector ring.
 *
 * Both emit SVG source as a string rather than nodes. A string is what a token decodes into, what a
 * data URI carries, and what a React component can hand to `dangerouslySetInnerHTML` without owning a
 * DOM — which is what keeps this half of the package free of React entirely.
 */

import { roundToTenth, type RandomSource } from "./random"

// ── A pixel grid ─────────────────────────────────────────────────────────────────────────────────

/** A square grid of colours, `null` where nothing is drawn. */
export interface PixelGrid {
  size: number
  pixels: (string | null)[]
}

export function makeGrid(size: number): PixelGrid {
  return { size, pixels: new Array(size * size).fill(null) }
}

export function setPixel(grid: PixelGrid, x: number, y: number, color: string | null): void {
  if (x >= 0 && y >= 0 && x < grid.size && y < grid.size) {
    grid.pixels[y * grid.size + x] = color
  }
}

export function getPixel(grid: PixelGrid, x: number, y: number): string | null {
  if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) {
    return null
  }

  return grid.pixels[y * grid.size + x]
}

/**
 * Sets a pixel and its mirror image.
 *
 * ⚠️ Every face below is drawn on the left half only. Bilateral symmetry is what makes a random grid
 * read as a creature rather than as noise, and doing it here rather than in each strategy is what keeps
 * a strategy short enough to argue with.
 */
export function setMirroredPixel(grid: PixelGrid, x: number, y: number, color: string | null): void {
  setPixel(grid, x, y, color)
  setPixel(grid, grid.size - 1 - x, y, color)
}

/** A mirrored run along one row, both ends included. */
export function setMirroredRow(
  grid: PixelGrid,
  y: number,
  fromX: number,
  toX: number,
  color: string | null,
): void {
  for (let x = fromX; x <= toX; x += 1) {
    setMirroredPixel(grid, x, y, color)
  }
}

/**
 * The grid as SVG rectangles, one per horizontal run of identical colour.
 *
 * Runs rather than pixels: a 16x16 grid is 256 cells but around thirty runs, and a member list
 * rendering forty of these inline cares about the difference.
 */
export function gridToSvg(grid: PixelGrid): string {
  let markup = ""

  for (let y = 0; y < grid.size; y += 1) {
    let x = 0

    while (x < grid.size) {
      const color = grid.pixels[y * grid.size + x]

      if (!color) {
        x += 1
        continue
      }

      let width = 1

      while (x + width < grid.size && grid.pixels[y * grid.size + x + width] === color) {
        width += 1
      }

      markup += `<rect x="${x}" y="${y}" width="${width}" height="1" fill="${color}"/>`
      x += width
    }
  }

  return markup
}

// ── A vector ring ────────────────────────────────────────────────────────────────────────────────

/** A point, as the ring helpers pass it around. */
export type Point = [number, number]

function midpoint(first: Point, second: Point): Point {
  return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
}

/**
 * A closed path through `points`, rounded at every corner.
 *
 * Quadratic segments between successive midpoints, with each original point as the control: the curve
 * never passes through a vertex, so no amount of jitter can produce a spike. That is the whole reason a
 * blob stays a blob however hard the wobble is turned up.
 */
export function smoothPath(points: Point[]): string {
  const start = midpoint(points[points.length - 1], points[0])
  let path = `M ${roundToTenth(start[0])} ${roundToTenth(start[1])}`

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = midpoint(current, points[(index + 1) % points.length])

    path += ` Q ${roundToTenth(current[0])} ${roundToTenth(current[1])} ${roundToTenth(next[0])} ${roundToTenth(next[1])}`
  }

  return path + " Z"
}

/** `count` points around an ellipse, each pushed in or out by up to `jitter` of the radius. */
export function ringPoints(
  random: RandomSource,
  count: number,
  radiusX: number,
  radiusY: number,
  jitter: number,
  centerX = 50,
  centerY = 50,
): Point[] {
  const points: Point[] = []

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2
    const scale = 1 - jitter / 2 + random() * jitter

    points.push([centerX + Math.cos(angle) * radiusX * scale, centerY + Math.sin(angle) * radiusY * scale])
  }

  return points
}

/** Escapes text bound for an SVG `<text>` node. */
export function escapeMarkup(value: string): string {
  const replacements: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }

  return String(value).replace(/[<>&"]/g, (character) => replacements[character])
}

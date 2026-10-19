import { useEffect, useMemo, useRef, useState } from "react"
import { useAppearance } from "../appearance/AppearanceProvider"

/*
 * What every chart shares — Innoventa's `palette.ts`, `chartText.ts`, `chartType.ts` and `useMeasuredWidth.ts`, same
 * names. ⚠️ Everything a chart draws is SVG and every colour it uses is a RESOLVED value, because a chart has to be
 * saveable as a picture of itself, and an SVG lifted out of the page carries neither the stylesheet nor its variables.
 */

export interface ChartPalette {
  /** Categorical colours, in order; a ninth series folds into "Other", it never cycles. */
  series: string[]
  /** An ordered ramp, light to dark — for answers that have an order. */
  scale: string[]
  primary: string
  grid: string
  surface: string
  ink: string
  inkQuiet: string
}

const SERIES_SLOTS = 8
const SCALE_STEPS = 5

function read(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value === "" ? fallback : value
}

/** The chart colours in force — re-read whenever the theme, the mode or the chart palette changes. */
export function useChartPalette(): ChartPalette {
  const { choice, theme, mode } = useAppearance()
  return useMemo(() => {
    const series = Array.from({ length: SERIES_SLOTS }, (_unused, slot) => read(`--kit-chart-${slot + 1}`, "#3d6da4"))
    const scale = Array.from({ length: SCALE_STEPS }, (_unused, step) => read(`--kit-chart-scale-${step + 1}`, "#4f81ba"))
    return {
      series,
      scale,
      primary: series[0],
      grid: read("--kit-chart-grid", "#e8e8e3"),
      surface: read("--kit-surface", "#ffffff"),
      ink: read("--kit-ink", "#191917"),
      inkQuiet: read("--kit-muted", "#5c5c56"),
    }
    // The token names never change; their values do — with the theme, the mode and the chart palette.
  }, [theme.name, mode, choice.chart])
}

/** The ramp step for a position in an ordered list. */
export function scaleStep(palette: ChartPalette, position: number, total: number): string {
  if (total <= 1) {
    return palette.scale[palette.scale.length - 1]
  }
  const step = Math.round((position / (total - 1)) * (palette.scale.length - 1))
  return palette.scale[Math.max(0, Math.min(palette.scale.length - 1, step))]
}

/** The type a chart is set in — written out, because an exported SVG cannot see the page's fonts. */
export const CHART_TYPE = {
  sans: 'Onest, Inter, "Segoe UI", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Consolas, monospace',
  body: 12.5,
  fine: 11,
  figure: 12.5,
  label: 10,
} as const

const AVERAGE_CHARACTER_WIDTH = 0.55
const ELLIPSIS = "…"

/** How many characters fit in a width at a size — an estimate, since SVG text cannot be measured before it is drawn. */
export function fitsIn(width: number, fontSize: number): number {
  return Math.max(1, Math.floor(width / (fontSize * AVERAGE_CHARACTER_WIDTH)))
}

export function shorten(text: string, width: number, fontSize: number): string {
  const budget = fitsIn(width, fontSize)
  return text.length <= budget ? text : `${text.slice(0, Math.max(1, budget - 1)).trimEnd()}${ELLIPSIS}`
}

/** A count with its thousands grouped by a space. */
export function grouped(value: number): string {
  return new Intl.NumberFormat("en-GB", { useGrouping: true }).format(value).replaceAll(",", " ")
}

/** A share as a whole percentage — "<1%" rather than a misleading 0%. */
export function share(count: number, total: number): string {
  if (total <= 0) {
    return "—"
  }
  const exact = (count / total) * 100
  return `${exact > 0 && exact < 1 ? "<1" : Math.round(exact)}%`
}

/** A measured value: three decimals at most, trimmed, never in exponent notation. */
export function readable(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—"
  }
  const number = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(number)) {
    return String(value)
  }
  const fixed = Math.abs(number) >= 1000 ? Math.round(number).toString() : number.toFixed(3)
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : grouped(Number(fixed))
}

/** The width an element is given, kept current — a chart draws to the pixel, not to a viewBox stretched later. */
export function useMeasuredWidth<T extends HTMLElement>(fallback = 640) {
  const reference = useRef<T | null>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const element = reference.current
    if (element === null) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0
      if (measured > 0) {
        setWidth(Math.round(measured))
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { reference, width }
}

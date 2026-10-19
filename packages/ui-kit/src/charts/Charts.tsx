import { useId, useState, type ReactNode } from "react"
import { useAppearance } from "../appearance/AppearanceProvider"
import { SwatchPicker } from "../controls/ChoiceCards"
import { Micro } from "../controls/Text"
import { SegmentedControl } from "../navigation/Toolbar"
import { CHART_TYPE, grouped, readable, scaleStep, share, shorten, useChartPalette, useMeasuredWidth } from "./chartSupport"

/*
 * Innoventa's chart family (`charts/*.tsx`), same names and properties: measured SVG in resolved colours, every chart
 * readable as a table too. `data-chart-mark` is how an export tells a chart's SVG from the icons around it.
 */

/* ===================== the panel: a chart, or its table ===================== */

export interface ChartTableRow {
  label: string
  count: number
  /** Per legend entry, for a stacked chart. */
  counts?: number[]
}

export interface ChartPanelProperties {
  title: string
  meta: string
  legend?: string[]
  table: { rows: ChartTableRow[]; total: number; valueHeading?: string }
  footnote?: ReactNode
  children: ReactNode
  className?: string
}

export function ChartPanel({ title, meta, legend, table, footnote, children, className }: ChartPanelProperties) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const headingId = useId()
  const palette = useChartPalette()
  return (
    <section aria-labelledby={headingId} data-chart-section={title} data-chart-meta={meta} className={className ? `kit-chart-panel ${className}` : "kit-chart-panel"}>
      <header className="kit-chart-panel-head">
        <div>
          <h3 id={headingId}>{title}</h3>
          <Micro>{meta}</Micro>
        </div>
        <SegmentedControl<"chart" | "table"> label={`How to read ${title}`} value={view} onChange={setView} options={[{ value: "chart", label: "Chart", icon: "activity" }, { value: "table", label: "Table", icon: "list" }]} />
      </header>
      {legend === undefined || legend.length < 2 ? null : (
        <div className="kit-chart-legend">
          {legend.map((name, slot) => (
            <span key={name}>
              <i aria-hidden="true" style={{ background: palette.series[slot % palette.series.length] }} />
              {name}
            </span>
          ))}
        </div>
      )}
      <div className="kit-chart-panel-body">{view === "chart" ? children : <ChartTable {...table} legend={legend} />}</div>
      {footnote === undefined ? null : (
        <footer className="kit-chart-panel-foot">
          <Micro>{footnote}</Micro>
        </footer>
      )}
    </section>
  )
}

function ChartTable({ rows, total, valueHeading = "Answers", legend }: { rows: ChartTableRow[]; total: number; valueHeading?: string; legend?: string[] }) {
  const columns = legend !== undefined && legend.length > 1 ? legend : []
  return (
    <div className="kit-chart-table-scroll">
      <table className="kit-chart-table">
        <thead>
          <tr>
            <th scope="col">Answer</th>
            {columns.map((name) => (
              <th key={name} scope="col" data-number="">{name}</th>
            ))}
            <th scope="col" data-number="">{valueHeading}</th>
            <th scope="col" data-number="">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              {columns.map((name, slot) => (
                <td key={name} data-number="" data-quiet="">{grouped(row.counts?.[slot] ?? 0)}</td>
              ))}
              <td data-number="">{grouped(row.count)}</td>
              <td data-number="" data-quiet="">{share(row.count, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ===================== ranked bars ===================== */

export interface RankedBar {
  value: string
  label: string
  count: number
  counts?: number[]
}

export interface RankedBarsProperties {
  bars: RankedBar[]
  total: number
  /** Stacked by these segments (the legend), each bar its `counts`. */
  segments?: string[]
  /** The answers have an order: drawn along the ramp. */
  ordered?: boolean
  ariaLabel: string
  onSelect?(bar: RankedBar): void
}

const ROW_HEIGHT = 30
const BAR_HEIGHT = 14
const LABEL_WIDTH = 176
const FIGURE_WIDTH = 96
const GAP = 12
const SEGMENT_GAP = 2

/** Answers as horizontal bars, scaled to the LARGEST answer (not the total), the count then the share at the right. */
export function RankedBars({ bars, total, segments, ordered, ariaLabel, onSelect }: RankedBarsProperties) {
  const palette = useChartPalette()
  const { reference, width } = useMeasuredWidth<HTMLDivElement>()
  const trackWidth = Math.max(60, width - LABEL_WIDTH - FIGURE_WIDTH - GAP * 2)
  const height = Math.max(ROW_HEIGHT, bars.length * ROW_HEIGHT)
  const longest = bars.reduce((most, bar) => Math.max(most, bar.count), 0) || 1
  return (
    <div ref={reference} className="kit-chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} data-chart-mark style={{ fontFamily: CHART_TYPE.sans }}>
        {bars.map((bar, row) => {
          const y = row * ROW_HEIGHT
          const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2
          const full = Math.round((bar.count / longest) * trackWidth)
          const interactive = onSelect !== undefined
          return (
            <g
              key={bar.value}
              onClick={interactive ? () => onSelect(bar) : undefined}
              onKeyDown={
                interactive
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onSelect(bar)
                      }
                    }
                  : undefined
              }
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? "button" : undefined}
              className={interactive ? "kit-chart-row" : undefined}
            >
              <rect x={0} y={y} width={width} height={ROW_HEIGHT} fill="transparent" />
              <title>{`${bar.label} — ${grouped(bar.count)} of ${grouped(total)} (${share(bar.count, total)})`}</title>
              <text x={0} y={y + ROW_HEIGHT / 2} dominantBaseline="central" fontSize={CHART_TYPE.body} fill={palette.ink}>
                {shorten(bar.label, LABEL_WIDTH - 8, CHART_TYPE.body)}
              </text>
              <rect x={LABEL_WIDTH + GAP} y={barY} width={trackWidth} height={BAR_HEIGHT} fill={palette.grid} />
              {segments === undefined ? (
                <rect x={LABEL_WIDTH + GAP} y={barY} width={full} height={BAR_HEIGHT} fill={ordered === true ? scaleStep(palette, row, bars.length) : palette.primary} />
              ) : (
                stacked(bar, segments.length).map((piece) => (
                  <rect
                    key={piece.segment}
                    x={LABEL_WIDTH + GAP + Math.round((piece.from / longest) * trackWidth)}
                    y={barY}
                    width={Math.max(0, Math.round((piece.count / longest) * trackWidth) - (piece.last ? 0 : SEGMENT_GAP))}
                    height={BAR_HEIGHT}
                    fill={palette.series[piece.segment % palette.series.length]}
                  />
                ))
              )}
              <text x={width - FIGURE_WIDTH + 44} y={y + ROW_HEIGHT / 2} textAnchor="end" dominantBaseline="central" fontSize={CHART_TYPE.figure} fontFamily={CHART_TYPE.mono} fill={palette.ink}>
                {readable(bar.count)}
              </text>
              <text x={width} y={y + ROW_HEIGHT / 2} textAnchor="end" dominantBaseline="central" fontSize={CHART_TYPE.figure} fontFamily={CHART_TYPE.mono} fill={palette.inkQuiet}>
                {share(bar.count, total)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function stacked(bar: RankedBar, segmentCount: number) {
  const counts = bar.counts ?? []
  const pieces: Array<{ segment: number; from: number; count: number; last: boolean }> = []
  let running = 0
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const count = counts[segment] ?? 0
    if (count > 0) {
      pieces.push({ segment, from: running, count, last: false })
      running += count
    }
  }
  if (pieces.length > 0) {
    pieces[pieces.length - 1].last = true
  }
  return pieces
}

/* ===================== distribution columns ===================== */

export interface DistributionColumn {
  key: string
  label: string
  count: number
  hint?: string
}

export interface DistributionColumnsProperties {
  columns: DistributionColumn[]
  total: number
  ordered?: boolean
  ariaLabel: string
  unit?: string
}

const COLUMNS_HEIGHT = 180
const COLUMNS_AXIS_HEIGHT = 22
const TOP_INSET = 12
const COLUMN_TICKS = 4
const MAX_COLUMN_WIDTH = 24
const COLUMN_GAP = 2
const MAX_SLOT_WIDTH = 84

/** A distribution as columns on a nice-rounded scale, each focusable, its exact figure in a tooltip. */
export function DistributionColumns({ columns, total, ordered = true, ariaLabel, unit = "submissions" }: DistributionColumnsProperties) {
  const palette = useChartPalette()
  const { reference, width } = useMeasuredWidth<HTMLDivElement>()
  const [hovered, setHovered] = useState<number | undefined>(undefined)
  const plotHeight = COLUMNS_HEIGHT - COLUMNS_AXIS_HEIGHT - TOP_INSET
  const tallest = columns.reduce((most, column) => Math.max(most, column.count), 0) || 1
  const ceiling = niceCeiling(tallest)
  const plotWidth = Math.min(width, Math.max(1, columns.length) * MAX_SLOT_WIDTH)
  const slot = columns.length > 0 ? plotWidth / columns.length : plotWidth
  const columnWidth = Math.max(2, Math.min(MAX_COLUMN_WIDTH, slot - COLUMN_GAP * 2))
  return (
    <div ref={reference} className="kit-chart">
      <svg width={width} height={COLUMNS_HEIGHT} viewBox={`0 0 ${width} ${COLUMNS_HEIGHT}`} role="img" aria-label={ariaLabel} data-chart-mark style={{ fontFamily: CHART_TYPE.sans }} onMouseLeave={() => setHovered(undefined)}>
        {Array.from({ length: COLUMN_TICKS + 1 }, (_unused, tick) => {
          const value = (ceiling / COLUMN_TICKS) * tick
          const y = plotHeight - (value / ceiling) * plotHeight
          return (
            <g key={tick}>
              <line x1={0} y1={y + TOP_INSET} x2={plotWidth} y2={y + TOP_INSET} stroke={palette.grid} strokeWidth={1} />
              <text x={0} y={y + TOP_INSET - 3} fontSize={CHART_TYPE.label} fontFamily={CHART_TYPE.mono} fill={palette.inkQuiet}>{grouped(Math.round(value))}</text>
            </g>
          )
        })}
        {columns.map((column, index) => {
          const columnHeight = Math.round((column.count / ceiling) * plotHeight)
          const x = Math.round(index * slot + (slot - columnWidth) / 2)
          return (
            <g key={column.key} onMouseEnter={() => setHovered(index)} onFocus={() => setHovered(index)} onBlur={() => setHovered(undefined)} tabIndex={0} className="kit-chart-row">
              <rect x={Math.round(index * slot)} y={TOP_INSET} width={Math.max(1, Math.round(slot))} height={plotHeight} fill={hovered === index ? palette.grid : "transparent"} opacity={hovered === index ? 0.6 : 1} />
              <title>{`${column.label} — ${grouped(column.count)} (${share(column.count, total)})`}</title>
              <rect x={x} y={plotHeight + TOP_INSET - columnHeight} width={columnWidth} height={columnHeight} fill={ordered ? scaleStep(palette, index, columns.length) : palette.primary} />
              <text x={Math.round(index * slot + slot / 2)} y={plotHeight + TOP_INSET + 14} textAnchor="middle" fontSize={CHART_TYPE.fine} fontFamily={CHART_TYPE.mono} fill={palette.inkQuiet}>
                {shorten(column.label, slot, CHART_TYPE.fine)}
              </text>
            </g>
          )
        })}
        <line x1={0} y1={plotHeight + TOP_INSET} x2={plotWidth} y2={plotHeight + TOP_INSET} stroke={palette.grid} strokeWidth={1} />
      </svg>
      {hovered === undefined ? null : (
        <div className="kit-chart-tooltip" style={{ left: Math.min(width - 180, Math.max(0, hovered * slot)) }}>
          <div>{columns[hovered].hint ?? columns[hovered].label}</div>
          <div className="kit-chart-tooltip-figure">{grouped(columns[hovered].count)} {unit} · {share(columns[hovered].count, total)}</div>
        </div>
      )}
    </div>
  )
}

function niceCeiling(tallest: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, tallest)))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (tallest <= magnitude * step) {
      return magnitude * step
    }
  }
  return magnitude * 10
}

/* ===================== trend area ===================== */

export interface TrendPoint {
  label: string
  count: number
}

export interface TrendAreaProperties {
  points: TrendPoint[]
  ariaLabel: string
  /** What one point stands for — "day", "week" — for the tooltip. */
  step: string
}

const TREND_HEIGHT = 132
const TREND_AXIS_HEIGHT = 20
const TREND_TICKS = 3
const AREA_OPACITY = 0.1

/** A count over time as a line over a faint area; three axis labels, the exact date in the tooltip. */
export function TrendArea({ points, ariaLabel, step }: TrendAreaProperties) {
  const palette = useChartPalette()
  const { reference, width } = useMeasuredWidth<HTMLDivElement>()
  const [hovered, setHovered] = useState<number | undefined>(undefined)
  const plotHeight = TREND_HEIGHT - TREND_AXIS_HEIGHT
  const tallest = points.reduce((most, point) => Math.max(most, point.count), 0) || 1
  const slot = points.length > 1 ? width / (points.length - 1) : width
  const at = (index: number) => (points.length > 1 ? index * slot : width / 2)
  const heightOf = (count: number) => plotHeight - (count / tallest) * plotHeight
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${at(index)},${heightOf(point.count)}`).join(" ")
  const area = `${line} L${at(points.length - 1)},${plotHeight} L${at(0)},${plotHeight} Z`
  const marks = points.length <= 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1]
  return (
    <div ref={reference} className="kit-chart">
      <svg
        width={width}
        height={TREND_HEIGHT}
        viewBox={`0 0 ${width} ${TREND_HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        data-chart-mark
        style={{ fontFamily: CHART_TYPE.sans }}
        onMouseLeave={() => setHovered(undefined)}
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const nearest = Math.round((event.clientX - bounds.left) / (slot || 1))
          setHovered(Math.max(0, Math.min(points.length - 1, nearest)))
        }}
      >
        {Array.from({ length: TREND_TICKS + 1 }, (_unused, tick) => {
          const y = (plotHeight / TREND_TICKS) * tick
          return <line key={tick} x1={0} y1={y} x2={width} y2={y} stroke={palette.grid} strokeWidth={1} />
        })}
        <path d={area} fill={palette.primary} opacity={AREA_OPACITY} />
        <path d={line} fill="none" stroke={palette.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hovered === undefined ? null : (
          <g>
            <line x1={at(hovered)} y1={0} x2={at(hovered)} y2={plotHeight} stroke={palette.inkQuiet} strokeWidth={1} />
            <circle cx={at(hovered)} cy={heightOf(points[hovered].count)} r={4} fill={palette.primary} stroke={palette.surface} strokeWidth={2} />
          </g>
        )}
        {marks.map((index) => (
          <text key={index} x={Math.max(0, Math.min(width, at(index)))} y={plotHeight + 14} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} fontSize={CHART_TYPE.label} fontFamily={CHART_TYPE.mono} fill={palette.inkQuiet}>
            {points[index]?.label ?? ""}
          </text>
        ))}
      </svg>
      {hovered === undefined ? null : (
        <div className="kit-chart-tooltip" style={{ left: Math.min(width - 160, Math.max(0, at(hovered) - 40)) }}>
          <div>{points[hovered].label}</div>
          <div className="kit-chart-tooltip-figure">{grouped(points[hovered].count)} in the {step}</div>
        </div>
      )}
    </div>
  )
}

/* ===================== the chart palette picker ===================== */

const CHART_DESCRIPTIONS: Record<string, string> = {
  quiet: "Quiet — the muted set, for reading at a desk",
  vivid: "Vivid — loud and far apart, for a projector or a print-out",
  cool: "Cool — blues, greens and violets",
  warm: "Warm — ambers, rusts and olives",
}

/** Which colours a series is drawn in — each swatch wears the palette it selects and reads the ordinary tokens. */
export function ChartThemePicker({ className, label = "Chart colours" }: { className?: string; label?: string }) {
  const { choice, change } = useAppearance()
  return (
    <SwatchPicker
      label={label}
      value={choice.chart}
      onChange={(value) => change("chart", value as typeof choice.chart)}
      className={className}
      options={(["quiet", "vivid", "cool", "warm"] as const).map((name) => ({
        value: name,
        description: CHART_DESCRIPTIONS[name],
        preview: { "data-chart": name },
        colours: ["var(--kit-chart-1)", "var(--kit-chart-2)", "var(--kit-chart-3)", "var(--kit-chart-4)"] as const,
      }))}
    />
  )
}

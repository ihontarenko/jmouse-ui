import { useEffect, useState } from "react"
import { useAppearance } from "@jmouse/ui-kit"

/*
 * Burin's mark, "groove": three engraved strokes, swelling and thinning as a cut line does (Html/Burin/scripts/brand.js).
 * It is the product's own art, not a component — the kit's title bar takes it as its `mark`. The strokes breathe while
 * motion is allowed and stand still otherwise.
 */

/** Iris, the palette Burin opens in: the mark's three colours on a dark and on a light ground. */
const colors = { dark: ["#7077e8", "#a8b4ff", "#e0e6ff"], light: ["#5358c5", "#7f8bea", "#aebaf8"] }

const strokes: Array<[number, number, number, number, number]> = [
  [26, 86, 70, 30, 13],
  [44, 96, 92, 36, 15],
  [70, 100, 100, 62, 9],
]

/** A stroke whose width swells in the middle, drawn as a filled outline around its centre line. */
function cutStroke(fromX: number, fromY: number, toX: number, toY: number, width: number, progress: number) {
  const length = Math.hypot(toX - fromX, toY - fromY)
  const normalX = -(toY - fromY) / length
  const normalY = (toX - fromX) / length
  const samples = 24
  const upper: string[] = []
  const lower: string[] = []
  for (let sample = 0; sample <= samples; sample++) {
    const position = (sample / samples) * progress
    const centreX = fromX + (toX - fromX) * position
    const centreY = fromY + (toY - fromY) * position
    const swell = Math.sin(Math.PI * (sample / samples)) ** 0.7 * width * 0.5 + 0.6
    upper.push(`${(centreX + normalX * swell).toFixed(2)} ${(centreY + normalY * swell).toFixed(2)}`)
    lower.unshift(`${(centreX - normalX * swell).toFixed(2)} ${(centreY - normalY * swell).toFixed(2)}`)
  }
  return `M${upper.join(" L")} L${lower.join(" L")} Z`
}

function useMarkTime(animated: boolean) {
  const [time, setTime] = useState(0)
  useEffect(() => {
    if (!animated || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTime(0)
      return
    }
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      setTime((now - started) / 1000)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animated])
  return time
}

export function BurinMark() {
  const { mode, choice } = useAppearance()
  const time = useMarkTime(choice.motion !== "off")
  const palette = colors[mode]
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      {strokes.map(([fromX, fromY, toX, toY, width], index) => {
        const phase = time ? (Math.sin(time * 1.4 - index * 0.9) + 1) / 2 : 1
        const progress = time ? 0.55 + 0.45 * phase : 1
        return <path key={index} d={cutStroke(fromX, fromY, toX, toY, width, progress)} fill={palette[index]} />
      })}
    </svg>
  )
}

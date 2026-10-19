import { useState, type ReactNode } from "react"
import { ProblemState } from "../feedback/Feedback"

function webGlAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
  } catch {
    return false
  }
}

export interface InstrumentGateProperties {
  /** What the instrument is, for the message — "The oscilloscope", "The 3D stand". */
  name: string
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
}

/**
 * Draws an instrument that needs WebGL only where the browser can give it; elsewhere it says so in words, in the
 * instrument's place, instead of an empty canvas.
 */
export function InstrumentGate({ name, title, description, children }: InstrumentGateProperties) {
  const [available] = useState(webGlAvailable)
  if (available) {
    return <>{children}</>
  }
  return (
    <ProblemState
      title={title ?? `${name} needs WebGL`}
      description={description ?? "This browser or device does not provide WebGL, or it is switched off. Turn on hardware acceleration, or open the page in a current browser."}
    />
  )
}

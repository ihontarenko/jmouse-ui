import * as React from "react"

/**
 * Reading a printed code with the camera — the half every scanner shares.
 *
 * <h2>⚠️ It produces a STRING and stops there</h2>
 *
 * <p>What a code means is the product's: one screen looks it up as an inventory number, another
 * searches components with it, a third might file it. A hook that resolved the code would be a hook
 * that had to know about somebody's endpoints, and the two callers would then differ in the half that
 * matters instead of sharing the half that does not.
 *
 * <h2>⚠️ The camera is an enhancement, never a requirement</h2>
 *
 * <p>`BarcodeDetector` is not in every browser and a camera is not on every machine, so this reports
 * a `problem` rather than throwing, and whatever renders it is expected to keep a typed field beside
 * the picture. A scanner screen that is useless without a camera is useless at a desk.
 *
 * <h2>⚠️ Nothing is queued, retried or stored</h2>
 *
 * <p>This starts a camera and hands over strings. Everything about what happens to them — including
 * whether the work survives being offline — belongs to the caller.
 */

export interface CodeScannerOptions {
  /** Called once per code read. The scanner keeps running; stop it by disabling. */
  onCode: (code: string) => void
  /** False tears the camera down — a dialog that closed, a panel that collapsed. */
  enabled?: boolean
  formats?: readonly string[]
}

export interface CodeScanner {
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Why there is no picture, in words to show — or null while the camera is working. */
  problem: string | null
}

const DEFAULT_FORMATS = ["qr_code", "code_128", "ean_13", "code_39"] as const

/** How often the detector is asked. Fast enough to feel instant, slow enough not to cook a phone. */
const LOOK_INTERVAL = 250

export function useCodeScanner({ onCode, enabled = true, formats = DEFAULT_FORMATS }: CodeScannerOptions): CodeScanner {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)

  // ⚠️ Held in a ref so the effect below does not restart every time the caller re-renders with a new
  // closure — restarting means tearing down a camera and asking for it again, which on a phone is a
  // visible black flash and a permission prompt that reappears.
  const report = React.useRef(onCode)
  report.current = onCode

  React.useEffect(() => {
    if (!enabled) {
      return
    }

    // Feature-detected rather than assumed, and failing is not an error state: no detector means the
    // typed field, which was always going to be there.
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setProblem("This browser cannot read codes from a camera — type what is printed instead.")

      return
    }

    setProblem(null)

    let stream: MediaStream | null = null
    let stopped = false

    async function watch() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const detector = new (window as unknown as {
          BarcodeDetector: new (options: { formats: readonly string[] }) => {
            detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
          }
        }).BarcodeDetector({ formats })

        while (!stopped && videoRef.current) {
          const found = await detector.detect(videoRef.current)

          if (found.length > 0 && found[0]) {
            report.current(found[0].rawValue)

            // ⚠️ One code per sighting, then a pause. Without it a sticker held in frame fires the
            // callback four times a second, and whatever it triggers happens four times a second too.
            await new Promise((wake) => setTimeout(wake, 1500))
          }

          await new Promise((wake) => setTimeout(wake, LOOK_INTERVAL))
        }
      } catch {
        setProblem("The camera could not be opened — type what is printed instead.")
      }
    }

    void watch()

    return () => {
      stopped = true
      // ⚠️ Every track, explicitly. A stream left running keeps the camera light on after the screen
      // has gone, which people reasonably read as being recorded.
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [enabled, formats])

  return { videoRef, problem }
}

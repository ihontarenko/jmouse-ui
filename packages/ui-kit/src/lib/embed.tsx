import { useEffect, useRef, useState } from "react"
import { joinClassNames } from "./classNames"

/**
 * A page shown inside another product's iframe, sized to its content (Innoventa's `Embed.tsx`, same names).
 *
 * ⚠️ The message type is a CONTRACT ON THE WIRE between applications, not a name to tidy: pages already embedded in
 * Kiwi and Moneta post `"innoventa:embed-resize"`, and a host listening for anything else would leave them at their
 * starting height. Keep the default; pass another only for a new pair of applications.
 */
export const EMBED_RESIZE = "innoventa:embed-resize"
export const SMALLEST_EMBED_HEIGHT = 240
export const STARTING_EMBED_HEIGHT = 420

/**
 * The embedded side: makes the document transparent and as tall as its content, and reports that height to the parent
 * whenever it changes (fonts arriving included). Put the returned reference on the outermost element.
 */
export function useEmbedFrame(active = true, messageType = EMBED_RESIZE) {
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active) {
      return
    }
    const root = document.documentElement
    root.style.height = "auto"
    root.style.background = "transparent"
    document.body.style.height = "auto"
    document.body.style.minHeight = "0"
    document.body.style.background = "transparent"
    document.body.style.overflowY = "hidden"
    const report = () => {
      // The rectangle includes the wrapper's own padding; scrollHeight has been seen to miss a flex container's foot.
      const height = frame.current ? Math.ceil(frame.current.getBoundingClientRect().height) : document.body.scrollHeight
      window.parent?.postMessage({ type: messageType, height }, "*")
    }
    report()
    void document.fonts?.ready.then(report)
    const observer = new ResizeObserver(report)
    observer.observe(frame.current ?? document.body)
    return () => {
      observer.disconnect()
      root.style.height = ""
      root.style.background = ""
      document.body.style.height = ""
      document.body.style.minHeight = ""
      document.body.style.background = ""
      document.body.style.overflowY = ""
    }
  }, [active, messageType])
  return frame
}

/** The hosting side: an iframe that grows to what the embedded page reports — from this origin only. */
export function EmbedHost({ source, title, className, messageType = EMBED_RESIZE }: { source: string; title: string; className?: string; messageType?: string }) {
  const [height, setHeight] = useState(STARTING_EMBED_HEIGHT)
  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return
      }
      const message = event.data as { type?: string; height?: number } | null
      if (message?.type === messageType && typeof message.height === "number") {
        setHeight(Math.max(SMALLEST_EMBED_HEIGHT, Math.ceil(message.height)))
      }
    }
    window.addEventListener("message", listen)
    return () => window.removeEventListener("message", listen)
  }, [messageType])
  return <iframe src={source} title={title} scrolling="no" style={{ height }} className={joinClassNames("kit-embed", className)} />
}

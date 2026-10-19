import { useState } from "react"
import { Button } from "../controls/Button"
import { Mono } from "../controls/Text"
import { joinClassNames } from "../lib/classNames"

export interface MeterProperties {
  value: number
  total: number
  /** "ok" is Innoventa's name for "good"; both are taken. */
  tone?: "accent" | "good" | "ok" | "warn" | "danger"
  /** The pair above the bar: what it measures and the figure it stands for. A bar without a caption is decoration. */
  caption?: { label: string; value: string }
  className?: string
}

/** A proportion as a bar on a hairline track, its numbers above it where no fill can ever cover them. */
export function Meter({ value, total, tone = "accent", caption, className }: MeterProperties) {
  const percentage = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div className={joinClassNames("kit-meter", className)} data-tone={tone === "ok" ? "good" : tone}>
      {caption && (
        <div className="kit-meter-caption">
          <span className="kit-micro-label">{caption.label}</span>
          <span className="kit-meter-value">{caption.value}</span>
        </div>
      )}
      <div className="kit-meter-track" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total} aria-label={caption?.label}>
        <i style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

export interface AddressRowProperties {
  label: string
  url: string
  /** Innoventa's controlled shape: the caller copies and says it did. Leave both out and the row copies by itself. */
  copied?: boolean
  onCopy?(): void
  copyLabel?: string
  copiedLabel?: string
}

/**
 * A public address in full and copyable — never truncated to a name, because whoever pastes it must see it is the
 * right one; and a real anchor opening a new tab, because the point of it is that it works outside this application.
 */
export function AddressRow({ label, url, copied: copiedGiven, onCopy, copyLabel = "Copy", copiedLabel = "Copied" }: AddressRowProperties) {
  const [copiedHere, setCopiedHere] = useState(false)
  const copied = copiedGiven ?? copiedHere
  return (
    <div className="kit-address-row">
      <span className="kit-address-label">{label}</span>
      <a href={url} target="_blank" rel="noreferrer" title={url} className="kit-address-url">
        <Mono>{url}</Mono>
      </a>
      <Button
        variant="quiet"
        size="small"
        icon={copied ? "check" : "copy"}
        onClick={async () => {
          if (onCopy) {
            onCopy()
            return
          }
          await navigator.clipboard.writeText(url)
          setCopiedHere(true)
          window.setTimeout(() => setCopiedHere(false), 1600)
        }}
      >
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  )
}

import { useRef, useState, type AnchorHTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import { IconButton } from "../controls/Button"
import { joinClassNames } from "../lib/classNames"
import { Menu, MenuItem } from "../navigation/Menu"

/* ===================== media tile ===================== */

export interface MediaTileProperties extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "title"> {
  title: ReactNode
  /** Under the title: a year, a season, a size. */
  meta?: ReactNode
  imageUrl?: string
  /** The shape of the artwork: a poster, a still, a square cover. */
  aspect?: "poster" | "still" | "square"
  /** 0…1 — how much has been watched; drawn as a bar along the artwork's foot. */
  progress?: number
  /** Over the artwork's corner: "4K", "New", a count of episodes. Words, never a colour alone. */
  badges?: ReactNode
  /** What stands in when there is no artwork — the title's initials are drawn otherwise. */
  placeholder?: ReactNode
  selected?: boolean
}

/** One film, one album, one photo — artwork first, its name under it; a link to the thing itself. */
export function MediaTile({ title, meta, imageUrl, aspect = "poster", progress, badges, placeholder, selected, className, ...rest }: MediaTileProperties) {
  const initials = typeof title === "string" ? title.split(/\s+/).slice(0, 2).map((word) => word[0]).join("") : ""
  return (
    <a className={joinClassNames("kit-media-tile", className)} aria-current={selected ? "true" : undefined} {...rest}>
      <span className="kit-media-art" data-aspect={aspect}>
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <span className="kit-media-placeholder" aria-hidden="true">{placeholder ?? initials}</span>}
        {badges && <span className="kit-media-badges">{badges}</span>}
        {progress !== undefined && progress > 0 && (
          <span className="kit-media-progress" role="progressbar" aria-label="Watched" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <span style={{ width: `${Math.min(1, progress) * 100}%` }} />
          </span>
        )}
      </span>
      <span className="kit-media-title">{title}</span>
      {meta && <span className="kit-media-meta">{meta}</span>}
    </a>
  )
}

/* ===================== shelf: a row of tiles that scrolls sideways ===================== */

export interface ShelfProperties {
  title: ReactNode
  /** "See all" and the like, at the heading's end. */
  action?: ReactNode
  previousLabel?: string
  nextLabel?: string
  children: ReactNode
}

/**
 * A titled row of tiles — "Continue watching", "Recently added" — that scrolls sideways by touch, wheel, keys or the
 * two buttons, a page at a time. The row is a list, so its length is announced.
 */
export function Shelf({ title, action, previousLabel = "Scroll back", nextLabel = "Scroll on", children }: ShelfProperties) {
  const rowReference = useRef<HTMLUListElement>(null)
  const scrollByPage = (direction: 1 | -1) => {
    const row = rowReference.current
    row?.scrollBy({ left: direction * row.clientWidth * 0.9, behavior: "smooth" })
  }
  return (
    <section className="kit-shelf">
      <header className="kit-shelf-head">
        <h2>{title}</h2>
        {action}
        <span className="kit-shelf-navigation">
          <IconButton icon="chevron-left" label={previousLabel} size="small" onClick={() => scrollByPage(-1)} />
          <IconButton icon="chevron-right" label={nextLabel} size="small" onClick={() => scrollByPage(1)} />
        </span>
      </header>
      <ul ref={rowReference} className="kit-shelf-row" role="list">
        {Array.isArray(children) ? children.map((child, index) => <li key={index}>{child}</li>) : <li>{children}</li>}
      </ul>
    </section>
  )
}

/* ===================== transport: a player's controls ===================== */

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--"
  }
  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, "0")
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`
}

export interface TransportProperties {
  playing: boolean
  /** Seconds. */
  position: number
  duration: number
  /** Seconds already loaded ahead — drawn as a lighter track. */
  buffered?: number
  /** 0…1, and whether it is muted. */
  volume: number
  muted: boolean
  qualities?: string[]
  quality?: string
  fullscreen?: boolean
  onPlayingChange(playing: boolean): void
  onSeek(position: number): void
  onVolumeChange(volume: number): void
  onMutedChange(muted: boolean): void
  onQualityChange?(quality: string): void
  onFullscreenChange?(fullscreen: boolean): void
  /** Extra controls before the quality menu — subtitles, next episode. */
  extra?: ReactNode
  labels?: Partial<Record<"play" | "pause" | "seek" | "mute" | "unmute" | "volume" | "quality" | "fullscreen" | "exitFullscreen", string>>
}

/**
 * A player's controls — and only its controls: it draws the state it is handed and reports what the viewer wants, so
 * a video, an audio stream or HLS all sit behind it unchanged. The seek bar is a slider with its time spoken as words;
 * the arrow keys step five seconds (Shift: thirty), Space plays and pauses.
 */
export function Transport({ playing, position, duration, buffered = 0, volume, muted, qualities, quality, fullscreen, onPlayingChange, onSeek, onVolumeChange, onMutedChange, onQualityChange, onFullscreenChange, extra, labels = {} }: TransportProperties) {
  const text = { play: "Play", pause: "Pause", seek: "Seek", mute: "Mute", unmute: "Unmute", volume: "Volume", quality: "Quality", fullscreen: "Full screen", exitFullscreen: "Leave full screen", ...labels }
  const trackReference = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const fraction = duration > 0 ? position / duration : 0

  const positionAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = trackReference.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * duration
  }

  function onSeekKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 30 : 5
    const next: Record<string, number> = { ArrowRight: position + step, ArrowLeft: position - step, Home: 0, End: duration }
    if (event.key in next) {
      event.preventDefault()
      onSeek(Math.max(0, Math.min(duration, next[event.key])))
    } else if (event.key === " ") {
      event.preventDefault()
      onPlayingChange(!playing)
    }
  }

  return (
    <div className="kit-transport">
      <div
        ref={trackReference}
        className="kit-transport-track"
        role="slider"
        tabIndex={0}
        aria-label={text.seek}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
        onKeyDown={onSeekKey}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          onSeek(positionAt(event))
        }}
        onPointerMove={(event) => {
          setHover(positionAt(event))
          if (event.buttons === 1) {
            onSeek(positionAt(event))
          }
        }}
        onPointerLeave={() => setHover(null)}
      >
        <span className="kit-transport-buffered" style={{ width: `${duration > 0 ? Math.min(1, buffered / duration) * 100 : 0}%` }} />
        <span className="kit-transport-played" style={{ width: `${fraction * 100}%` }} />
        <span className="kit-transport-head" style={{ left: `${fraction * 100}%` }} />
        {hover !== null && <span className="kit-transport-hover" style={{ left: `${(hover / duration) * 100}%` }}>{formatTime(hover)}</span>}
      </div>
      <div className="kit-transport-bar">
        <IconButton icon={playing ? "pause" : "play"} label={playing ? text.pause : text.play} onClick={() => onPlayingChange(!playing)} />
        <IconButton icon={muted || volume === 0 ? "volume-off" : "volume"} label={muted ? text.unmute : text.mute} size="small" onClick={() => onMutedChange(!muted)} />
        <input className="kit-range kit-transport-volume" type="range" min={0} max={1} step={0.05} aria-label={text.volume} value={muted ? 0 : volume} onChange={(event) => onVolumeChange(Number(event.target.value))} style={{ ["--kit-fill" as string]: `${(muted ? 0 : volume) * 100}%` }} />
        <span className="kit-transport-time">{formatTime(position)} / {formatTime(duration)}</span>
        <span className="kit-toolbar-push" />
        {extra}
        {qualities && onQualityChange && (
          <Menu label={text.quality} alignment="end" trigger={(triggerProperties) => <IconButton icon="settings" label={`${text.quality}: ${quality ?? ""}`} size="small" {...triggerProperties} />}>
            {qualities.map((candidate) => (
              <MenuItem key={candidate} checked={candidate === quality} onSelect={() => onQualityChange(candidate)}>{candidate}</MenuItem>
            ))}
          </Menu>
        )}
        {onFullscreenChange && <IconButton icon={fullscreen ? "fullscreen-exit" : "fullscreen"} label={fullscreen ? text.exitFullscreen : text.fullscreen} size="small" pressed={fullscreen} onClick={() => onFullscreenChange(!fullscreen)} />}
      </div>
    </div>
  )
}

export { formatTime as formatPlaybackTime }

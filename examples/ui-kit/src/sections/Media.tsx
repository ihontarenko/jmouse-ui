import { useEffect, useState } from "react"
import { Badge, ButtonLink, IconButton, MediaTile, PageHeader, Shelf, Transport } from "@jmouse/ui-kit"
import { Specimen } from "../Specimen"

const films = [
  { title: "Spirited Away", meta: "2001 · 2:05", progress: 0.42, badges: <Badge tone="accent" dot={false}>4K</Badge> },
  { title: "Paprika", meta: "2006 · 1:30", progress: 0 },
  { title: "Akira", meta: "1988 · 2:04", progress: 1, badges: <Badge tone="good">Watched</Badge> },
  { title: "Perfect Blue", meta: "1997 · 1:21", progress: 0.1 },
  { title: "Ghost in the Shell", meta: "1995 · 1:23", progress: 0, badges: <Badge dot={false}>New</Badge> },
  { title: "Your Name", meta: "2016 · 1:46", progress: 0.77 },
  { title: "Tokyo Godfathers", meta: "2003 · 1:32", progress: 0 },
  { title: "Princess Mononoke", meta: "1997 · 2:14", progress: 0 },
]

export function MediaSection() {
  const duration = 7500
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(3150)
  const [volume, setVolume] = useState(0.7)
  const [muted, setMuted] = useState(false)
  const [quality, setQuality] = useState("Original")
  const [fullscreen, setFullscreen] = useState(false)

  // A stand-in for a <video>: the transport only draws what it is handed.
  useEffect(() => {
    if (!playing) {
      return
    }
    const timer = window.setInterval(() => setPosition((current) => Math.min(duration, current + 1)), 1000)
    return () => window.clearInterval(timer)
  }, [playing])

  return (
    <div className="showcase-stack">
      <PageHeader title="Media" description="Kitsu's library pieces: a tile with artwork, the shelf tiles sit on, and a player's transport. The transport draws the state it is handed and reports what the viewer wants, so any player sits behind it." />

      <Specimen id="shelf" title="Shelf and media tile" summary="A titled row that scrolls sideways a page at a time. A tile is artwork first, its name under it, a watched bar along its foot; badges are words, never a colour alone. Without artwork the initials stand in." layout="column" usage={`<Shelf title="Continue watching" action={<ButtonLink variant="quiet" size="small" href="/films">See all</ButtonLink>}>\n  {films.map((film) => <MediaTile key={film.id} href={film.href} title={film.title} meta={film.meta} imageUrl={film.poster} progress={film.watched} />)}\n</Shelf>`}>
        <Shelf title="Continue watching" action={<ButtonLink variant="quiet" size="small" href="#/media">See all</ButtonLink>}>
          {films.map((film, index) => (
            <MediaTile key={film.title} href="#/media" title={film.title} meta={film.meta} progress={film.progress} badges={film.badges} selected={index === 0} />
          ))}
        </Shelf>
        <div className="kit-media-grid">
          {films.slice(0, 4).map((film) => (
            <MediaTile key={film.title} href="#/media" aspect="still" title={film.title} meta={film.meta} progress={film.progress} />
          ))}
        </div>
      </Specimen>

      <Specimen id="transport" title="Transport" summary="Play and pause, a seek bar with what is buffered, the time in words for a screen reader, volume, quality and full screen. On the seek bar the arrow keys step five seconds (Shift: thirty), Home and End jump, Space plays." layout="column" flush>
        <div className="showcase-player">
          <div className="showcase-player-picture" aria-hidden="true">Spirited Away</div>
          <Transport
            playing={playing}
            position={position}
            duration={duration}
            buffered={Math.min(duration, position + 600)}
            volume={volume}
            muted={muted}
            qualities={["Original", "1080p", "720p", "480p"]}
            quality={quality}
            fullscreen={fullscreen}
            onPlayingChange={setPlaying}
            onSeek={setPosition}
            onVolumeChange={(value) => { setVolume(value); setMuted(value === 0) }}
            onMutedChange={setMuted}
            onQualityChange={setQuality}
            onFullscreenChange={setFullscreen}
            extra={<IconButton icon="subtitles" label="Subtitles" size="small" />}
          />
        </div>
      </Specimen>
    </div>
  )
}

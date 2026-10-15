import { useEffect, useRef, useState } from "react";
import { channelName, channelUnit, ScreenWindow, type PlaybackClock, type SampleMemory, type ScopeSettings } from "@jmouse/parallax/oscilloscope";
import { formatQuantity } from "@jmouse/parallax/quantities";
import { spaceBox, spaceChannels, spaceFigure } from "@jmouse/parallax/scope";
import { defaultSpaceCamera, Stage } from "@jmouse/parallax/visual";
import { Segments } from "../controls/BenchControls";

/** Where the figure is looked at from, named by the plane each view shows: the front is the XY figure. */
const CAMERAS = {
  angled: { azimuth: defaultSpaceCamera.azimuth, elevation: defaultSpaceCamera.elevation },
  xy: { azimuth: 0, elevation: 0.02 },
  zy: { azimuth: -Math.PI / 2, elevation: 0.02 },
  xz: { azimuth: 0, elevation: Math.PI / 2 - 0.02 },
} as const;

type CameraName = keyof typeof CAMERAS;

/** The box at a turn fits a screen wider than tall; at the stage's own zoom its corners ran off the bottom. */
const SPACE_ZOOM = 0.75;

/**
 * The oscilloscope's XYZ display: the first three channels as one figure in space, in a box of divisions the reader
 * turns by dragging and zooms with the wheel. It plays from the same clock and window as the flat screen — the time
 * base sets how much of the signals the figure holds —, drawn at every animation frame the memory or the clock moved.
 */
export function ScopeSpace({ memory, settings, back, clock, label, waiting, idle }: {
  memory: SampleMemory;
  settings: ScopeSettings;
  back: number;
  clock?: PlaybackClock;
  label: string;
  waiting?: string | null;
  idle?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [camera, setCamera] = useState<CameraName>("angled");
  const state = useRef({ settings, back, clock, waiting, idle });
  state.current = { settings, back, clock, waiting, idle };

  useEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const space = new Stage(element, { driver: "webgl", interactive: true, surface: "screen", view: { space: { ...defaultSpaceCamera, ...CAMERAS.angled, zoom: SPACE_ZOOM } } });
    stage.current = space;
    const box = { id: "box", dataset: spaceBox(), color: "var(--parallax-screen-grid-strong)" };
    const screenWindow = new ScreenWindow();
    let drawn = "";
    let animation = 0;
    const draw = () => {
      animation = requestAnimationFrame(draw);
      const current = state.current;
      const { view, shownTime } = screenWindow.frame(memory, current.settings, { back: current.back, clock: current.clock, now: performance.now() });
      const channels = spaceChannels(current.settings);
      const key = [memory.generation, memory.version, shownTime, view.start, JSON.stringify(current.settings.channels), current.waiting, current.idle].join("/");
      if (key === drawn) {
        return;
      }
      drawn = key;
      const message = !channels ? "XYZ needs three channels on"
        : current.waiting || memory.length === 0 ? current.waiting ?? current.idle ?? "No samples yet" : null;
      const figure = channels && !message
        ? [{ id: "figure", dataset: spaceFigure(memory, channels, view), color: `var(--parallax-probe-${channels.up.color})`, emphasized: true }]
        : [];
      space.setContent({
        layers: [box, ...figure],
        grid: false,
        axes: false,
        fitKey: "xyz",
        overlay: (context, _size, theme) => {
          context.font = theme.labelFont;
          context.fillStyle = theme.label;
          context.textAlign = "left";
          context.textBaseline = "top";
          if (message) {
            context.fillText(message, 10, 8);
            return;
          }
          // Which channel stands on which axis, and its scale: a figure in space is unreadable without them.
          [["X", channels!.across], ["Y", channels!.up], ["Z", channels!.depth]].forEach(([axis, channel], line) => {
            const probe = channel as NonNullable<typeof channels>["across"];
            context.fillText(`${axis} ${channelName(probe)} · ${formatQuantity(probe.voltsPerDivision, channelUnit(probe))}/div`, 10, 8 + line * 16);
          });
        },
      });
      space.renderNow();
    };
    animation = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animation);
      space.destroy();
      stage.current = null;
    };
  }, [memory]);

  return (
    <div data-parallax-part="scope-screen" className="parallax-scope-screen parallax-scope-space">
      <div className="parallax-scope-space-camera">
        <Segments label="Look at the figure from" value={camera} onChange={(name: CameraName) => {
          setCamera(name);
          stage.current?.turnTo(CAMERAS[name]);
        }}
          options={[{ value: "angled", label: "3D", title: "At an angle: the whole figure in space — drag to turn it, the wheel zooms" },
            { value: "xy", label: "XY", title: "From the front: the first channel across, the second up — the XY figure" },
            { value: "zy", label: "ZY", title: "From the side: the third channel across, the second up" },
            { value: "xz", label: "XZ", title: "From above: the first channel across, the third up" }]} />
      </div>
      <div ref={host} className="parallax-visual-host parallax-scope-space-stage" role="img" aria-label={label} />
    </div>
  );
}

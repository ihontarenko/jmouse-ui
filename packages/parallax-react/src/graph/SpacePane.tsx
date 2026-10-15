import { useRef, useState } from "react";
import { defaultSpaceCamera, type Dataset, type PlayerFrame } from "@jmouse/parallax/visual";
import { VisualView, type VisualViewHandle } from "../viewers/VisualView";
import { Segmented } from "../controls/Segmented";
import type { PaneContent } from "./GraphPanes";

/** Where a space pane looks from: straight along y, along x, from above, or the usual angle. */
const CAMERAS = {
  front: { azimuth: 0, elevation: 0.02 },
  side: { azimuth: -Math.PI / 2, elevation: 0.02 },
  top: { azimuth: 0, elevation: Math.PI / 2 - 0.02 },
  angled: { azimuth: defaultSpaceCamera.azimuth, elevation: defaultSpaceCamera.elevation },
} as const;

type CameraName = keyof typeof CAMERAS;

/**
 * Its lines in three dimensions, on the graph's clock. The camera is the reader's to turn; the presets ask the stage to
 * carry it to a front, side, top or angled view.
 */
export function SpacePane({ content, playback }: {
  content: PaneContent;
  playback?: { subscribe: (listener: (frame: PlayerFrame<Dataset>) => void) => () => void };
}) {
  const handle = useRef<VisualViewHandle>(null);
  const written = content.pane.camera && content.pane.camera in CAMERAS ? (content.pane.camera as CameraName) : "angled";
  const [camera, setCamera] = useState<CameraName>(written);
  // The stage turns its camera — eased, the shorter way round, at once under reduced motion.
  const turnTo = (name: CameraName) => {
    setCamera(name);
    handle.current?.turnTo(CAMERAS[name]);
  };

  return (
    <>
      <div className="parallax-graph-pane-camera">
        <Segmented small label={`Camera of ${content.pane.name}`} value={camera} onChange={turnTo}
          options={[
            { value: "front", label: "Front" },
            { value: "side", label: "Side" },
            { value: "top", label: "Top" },
            { value: "angled", label: "Angled" },
          ]} />
      </div>
      <VisualView ref={handle} layers={content.layers} tools projection="perspective" playback={playback}
        initialView={{ space: { ...defaultSpaceCamera, ...CAMERAS[written] } }}
        title={`Pane ${content.pane.name}: space with ${content.layers.length} drawn surfaces`} />
    </>
  );
}

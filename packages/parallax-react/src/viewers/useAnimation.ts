import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ready } from "@jmouse/parallax";
import { AnimationPlayer, frameGrid, nearestFrame, type FrameBuffer } from "@jmouse/parallax/visual";
import { computationRequest, type ComputationTarget } from "@jmouse/parallax/computation";
import { useParallaxSettings } from "../providers/ParallaxSettings";
import { datasetPlayback, type Playback } from "@jmouse/parallax/playback";
import { useFrameBuffer } from "./useFrames";

/** How many frames one pass over a parameter's range is cut into. */
export const FRAMES_PER_LOOP = 64;

export interface Animated {
  name: string;
  minimum: number;
  maximum: number;
}

export interface Animation {
  /** Pushed straight to the view every frame; null while nothing plays. */
  playback: Playback | null;
  /** A frame to mount the view with before anything else was computed. */
  still: Ready | null;
  /** The animated parameter's value at the frame on screen, now. */
  valueNow: () => number;
  /** Told the value whenever the frame changes — for a readout that renders itself, not the whole page. */
  subscribeValue: (listener: (value: number) => void) => () => void;
  seek: (value: number) => void;
  buffer: FrameBuffer<Ready> | null;
  waiting: boolean;
}

/** The layer id an animated object is drawn under in a computed frame. */
export const ANIMATED_LAYER = "result";

/**
 * One object animated over one of its parameters: frames computed ahead, played by the drawing library's player, and
 * handed to the view without a React render per frame. The other parameters stay at `values`; changing one starts a
 * new buffer.
 */
export function useAnimation({ target, representation, values, settings, animated, playing, secondsPerLoop, start }: {
  target: ComputationTarget;
  representation: string | null;
  values: Record<string, number>;
  settings: Record<string, unknown>;
  animated: Animated | null;
  playing: boolean;
  secondsPerLoop: number;
  /** Where play starts: the parameter's current value. */
  start: number;
}): Animation {
  const { computationOwner } = useParallaxSettings();
  const grid = useMemo(() => (animated ? frameGrid(animated.minimum, animated.maximum, FRAMES_PER_LOOP) : []), [animated?.name, animated?.minimum, animated?.maximum]);
  const fixed = useMemo(() => Object.fromEntries(Object.entries(values).filter(([name]) => name !== animated?.name)), [values, animated?.name]);
  const source = target && representation && animated && playing
    ? { computation: computationRequest(target, representation, fixed, settings, computationOwner ?? undefined), parameter: animated.name, grid }
    : null;
  // The frame index lives in a ref: it changes several times a second while playing, and no page should render for it.
  const index = useRef(nearestFrame(grid, start));
  const [fillFrom, setFillFrom] = useState(index.current);
  const buffer = useFrameBuffer(source, fillFrom);
  const [waiting, setWaiting] = useState(false);

  const player = useMemo(() => (buffer ? new AnimationPlayer(new Map([[ANIMATED_LAYER, buffer]]), grid.length, { secondsPerLoop, loop: true, whole: true }, index.current) : null), [buffer]);
  useEffect(() => {
    if (!player) {
      return;
    }
    const stopIndex = player.onIndex((next) => {
      index.current = next;
    });
    const stopWaiting = player.onWaiting(setWaiting);
    player.play();
    return () => {
      stopIndex();
      stopWaiting();
      player.destroy();
    };
  }, [player]);
  useEffect(() => {
    player?.update({ secondsPerLoop });
  }, [player, secondsPerLoop]);

  const playback = useMemo<Playback | null>(() => (player ? datasetPlayback(player) : null), [player]);

  const subscribeValue = useCallback((listener: (value: number) => void) => player?.onIndex((next) => listener(grid[next] ?? start)) ?? (() => {}), [player, grid]);

  return {
    playback,
    still: buffer?.frameAt(index.current) ?? null,
    valueNow: () => grid[index.current] ?? start,
    subscribeValue,
    seek: (value) => {
      const target = nearestFrame(grid, value);
      index.current = target;
      setFillFrom(target);
      player?.seek(target);
    },
    buffer,
    waiting,
  };
}

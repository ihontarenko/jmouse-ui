import type { ParallaxTransport } from "../transport/transport";
import type { ComputationRequest, Ready } from "../transport/wire";
import { FrameBuffer, type AnimationPlayer, type Dataset, type PlayerFrame } from "../visual";

/*
 * Parallax's frames for the drawing library's buffer: one computation run at every value of one parameter, through
 * `POST /computations/frames`. The buffering and the clock are the library's; only where frames come from is ours.
 */

/** What is animated: one computation, run at every value of `grid` for its `parameter`. */
export interface FrameSource {
  computation: ComputationRequest;
  parameter: string;
  grid: readonly number[];
}

const KEPT_BUFFERS = 8;

/** Buffers kept a while per transport, so going back to settings just played starts at once. */
const buffersByTransport = new WeakMap<ParallaxTransport, Map<string, FrameBuffer<Ready>>>();

/** The buffer of a source, shared by every view that animates the same thing through the same transport. */
export function bufferFor(transport: ParallaxTransport, source: FrameSource): FrameBuffer<Ready> {
  let buffers = buffersByTransport.get(transport);
  if (!buffers) {
    buffers = new Map();
    buffersByTransport.set(transport, buffers);
  }
  const key = JSON.stringify(source);
  let buffer = buffers.get(key);
  if (!buffer) {
    buffer = new FrameBuffer<Ready>(source.grid, async (values, signal) => {
      const answer = await transport.computations.frames({ computation: source.computation, parameter: source.parameter, values }, signal);
      return { frames: answer.frames.map((frame) => frame.ready), complete: answer.complete };
    }, (ready) => ready.elementCount);
    buffers.set(key, buffer);
    while (buffers.size > KEPT_BUFFERS) {
      const oldest = buffers.keys().next().value as string;
      buffers.get(oldest)?.stop();
      buffers.delete(oldest);
    }
  }
  return buffer;
}

/** What a view subscribes to while an animation plays: per layer, the datasets of the frame and of the next one. */
export interface Playback {
  subscribe: (listener: (frame: PlayerFrame<Dataset>) => void) => () => void;
}

/** A player of computed answers, as the drawing library's view takes it: their datasets. */
export function datasetPlayback(player: AnimationPlayer<Ready>): Playback {
  return {
    subscribe: (listener) => player.subscribe((frame) => {
      const datasets = new Map<string, { frame: Dataset | null; next: Dataset | null }>();
      frame.frames.forEach((shown, key) => datasets.set(key, { frame: shown.frame?.dataset ?? null, next: shown.next?.dataset ?? null }));
      listener({ index: frame.index, phase: frame.phase, frames: datasets });
    }),
  };
}

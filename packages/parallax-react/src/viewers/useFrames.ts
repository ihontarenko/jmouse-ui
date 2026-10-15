import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Ready } from "@jmouse/parallax";
import type { AnimationPlayer, FrameBuffer } from "@jmouse/parallax/visual";
import { bufferFor, type FrameSource } from "@jmouse/parallax/playback";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";

/** The buffer of a source, filling while the component shows it; null while there is nothing to animate. */
export function useFrameBuffer(source: FrameSource | null, start = 0): FrameBuffer<Ready> | null {
  const transport = useParallaxTransport();
  const key = source ? JSON.stringify(source) : null;
  const buffer = useMemo(() => (source ? bufferFor(transport, source) : null), [transport, key]);
  useSyncExternalStore(buffer?.subscribe ?? noSubscription, () => buffer?.version ?? 0);
  useEffect(() => {
    buffer?.fill(start);
  }, [buffer, start]);
  return buffer;
}

const noSubscription = () => () => {};

/** A player's buffered frames, re-read whenever more arrive; null without a player. */
export function usePlayerProgress(player: AnimationPlayer<Ready> | null): { loaded: number; total: number } | null {
  const snapshot = useRef<{ loaded: number; total: number } | null>(null);
  const subscribe = useCallback((listener: () => void) => player?.onProgress(listener) ?? (() => {}), [player]);
  const read = useCallback(() => {
    const progress = player?.progress ?? null;
    const previous = snapshot.current;
    if (progress && previous && progress.loaded === previous.loaded && progress.total === previous.total) {
      return previous;
    }
    snapshot.current = progress;
    return progress;
  }, [player]);
  return useSyncExternalStore(subscribe, read);
}

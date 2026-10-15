import { useSyncExternalStore } from "react";
import { useParallaxSettings } from "../providers/ParallaxSettings";
import { measuredFrameRate, subscribeToFrameRate, type FrameRateGuard } from "@jmouse/parallax/playback";

/** The measured rate against the host's minimum: whether what adds to the drawing may still be raised. */
export function useFrameRateGuard(): FrameRateGuard {
  const measured = useSyncExternalStore(subscribeToFrameRate, measuredFrameRate);
  const minimum = useParallaxSettings().minimumFrameRate;
  return { framesPerSecond: measured, minimum, starved: minimum > 0 && measured !== null && measured < minimum };
}

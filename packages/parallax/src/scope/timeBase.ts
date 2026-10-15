import { HORIZONTAL_DIVISIONS, measure, type ChannelId, type Measurement, type SampleMemory, type ScopeChannel } from "../oscilloscope";
import { ladderAtLeast } from "../quantities";

/* How an oscilloscope's time base and scales are fitted to what it shows. */

/** How many periods of a periodic trace the time base puts on the screen: a few, so its shape reads at a glance. */
const PERIODS_ON_SCREEN = 3;

/**
 * The time base that shows a few periods of the trigger source, from its frequency over everything the memory holds —
 * the screen may show less than one period —; null while the source is not periodic or not two periods long yet.
 */
export function periodicTimeBase(memory: SampleMemory, source: ChannelId): number | null {
  if (memory.length < 2) {
    return null;
  }
  const whole = { start: memory.firstTime(), span: memory.lastTime() - memory.firstTime(), triggered: null };
  const frequency = measure(memory, source, whole)?.frequency;
  if (!frequency || !Number.isFinite(frequency) || whole.span * frequency < 2) {
    return null;
  }
  return Math.min(1, ladderAtLeast(PERIODS_ON_SCREEN / frequency / HORIZONTAL_DIVISIONS));
}

/** How far a trace may run past the screen's edge, and how small its swing may shrink, in divisions, before Auto refits. */
const AUTO_EDGE = 4.2;
const AUTO_SMALLEST_SWING = 1.5;

/** Whether a trace has run off the screen, or shrunk to a sliver of it: what Auto refits for. */
export function outOfShape(channel: ScopeChannel, reading: Measurement): boolean {
  const top = (channel.coupling === "AC" ? (reading.maximum - reading.minimum) / 2 : reading.maximum) / channel.voltsPerDivision + channel.position;
  const bottom = (channel.coupling === "AC" ? -(reading.maximum - reading.minimum) / 2 : reading.minimum) / channel.voltsPerDivision + channel.position;
  const swing = (reading.maximum - reading.minimum) / channel.voltsPerDivision;
  return top > AUTO_EDGE || bottom < -AUTO_EDGE || (swing > 0 && swing < AUTO_SMALLEST_SWING && reading.maximum !== reading.minimum);
}

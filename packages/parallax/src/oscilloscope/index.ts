/**
 * A bench oscilloscope without a screen: a fixed-size ring of samples, a playback clock that plays a stream smoothly,
 * recordings, and the front panel's window, trigger and measurements. It imports nothing from the product; the product
 * imports it from here and draws the screen itself.
 */
export { Recording, SampleMemory } from "./SampleMemory";
export { PlaybackClock } from "./PlaybackClock";
export { Replay } from "./Replay";
export { ScreenWindow, type ScreenFrame, type ScreenMoment } from "./ScreenWindow";
export { REPLAY_ORDERS, TIME_CURVES, phaseOf, shareAt, timeCurve, type ReplayOrder, type TimeCurve } from "./timeCourse";
export {
  CHANNEL_IDS, DEFAULT_MATH, HORIZONTAL_DIVISIONS, PROBE_COLORS, VERTICAL_DIVISIONS, channelDrawn, channelName, channelSource, channelUnit, holdsWholeRecord, measure, windowOf,
  type ChannelId, type MathChannel, type MathOperation, type Measurement, type ScopeChannel, type ScopeSettings, type TriggerEdge, type TriggerMode, type Window,
} from "./instrument";

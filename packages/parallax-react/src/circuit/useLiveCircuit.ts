import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LiveControl, LiveProbe } from "@jmouse/parallax";
import { useParallaxTransport } from "../providers/ParallaxTransportProvider";
import {
  type CircuitDefinition, type FlowFeed, LiveCircuitSession, type LiveReading, LiveTelemetry, type RecentFlowFeed, SIMULATION_SPEEDS,
} from "@jmouse/parallax/circuit";
import type { PlaybackClock, Recording, SampleMemory } from "@jmouse/parallax/oscilloscope";

/** The speed last chosen, kept in this browser: the reader's habit, not the circuit's. */
const SPEED_KEY = "parallax.bench.speed";

function rememberedSpeed(): number {
  try {
    const kept = Number(localStorage.getItem(SPEED_KEY));
    return SIMULATION_SPEEDS.some((choice) => Number(choice.value) === kept) ? kept : 1;
  } catch {
    return 1;
  }
}

export interface LiveCircuit {
  running: boolean;
  /** Waiting for the server's first answer. */
  busy: boolean;
  problem: string | null;
  /** Time, speed and node voltages as they change while it runs — read through {@link useLiveReading}. */
  telemetry: LiveTelemetry;
  /** The circuit's nodes, known once it started. */
  nodes: string[];
  controls: LiveControl[];
  memory: SampleMemory;
  /** Where the live screen is in the stream; also what the buffer indicator reads. */
  playback: PlaybackClock;
  /** The circuit at the moment the screen plays, every screen frame: what the sheet moves its currents by. */
  flow: FlowFeed;
  /** The traced moments just before the moment played: what tells a current too fast to show as flowing. */
  recent: RecentFlowFeed;
  /** How fast it plays, in circuit seconds per second of wall time: 1 is real time. */
  speed: number;
  run: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
  set: (control: LiveControl, value: number) => void;
  probe: (probes: LiveProbe[]) => void;
  runText: (source: string) => Promise<void>;
  pace: (speed: number) => void;
  /** Samples this far apart from now on — what the oscilloscope's time base needs —; the circuit goes on. */
  sample: (interval: number) => void;
  /** Every sample read, the run as slow as that takes, or real time first; the circuit goes on. */
  acquire: (gapless: boolean) => void;
  resize: (capacity: number) => void;
  recording: { received: number; target: number } | null;
  record: (count: number) => void;
  stopRecording: () => Recording | null;
  /** Plays a stretch of the memory again — the run pauses —; null goes back to the stream. */
  replay: (stretch: { from: number; to: number } | null) => void;
}

export function useLiveReading(telemetry: LiveTelemetry): LiveReading {
  return useSyncExternalStore(telemetry.subscribe, telemetry.current);
}

/**
 * The live bench's session as React state: a {@link LiveCircuitSession} made once, whose listener writes the state the
 * bench draws from. What belongs to this browser rather than to the session stays here — the speed the reader last
 * chose, and pausing the server while nobody watches the tab.
 */
export function useLiveCircuit(objectId: string, circuit: CircuitDefinition | null, values: Record<string, number>,
  sampleInterval: number, enabled: boolean, onRecorded: (recording: Recording) => void): LiveCircuit {
  const transport = useParallaxTransport();
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [nodes, setNodes] = useState<string[]>([]);
  const [controls, setControls] = useState<LiveControl[]>([]);
  const [speed, setSpeed] = useState(rememberedSpeed);
  const [recordingShown, setRecordingShown] = useState<{ received: number; target: number } | null>(null);
  const recorded = useRef(onRecorded);
  recorded.current = onRecorded;
  const input = { objectId, circuit, values, speed, sampleInterval };
  const [session] = useState(() => new LiveCircuitSession(transport.live, input, {
    onRunning: setRunning,
    onBusy: setBusy,
    onProblem: setProblem,
    onNodes: setNodes,
    onControls: setControls,
    onRecording: setRecordingShown,
    onRecorded: (recording) => recorded.current(recording),
  }));
  session.follow(input);

  const pace = (next: number) => {
    setSpeed(next);
    try {
      localStorage.setItem(SPEED_KEY, String(next));
    } catch {
      // A private window keeps no habit; the next bench starts at real time.
    }
    session.pace(next);
  };

  useEffect(() => {
    session.edit(circuit, values);
  }, [circuit, values, session]);

  useEffect(() => {
    if (!enabled) {
      session.disconnect();
    }
  }, [enabled, session]);
  useEffect(() => () => session.close(), [session]);

  // Nobody watches a hidden tab: the server stops computing for it, and goes on where it was when the tab is back.
  const runningNow = useRef(running);
  runningNow.current = running;
  useEffect(() => {
    let pausedWhileHidden = false;
    const visibility = () => {
      if (document.hidden && runningNow.current && session.streaming()) {
        pausedWhileHidden = true;
        session.hold();
      } else if (!document.hidden && pausedWhileHidden) {
        pausedWhileHidden = false;
        if (runningNow.current && session.streaming()) {
          session.proceed();
        }
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [session]);

  return { running, busy, problem, telemetry: session.telemetry, nodes, controls, memory: session.memory, playback: session.playback,
    flow: session.flow, recent: session.recent, speed, sample: session.sample, acquire: session.acquire, run: session.run, pause: session.pause, step: session.step,
    reset: session.reset, set: session.set, probe: session.probe, runText: session.runText, pace, resize: session.resize,
    recording: recordingShown, record: session.record, stopRecording: session.stopRecording, replay: session.replay };
}

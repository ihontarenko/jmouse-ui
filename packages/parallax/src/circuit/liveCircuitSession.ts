import { openLiveCircuit, type LiveControl, type LiveMessage, type LiveProbe, type LiveSocket, type ParallaxLive, type PartLoad } from "../transport/live";
import { nodesOf, type CircuitDefinition } from "./circuit";
import { levelsOf, loadsOf, LiveFlow, type FlowFeed, type RecentFlowFeed } from "./circuitTrace";
import { PlaybackClock, Recording, Replay, SampleMemory } from "../oscilloscope";

/**
 * How slowly a circuit can be watched: a 50 Hz bridge shows one cycle a second at 1/100 (each half-wave's path lights
 * in turn); a 10 kHz PWM or a 555 at 1/10 000 — its edges, and which way the current goes on each.
 */
/**
 * The speeds a run plays at, slowest first, on the 1–2–5 ladder down to a hundred thousand times slower than real
 * time — a 100 kHz switcher, one period a second. Each says what it makes visible: the frequency seen once a second.
 */
export const SIMULATION_SPEEDS: readonly { value: string; label: string; title: string }[] = [1e5, 5e4, 2e4, 1e4, 5e3, 2e3, 1e3, 500, 200, 100, 50, 20, 10, 5, 2, 1]
  .map((slowdown) => {
    const count = slowdown >= 1000 ? `${slowdown / 1000}k` : String(slowdown);
    const frequency = slowdown >= 1000 ? `${slowdown / 1000} kHz` : `${slowdown} Hz`;
    return slowdown === 1
      ? { value: "1", label: "1×", title: "Real time — as fast as the server keeps up" }
      : { value: String(1 / slowdown), label: `1/${count}`, title: `${count} times slower than real time — a ${frequency} signal shows one period a second` };
  });

/** What a running circuit reports a few times a second. */
export interface LiveReading {
  /** The circuit's own time, as last shown. */
  reached: number;
  /** Circuit seconds per wall-clock second, as measured — what the processor keeps up with; null before it is known. */
  speed: number | null;
  /** The speed the server plays at: the one asked for, or the lower one it holds because it cannot keep up; null before it said. */
  held: number | null;
  /** Every node's voltage at the moment the screen plays, for the schematic's colours. */
  levels: Record<string, number>;
  /** How busy the server is with this circuit: the share of each frame's time it spends computing it, 0…1. */
  load: number | null;
  /** Every part's power and estimated temperature over the last frame, and its terminal currents at the moment played. */
  parts: Record<string, PartLoad>;
  /** The time between two samples, in seconds, once the circuit started. */
  interval: number | null;
}

/**
 * The live reading as a store of its own: the clock and the schematic subscribe to it, so a running circuit redraws
 * those two and not the whole bench around them five times a second.
 */
export class LiveTelemetry {
  private reading: LiveReading = { reached: 0, speed: null, levels: {}, load: null, held: null, parts: {}, interval: null };
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly current = (): LiveReading => this.reading;

  update(change: Partial<LiveReading>) {
    this.reading = { ...this.reading, ...change };
    this.listeners.forEach((listener) => listener());
  }
}

/** The last stretch captured finely, and why the last capture could not be made — what a capturing screen shows. */
export interface LiveCapture {
  capture: SampleMemory | null;
  refused: string | null;
}

/**
 * The captures as a store of their own, like the telemetry: the screen subscribes to it, so a capture arriving several
 * times a second redraws the screen and nothing else. Held in the bench's state, each one redrew the whole bench —
 * a third of a second a time, half of every second spent on it.
 */
export class LiveCaptures {
  private state: LiveCapture = { capture: null, refused: null };
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly current = (): LiveCapture => this.state;

  update(change: Partial<LiveCapture>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }
}

/** The circuit time the screen plays now; the newest traced moment while no screen is drawing. */
export function playedTime(playback: PlaybackClock, traced: LiveFlow, now: number): number {
  const shown = playback.shownTime(now);
  return Number.isFinite(shown) ? shown : traced.newest;
}

/**
 * The probes an edited circuit still has a place for: on nodes it has — a part's own inner node counts while the part
 * is there — and on parts it has. A probe the drawing took away goes with it rather than stopping the run.
 */
export function probesWithin(probes: readonly LiveProbe[], circuit: CircuitDefinition | null): LiveProbe[] {
  if (!circuit) {
    return [];
  }
  const parts = new Set(circuit.elements.map((element) => element.id));
  const nodes = new Set(nodesOf(circuit.elements));
  const known = (node: string) => node === "0" || nodes.has(node) || parts.has(node.split(".")[0]);
  return probes.filter((probe) => known(probe.positive) && known(probe.negative) && (!probe.part || parts.has(probe.part)));
}

/** A circuit as far as a live run is concerned: its window is how long an analysis runs, and a live run has none. */
export function liveShape(circuit: CircuitDefinition | null): string {
  return JSON.stringify(circuit ? { ...circuit, time: null } : null);
}

/** How often the listener hears about a running circuit: the screen redraws from memory on its own, every frame. */
const SHOWN_EVERY_MILLISECONDS = 200;

/** What a start sends and an edit is compared with: the circuit, its values, how fast and how often it is sampled. */
export interface LiveCircuitInput {
  objectId: string;
  circuit: CircuitDefinition | null;
  values: Record<string, number>;
  /** Circuit seconds per second of wall time: 1 is real time. */
  speed: number;
  sampleInterval: number;
  /**
   * Every sample read, the run as slow as that takes — an unbroken record at a fine time base —, or real time first,
   * one block a frame and gaps between. Absent: real time first.
   */
  gapless?: boolean;
}

/** What a session tells its owner, each as it changes; a React hook turns each into its state. */
export interface LiveCircuitListener {
  onRunning(running: boolean): void;
  /** Waiting for the server's first answer. */
  onBusy(busy: boolean): void;
  onProblem(problem: string | null): void;
  /** The circuit's nodes, known once it started; empty again while an edited circuit starts. */
  onNodes(nodes: string[]): void;
  onControls(controls: LiveControl[]): void;
  /** How far the recording asked for has got, or null when none is being made. */
  onRecording(progress: { received: number; target: number } | null): void;
  /** A recording finished — complete, or stopped with something in it. */
  onRecorded(recording: Recording): void;
}

/**
 * A circuit running on the server, watched over a socket. Run starts it there; frames arrive with the probes already
 * measured and go straight into the oscilloscope's ring memory — fixed in size, so a circuit that has run for an hour
 * costs what one that ran for a second does — and into a recording when one is asked for. A moved slider, a worked
 * switch or an edit goes up as a message and the circuit goes on, or for an edit starts again. Nothing is stepped in
 * the browser, and the listener hears about it a few times a second, not on every frame.
 *
 * Every command is a bound function, so it can be handed to a control as it is.
 */
export class LiveCircuitSession {
  /** Time, speed and node voltages as they change while it runs. */
  readonly telemetry = new LiveTelemetry();
  /** The stretches captured finely ({@link capture}), as they arrive. */
  readonly captures = new LiveCaptures();
  readonly memory = new SampleMemory(10_000);
  /** Where the live screen is in the stream; also what the buffer indicator reads. */
  readonly playback = new PlaybackClock();
  private readonly traced = new LiveFlow();
  private readonly live: ParallaxLive;
  private readonly listener: LiveCircuitListener;
  private input: LiveCircuitInput;
  /** What the server was last sent, which an edit is compared with. */
  private sent: { circuit: CircuitDefinition | null; values: Record<string, number> };
  /** The server's load, smoothed over frames: one frame's figure jumps with every edge it had to resolve. */
  private loadShown: number | null = null;
  private paced: { wall: number; circuit: number } | null = null;
  private shownAt = 0;
  /** Each part's energy and the circuit time it took since the sheet was last told, so its power is the mean over all of it. */
  private readonly worked = new Map<string, { energy: number; seconds: number }>();
  private controls: LiveControl[] = [];
  private probes: LiveProbe[] = [];
  private recording: Recording | null = null;
  private recordings = 0;
  private socket: LiveSocket | null = null;
  private opening: Promise<LiveSocket> | null = null;
  private started = false;
  private replayLevels: ReturnType<typeof setInterval> | null = null;

  constructor(live: ParallaxLive, input: LiveCircuitInput, listener: LiveCircuitListener) {
    this.live = live;
    this.listener = listener;
    this.input = input;
    this.sent = { circuit: input.circuit, values: input.values };
    this.traced.pace(input.speed);
  }

  /** What the next start sends; the owner hands it over whenever it draws, as the circuit and its values change. */
  readonly follow = (input: LiveCircuitInput) => {
    // How it is acquired is set by `acquire`, not by the owner's render: an input without it keeps the one set.
    this.input = { ...input, gapless: input.gapless ?? this.input.gapless };
  };

  /** Whether the server runs a circuit for this session now: the socket is open and the circuit started. */
  readonly streaming = (): boolean => this.socket !== null && this.started;

  // Every screen frame, the circuit at the moment the oscilloscope plays — the same clock, so the sheet and the trace
  // on the screen show one instant.
  readonly recent: RecentFlowFeed = (wallSeconds) =>
    this.traced.recent(playedTime(this.playback, this.traced, performance.now()), wallSeconds);

  readonly flow: FlowFeed = (listener) => {
    const play = (now: number) => {
      const moment = this.traced.momentAt(playedTime(this.playback, this.traced, now));
      if (moment) {
        listener(moment);
      }
      frame = requestAnimationFrame(play);
    };
    let frame = requestAnimationFrame(play);
    return () => cancelAnimationFrame(frame);
  };

  /**
   * Plays a stretch of what the memory holds again, at the speed it was recorded at, round and round: the run pauses —
   * a replay is of what was computed, and the stream would only push it out of the memory. The screen, the sheet's
   * currents and the meters follow it through the playback clock; the wires' colours, which a running circuit takes from
   * its frames, are taken from the traced moments five times a second. Null goes back to the stream. A replay that
   * replaces another keeps its course — order, curve and pace.
   */
  readonly replay = (stretch: { from: number; to: number } | null) => {
    const previous = this.playback.replay;
    if (this.replayLevels !== null) {
      clearInterval(this.replayLevels);
      this.replayLevels = null;
    }
    if (!stretch) {
      if (this.playback.replay) {
        this.playback.play(null);
      }
      return;
    }
    if (this.streaming()) {
      this.pause();
    }
    const recorded = previous?.recorded ?? this.telemetry.current().speed ?? this.input.speed;
    this.playback.play(previous
      ? new Replay(stretch.from, stretch.to, recorded, previous.order, previous.curve.id, previous.multiple)
      : new Replay(stretch.from, stretch.to, recorded));
    this.replayLevels = setInterval(() => {
      const moment = this.traced.windowAt(playedTime(this.playback, this.traced, performance.now()), SHOWN_EVERY_MILLISECONDS / 1000);
      if (moment) {
        this.telemetry.update({ levels: levelsOf(moment, this.traced.columnUnits) });
      }
    }, SHOWN_EVERY_MILLISECONDS);
  };

  readonly run = () => {
    this.replay(null);
    this.listener.onRunning(true);
    if (this.socket && this.started) {
      this.socket.send({ type: "resume" });
    } else {
      void this.start().catch(this.failed);
    }
  };

  readonly pause = () => {
    this.listener.onRunning(false);
    this.socket?.send({ type: "pause" });
  };

  readonly step = () => {
    this.replay(null);
    this.listener.onRunning(false);
    if (this.socket && this.started) {
      this.socket.send({ type: "step" });
    } else {
      void this.start().then((open) => {
        open?.send({ type: "pause" });
        open?.send({ type: "step" });
      }).catch(this.failed);
    }
  };

  readonly reset = () => {
    this.replay(null);
    this.memory.clear();
    this.traced.clear();
    this.telemetry.update({ reached: 0 });
    this.socket?.send({ type: "reset" });
  };

  /** Works a live part; the circuit goes on from now with the new value. */
  readonly set = (control: LiveControl, value: number) => {
    this.controls = this.controls.map((candidate) => candidate === control ? { ...candidate, value } : candidate);
    this.listener.onControls(this.controls);
    this.socket?.send({ type: "set", part: control.part, parameter: control.parameter, value });
  };

  /** An edited text, run at once; a circuit not yet running starts with it. */
  readonly runText = async (source: string) => {
    this.listener.onProblem(null);
    this.replay(null);
    this.memory.clear();
    this.traced.clear();
    const open = this.socket && this.started ? this.socket : await this.start();
    open?.send({ type: "restart", source });
    this.listener.onRunning(true);
    open?.send({ type: "resume" });
  };

  /** The probes the oscilloscope has; what was measured with the old ones means something else now. */
  readonly probe = (asked: LiveProbe[]) => {
    // Only what the circuit has a place for: a channel left on a node a rewiring renamed stopped the whole run before.
    const channels = probesWithin(asked, this.input.circuit);
    if (JSON.stringify(channels) === JSON.stringify(this.probes)) {
      return;
    }
    this.probes = channels;
    this.memory.clear();
    this.socket?.send({ type: "probes", probes: channels });
  };

  /** How fast it plays from now on; a Run straight after starts at this speed. */
  readonly pace = (speed: number) => {
    this.traced.pace(speed);
    this.input = { ...this.input, speed };
    this.socket?.send({ type: "pace", speed });
  };

  /** Samples this far apart from now on — what the oscilloscope's time base needs —; the circuit goes on. */
  readonly sample = (interval: number) => {
    if (this.input.sampleInterval === interval) {
      return;
    }
    this.input = { ...this.input, sampleInterval: interval };
    if (this.socket && this.started) {
      this.socket.send({ type: "sample", interval });
      this.telemetry.update({ interval });
    }
  };

  /**
   * A stretch the run has passed, replayed on the server from just before it and sampled on `samples` samples: an edge
   * a few nanoseconds long, seen in a stream sampled every ten microseconds, as it happened. The run goes on; the
   * capture arrives in {@link captures}.
   */
  readonly capture = (from: number, to: number, samples: number) => {
    if (this.socket && this.started) {
      this.socket.send({ type: "capture", from, to, samples });
    }
  };

  /** Every sample read from now on, or real time first; the circuit goes on. */
  readonly acquire = (gapless: boolean) => {
    if (Boolean(this.input.gapless) === gapless) {
      return;
    }
    this.input = { ...this.input, gapless };
    if (this.socket && this.started) {
      this.socket.send({ type: "acquire", gapless });
    }
  };

  readonly resize = (capacity: number) => {
    this.memory.resize(capacity);
  };

  readonly record = (count: number) => {
    this.recordings++;
    this.recording = new Recording(this.recordings, count, `REC-${String(this.recordings).padStart(3, "0")}`);
    this.listener.onRecording({ received: 0, target: count });
  };

  /** Ends the recording being made; one with something in it goes to the listener as well. */
  readonly stopRecording = (): Recording | null => {
    const finished = this.recording;
    this.recording = null;
    this.listener.onRecording(null);
    if (finished && finished.time.length) {
      this.listener.onRecorded(finished);
    }
    return finished;
  };

  /** While it runs, a moved slider goes on from now; an edited circuit starts again with what is written. */
  readonly edit = (circuit: CircuitDefinition | null, values: Record<string, number>) => {
    const open = this.socket;
    if (!open || !this.started) {
      return;
    }
    const before = this.sent;
    if (liveShape(before.circuit) !== liveShape(circuit)) {
      this.sent = { circuit, values };
      this.memory.clear();
      // The old circuit's nodes say nothing of the new one until it has started.
      this.listener.onNodes([]);
      this.probes = probesWithin(this.probes, circuit);
      open.send({ type: "restart", definition: circuit, interval: this.input.sampleInterval, probes: this.probes });
      return;
    }
    for (const [name, value] of Object.entries(values)) {
      if (before.values[name] !== value) {
        open.send({ type: "set", parameter: name, value });
      }
    }
    this.sent = { circuit, values };
  };

  /** Asks the server to stop computing while the run stays running for the reader — a hidden tab; `proceed` goes on. */
  readonly hold = () => {
    this.socket?.send({ type: "pause" });
  };

  readonly proceed = () => {
    this.socket?.send({ type: "resume" });
  };

  /** Closes the socket and forgets the run; the next Run opens a new one. */
  readonly disconnect = () => {
    this.socket?.close();
    this.socket = null;
    this.opening = null;
    this.started = false;
  };

  /** Closes the socket; the listener hears of it as the socket closes. */
  readonly close = () => {
    this.replay(null);
    this.socket?.close();
  };

  private readonly failed = (failure: unknown) => {
    this.listener.onProblem(String((failure as Error).message ?? failure));
    this.listener.onRunning(false);
    this.listener.onBusy(false);
  };

  private async connect(): Promise<LiveSocket> {
    if (this.socket) {
      return this.socket;
    }
    const opening: Promise<LiveSocket> = this.opening ??= openLiveCircuit(this.live, (message) => this.receive(message), (reason) => {
      // A socket closed after a disconnect, once the next one is already opening, must not take that one down with it.
      if (this.opening !== null && this.opening !== opening) {
        return;
      }
      this.socket = null;
      this.opening = null;
      this.started = false;
      this.listener.onRunning(false);
      this.listener.onBusy(false);
      if (reason !== "done") {
        this.listener.onProblem(reason);
      }
    });
    const open = await this.opening;
    this.socket = open;
    return open;
  }

  private async start(): Promise<LiveSocket | null> {
    const current = this.input;
    if (!current.circuit) {
      return null;
    }
    this.listener.onBusy(true);
    this.listener.onProblem(null);
    const open = await this.connect();
    this.sent = { circuit: current.circuit, values: current.values };
    this.probes = probesWithin(this.probes, current.circuit);
    open.send({ type: "start", objectId: current.objectId, definition: current.circuit, values: current.values,
      interval: current.sampleInterval, speed: current.speed, gapless: Boolean(current.gapless),
      probes: this.probes });
    return open;
  }

  /**
   * Takes a frame's power into each part's running energy. A frame is 40 ms of wall time, which at a few times slower
   * than real time is less than one period of 50 Hz: its mean power lands on whichever half-wave it covered, and the
   * figure shown five times a second would jump with it.
   */
  private work(time: ArrayLike<number>, parts: Record<string, PartLoad>) {
    const seconds = time.length > 1 ? time[time.length - 1] - time[0] : 0;
    if (!(seconds > 0)) {
      return;
    }
    for (const [part, load] of Object.entries(parts)) {
      if (load.power === null || !Number.isFinite(load.power)) {
        continue;
      }
      const worked = this.worked.get(part) ?? { energy: 0, seconds: 0 };
      worked.energy += load.power * seconds;
      worked.seconds += seconds;
      this.worked.set(part, worked);
    }
  }

  /** A part's mean power since the sheet was last told; null when no frame said. */
  private meanPower(part: string): number | null {
    const worked = this.worked.get(part);
    return worked && worked.seconds > 0 ? worked.energy / worked.seconds : null;
  }

  private receive(message: LiveMessage) {
    if (message.type === "started") {
      this.started = true;
      this.memory.clear();
      this.captures.update({ capture: null, refused: null });
      this.traced.clear();
      this.paced = null;
      this.loadShown = null;
      this.worked.clear();
      this.telemetry.update({ reached: 0, speed: null, levels: {}, load: null, held: null, parts: {}, interval: message.interval });
      this.listener.onNodes(message.nodes);
      this.controls = message.controls;
      this.listener.onControls(message.controls);
      this.listener.onBusy(false);
      // What changed while the circuit was starting — a bench switched to realistic just before Run, a slider moved —
      // was refused by `edit` then, since nothing ran yet; it is applied now, or the run would go on without it.
      this.edit(this.input.circuit, this.input.values);
    } else if (message.type === "capture") {
      const captured = new SampleMemory(Math.max(2, message.time.length));
      captured.append(message.time, message.channels, message.peaks, message.interval);
      this.captures.update({ capture: captured, refused: null });
    } else if (message.type === "capture-refused") {
      this.captures.update({ refused: message.message });
    } else if (message.type === "frame") {
      this.memory.append(message.time, message.channels, message.peaks, message.interval);
      this.traced.append(message.trace.time, message.trace.columns, message.trace.units, message.trace.rms);
      this.work(message.time, message.parts);
      const load = this.loadShown;
      this.loadShown = load === null ? message.load : load * 0.8 + message.load * 0.2;
      const capture = this.recording;
      if (capture) {
        capture.append(message.time, message.channels);
        if (capture.complete) {
          this.stopRecording();
        }
      }
      const now = performance.now();
      if (now - this.shownAt > SHOWN_EVERY_MILLISECONDS) {
        this.shownAt = now;
        const circuitTime = message.time.at(-1) ?? 0;
        const before = this.paced;
        const measured = before && now > before.wall && circuitTime >= before.circuit
          ? (circuitTime - before.circuit) / ((now - before.wall) / 1000) : null;
        // Frames arrive in clusters, so a fifth of a second holds four of them or six: the figure is smoothed over a
        // second or so, or it reads 0.8× and 1.3× in turn while the run plays evenly.
        const shown = this.telemetry.current().speed;
        const speed = measured === null ? shown : shown === null ? measured : shown + (measured - shown) * 0.3;
        this.paced = { wall: now, circuit: circuitTime };
        if (speed !== null && speed > 0) {
          // The speed it really plays at, not the one asked for: a circuit the server cannot keep up with plays slower,
          // and its lights and its readings' windows have to keep their pace on the screen all the same.
          this.traced.pace(speed);
        }
        // The sheet shows what the screen plays, not the frame's last sample — a frame is 40 ms, two periods of 50 Hz, and
        // its last sample is the same phase every time —; and it shows it as a reading shown five times a second should:
        // the mean over the fifth of a second before. A 20 kHz edge read at one instant is a different phase each time.
        const moment = this.traced.windowAt(playedTime(this.playback, this.traced, now), SHOWN_EVERY_MILLISECONDS / 1000);
        const levels = moment ? levelsOf(moment, this.traced.columnUnits) : message.levels ?? {};
        const terminals = moment ? loadsOf(moment, this.traced.columnUnits) : {};
        const parts = Object.fromEntries(Object.entries(message.parts).map(([part, load]) => {
          const power = this.meanPower(part) ?? load.power;
          return [part, { ...load, power, ...(terminals[part] ? { terminals: terminals[part].terminals } : {}) }];
        }));
        this.worked.clear();
        this.telemetry.update({ reached: circuitTime, speed, levels, load: this.loadShown, held: message.played, parts });
        if (this.recording) {
          this.listener.onRecording({ received: this.recording.time.length, target: this.recording.target });
        }
      }
    } else if (message.type === "changed") {
      this.controls = message.controls;
      this.listener.onControls(message.controls);
    } else if (message.type === "problem") {
      this.listener.onProblem(message.message);
      this.listener.onRunning(false);
      this.listener.onBusy(false);
    }
  }
}

import type { CircuitDefinition } from "../circuit/circuit";

/**
 * `/jmouse/parallax/live`: one running circuit per socket. The server steps it and streams what the probes read; the
 * reader starts and pauses it, moves probes, works live parts and edits it — each as a message. The bearer token rides
 * as the `bearer.<token>` subprotocol, the one place a browser lets a WebSocket handshake carry it.
 */

/**
 * What the server reads on every sample, by channel: the voltage of `positive` against `negative` (an oscilloscope
 * channel, a voltmeter), or on `part` the current into its `terminal` (its first when none) or the power it takes.
 */
export interface LiveProbe {
  channel: string;
  quantity?: "VOLTAGE" | "CURRENT" | "POWER" | "READING";
  positive: string;
  negative: string;
  part?: string;
  terminal?: string;
}

/** A part's value a reader works while it runs: a switch toggles, a button is held, a wiper slides. */
export interface LiveControl {
  part: string;
  parameter: string;
  label: string;
  minimum: number;
  maximum: number;
  step: number;
  value: number;
  kind: "TOGGLE" | "MOMENTARY" | "SLIDER";
}

export type LiveMessage =
  | { type: "started"; interval: number; nodes: string[]; controls: LiveControl[]; probes: LiveProbe[] }
  | LiveFrame
  | { type: "changed"; continued: boolean; controls: LiveControl[]; time: number }
  | { type: "problem"; message: string };

export interface LiveStart {
  objectId: string;
  definition: CircuitDefinition | null;
  values: Record<string, number>;
  interval: number;
  probes: LiveProbe[];
}

/** A frame of samples, decoded from the binary message the server sends (`FrameEncoding` on the server). */
export interface LiveFrame {
  type: "frame";
  time: Float64Array;
  /** The time between two samples: the frame's samples are evenly spaced by it, and so is the stream they continue. */
  interval: number;
  channels: Record<string, Float32Array>;
  /**
   * Each voltage channel's lowest, highest and mean reading over every sample's interval — the peak detection a digital
   * oscilloscope draws with, so a signal faster than the samples shows as the band it fills, not as a saw.
   */
  peaks: Record<string, { lows: Float32Array; highs: Float32Array; means: Float32Array }>;
  levels: Record<string, number>;
  /** The share of the frame's period the server spent computing it. */
  load: number;
  /** The speed the server plays at: the one asked for, or the lower one it holds while it cannot keep up. */
  played: number | null;
  /** How hard every part worked over the frame. */
  parts: Record<string, PartLoad>;
  /**
   * The whole circuit at the moments the server traced — a node (`out`, in volts), a part (`R1`) or a pin
   * (`U1.output`, in amperes), the columns of a computed transient —: what the sheet plays its currents and voltages
   * from at the clock's time. When the server keeps one sample in several, each moment is the mean over the stretch it
   * stands for, and `rms` is that stretch's RMS — what a current alternating faster than the moments still carries.
   */
  trace: { time: Float64Array; columns: Record<string, Float32Array>; units: Record<string, string>; rms: Record<string, Float32Array> };
}

/** A part's work over a frame (`PartLoad` on the server); null where the server does not know the figure. */
export interface PartLoad {
  /** Average watts taken from the circuit; negative for a source that delivered them. */
  power: number | null;
  /** Amperes flowing into each of its terminals at the frame's end: "+" and "−" for a two-terminal part, pin names for a model. */
  terminals: Record<string, number>;
  /** How warm it is now, °C: it moves towards what it would settle at, at its own thermal time constant. */
  temperature: number | null;
  /** The hottest its component lets it be, °C; null when the component sets no limit. */
  maximum?: number | null;
  /** The power its component rates it for, W; null when it states none. */
  rating?: number | null;
  /** How it failed on a realistic bench; null while it works. */
  failure?: "open" | "short" | null;
  /** What its symbol shows now, by indicator name — its component's `display` figures. */
  displays?: Record<string, number>;
}

const HEADER_DECODER = new TextDecoder();

/** Reads a binary frame: a JSON header, then the first time and the step, then each channel's readings. */
function decodeFrame(buffer: ArrayBuffer): LiveFrame {
  const view = new DataView(buffer);
  const headerLength = view.getInt32(0, true);
  const header = JSON.parse(HEADER_DECODER.decode(new Uint8Array(buffer, 4, headerLength))) as
    { channels: string[]; levels: Record<string, number>; load: number; played?: number; parts?: Record<string, [number | null, number | null, Record<string, number>, (number | null)?, (number | null)?, ("open" | "short" | null)?, Record<string, number>?]>;
      trace?: string[]; traceUnits?: string[]; peaks?: string[] };
  let offset = (4 + headerLength + 7) & ~7;
  const first = view.getFloat64(offset, true);
  const step = view.getFloat64(offset + 8, true);
  const count = view.getInt32(offset + 16, true);
  offset += 24;
  const time = new Float64Array(count);
  for (let index = 0; index < count; index++) {
    time[index] = first + index * step;
  }
  const channels: Record<string, Float32Array> = {};
  for (const name of header.channels) {
    channels[name] = new Float32Array(buffer, offset, count);
    offset += count * Float32Array.BYTES_PER_ELEMENT;
  }
  const peaks: LiveFrame["peaks"] = {};
  for (const name of header.peaks ?? []) {
    const lows = new Float32Array(buffer, offset, count);
    offset += count * Float32Array.BYTES_PER_ELEMENT;
    const highs = new Float32Array(buffer, offset, count);
    offset += count * Float32Array.BYTES_PER_ELEMENT;
    const means = new Float32Array(buffer, offset, count);
    offset += count * Float32Array.BYTES_PER_ELEMENT;
    peaks[name] = { lows, highs, means };
  }
  // The trace starts at the next multiple of eight: its times are double precision.
  offset = (offset + 7) & ~7;
  const traced: LiveFrame["trace"] = { time: new Float64Array(0), columns: {}, units: {}, rms: {} };
  if (header.trace && offset + 8 <= buffer.byteLength) {
    const moments = view.getInt32(offset, true);
    offset += 8;
    traced.time = new Float64Array(buffer.slice(offset, offset + moments * Float64Array.BYTES_PER_ELEMENT));
    offset += moments * Float64Array.BYTES_PER_ELEMENT;
    for (const name of header.trace) {
      traced.columns[name] = new Float32Array(buffer, offset, moments);
      offset += moments * Float32Array.BYTES_PER_ELEMENT;
    }
    if (offset + header.trace.length * moments * Float32Array.BYTES_PER_ELEMENT <= buffer.byteLength) {
      for (const name of header.trace) {
        traced.rms[name] = new Float32Array(buffer, offset, moments);
        offset += moments * Float32Array.BYTES_PER_ELEMENT;
      }
    }
    header.trace.forEach((name, index) => {
      traced.units[name] = header.traceUnits?.[index] ?? "";
    });
  }
  const parts: Record<string, PartLoad> = {};
  for (const [part, [power, temperature, terminals, maximum, rating, failure, displays]] of Object.entries(header.parts ?? {})) {
    parts[part] = { power, temperature, terminals: terminals ?? {}, maximum: maximum ?? null, rating: rating ?? null, failure: failure ?? null,
      displays: displays ?? {} };
  }
  return { type: "frame", time, interval: step, channels, peaks, levels: header.levels, load: header.load, played: header.played ?? null, parts, trace: traced };
}

export interface LiveSocket {
  send(message: Record<string, unknown>): void;
  close(): void;
}

/**
 * Where the live socket is and whose it is — the transport's `live`. Apart from the request function because a socket
 * is not a request: it needs its own address (`ws:`, not `http:`) and the token itself, which a browser lets a
 * handshake carry only as a subprotocol, while a request function keeps its token to itself.
 */
export interface ParallaxLive {
  /** The socket's whole address: `ws://…/jmouse/parallax/live`, or `wss://…` on a secure page. */
  socketUrl(): string;
  /** The reader's bearer token, or null for nobody; asked for each time a socket opens. */
  token(): string | null;
}

/** Opens the socket; messages the server sends go to `onMessage`, a closed socket to `onClose`. */
export function openLiveCircuit(live: ParallaxLive, onMessage: (message: LiveMessage) => void, onClose: (reason: string) => void): Promise<LiveSocket> {
  const token = live.token();
  const socket = new WebSocket(live.socketUrl(), ["parallax.live", ...(token ? [`bearer.${token}`] : [])]);
  socket.binaryType = "arraybuffer";
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve({
      send: (message) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      },
      close: () => socket.close(1000, "done"),
    }), { once: true });
    socket.addEventListener("error", () => reject(new Error("The live circuit could not be reached.")), { once: true });
    socket.addEventListener("message", (event) => onMessage(event.data instanceof ArrayBuffer
      ? decodeFrame(event.data) : JSON.parse(String(event.data)) as LiveMessage));
    socket.addEventListener("close", (event) => onClose(event.reason || "The live circuit closed."));
  });
}

/*
 * Animation as the drawing library plays it: frames computed ahead by whoever owns the data, buffered here, and a
 * clock that steps through them — waiting at a frame that has not arrived rather than skipping it — and says, every
 * screen frame, how far it is toward the next one so the stage can draw between them (`Stage.setBlend`).
 * Nothing here knows where frames come from: the product hands in a loader.
 */

/** Asks for the frames at some values, in order; may answer fewer than asked, and says whether it stopped early. */
export type FrameLoader<Frame> = (values: number[], signal: AbortSignal) => Promise<{ frames: Frame[]; complete: boolean }>;

const MAXIMUM_CHUNK = 8;
/** About how many elements one answer may carry, so taking it in never stalls a frame for long. */
const ELEMENTS_PER_ANSWER = 120_000;

/** The frames of one animation over a grid of values, filling in from a starting frame onwards and round. */
export class FrameBuffer<Frame> {
  readonly grid: readonly number[];
  readonly frames: (Frame | null)[];
  readonly #loader: FrameLoader<Frame>;
  #loaded = 0;
  #failure: string | null = null;
  #version = 0;
  #listeners = new Set<() => void>();
  #controller: AbortController | null = null;
  #start = 0;

  readonly #weigh: (frame: Frame) => number;
  #chunk = 2;

  /** `weigh` says how many elements a frame carries: heavy frames are asked for a few at a time, light ones in eights. */
  constructor(grid: readonly number[], loader: FrameLoader<Frame>, weigh: (frame: Frame) => number = () => 0) {
    this.grid = grid;
    this.frames = grid.map(() => null);
    this.#loader = loader;
    this.#weigh = weigh;
  }

  get loaded(): number {
    return this.#loaded;
  }

  get total(): number {
    return this.frames.length;
  }

  get complete(): boolean {
    return this.#loaded === this.frames.length;
  }

  /** Why frames stopped coming — one too heavy, a refusal — or null. */
  get failure(): string | null {
    return this.#failure;
  }

  /** Moves on every arrival, for a view that subscribes. */
  get version(): number {
    return this.#version;
  }

  has(index: number): boolean {
    return this.frames[index] !== null && this.frames[index] !== undefined;
  }

  /** The frame at an index, or the nearest one before it that is here — a still picture rather than a hole. */
  frameAt(index: number): Frame | null {
    for (let offset = 0; offset < this.frames.length; offset++) {
      const frame = this.frames[(index - offset + this.frames.length) % this.frames.length];
      if (frame) {
        return frame;
      }
    }
    return null;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Fills from `start`, a chunk at a time; asking again only moves where the next chunk begins. */
  fill(start: number) {
    this.#start = Math.max(0, Math.min(this.frames.length - 1, start));
    if (this.#controller || this.complete || this.#failure) {
      return;
    }
    const controller = new AbortController();
    this.#controller = controller;
    void this.#run(controller.signal).finally(() => {
      if (this.#controller === controller) {
        this.#controller = null;
      }
    });
  }

  stop() {
    this.#controller?.abort();
    this.#controller = null;
  }

  async #run(signal: AbortSignal) {
    while (!this.complete && !signal.aborted) {
      const indices: number[] = [];
      for (let offset = 0; offset < this.frames.length && indices.length < this.#chunk; offset++) {
        const index = (this.#start + offset) % this.frames.length;
        if (!this.has(index)) {
          indices.push(index);
        }
      }
      try {
        const answer = await this.#loader(indices.map((index) => this.grid[index]), signal);
        answer.frames.forEach((frame, position) => {
          this.frames[indices[position]] = frame;
          this.#loaded++;
        });
        if (answer.frames.length > 0) {
          this.#start = indices[answer.frames.length - 1] + 1;
          const heaviest = Math.max(1, ...answer.frames.map((frame) => this.#weigh(frame)));
          this.#chunk = Math.max(1, Math.min(MAXIMUM_CHUNK, Math.floor(ELEMENTS_PER_ANSWER / heaviest)));
        } else if (!answer.complete) {
          this.#failure = "A frame is too heavy to compute while it plays.";
        }
      } catch (failure) {
        if (signal.aborted) {
          return;
        }
        this.#failure = failure instanceof Error ? failure.message : "The frames did not arrive.";
      }
      this.#version++;
      this.#listeners.forEach((listener) => listener());
      if (this.#failure) {
        return;
      }
    }
  }
}

/** `count` evenly spaced values from `minimum` to `maximum`, both ends included. */
export function frameGrid(minimum: number, maximum: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => minimum + ((maximum - minimum) * index) / Math.max(1, count - 1));
}

/** The grid index nearest a value. */
export function nearestFrame(grid: readonly number[], value: number): number {
  if (grid.length < 2) {
    return 0;
  }
  const step = (grid[grid.length - 1] - grid[0]) / (grid.length - 1);
  return Math.max(0, Math.min(grid.length - 1, Math.round((value - grid[0]) / (step || 1))));
}

export interface ClockOptions {
  frameCount: number;
  secondsPerLoop: number;
  loop: boolean;
  /** Whether a frame can be shown — every buffer that plays has it. */
  isReady: (index: number) => boolean;
  onIndex: (index: number) => void;
  /** How far from the shown frame to the next, 0 to 1, every screen frame. */
  onPhase?: (phase: number) => void;
  onWaiting?: (waiting: boolean) => void;
}

/**
 * Steps through frames at the pace of a loop. It waits at a frame that has not arrived — waiting is not falling
 * behind, so play resumes from there instead of jumping — and reports its phase between frames every screen frame.
 */
export class AnimationClock {
  #options: ClockOptions;
  #index: number;
  #request = 0;
  #running = false;

  constructor(options: ClockOptions, index = 0) {
    this.#options = options;
    this.#index = index;
  }

  /** Changes what the clock reads without restarting it. */
  update(options: Partial<ClockOptions>) {
    this.#options = { ...this.#options, ...options };
  }

  /** Where the clock is; a scrub moves it without stopping it. */
  set index(index: number) {
    this.#index = index;
  }

  start() {
    if (this.#running || this.#options.frameCount < 2) {
      return;
    }
    this.#running = true;
    let last = performance.now();
    let carried = 0;
    let waiting = false;
    const tick = (now: number) => {
      if (!this.#running) {
        return;
      }
      const { frameCount, secondsPerLoop, loop, isReady } = this.#options;
      const step = (secondsPerLoop * 1000) / frameCount;
      carried += now - last;
      last = now;
      let blocked = false;
      let next = this.#index;
      const after = (index: number) => (index + 1 >= frameCount ? (loop ? 0 : -1) : index + 1);
      while (carried >= step) {
        const candidate = after(next);
        if (candidate < 0 || !isReady(candidate)) {
          carried = 0;
          blocked = candidate >= 0;
          break;
        }
        next = candidate;
        carried -= step;
      }
      if (blocked !== waiting) {
        waiting = blocked;
        this.#options.onWaiting?.(blocked);
      }
      if (next !== this.#index) {
        this.#index = next;
        this.#options.onIndex(next);
      }
      const following = after(next);
      this.#options.onPhase?.(blocked || following < 0 || !isReady(following) ? 0 : Math.min(1, carried / step));
      this.#request = requestAnimationFrame(tick);
    };
    this.#request = requestAnimationFrame(tick);
  }

  stop() {
    this.#running = false;
    cancelAnimationFrame(this.#request);
    this.#options.onPhase?.(0);
    this.#options.onWaiting?.(false);
  }
}

/** What a player shows at a moment: per animated thing, its frame and the next one; one phase between them for all. */
export interface PlayerFrame<Frame> {
  index: number;
  phase: number;
  frames: ReadonlyMap<string, { frame: Frame | null; next: Frame | null }>;
}

/**
 * Plays any number of buffers over one grid by one clock — several animated things kept in step, as the lines of a
 * graph are. It hands every screen frame to its listeners directly: a view draws from it without a framework render.
 */
export class AnimationPlayer<Frame> {
  readonly #buffers: ReadonlyMap<string, FrameBuffer<Frame>>;
  readonly #clock: AnimationClock;
  readonly #frameCount: number;
  readonly #listeners = new Set<(frame: PlayerFrame<Frame>) => void>();
  readonly #indexListeners = new Set<(index: number) => void>();
  readonly #waitingListeners = new Set<(waiting: boolean) => void>();
  #index: number;
  #phase = 0;
  #playing = false;
  /** Whether play waits until every frame of every buffer is here, rather than for the next one. */
  readonly #whole: boolean;

  constructor(buffers: ReadonlyMap<string, FrameBuffer<Frame>>, frameCount: number, options: { secondsPerLoop: number; loop: boolean; whole?: boolean }, index = 0) {
    this.#buffers = buffers;
    this.#whole = options.whole ?? false;
    this.#frameCount = frameCount;
    this.#index = index;
    this.#clock = new AnimationClock({
      frameCount,
      secondsPerLoop: options.secondsPerLoop,
      loop: options.loop,
      isReady: (candidate) => this.#ready(candidate),
      onIndex: (next) => {
        this.#index = next;
        this.#fill();
        this.#indexListeners.forEach((listener) => listener(next));
      },
      onPhase: (phase) => {
        this.#phase = phase;
        this.#emit();
      },
      onWaiting: (waiting) => this.#waitingListeners.forEach((listener) => listener(waiting)),
    }, index);
  }

  get index(): number {
    return this.#index;
  }

  get playing(): boolean {
    return this.#playing;
  }

  /** The frame on screen now, for a view that subscribes after play began. */
  get current(): PlayerFrame<Frame> {
    return this.#frame();
  }

  play() {
    if (this.#playing) {
      return;
    }
    this.#playing = true;
    this.#fill();
    this.#clock.start();
  }

  pause() {
    this.#playing = false;
    this.#clock.stop();
  }

  /** Jumps to a frame — a scrub — whether playing or not. */
  seek(index: number) {
    this.#index = Math.max(0, Math.min(this.#frameCount - 1, index));
    this.#clock.index = this.#index;
    this.#phase = 0;
    this.#fill();
    this.#emit();
    this.#indexListeners.forEach((listener) => listener(this.#index));
  }

  update(options: { secondsPerLoop?: number; loop?: boolean }) {
    this.#clock.update(options);
  }

  /** Every screen frame while playing, and at every seek. */
  subscribe(listener: (frame: PlayerFrame<Frame>) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** When the frame index changes — a few times a second; for a readout, not for drawing. */
  onIndex(listener: (index: number) => void): () => void {
    this.#indexListeners.add(listener);
    return () => this.#indexListeners.delete(listener);
  }

  /** How many frames of all the buffers have arrived, of all there are. */
  get progress(): { loaded: number; total: number } {
    let loaded = 0;
    let total = 0;
    this.#buffers.forEach((buffer) => {
      loaded += buffer.loaded;
      total += buffer.total;
    });
    return { loaded, total };
  }

  /** Told whenever frames arrive in any buffer. */
  onProgress(listener: () => void): () => void {
    const stops = [...this.#buffers.values()].map((buffer) => buffer.subscribe(listener));
    return () => stops.forEach((stop) => stop());
  }

  onWaiting(listener: (waiting: boolean) => void): () => void {
    this.#waitingListeners.add(listener);
    return () => this.#waitingListeners.delete(listener);
  }

  destroy() {
    this.pause();
    this.#listeners.clear();
    this.#indexListeners.clear();
    this.#waitingListeners.clear();
  }

  #ready(index: number): boolean {
    for (const buffer of this.#buffers.values()) {
      if (this.#whole ? !buffer.complete : !buffer.has(index)) {
        return false;
      }
    }
    return true;
  }

  /** Keeps every buffer filling from the frame on screen onwards. */
  #fill() {
    this.#buffers.forEach((buffer) => buffer.fill(this.#index));
  }

  #frame(): PlayerFrame<Frame> {
    const following = (this.#index + 1) % this.#frameCount;
    const frames = new Map<string, { frame: Frame | null; next: Frame | null }>();
    this.#buffers.forEach((buffer, key) => {
      frames.set(key, { frame: buffer.frameAt(this.#index), next: buffer.has(this.#index) && buffer.has(following) ? buffer.frames[following] : null });
    });
    return { index: this.#index, phase: this.#phase, frames };
  }

  #emit() {
    if (this.#listeners.size === 0) {
      return;
    }
    const frame = this.#frame();
    this.#listeners.forEach((listener) => listener(frame));
  }
}

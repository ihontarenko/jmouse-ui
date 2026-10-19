import { channelDrawn, type SampleMemory, type ScopeSettings, type Window } from "../oscilloscope";
import { mathName, mathSource } from "./mathChannel";
import { phasorsOf, type Phasor, type PhasorDiagram } from "./phasors";
import { analysisLength, spectrumAxisOf, spectrumOf, type Spectrum, type SpectrumAxis } from "./spectrum";

/*
 * What the FFT and phasor displays read, held steady the way an instrument holds them. Worked out at every animation
 * frame over a window that slides a little each time, a spectrum's bins and a phasor's angle shook sixty times a second,
 * and a frame whose window fell short drew the "need a period" message in between — the screen flickered. So the
 * analysis is read a few times a second, each read averaged into the last ones (powers for a spectrum, complex values
 * for a phasor), and a read that finds nothing keeps the last good picture a moment before giving it up. A change of
 * what is analysed — a channel, the math, the time base, a new run — starts afresh at once.
 *
 * A spectrum is read over the same number of samples every time, so its bins stay where they were and the average
 * holds: a live record is a few hundred samples one moment and thousands the next, and a spectrum read over whatever it
 * held changed its resolution at every read — the average started again each time and the picture jumped. A read that
 * finds a shorter record is skipped; one twice as long moves to the finer grid.
 */

/** How often a running signal is analysed again. */
const READ_INTERVAL_MILLISECONDS = 200;
/** The weight a new read has in the average: about the last five reads, a second, are seen. */
const AVERAGE_WEIGHT = 0.3;
/** How long a read that finds nothing leaves the last good picture standing. */
const HOLD_MILLISECONDS = 1500;
/** A phasor frequency that moved by more than this share is a different signal: the average starts again. */
const FREQUENCY_TOLERANCE = 0.02;

export interface ChannelSpectrum {
  channel: { id: string; color: number };
  spectrum: Spectrum | null;
}

export interface ChannelSpectra {
  spectra: ChannelSpectrum[];
  axis: SpectrumAxis | null;
}

const NO_SPECTRA: ChannelSpectra = { spectra: [], axis: null };

/** The FFT display's spectra or the phasor display's diagram, whichever the screen shows. */
export interface AnalysisReadout {
  spectra: ChannelSpectra;
  diagram: PhasorDiagram | null;
}

export class ScreenAnalysis {
  private subject = "";
  private computedData = "";
  private seenData = "";
  private computedAt = Number.NEGATIVE_INFINITY;
  private foundAt = Number.NEGATIVE_INFINITY;
  private spectra: ChannelSpectra = NO_SPECTRA;
  private diagram: PhasorDiagram | null = null;
  /** How many samples each spectrum of this subject is read over; null until the first read. */
  private spectrumSamples: number | null = null;

  /** Whether the signal moved since the last read: the screen must keep drawing until it has been read. */
  get pending(): boolean {
    return this.seenData !== this.computedData;
  }

  /** What the display shown needs, read once a frame and handed to both the traces and the marks. */
  read(memory: SampleMemory, settings: ScopeSettings, view: Window, now: number): AnalysisReadout {
    if (settings.display === "fft") {
      return { spectra: this.spectraOf(memory, settings, view, now), diagram: null };
    }
    if (settings.display === "phasors") {
      return { spectra: NO_SPECTRA, diagram: this.phasorsOf(memory, settings, view, now) };
    }
    this.seenData = this.computedData;
    return { spectra: NO_SPECTRA, diagram: null };
  }

  /** The spectra of the enabled channels and the math channel, as steady as the signal allows. */
  spectraOf(memory: SampleMemory, settings: ScopeSettings, view: Window, now: number): ChannelSpectra {
    if (this.due(memory, settings, view, now)) {
      const available = analysisLength(memory, view);
      if (this.spectrumSamples === null || available >= 2 * this.spectrumSamples) {
        this.spectrumSamples = available;
      } else if (available < this.spectrumSamples) {
        // A shorter record than this subject is read over: the last picture stands, and is not given up for it.
        this.foundAt = now;
        return this.spectra;
      }
      const next = readSpectra(memory, settings, view, this.spectrumSamples);
      if (next.axis) {
        this.spectra = this.spectra.axis ? averageSpectra(this.spectra, next) : next;
        this.foundAt = now;
      } else if (now - this.foundAt > HOLD_MILLISECONDS) {
        this.spectra = NO_SPECTRA;
      }
    }
    return this.spectra;
  }

  /** The phasor diagram, as steady as the signal allows. */
  phasorsOf(memory: SampleMemory, settings: ScopeSettings, view: Window, now: number): PhasorDiagram | null {
    if (this.due(memory, settings, view, now)) {
      const next = phasorsOf(memory, settings, view);
      if (next) {
        this.diagram = this.diagram ? averagePhasors(this.diagram, next) : next;
        this.foundAt = now;
      } else if (now - this.foundAt > HOLD_MILLISECONDS) {
        this.diagram = null;
      }
    }
    return this.diagram;
  }

  /** Whether to read now: at once for a new subject, otherwise when the signal moved and a read interval has passed. */
  private due(memory: SampleMemory, settings: ScopeSettings, view: Window, now: number): boolean {
    const subject = subjectOf(memory, settings);
    const data = `${memory.version}/${view.start}/${view.span}`;
    this.seenData = data;
    if (subject !== this.subject) {
      this.subject = subject;
      this.spectra = NO_SPECTRA;
      this.diagram = null;
      this.spectrumSamples = null;
      this.foundAt = Number.NEGATIVE_INFINITY;
    } else if (data === this.computedData || now - this.computedAt < READ_INTERVAL_MILLISECONDS) {
      return false;
    }
    this.computedData = data;
    this.computedAt = now;
    return true;
  }
}

/** What is analysed: the run, the display, the time base and every channel's source — not where the window stands. */
function subjectOf(memory: SampleMemory, settings: ScopeSettings): string {
  const channels = settings.channels.filter((channel) => channel.enabled)
    .map((channel) => `${channel.id}:${channel.quantity ?? "voltage"}:${channel.node}:${channel.reference}:${channel.part ?? ""}:${channel.coupling}:${channel.shown !== false}`);
  const math = settings.math?.enabled ? mathName(settings.math) : "";
  return [memory.generation, settings.display, settings.secondsPerDivision, settings.horizontal ?? "", channels.join(","), math].join("/");
}

function readSpectra(memory: SampleMemory, settings: ScopeSettings, view: Window, samples: number): ChannelSpectra {
  const spectra: ChannelSpectrum[] = settings.channels.filter(channelDrawn)
    .map((channel) => ({ channel: { id: channel.id as string, color: channel.color }, spectrum: spectrumOf(memory, channel.id, view, samples) }));
  const math = settings.math?.enabled ? settings.math : null;
  if (math) {
    spectra.push({ channel: { id: "M", color: math.color }, spectrum: spectrumOf(mathSource(memory, math), "M", view, samples) });
  }
  return { spectra, axis: spectrumAxisOf(spectra.map((entry) => entry.spectrum)) };
}

/** Power averaging, bin by bin, where a channel's bins are the same as last time; otherwise the new read stands. */
function averageSpectra(previous: ChannelSpectra, next: ChannelSpectra): ChannelSpectra {
  const spectra = next.spectra.map((entry) => {
    const before = previous.spectra.find((candidate) => candidate.channel.id === entry.channel.id)?.spectrum;
    const now = entry.spectrum;
    if (!before || !now || before.levels.length !== now.levels.length || Math.abs(before.resolution - now.resolution) > now.resolution * 1e-3) {
      return entry;
    }
    const levels = new Float64Array(now.levels.length);
    for (let bin = 0; bin < levels.length; bin++) {
      const power = (1 - AVERAGE_WEIGHT) * 10 ** (before.levels[bin] / 10) + AVERAGE_WEIGHT * 10 ** (now.levels[bin] / 10);
      levels[bin] = 10 * Math.log10(power);
    }
    return { channel: entry.channel, spectrum: { ...now, levels } };
  });
  // The axis is kept while it still holds every spectrum: it moves only when the record really changed its reach.
  const axis = previous.axis && next.axis && previous.axis.lowest === next.axis.lowest && previous.axis.highest === next.axis.highest ? previous.axis : next.axis;
  return { spectra, axis };
}

/** Each phasor averaged as a complex value; a frequency that moved further than the tolerance starts the average again. */
function averagePhasors(previous: PhasorDiagram, next: PhasorDiagram): PhasorDiagram {
  if (Math.abs(next.frequency - previous.frequency) > previous.frequency * FREQUENCY_TOLERANCE) {
    return next;
  }
  const phasors = next.phasors.map((phasor): Phasor => {
    const before = previous.phasors.find((candidate) => candidate.id === phasor.id && candidate.unit === phasor.unit);
    if (!before) {
      return phasor;
    }
    const real = (1 - AVERAGE_WEIGHT) * before.amplitude * Math.cos(before.angle) + AVERAGE_WEIGHT * phasor.amplitude * Math.cos(phasor.angle);
    const imaginary = (1 - AVERAGE_WEIGHT) * before.amplitude * Math.sin(before.angle) + AVERAGE_WEIGHT * phasor.amplitude * Math.sin(phasor.angle);
    return { ...phasor, amplitude: Math.hypot(real, imaginary), angle: Math.atan2(imaginary, real) };
  });
  return { ...next, frequency: (1 - AVERAGE_WEIGHT) * previous.frequency + AVERAGE_WEIGHT * next.frequency, phasors };
}

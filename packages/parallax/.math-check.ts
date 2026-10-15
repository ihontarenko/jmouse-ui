// Throwaway numerical check of the scope's mathematics against signals with a known answer. Not shipped.
import { SampleMemory } from "./src/oscilloscope/SampleMemory";
import { measure, type ScopeSettings } from "./src/oscilloscope/instrument";
import { peakNear, spectrumOf, spectrumPeak } from "./src/scope/spectrum";
import { phasorsOf } from "./src/scope/phasors";
import { mathSource } from "./src/scope/mathChannel";

const results: string[] = [];
const check = (name: string, got: number, want: number, tolerance: number) => {
  const ok = Math.abs(got - want) <= tolerance;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}: got ${got.toFixed(4)}, want ${want.toFixed(4)} ±${tolerance}`);
};

function fill(capacity: number, interval: number, count: number, signals: Record<string, (time: number) => number>) {
  const memory = new SampleMemory(capacity);
  const times: number[] = [];
  const readings: Record<string, number[]> = Object.fromEntries(Object.keys(signals).map((key) => [key, []]));
  for (let index = 0; index < count; index++) {
    const time = index * interval;
    times.push(time);
    for (const [key, signal] of Object.entries(signals)) {
      readings[key].push(signal(time));
    }
  }
  memory.append(times, readings);
  return memory;
}

function levelAt(spectrum: NonNullable<ReturnType<typeof spectrumOf>>, frequency: number) {
  // the local maximum within ±3 bins, refined like spectrumPeak
  let best = 0;
  let bestLevel = -Infinity;
  for (let bin = 0; bin < spectrum.frequencies.length; bin++) {
    if (Math.abs(spectrum.frequencies[bin] - frequency) <= 3 * spectrum.resolution && spectrum.levels[bin] > bestLevel) {
      bestLevel = spectrum.levels[bin];
      best = bin;
    }
  }
  return peakNear(spectrum, best);
}

const dB = (volts: number) => 20 * Math.log10(volts);
const TAU = 2 * Math.PI;

// 1. FFT: three tones on a 10 V offset, 10 µs samples, 10 000 kept, screen 20 ms (2 ms/div)
{
  const memory = fill(10_000, 1e-5, 10_000, { CH1: (t) => 10 + 2 * Math.sin(TAU * 160 * t) + 0.7 * Math.sin(TAU * 480 * t) + 0.4 * Math.sin(TAU * 800 * t) });
  const view = { start: 0.1 - 0.02, span: 0.02, triggered: null };
  const spectrum = spectrumOf(memory, "CH1", view)!;
  results.push(`FFT record: resolution ${spectrum.resolution.toFixed(3)} Hz, Nyquist ${spectrum.nyquist.toFixed(0)} Hz`);
  const peak = spectrumPeak(spectrum);
  check("FFT strongest peak frequency (160 Hz, offset 10 V must not win)", peak.frequency, 160, 0.5);
  for (const [frequency, amplitude] of [[160, 2], [480, 0.7], [800, 0.4]]) {
    const found = levelAt(spectrum, frequency);
    check(`FFT ${frequency} Hz frequency`, found.frequency, frequency, 0.5);
    check(`FFT ${frequency} Hz level dBV (${amplitude} V)`, found.level, dB(amplitude), 0.05);
  }
}

// 2. FFT: a tone between bins (scalloping) — 123.4 Hz, 1 V
{
  const memory = fill(10_000, 1e-5, 10_000, { CH1: (t) => Math.sin(TAU * 123.4 * t) });
  const spectrum = spectrumOf(memory, "CH1", { start: 0.08, span: 0.02, triggered: null })!;
  const peak = spectrumPeak(spectrum);
  check("FFT off-bin tone frequency 123.4 Hz", peak.frequency, 123.4, 0.3);
  check("FFT off-bin tone level 0 dBV", peak.level, 0, 0.05);
}

// 3. Phasors: RLC at 1.2 kHz as the theory gives it, with a DC offset on CH1 that must not move anything
{
  const frequency = 1200;
  const degrees = Math.PI / 180;
  const memory = fill(10_000, 1e-6, 10_000, {
    CH1: (t) => 2 * Math.sin(TAU * frequency * t),
    CH2: (t) => 0.02632 * Math.sin(TAU * frequency * t + 48.86 * degrees),
    CH3: (t) => 1.984 * Math.sin(TAU * frequency * t + 138.86 * degrees),
    CH4: (t) => 3.491 * Math.sin(TAU * frequency * t - 41.14 * degrees),
  });
  const channel = (id: string, quantity: "voltage" | "current" = "voltage") => ({ id, enabled: true, node: id, reference: "ground", voltsPerDivision: 1, position: 0, coupling: "DC", color: 1, name: "", quantity }) as any;
  const settings: ScopeSettings = {
    channels: [channel("CH1"), channel("CH2", "current"), channel("CH3"), channel("CH4")],
    secondsPerDivision: 0.0005, trigger: { mode: "auto", source: "CH1", edge: "rising", level: 0, position: 0.5 }, wheel: "time", active: "CH1",
    cursors: { enabled: false, first: 0.3, second: 0.7 }, phosphor: false, display: "phasors",
    math: { enabled: true, operation: "difference", first: "CH1", second: "CH4", voltsPerDivision: 1, position: 0, color: 6 },
  };
  const diagram = phasorsOf(memory, settings, { start: 0.005, span: 0.005, triggered: null })!;
  check("Phasor frequency 1200 Hz", diagram.frequency, 1200, 0.2);
  const byId = Object.fromEntries(diagram.phasors.map((phasor) => [phasor.id, phasor]));
  check("Phasor CH2 I amplitude mA", byId.CH2.amplitude * 1000, 26.32, 0.1);
  check("Phasor CH2 I angle °", byId.CH2.angle / degrees, 48.86, 0.3);
  check("Phasor CH3 U_L amplitude V", byId.CH3.amplitude, 1.984, 0.01);
  check("Phasor CH3 U_L angle °", byId.CH3.angle / degrees, 138.86, 0.3);
  check("Phasor CH4 U_C amplitude V", byId.CH4.amplitude, 3.491, 0.01);
  check("Phasor CH4 U_C angle °", byId.CH4.angle / degrees, -41.14, 0.3);
  // M = CH1 − CH4 = U_R + U_L: 2∠0 − 3.491∠−41.14
  const real = 2 - 3.491 * Math.cos(-41.14 * degrees);
  const imaginary = -3.491 * Math.sin(-41.14 * degrees);
  check("Phasor M = CH1−CH4 amplitude V", byId.M.amplitude, Math.hypot(real, imaginary), 0.02);
  check("Phasor M angle °", byId.M.angle / degrees, Math.atan2(imaginary, real) / degrees, 0.5);
  // with a 5 V offset on the reference
  const offset = fill(10_000, 1e-6, 10_000, { CH1: (t) => 5 + 2 * Math.sin(TAU * frequency * t), CH4: (t) => 3.491 * Math.sin(TAU * frequency * t - 41.14 * degrees) });
  const shifted = phasorsOf(offset, { ...settings, channels: [channel("CH1"), channel("CH4")], math: undefined }, { start: 0.005, span: 0.005, triggered: null })!;
  check("Phasor with 5 V offset: CH1 amplitude stays 2 V", shifted.phasors[0].amplitude, 2, 0.02);
  check("Phasor with 5 V offset: CH4 angle stays −41.14°", shifted.phasors[1].angle / degrees, -41.14, 0.3);
}

// 4. Math channel and measurements
{
  const memory = fill(10_000, 1e-5, 10_000, {
    CH1: (t) => (((t * 1000) % 1) < 0.3 ? 5 : 0),
    CH2: (t) => 3 * Math.sin(TAU * 50 * t),
  });
  const view = { start: 0.06, span: 0.04, triggered: null };
  const square = measure(memory, "CH1", view)!;
  check("Square 1 kHz frequency", square.frequency ?? NaN, 1000, 1);
  check("Square duty 30 %", (square.duty ?? NaN) * 100, 30, 0.6);
  check("Square mean 1.5 V", square.mean, 1.5, 0.02);
  check("Square RMS √(0.3)·5 = 2.739 V", square.rms, 5 * Math.sqrt(0.3), 0.02);
  const sine = measure(memory, "CH2", view)!;
  check("Sine 3 V RMS 2.121", sine.rms, 3 / Math.SQRT2, 0.01);
  check("Sine pp 6 V", sine.maximum - sine.minimum, 6, 0.01);
  const sum = mathSource(memory, { enabled: true, operation: "sum", first: "CH1", second: "CH2", voltsPerDivision: 1, position: 0, color: 6 });
  const index = memory.indexAt(0.0613);
  check("M = A+B sample", sum.reading("M", index), memory.reading("CH1", index) + memory.reading("CH2", index), 1e-9);
  const product = mathSource(memory, { enabled: true, operation: "product", first: "CH2", second: "CH2", voltsPerDivision: 1, position: 0, color: 6 });
  let mean = 0;
  let count = 0;
  for (let at = memory.indexAt(0.06); at < memory.indexAt(0.1); at++) {
    mean += product.reading("M", at);
    count++;
  }
  check("M = CH2×CH2 mean = 4.5 V² (power of a 3 V sine on 1 Ω)", mean / count, 4.5, 0.02);
}

// 5. A live memory: blocks of 4096 samples at 5 µs with a 19.5 ms gap between, the screen's end 900 samples into the last block
{
  const memory = new SampleMemory(10_000);
  const signal = (t: number) => 2 * Math.sin(TAU * 1200 * t);
  let time = 0;
  for (const count of [1808, 4096, 900]) {
    const times: number[] = [];
    const values: number[] = [];
    for (let index = 0; index < count; index++) {
      times.push(time);
      values.push(signal(time));
      time += 5e-6;
    }
    memory.append(times, { CH1: values });
    time += 0.0195;
  }
  const end = memory.lastTime();
  const spectrum = spectrumOf(memory, "CH1", { start: end - 0.005, span: 0.005, triggered: null })!;
  results.push(`gapped record: resolution ${spectrum.resolution.toFixed(2)} Hz`);
  check("Gapped FFT resolution ≤ 50 Hz (a whole block)", spectrum.resolution, 48.8, 2);
  check("Gapped FFT level 6.02 dBV", spectrumPeak(spectrum).level, dB(2), 0.05);
  check("Gapped FFT frequency 1200 Hz", spectrumPeak(spectrum).frequency, 1200, 0.5);
}

console.log(results.join("\n"));

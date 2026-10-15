import { CHANNEL_IDS, type ScopeSettings } from "../oscilloscope";
import type { BenchProbe, CircuitElement } from "../circuit/circuit";

/*
 * Where an oscilloscope's probes touch a circuit: the nodes a fresh screen probes first, and the probes the server
 * measures. The instrument itself is `lib/oscilloscope`; how a circuit names its nodes is this product's.
 */

/**
 * Where the probes go first: the signal in (or the PWM, or the first node that is not a supply) and the signal out.
 * A part's inner nodes (`U1.lower`) are measurable but never a first choice.
 */
export function initialSettings(nodes: readonly string[], written: readonly BenchProbe[] = []): ScopeSettings {
  const settings = suggestedSettings(nodes);
  // The circuit's own `probes` block wins for the channels it names: those are on, where it put them.
  const channels = written.filter((probe) => (probe.measure === "voltage" || probe.measure === "current") && /^CH[1-4]$/.test(probe.id));
  if (!channels.length) {
    return settings;
  }
  return {
    ...settings,
    channels: settings.channels.map((channel) => {
      const probe = channels.find((candidate) => candidate.id === channel.id);
      return probe?.measure === "current"
        ? { ...channel, enabled: true, quantity: "current" as const, part: probe.target, node: "ground", reference: "ground", voltsPerDivision: probe.scale ?? 0.01 }
        : probe ? { ...channel, enabled: true, quantity: "voltage" as const, node: probe.target === "0" ? "ground" : probe.target,
        reference: probe.reference && probe.reference !== "0" ? probe.reference : "ground", voltsPerDivision: probe.scale ?? channel.voltsPerDivision }
        : { ...channel, enabled: false };
    }),
    active: channels[0].id as ScopeSettings["active"],
    trigger: { ...settings.trigger, source: channels[0].id as ScopeSettings["trigger"]["source"] },
  };
}

function suggestedSettings(nodes: readonly string[]): ScopeSettings {
  const outer = nodes.filter((node) => !node.includes("."));
  const candidates = outer.length ? outer : [...nodes];
  const first = candidates.find((node) => node === "in") ?? candidates.find((node) => node === "pwm")
    ?? candidates.find((node) => !/^(vcc|vdd|supply|v+)$/i.test(node)) ?? candidates[0] ?? "ground";
  const second = candidates.find((node) => node === "out") ?? candidates.at(-1) ?? first;
  const others = candidates.filter((node) => node !== first && node !== second);
  return {
    channels: CHANNEL_IDS.map((id, index) => ({
      id,
      enabled: index < 2 && nodes.length > 0,
      node: [first, second, others[0] ?? first, others[1] ?? second][index],
      reference: "ground",
      voltsPerDivision: 1,
      position: 0,
      coupling: "DC",
      color: index + 1,
      name: "",
    })),
    secondsPerDivision: 1e-3,
    trigger: { mode: "auto", source: "CH1", edge: "rising", level: 0, position: 0.5 },
    wheel: "time",
    active: "CH1",
    cursors: { enabled: false, axis: "time", first: 0.3, second: 0.7 },
    phosphor: false,
    display: "time",
  };
}

/** The probes the server measures for these channels: the tip's node against the clip's. */
export function probesOf(settings: ScopeSettings): { channel: string; quantity?: "CURRENT"; positive: string; negative: string; part?: string }[] {
  return settings.channels.filter((channel) => channel.enabled).map((channel) => channel.quantity === "current"
    // A current clamp: the server reads the current into the part's first terminal.
    ? { channel: channel.id, quantity: "CURRENT" as const, positive: "0", negative: "0", part: channel.part }
    : {
      channel: channel.id,
      positive: channel.node === "ground" ? "0" : channel.node,
      negative: channel.reference === "ground" ? "0" : channel.reference,
    });
}

/**
 * What every node is wired to, as a probe list names it: `a` reads "V1 +, D1 anode, D4 cathode", so a reader picks a
 * point by what is there rather than by a letter. The circuit's ground is "ground".
 */
export function nodeConnections(elements: readonly CircuitElement[]): Record<string, string> {
  const touching = new Map<string, string[]>();
  const add = (node: string | null | undefined, terminal: string) => {
    if (node) {
      touching.set(node, [...(touching.get(node) ?? []), terminal]);
    }
  };
  for (const element of elements) {
    if (element.type === "MODEL") {
      Object.entries(element.pins ?? {}).forEach(([pin, node]) => add(node, `${element.id} ${pin}`));
    } else {
      add(element.positive, `${element.id} +`);
      add(element.negative, `${element.id} −`);
    }
  }
  return Object.fromEntries([...touching].map(([node, terminals]) => [node, terminals.join(", ")]));
}

/** The settings with every channel on `nodes`: a tip on a node that is gone is off and on ground, a clip goes to ground. */
export function withinNodes(settings: ScopeSettings, nodes: readonly string[]): ScopeSettings {
  const present = (node: string) => node === "ground" || nodes.includes(node);
  // A current clamp is on a part, not a node: the nodes say nothing about it.
  if (settings.channels.every((channel) => channel.quantity === "current" || (present(channel.node) && present(channel.reference)))) {
    return settings;
  }
  return { ...settings, channels: settings.channels.map((channel) => channel.quantity === "current" ? channel : ({ ...channel,
    ...(present(channel.node) ? {} : { node: "ground", enabled: false }),
    ...(present(channel.reference) ? {} : { reference: "ground" }) })) };
}

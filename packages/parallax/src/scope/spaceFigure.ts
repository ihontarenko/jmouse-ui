import type { SampleMemory, ScopeChannel, ScopeSettings, Window } from "../oscilloscope";
import type { Polyline, PolylinesDataset } from "../visual";

/** Half the box the XYZ figure is drawn in, in divisions: eight divisions along every axis, as tall as the screen. */
export const SPACE_HALF_DIVISIONS = 4;

/** The three channels an XYZ figure is drawn from — the first three on: across, up, and into the screen. */
export interface SpaceChannels {
  across: ScopeChannel;
  up: ScopeChannel;
  depth: ScopeChannel;
}

export function spaceChannels(settings: ScopeSettings): SpaceChannels | null {
  const [across, up, depth] = settings.channels.filter((channel) => channel.enabled);
  return across && up && depth ? { across, up, depth } : null;
}

/**
 * Three signals as one figure in space, sample by sample over the window — XY with a third axis: the first channel
 * across, the second up, the third into the screen, each in its own divisions about its zero. Seen from the front it
 * is the XY figure of the first two. Space draws its height along z, so the second channel goes there. An
 * acquisition's end breaks the figure as it breaks a trace.
 */
export function spaceFigure(memory: SampleMemory, channels: SpaceChannels, view: Window): PolylinesDataset {
  const { across, up, depth } = channels;
  const lines: Polyline[] = [];
  let points: number[] = [];
  const close = () => {
    if (points.length >= 6) {
      lines.push({ points, closed: false });
    }
    points = [];
  };
  const first = Math.max(0, memory.indexAt(view.start));
  const last = Math.min(memory.length, memory.indexAt(view.start + view.span) + 1);
  for (let index = first; index < last; index++) {
    const x = memory.reading(across.id, index);
    const y = memory.reading(up.id, index);
    const z = memory.reading(depth.id, index);
    if (!memory.continues(index)) {
      close();
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      close();
      continue;
    }
    points.push(x / across.voltsPerDivision + across.position, z / depth.voltsPerDivision + depth.position, y / up.voltsPerDivision + up.position);
  }
  close();
  return figureDataset(lines);
}

/**
 * The box of divisions the figure stands in: its twelve edges. It also fixes the figure's frame — space scales what
 * it draws to its bounds, and a frame that followed the signal would make the figure breathe with every sweep.
 */
export function spaceBox(): PolylinesDataset {
  const half = SPACE_HALF_DIVISIONS;
  const corner = (x: number, y: number, z: number) => [x * half, y * half, z * half];
  const edge = (from: number[], to: number[]): Polyline => ({ points: [...from, ...to], closed: false });
  const lines: Polyline[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      lines.push(edge(corner(-1, a, b), corner(1, a, b)));
      lines.push(edge(corner(a, -1, b), corner(a, 1, b)));
      lines.push(edge(corner(a, b, -1), corner(a, b, 1)));
    }
  }
  return figureDataset(lines);
}

/**
 * Space fits a surface's height into 1.3 where its width gets 2 (`SpaceFrame`) — a landscape, not a cube. The figure's
 * bounds declare its height that much shorter, so a division up is as long as a division across: a sphere stays round.
 */
const SPACE_HEIGHT_SHARE = 1.3 / 2;

function figureDataset(lines: Polyline[]): PolylinesDataset {
  const half = SPACE_HALF_DIVISIONS;
  const height = half * SPACE_HEIGHT_SHARE;
  return { format: "POLYLINES", shape: "LINES", canvas: "SPACE", dimension: 3, lines, minimum: [-half, -half, -height], maximum: [half, half, height] };
}

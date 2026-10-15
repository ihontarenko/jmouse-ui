import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Rope, stripePath, type RopeOptions, type RopePoint } from "@jmouse/parallax/tether";

/**
 * A rope a drawing hangs: its id, the points it is held at — its two ends and every point it is hung through —, and,
 * when it is not a lead, how it hangs: a leader from a text is the same rope, drawn taut.
 */
export interface TetherSpec {
  id: string;
  holds: readonly RopePoint[];
  options?: RopeOptions;
}

/** Where a rope was let go: which one, the point, and between which two of its holds — the span it was taken by. */
export interface TetherRelease {
  id: string;
  at: RopePoint;
  span: number;
}

export interface Tethers {
  /** Each rope's shape at rest, as an SVG path; what is drawn until it moves. */
  shapes: ReadonlyMap<string, string>;
  /** Each rope's stripes at rest — slanted marks along it —, for a rope drawn striped. */
  stripes: ReadonlyMap<string, string>;
  grab: (id: string, at: RopePoint) => void;
  pull: (to: RopePoint) => void;
  release: () => TetherRelease | null;
  /** Whether a lead stays where it is laid — on the table nothing pulls it, so letting go needs no point to hang it from. */
  laid: boolean;
}

/**
 * The ropes of a drawing in `container`. While one moves — an end moved, it was pulled, it was let go — it is stepped
 * every animation frame and every element marked `data-tether="<id>"` takes its shape, without React; at rest the
 * shapes are handed back to be drawn. A reader who asks for reduced motion sees every rope at rest at once.
 */
export function useTethers(container: RefObject<Element | null>, tethers: readonly TetherSpec[], options: RopeOptions = {}): Tethers {
  const ropes = useRef(new Map<string, Rope>());
  const frame = useRef<number | null>(null);
  const held = useRef<string | null>(null);
  const [shapes, setShapes] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [stripes, setStripes] = useState<ReadonlyMap<string, string>>(() => new Map());

  // An element marked `data-tether` takes the rope's shape; one marked `data-tether-stripes` its stripes.
  const draw = useCallback((id: string, rope: Rope) => {
    const host = container.current;
    if (!host) {
      return;
    }
    const escaped = CSS.escape(id);
    const path = rope.path();
    host.querySelectorAll(`[data-tether="${escaped}"]`).forEach((element) => element.setAttribute("d", path));
    const striped = host.querySelectorAll(`[data-tether-stripes="${escaped}"]`);
    if (striped.length) {
      const marks = stripePath(rope.chain());
      striped.forEach((element) => element.setAttribute("d", marks));
    }
  }, [container]);

  const atRest = useCallback(() => {
    frame.current = null;
    setShapes(new Map([...ropes.current].map(([id, rope]) => [id, rope.path()])));
    setStripes(new Map([...ropes.current].map(([id, rope]) => [id, stripePath(rope.chain())])));
  }, []);

  const animate = useCallback(() => {
    if (frame.current !== null) {
      return;
    }
    // A page nobody sees draws no frames: its ropes come to rest at once, so they are right when it is seen again.
    if (document.hidden || reducedMotion()) {
      ropes.current.forEach((rope, id) => {
        rope.settle();
        draw(id, rope);
      });
      atRest();
      return;
    }
    const tick = () => {
      let moving = false;
      ropes.current.forEach((rope, id) => {
        if (rope.moving) {
          moving = rope.step() || moving;
          draw(id, rope);
        }
      });
      if (moving) {
        frame.current = requestAnimationFrame(tick);
      } else {
        atRest();
      }
    };
    frame.current = requestAnimationFrame(tick);
  }, [draw, atRest]);

  const key = JSON.stringify(tethers.map((tether) => [tether.id, tether.holds.map((hold) => [hold.x, hold.y])]));
  // Ropes of another nature — the reader changed how leads lie — are hung again, as they are now.
  const nature = JSON.stringify(options);
  const hungAs = useRef(nature);
  if (hungAs.current !== nature) {
    hungAs.current = nature;
    ropes.current.clear();
  }
  useEffect(() => {
    const wanted = new Set(tethers.map((tether) => tether.id));
    let created = false;
    for (const tether of tethers) {
      const rope = ropes.current.get(tether.id);
      if (rope) {
        rope.hang(tether.holds);
      } else {
        // A rope that appears hangs at rest at once: only what moves afterwards swings.
        ropes.current.set(tether.id, new Rope(tether.holds, tether.options ?? options));
        created = true;
      }
    }
    ropes.current.forEach((_rope, id) => {
      if (!wanted.has(id)) {
        ropes.current.delete(id);
      }
    });
    if ([...ropes.current.values()].some((rope) => rope.moving)) {
      animate();
    } else if (created || wanted.size !== shapes.size) {
      atRest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` and `nature` stand for the ropes, their holds and how they move
  }, [key, nature]);

  useEffect(() => () => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      // A cancelled frame is no frame: left set, every later `animate()` took the ropes for already moving and returned —
      // under React's double-mounted effects a fresh sheet never drew its leads as ropes, nor their stripes.
      frame.current = null;
    }
  }, []);

  const grab = useCallback((id: string, at: RopePoint) => {
    const rope = ropes.current.get(id);
    if (!rope) {
      return;
    }
    held.current = id;
    rope.grab(at);
    animate();
  }, [animate]);

  const pull = useCallback((to: RopePoint) => {
    const rope = held.current ? ropes.current.get(held.current) : undefined;
    if (rope) {
      rope.pull(to);
      if (reducedMotion()) {
        rope.settle();
        draw(held.current!, rope);
      }
    }
  }, [draw]);

  const release = useCallback((): TetherRelease | null => {
    const id = held.current;
    held.current = null;
    const rope = id ? ropes.current.get(id) : undefined;
    const letGo = rope?.release();
    if (!id || !letGo) {
      return null;
    }
    animate();
    return { id, at: letGo.at, span: letGo.span };
  }, [animate]);

  return { shapes, stripes, grab, pull, release, laid: (options.gravity ?? 1) === 0 };
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

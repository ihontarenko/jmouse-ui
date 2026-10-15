/**
 * The reader's hands on a canvas, as gestures: a drag, a pinch, a wheel, a key, a pointing, a double click. What a
 * gesture does — pan the plane, turn the space — is the stage's; this only recognises them.
 */
export interface Gestures {
  drag(deltaX: number, deltaY: number): void;
  zoom(factor: number, x: number, y: number): void;
  key(key: string): boolean;
  hover(x: number, y: number): void;
  leave(): void;
  doubleClick(x: number, y: number, shift: boolean): void;
}

export function connectGestures(element: HTMLElement, gestures: Gestures): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  const local = (event: { clientX: number; clientY: number }) => {
    const bounds = element.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const listeners: [string, EventListener, AddEventListenerOptions?][] = [
    ["pointerdown", ((event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      element.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, local(event));
    }) as EventListener],
    ["pointermove", ((event: PointerEvent) => {
      const point = local(event);
      const previous = pointers.get(event.pointerId);
      if (!previous) {
        gestures.hover(point.x, point.y);
        return;
      }
      if (pointers.size === 2) {
        const others = [...pointers.entries()].filter(([identifier]) => identifier !== event.pointerId).map(([, position]) => position);
        const other = others[0];
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(point.x - other.x, point.y - other.y);
        if (before > 0) {
          gestures.zoom(after / before, (point.x + other.x) / 2, (point.y + other.y) / 2);
        }
      } else {
        gestures.drag(point.x - previous.x, point.y - previous.y);
      }
      pointers.set(event.pointerId, point);
    }) as EventListener],
    ["pointerup", ((event: PointerEvent) => {
      pointers.delete(event.pointerId);
    }) as EventListener],
    ["pointercancel", ((event: PointerEvent) => {
      pointers.delete(event.pointerId);
    }) as EventListener],
    ["pointerleave", (() => {
      if (pointers.size === 0) {
        gestures.leave();
      }
    }) as EventListener],
    ["wheel", ((event: WheelEvent) => {
      event.preventDefault();
      const point = local(event);
      gestures.zoom(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0015)), point.x, point.y);
    }) as EventListener, { passive: false }],
    ["dblclick", ((event: MouseEvent) => {
      const point = local(event);
      gestures.doubleClick(point.x, point.y, event.shiftKey);
    }) as EventListener],
    ["keydown", ((event: KeyboardEvent) => {
      if (gestures.key(event.key)) {
        event.preventDefault();
      }
    }) as EventListener],
  ];
  element.style.touchAction = "none";
  if (!element.hasAttribute("tabindex")) {
    element.tabIndex = 0;
  }
  for (const [name, listener, options] of listeners) {
    element.addEventListener(name, listener, options);
  }
  return () => {
    for (const [name, listener, options] of listeners) {
      element.removeEventListener(name, listener, options);
    }
  };
}

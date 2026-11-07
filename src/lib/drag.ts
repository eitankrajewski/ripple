import { create } from "zustand";
import type { OrderView, StationId } from "../engine/types";
import { haptic } from "./haptics";

export type DropTarget = StationId | "ready";

export const DROP_LABEL: Record<DropTarget, string> = { prep: "Prep", cook: "Cook", pack: "Pack", ready: "Ready shelf" };

export function stageOf(o: OrderView): DropTarget | null {
  switch (o.status) {
    case "queued":
    case "prepping":
    case "blocked":
      return "prep";
    case "cooking":
      return "cook";
    case "packing":
      return "pack";
    case "ready":
      return "ready";
    default:
      return null;
  }
}

interface DragState {
  order: OrderView | null;
  x: number;
  y: number;
  over: DropTarget | null;
}

export const useDrag = create<DragState>(() => ({ order: null, x: 0, y: 0, over: null }));

function targetAt(x: number, y: number): DropTarget | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const t = (el as HTMLElement).closest<HTMLElement>("[data-drop]");
    if (t) return t.dataset.drop as DropTarget;
  }
  return null;
}

function swallowNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
}

/**
 * Pointer-based drag that works for mouse, pen and touch. Drop targets are any element with
 * `data-drop="prep|cook|pack|ready"` (board columns and the 3D station labels).
 */
export function startOrderDrag(e: React.PointerEvent, order: OrderView, onDrop: (to: DropTarget) => void) {
  if (e.button !== 0) return;
  const el = e.currentTarget as HTMLElement;
  const sx = e.clientX;
  const sy = e.clientY;
  let dragging = false;
  let over: DropTarget | null = null;

  const move = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      dragging = true;
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {
        /* element may be gone */
      }
      haptic("pick");
    }
    ev.preventDefault();
    const now = targetAt(ev.clientX, ev.clientY);
    if (now !== over) {
      over = now;
      if (now) haptic("tick");
    }
    useDrag.setState({ order, x: ev.clientX, y: ev.clientY, over });
  };
  const end = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    if (!dragging) return;
    swallowNextClick();
    const to = ev.type === "pointercancel" ? null : targetAt(ev.clientX, ev.clientY);
    useDrag.setState({ order: null, over: null });
    if (to && to !== stageOf(order)) {
      haptic("drop");
      onDrop(to);
    }
  };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
}

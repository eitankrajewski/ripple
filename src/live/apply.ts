import { advanceTo, approveStrategy, cancelOrder, createLiveKitchen, ingestEvent, releaseOrder, type Kitchen } from "../engine/engine";
import { allowed } from "./roles";
import type { LiveEvent, Member } from "./types";

export const byOrder = (a: LiveEvent, b: LiveEvent) => a.at - b.at || a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Applies one event to a live kitchen. Pure function of (kitchen, event): every device converges. */
export function applyLiveEvent(k: Kitchen, e: LiveEvent) {
  advanceTo(k, e.at);
  if (!allowed(e.actor.role, e.action)) return;
  const by = `${e.actor.name} (${e.actor.role})`;
  const a = e.action;
  switch (a.type) {
    case "order_received":
      ingestEvent(k, { type: "order_received", source: a.source, customer: a.customer, items: a.items });
      break;
    case "task_done":
      ingestEvent(k, { type: "task_done", orderId: a.orderId, station: a.station, by });
      break;
    case "picked_up":
      ingestEvent(k, { type: "picked_up", orderId: a.orderId, by });
      break;
    case "stock_correction":
      ingestEvent(k, { type: "stock_correction", ingredientId: a.ingredientId, newStock: a.newStock });
      break;
    case "approve_plan":
      approveStrategy(k, a.plan);
      break;
    case "release_order":
      releaseOrder(k, a.orderId);
      break;
    case "cancel_order":
      cancelOrder(k, a.orderId);
      break;
  }
}

export function replay(startedAt: number, events: LiveEvent[]) {
  const k = createLiveKitchen(startedAt);
  for (const e of [...events].sort(byOrder)) applyLiveEvent(k, e);
  return k;
}

export function membersFrom(events: LiveEvent[]): Member[] {
  const m = new Map<string, Member>();
  for (const e of [...events].sort(byOrder)) {
    if (e.action.type === "member_joined") m.set(e.action.member.id, e.action.member);
    if (e.action.type === "member_left") m.delete(e.action.memberId);
  }
  return [...m.values()];
}
